const https = require("https");
const log = require("../observability/logger");
const { supabaseAdmin } = require("../db/supabaseAdmin");
const { decrypt, encrypt } = require("../auth/crypto");

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// ─── Token refresh ───────────────────────────────────────────

/**
 * Get a valid access token for the given account.
 * Refreshes automatically if expired.
 * Returns { accessToken, connection } or throws.
 */
async function getValidAccessToken(accountId, traceId) {
  const { data: conn, error } = await supabaseAdmin
    .from("calendar_connections")
    .select("*")
    .eq("account_id", accountId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !conn) {
    throw new Error("No active calendar connection for this account.");
  }

  const now = Date.now();
  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  const bufferMs = 5 * 60 * 1000; // refresh 5 min before expiry

  if (expiresAt - bufferMs > now) {
    // Token still valid
    return { accessToken: decrypt(conn.access_token_encrypted), connection: conn };
  }

  // Token expired or about to expire — refresh
  log.info("google_token_refresh", traceId, `Refreshing token for account ${accountId}`);

  if (!conn.refresh_token_encrypted) {
    throw new Error("No refresh token available. User needs to reconnect Google Calendar.");
  }

  const refreshToken = decrypt(conn.refresh_token_encrypted);
  const tokens = await refreshAccessToken(refreshToken, traceId);

  if (!tokens) {
    // Mark connection as expired
    await supabaseAdmin
      .from("calendar_connections")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", conn.id);
    throw new Error("Failed to refresh Google token. Connection marked as expired.");
  }

  // Update DB with new access token
  const newExpiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;

  await supabaseAdmin
    .from("calendar_connections")
    .update({
      access_token_encrypted: encrypt(tokens.access_token),
      token_expires_at: newExpiresAt,
      // Google may issue a new refresh token
      ...(tokens.refresh_token
        ? { refresh_token_encrypted: encrypt(tokens.refresh_token) }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", conn.id);

  log.info("google_token_refreshed", traceId, `New token expires at ${newExpiresAt}`);
  return { accessToken: tokens.access_token, connection: conn };
}

function refreshAccessToken(refreshToken, traceId) {
  return new Promise((resolve) => {
    const body = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
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
              log.error("google_token_refresh_no_token", traceId, data);
              resolve(null);
            }
          } catch {
            log.error("google_token_refresh_parse", traceId, data);
            resolve(null);
          }
        });
      }
    );
    req.on("error", (err) => {
      log.error("google_token_refresh_error", traceId, err.message);
      resolve(null);
    });
    req.write(body);
    req.end();
  });
}

// ─── Google Calendar API helpers ─────────────────────────────

