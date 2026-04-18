const https = require("https");
const url = require("url");
const log = require("../observability/logger");
const { supabaseAdmin } = require("../db/supabaseAdmin");
const { encrypt, decrypt, signState, verifyState } = require("./crypto");

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = "https://bridgeserver.ted.paris/auth/google/contacts/callback";
const DASHBOARD_URL = process.env.DASHBOARD_URL || "https://call-screening-bot.lovable.app";
const SCOPES = ["https://www.googleapis.com/auth/contacts.readonly"].join(" ");

/** GET /auth/google/contacts/start?account_id=...&token=... */
async function handleGoogleContactsStart(req, res) {
  try {
    const query = url.parse(req.url, true).query;
    const { account_id, token } = query;
    if (!account_id || !token) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      return res.end("Missing account_id or token");
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      res.writeHead(401, { "Content-Type": "text/plain" });
      return res.end("Invalid token");
    }

    const { data: membership } = await supabaseAdmin
      .from("account_members")
      .select("role")
      .eq("profile_id", user.id)
      .eq("account_id", account_id)
      .single();
    if (!membership) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      return res.end("Not a member of this account");
    }

    const state = signState({
      account_id,
      profile_id: user.id,
      kind: "contacts",
      nonce: Math.random().toString(36).slice(2),
    });

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", SCOPES);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent select_account");
    authUrl.searchParams.set("state", state);
    if (user.email) authUrl.searchParams.set("login_hint", user.email);

    log.info("google_contacts_oauth_start", null, `user=${user.id}`);
    res.writeHead(302, { Location: authUrl.toString() });
    res.end();
  } catch (err) {
    log.error("google_contacts_oauth_start_error", null, err.message);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal server error");
  }
}

/** GET /auth/google/contacts/callback */
async function handleGoogleContactsCallback(req, res) {
  try {
    const query = url.parse(req.url, true).query;
    const { code, state, error: oauthError } = query;
    const redirectBase = `${DASHBOARD_URL}/who`;

    if (oauthError) {
      res.writeHead(302, { Location: `${redirectBase}?import=google&status=error&reason=${oauthError}` });
      return res.end();
    }
    const payload = verifyState(state);
    if (!payload || payload.kind !== "contacts") {
      res.writeHead(302, { Location: `${redirectBase}?import=google&status=error&reason=invalid_state` });
      return res.end();
    }
    const { account_id, profile_id } = payload;

    const tokens = await exchangeCodeForTokens(code);
    if (!tokens) {
      res.writeHead(302, { Location: `${redirectBase}?import=google&status=error&reason=token_exchange_failed` });
      return res.end();
    }

    const accessTokenEnc = encrypt(tokens.access_token);
    const refreshTokenEnc = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    await supabaseAdmin
      .from("contact_import_connections")
      .upsert(
        {
          account_id,
          profile_id,
          provider: "google",
          access_token_encrypted: accessTokenEnc,
          refresh_token_encrypted: refreshTokenEnc,
          token_expires_at: expiresAt,
          scopes: SCOPES.split(" "),
          status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "account_id,profile_id,provider" }
      );

    // Run import immediately
    const result = await importGoogleContacts(account_id, tokens.access_token);

    const params = new URLSearchParams({
      import: "google",
      status: "success",
      imported: String(result.imported),
      skipped: String(result.skipped),
    });
    res.writeHead(302, { Location: `${redirectBase}?${params.toString()}` });
    res.end();
  } catch (err) {
    log.error("google_contacts_oauth_callback_error", null, err.message);
    res.writeHead(302, { Location: `${DASHBOARD_URL}/who?import=google&status=error&reason=internal` });
    res.end();
  }
}

/** POST /contacts/google/import?account_id=...&token=... — re-run import using stored token */
async function handleGoogleContactsImport(req, res) {
  try {
    const query = url.parse(req.url, true).query;
    const { account_id, token } = query;
    if (!account_id || !token) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "missing_params" }));
    }
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      res.writeHead(401, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "unauthorized" }));
    }
    const { data: membership } = await supabaseAdmin
      .from("account_members")
      .select("role")
      .eq("profile_id", user.id)
      .eq("account_id", account_id)
      .single();
    if (!membership) {
      res.writeHead(403, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "forbidden" }));
    }

    const { data: conn } = await supabaseAdmin
      .from("contact_import_connections")
      .select("*")
      .eq("account_id", account_id)
      .eq("provider", "google")
      .eq("status", "active")
      .maybeSingle();

    if (!conn) {
      res.writeHead(404, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      return res.end(JSON.stringify({ error: "no_connection" }));
    }

    let accessToken = conn.access_token_encrypted ? decrypt(conn.access_token_encrypted) : null;
    if (!accessToken || (conn.token_expires_at && new Date(conn.token_expires_at) <= new Date())) {
      if (!conn.refresh_token_encrypted) {
        res.writeHead(401, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        return res.end(JSON.stringify({ error: "token_expired_no_refresh" }));
      }
      const refreshed = await refreshAccessToken(decrypt(conn.refresh_token_encrypted));
      if (!refreshed) {
        res.writeHead(401, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        return res.end(JSON.stringify({ error: "refresh_failed" }));
      }
      accessToken = refreshed.access_token;
      await supabaseAdmin
        .from("contact_import_connections")
        .update({
          access_token_encrypted: encrypt(accessToken),
          token_expires_at: refreshed.expires_in
            ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conn.id);
    }

    const result = await importGoogleContacts(account_id, accessToken);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(result));
  } catch (err) {
    log.error("google_contacts_import_error", null, err.message);
    res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ error: "internal" }));
  }
}

