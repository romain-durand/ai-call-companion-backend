const https = require("https");
const url = require("url");
const log = require("../observability/logger");
const { supabaseAdmin } = require("../db/supabaseAdmin");
const { encrypt, signState, verifyState } = require("./crypto");

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = "https://bridgeserver2.ted.paris/auth/google/callback";
const SIGNIN_REDIRECT_URI = "https://bridgeserver2.ted.paris/auth/google/signin/callback";
const DASHBOARD_URL = process.env.DASHBOARD_URL || "https://call-screening-bot.lovable.app";
const APP_DEEP_LINK = "com.ted.paris.victor://auth-callback";
const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");
const SIGNIN_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");

/**
 * GET /auth/google/start?account_id=xxx&token=jwt
 */
async function handleGoogleStart(req, res) {
  try {
    const query = url.parse(req.url, true).query;
    const { account_id, token } = query;

    if (!account_id || !token) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      return res.end("Missing account_id or token");
    }

    // Verify the Supabase JWT
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      log.error("google_oauth_start", null, `JWT verification failed: ${error?.message}`);
      res.writeHead(401, { "Content-Type": "text/plain" });
      return res.end("Invalid token");
    }

    // Verify user is a member of the account
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

    // Build signed state
    const state = signState({
      account_id,
      profile_id: user.id,
      nonce: Math.random().toString(36).slice(2),
    });

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", CALENDAR_SCOPES);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent select_account");
    authUrl.searchParams.set("state", state);
    if (user.email) {
      authUrl.searchParams.set("login_hint", user.email);
    }

    log.info("google_oauth_start", null, `Redirecting user ${user.id} to Google consent`);
    res.writeHead(302, { Location: authUrl.toString() });
    res.end();
  } catch (err) {
    log.error("google_oauth_start_error", null, err.message);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal server error");
  }
}

/**
 * GET /auth/google/callback?code=xxx&state=yyy
 */
async function handleGoogleCallback(req, res) {
  try {
    const query = url.parse(req.url, true).query;
    const { code, state, error: oauthError } = query;

    if (oauthError) {
      log.error("google_oauth_callback", null, `OAuth error: ${oauthError}`);
      res.writeHead(302, { Location: `${DASHBOARD_URL}/calendar?status=error&reason=${oauthError}` });
      return res.end();
    }

    // Verify state
    const payload = verifyState(state);
    if (!payload) {
      log.error("google_oauth_callback", null, "Invalid state parameter");
      res.writeHead(302, { Location: `${DASHBOARD_URL}/calendar?status=error&reason=invalid_state` });
      return res.end();
    }

    const { account_id, profile_id } = payload;

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens) {
      res.writeHead(302, { Location: `${DASHBOARD_URL}/calendar?status=error&reason=token_exchange_failed` });
      return res.end();
    }

    // Encrypt tokens
    const accessTokenEnc = encrypt(tokens.access_token);
    const refreshTokenEnc = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    // Upsert calendar_connections
    const { data: conn, error: connErr } = await supabaseAdmin
      .from("calendar_connections")
      .upsert(
        {
          account_id,
          profile_id,
          provider: "google",
          access_token_encrypted: accessTokenEnc,
          refresh_token_encrypted: refreshTokenEnc,
          token_expires_at: expiresAt,
          scopes: CALENDAR_SCOPES.split(" "),
          status: "active",
          provider_account_id: tokens.id_token ? null : null, // Could decode id_token later
          updated_at: new Date().toISOString(),
        },
        { onConflict: "account_id,provider,profile_id" }
      )
      .select("id")
      .single();

    if (connErr) {
      log.error("google_oauth_upsert", null, connErr.message);
      // Fallback: insert without onConflict
      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from("calendar_connections")
        .insert({
          account_id,
          profile_id,
          provider: "google",
          access_token_encrypted: accessTokenEnc,
          refresh_token_encrypted: refreshTokenEnc,
          token_expires_at: expiresAt,
          scopes: CALENDAR_SCOPES.split(" "),
          status: "active",
        })
        .select("id")
        .single();

      if (insertErr) {
        log.error("google_oauth_insert", null, insertErr.message);
        res.writeHead(302, { Location: `${DASHBOARD_URL}/calendar?status=error&reason=db_error` });
        return res.end();
      }

      // Fetch calendars with the newly inserted connection
      await fetchAndStoreCalendars(tokens.access_token, account_id, inserted.id);
    } else {
      // Fetch calendars
      await fetchAndStoreCalendars(tokens.access_token, account_id, conn.id);
    }

    log.info("google_oauth_callback", null, `Calendar connected for account ${account_id}`);
    res.writeHead(302, { Location: `${DASHBOARD_URL}/calendar?status=success` });
    res.end();
  } catch (err) {
    log.error("google_oauth_callback_error", null, err.message);
    res.writeHead(302, { Location: `${DASHBOARD_URL}/calendar?status=error&reason=internal` });
    res.end();
  }
}

/**
 * Exchange authorization code for tokens via Google's token endpoint.
 */
function exchangeCodeForTokens(code, redirectUri = REDIRECT_URI) {
  return new Promise((resolve) => {
    const body = new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString();

    const req = https.request(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (json.access_token) {
              resolve(json);
            } else {
              log.error("google_token_exchange", null, `No access_token: ${data}`);
              resolve(null);
            }
          } catch {
            log.error("google_token_exchange_parse", null, data);
            resolve(null);
          }
        });
      }
    );
    req.on("error", (err) => {
      log.error("google_token_exchange_error", null, err.message);
      resolve(null);
    });
    req.write(body);
    req.end();
  });
}

/**
 * Fetch user's calendar list from Google and store in calendar_calendars.
 */