function googleApiRequest(method, path, accessToken, body) {
  return new Promise((resolve, reject) => {
    const options = {
      method,
      hostname: "www.googleapis.com",
      path,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json);
          } else {
            reject(new Error(`Google API ${res.statusCode}: ${JSON.stringify(json.error || json)}`));
          }
        } catch {
          reject(new Error(`Google API parse error: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ─── check_availability ──────────────────────────────────────

/**
 * Check availability across all is_watched calendars using Google freebusy API.
 * Returns { busy: [...], free: [...] } within the requested range.
 */
async function checkAvailability(accountId, timeMin, timeMax, traceId) {
  const { accessToken, connection } = await getValidAccessToken(accountId, traceId);

  // Get watched calendars
  const { data: calendars } = await supabaseAdmin
    .from("calendar_calendars")
    .select("provider_calendar_id")
    .eq("calendar_connection_id", connection.id)
    .eq("is_watched", true);

  if (!calendars || calendars.length === 0) {
    throw new Error("No calendars selected for availability checking. Please configure watched calendars.");
  }

  const items = calendars.map((c) => ({ id: c.provider_calendar_id }));

  log.tool("check_availability_request", traceId,
    `calendars=${items.map(i => i.id).join(",")}, range=${timeMin}→${timeMax}`);

  const freebusyResult = await googleApiRequest(
    "POST",
    "/calendar/v3/freeBusy",
    accessToken,
    {
      timeMin,
      timeMax,
      timeZone: "Europe/Paris",
      items,
    }
  );

  // Merge all busy periods
  const allBusy = [];
  for (const calId of Object.keys(freebusyResult.calendars || {})) {
    const cal = freebusyResult.calendars[calId];
    if (cal.busy) {
      allBusy.push(...cal.busy);
    }
  }

  // Sort busy periods
  allBusy.sort((a, b) => new Date(a.start) - new Date(b.start));

  // Compute free slots
  const free = [];
  let cursor = new Date(timeMin);
  const end = new Date(timeMax);

  for (const busy of allBusy) {
    const busyStart = new Date(busy.start);
    const busyEnd = new Date(busy.end);
    if (cursor < busyStart) {
      free.push({ start: cursor.toISOString(), end: busyStart.toISOString() });
    }
    if (busyEnd > cursor) cursor = busyEnd;
  }
  if (cursor < end) {
    free.push({ start: cursor.toISOString(), end: end.toISOString() });
  }

  log.tool("check_availability_result", traceId,
    `busy=${allBusy.length} periods, free=${free.length} slots`);

  return { busy: allBusy, free };
}

// ─── book_appointment ────────────────────────────────────────

/**
 * Create a Google Calendar event on the is_target calendar
 * and record it in the appointments table.
 */
async function bookAppointment(accountId, { title, startTime, endTime, attendeeName, attendeePhone, callSessionId }, traceId) {
  const { accessToken, connection } = await getValidAccessToken(accountId, traceId);

  // Get target calendar
  const { data: targetCal } = await supabaseAdmin
    .from("calendar_calendars")
    .select("provider_calendar_id")
    .eq("calendar_connection_id", connection.id)
    .eq("is_target", true)
    .maybeSingle();

  if (!targetCal) {
    throw new Error("No target calendar configured for booking. Please select a calendar for appointments.");
  }

  const calendarId = encodeURIComponent(targetCal.provider_calendar_id);

  // Build event
  const event = {
    summary: title || "Rendez-vous",
    description: [
      attendeeName ? `Contact: ${attendeeName}` : null,
      attendeePhone ? `Téléphone: ${attendeePhone}` : null,
      "Réservé par l'assistant téléphonique",
    ].filter(Boolean).join("\n"),
    start: { dateTime: startTime, timeZone: "Europe/Paris" },
    end: { dateTime: endTime, timeZone: "Europe/Paris" },
  };

  log.tool("book_appointment_request", traceId,
    `calendar=${targetCal.provider_calendar_id}, title=${title}, ${startTime}→${endTime}`);

  const created = await googleApiRequest(
    "POST",
    `/calendar/v3/calendars/${calendarId}/events`,
    accessToken,
    event
  );

  // Also store in appointments table for internal tracking
  // Try to find contact_id from phone
  let contactId = null;
  if (attendeePhone) {
    const { data: contact } = await supabaseAdmin
      .from("contacts")
      .select("id")
      .eq("account_id", accountId)
      .or(`primary_phone_e164.eq.${attendeePhone},secondary_phone_e164.eq.${attendeePhone}`)
      .maybeSingle();
    if (contact) contactId = contact.id;
  }

  await supabaseAdmin.from("appointments").insert({
    account_id: accountId,
    title: title || "Rendez-vous",
    starts_at: startTime,
    ends_at: endTime,
    booked_by: "assistant",
    status: "confirmed",
    provider: "google",
    provider_event_id: created.id,
    contact_id: contactId,
    call_session_id: callSessionId || null,
    notes: attendeeName ? `Contact: ${attendeeName}${attendeePhone ? ` (${attendeePhone})` : ""}` : null,
  });

  log.tool("book_appointment_created", traceId,
    `eventId=${created.id}, title=${title}`);

  return {
    event_id: created.id,
    title: title || "Rendez-vous",
    start: startTime,
    end: endTime,
    calendar: targetCal.provider_calendar_id,
  };
}

module.exports = { getValidAccessToken, checkAvailability, bookAppointment };