function exchangeCodeForTokens(code) {
  return postForm("https://oauth2.googleapis.com/token", {
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
  });
}

function refreshAccessToken(refreshToken) {
  return postForm("https://oauth2.googleapis.com/token", {
    refresh_token: refreshToken,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    grant_type: "refresh_token",
  });
}

function postForm(targetUrl, params) {
  return new Promise((resolve) => {
    const body = new URLSearchParams(params).toString();
    const req = https.request(
      targetUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            resolve(json.access_token ? json : null);
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on("error", () => resolve(null));
    req.write(body);
    req.end();
  });
}

function fetchPeoplePage(accessToken, pageToken) {
  return new Promise((resolve) => {
    const params = new URLSearchParams({
      personFields: "names,phoneNumbers,emailAddresses,organizations",
      pageSize: "200",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const u = `https://people.googleapis.com/v1/people/me/connections?${params.toString()}`;
    https
      .get(u, { headers: { Authorization: `Bearer ${accessToken}` } }, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(null);
          }
        });
      })
      .on("error", () => resolve(null));
  });
}

function normalizePhone(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/[\s\-().]/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("00")) return "+" + cleaned.slice(2);
  if (cleaned.startsWith("0")) return "+33" + cleaned.slice(1);
  return cleaned;
}

async function importGoogleContacts(accountId, accessToken) {
  let imported = 0;
  let skipped = 0;
  let pageToken = null;
  const seenPhones = new Set();

  // Pre-load existing phones to dedupe
  const { data: existing } = await supabaseAdmin
    .from("contacts")
    .select("primary_phone_e164")
    .eq("account_id", accountId);
  (existing || []).forEach((c) => c.primary_phone_e164 && seenPhones.add(c.primary_phone_e164));

  // Find the "Non classés" default group for this account
  const { data: defaultGroup } = await supabaseAdmin
    .from("caller_groups")
    .select("id")
    .eq("account_id", accountId)
    .eq("slug", "default_group")
    .maybeSingle();
  const defaultGroupId = defaultGroup ? defaultGroup.id : null;

  do {
    const page = await fetchPeoplePage(accessToken, pageToken);
    if (!page) break;
    const connections = page.connections || [];

    for (const person of connections) {
      const name = (person.names && person.names[0]) || {};
      const phoneRaw = (person.phoneNumbers && person.phoneNumbers[0] && person.phoneNumbers[0].value) || null;
      const email = (person.emailAddresses && person.emailAddresses[0] && person.emailAddresses[0].value) || null;
      const org = (person.organizations && person.organizations[0] && person.organizations[0].name) || null;
      const phone = normalizePhone(phoneRaw);

      if (!phone && !email) {
        skipped++;
        continue;
      }
      if (phone && seenPhones.has(phone)) {
        skipped++;
        continue;
      }

      const { data: inserted, error } = await supabaseAdmin
        .from("contacts")
        .insert({
          account_id: accountId,
          first_name: name.givenName || null,
          last_name: name.familyName || null,
          display_name: name.displayName || null,
          primary_phone_e164: phone,
          email,
          company_name: org,
          source: "google_import",
          external_source_id: person.resourceName || null,
          is_favorite: false,
          is_blocked: false,
        })
        .select("id")
        .single();

      if (error || !inserted) {
        skipped++;
      } else {
        imported++;
        if (phone) seenPhones.add(phone);
        if (defaultGroupId) {
          await supabaseAdmin.from("contact_group_memberships").insert({
            account_id: accountId,
            contact_id: inserted.id,
            caller_group_id: defaultGroupId,
          });
        }
      }
    }

    pageToken = page.nextPageToken || null;
  } while (pageToken);

  log.info("google_contacts_import", null, `account=${accountId} imported=${imported} skipped=${skipped}`);
  return { imported, skipped };
}

module.exports = {
  handleGoogleContactsStart,
  handleGoogleContactsCallback,
  handleGoogleContactsImport,
};