async function fetchAndStoreCalendars(accessToken, accountId, connectionId) {
  return new Promise((resolve) => {
    const req = https.request(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList",
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", async () => {
          try {
            const json = JSON.parse(data);
            const calendars = (json.items || []).map((cal) => ({
              account_id: accountId,
              calendar_connection_id: connectionId,
              provider_calendar_id: cal.id,
              name: cal.summary || cal.id,
              is_primary: cal.primary || false,
              is_read_only: cal.accessRole === "reader" || cal.accessRole === "freeBusyReader",
            }));

            if (calendars.length > 0) {
              // Delete existing calendars for this connection then insert
              await supabaseAdmin
                .from("calendar_calendars")
                .delete()
                .eq("calendar_connection_id", connectionId);

              const { error } = await supabaseAdmin
                .from("calendar_calendars")
                .insert(calendars);

              if (error) {
                log.error("google_calendars_insert", null, error.message);
              } else {
                log.info("google_calendars_synced", null, `${calendars.length} calendars stored`);
              }
            }
          } catch (err) {
            log.error("google_calendars_fetch", null, err.message);
          }
          resolve();
        });
      }
    );
    req.on("error", (err) => {
      log.error("google_calendars_fetch_error", null, err.message);
      resolve();
    });
    req.end();
  });
}

/**
 * GET /auth/google/signin/start
 * No JWT required - for new signups or existing signins
 */
async function handleGoogleSignInStart(req, res) {
  try {
    // Generate signed state for signin flow
    const state = signState({
      flow: "signin",
      nonce: Math.random().toString(36).slice(2),
    });

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", SIGNIN_REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", SIGNIN_SCOPES);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "select_account");
    authUrl.searchParams.set("state", state);

    log.info("google_signin_start", null, "Redirecting to Google OAuth");
    res.writeHead(302, { Location: authUrl.toString() });
    res.end();
  } catch (err) {
    log.error("google_signin_start_error", null, err.message);
    const errorUrl = `${APP_DEEP_LINK}?error=internal_error`;
    res.writeHead(302, { Location: errorUrl });
    res.end();
  }
}

/**
 * GET /auth/google/signin/callback?code=xxx&state=yyy
 * Creates user if new, authenticates if existing
 */
async function handleGoogleSignInCallback(req, res) {
  try {
    const query = url.parse(req.url, true).query;
    const { code, state, error: oauthError } = query;

    if (oauthError) {
      log.error("google_signin_callback", null, `OAuth error: ${oauthError}`);
      const errorUrl = `${APP_DEEP_LINK}?error=${oauthError}`;
      res.writeHead(302, { Location: errorUrl });
      return res.end();
    }

    // Verify state
    const payload = verifyState(state);
    if (!payload || payload.flow !== "signin") {
      log.error("google_signin_callback", null, "Invalid state parameter");
      const errorUrl = `${APP_DEEP_LINK}?error=invalid_state`;
      res.writeHead(302, { Location: errorUrl });
      return res.end();
    }

    // Exchange code for tokens (includes id_token with email)
    const tokens = await exchangeCodeForTokens(code, SIGNIN_REDIRECT_URI);
    if (!tokens || !tokens.id_token) {
      log.error("google_signin_callback", null, "Failed to exchange code");
      const errorUrl = `${APP_DEEP_LINK}?error=token_exchange_failed`;
      res.writeHead(302, { Location: errorUrl });
      return res.end();
    }

    // Decode id_token to get user email (basic decode, no verification needed here)
    const idTokenParts = tokens.id_token.split(".");
    const decoded = JSON.parse(Buffer.from(idTokenParts[1], "base64").toString());
    const userEmail = decoded.email;
    const userName = decoded.name || userEmail.split("@")[0];

    if (!userEmail) {
      log.error("google_signin_callback", null, "No email in id_token");
      const errorUrl = `${APP_DEEP_LINK}?error=no_email`;
      res.writeHead(302, { Location: errorUrl });
      return res.end();
    }

    // Check if user exists
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    const user = existingUser?.users?.find((u) => u.email === userEmail);

    let userId;
    if (user) {
      // User exists - sign in
      userId = user.id;
      log.info("google_signin_callback", null, `Existing user signed in: ${userId}`);
    } else {
      // New user - create account
      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: userEmail,
        user_metadata: { full_name: userName },
        email_confirm: true, // Auto-confirm Google emails
      });

      if (createErr || !newUser) {
        log.error("google_signin_create_user", null, createErr?.message || "Unknown error");
        const errorUrl = `${APP_DEEP_LINK}?error=user_creation_failed`;
        res.writeHead(302, { Location: errorUrl });
        return res.end();
      }

      userId = newUser.id;
      log.info("google_signin_callback", null, `New user created: ${userId}`);
    }

    // Generate session - use admin to create session token
    const { data: { session }, error: sessionErr } = await supabaseAdmin.auth.admin.createSession(userId);

    if (sessionErr || !session) {
      log.error("google_signin_session", null, sessionErr?.message || "Failed to create session");
      const errorUrl = `${APP_DEEP_LINK}?error=session_failed`;
      res.writeHead(302, { Location: errorUrl });
      return res.end();
    }

    // Return deep link with session
    const deepLink = `${APP_DEEP_LINK}?session=${session.access_token}&refresh=${session.refresh_token}&user=${userId}`;
    log.info("google_signin_success", null, `User ${userId} authenticated`);
    res.writeHead(302, { Location: deepLink });
    res.end();
  } catch (err) {
    log.error("google_signin_callback_error", null, err.message);
    const errorUrl = `${APP_DEEP_LINK}?error=internal_error`;
    res.writeHead(302, { Location: errorUrl });
    res.end();
  }
}

module.exports = { handleGoogleStart, handleGoogleCallback, handleGoogleSignInStart, handleGoogleSignInCallback };
