const log = require("../observability/logger");

const WEAK_MESSAGES = new Set([
  "bonjour", "allo", "allô", "oui", "ok", "merci", "test",
  "non", "salut", "bonsoir", "au revoir", "bye", "hello", "hi",
]);

const TEST_PATTERNS = [
  /\btest\b/i,
  /\bappel de test\b/i,
  /\bc'est un test\b/i,
  /\bceci est un test\b/i,
];

const PRIORITY_LABELS = {
  low: "basse",
  normal: "normale",
  high: "haute",
  urgent: "urgente",
};

function cleanText(text) {
  if (!text) return "";
  return text.trim().replace(/\s+/g, " ");
}

function truncate(text, max = 100) {
  if (!text || text.length <= max) return text;
  const cut = text.lastIndexOf(" ", max);
  return (cut > 20 ? text.slice(0, cut) : text.slice(0, max)) + "…";
}

function callerLabel(callbackRow, session) {
  const name =
    (callbackRow && callbackRow.caller_name) ||
    (session && session.caller_name_raw) ||
    null;
  return name ? cleanText(name) : "L'appelant";
}

/**
 * Generate a deterministic summary from structured call data.
 * Returns { summary_short, summary_long, rule }
 */
function generateDeterministicSummary({ session, callbacks, notifications, toolInvocations, messages }) {
  // RULE 1 — Callback request exists
  if (callbacks && callbacks.length > 0) {
    const cb = callbacks[0];
    const label = callerLabel(cb, session);
    const time = cleanText(cb.preferred_time_note);
    const prio = PRIORITY_LABELS[cb.priority] || cb.priority || "normale";

    const summary_short = time
      ? truncate(`${label} demande à être rappelé ${time}`)
      : truncate(`${label} demande à être rappelé`);

    let summary_long = `Une demande de rappel a été enregistrée pour ${label}, avec priorité ${prio}.`;
    if (time) summary_long += ` Rappel souhaité ${time}.`;

    return { summary_short, summary_long, rule: "callback_request" };
  }

  // RULE 2 — Notification exists but no callback
  if (notifications && notifications.length > 0) {
    const notif = notifications[0];
    let summary_long = "L'appel a donné lieu à l'envoi d'une notification à l'utilisateur.";
    if (notif.priority && notif.priority !== "normal") {
      summary_long += ` Priorité : ${notif.priority}.`;
    }
    return {
      summary_short: "Notification envoyée à l'utilisateur",
      summary_long,
      rule: "notification",
    };
  }

  // RULE 3 — Known tool invocation
  if (toolInvocations && toolInvocations.length > 0) {
    for (const inv of toolInvocations) {
      const name = inv.tool_name;
      if (name === "create_callback") {
        return {
          summary_short: "Demande de rappel enregistrée",
          summary_long: "L'appel a conduit à l'enregistrement d'une demande de rappel.",
          rule: "tool_create_callback",
        };
      }
      if (name === "check_availability") {
        return {
          summary_short: "Demande de disponibilité reçue",
          summary_long: "L'appelant a demandé des disponibilités et le calendrier a été consulté.",
          rule: "tool_check_availability",
        };
      }
      if (name === "book_appointment") {
        return {
          summary_short: "Demande de rendez-vous",
          summary_long: "L'appel a conduit à une tentative de réservation de rendez-vous.",
          rule: "tool_book_appointment",
        };
      }
      if (name === "send_notification") {
        return {
          summary_short: "Notification envoyée",
          summary_long: "L'appel a donné lieu à l'envoi d'une notification.",
          rule: "tool_send_notification",
        };
      }
    }
  }

  // Collect all caller messages for rules 4 & 5
  const callerMessages = (messages || [])
    .filter((m) => m.speaker === "caller" && m.content_text)
    .map((m) => cleanText(m.content_text))
    .filter((t) => t.length > 0);

  // RULE 4 — First useful caller message
  const useful = callerMessages.find(
    (t) => t.length >= 8 && !WEAK_MESSAGES.has(t.toLowerCase())
  );
  if (useful) {
    const short = truncate(useful);
    return {
      summary_short: short,
      summary_long: `Motif principal détecté à partir de la conversation : ${useful}.`,
      rule: "caller_message",
    };
  }

  // RULE 5 — Test call detection
  const allText = callerMessages.join(" ");
  if (TEST_PATTERNS.some((p) => p.test(allText))) {
    return {
      summary_short: "Appel de test",
      summary_long: "L'appel semble être un test. Aucune action particulière n'a été enregistrée.",
      rule: "test_call",
    };
  }

  // RULE 6 — Fallback
  return {
    summary_short: "Appel traité sans résumé détaillé",
    summary_long: "L'appel a été enregistré mais aucun motif exploitable n'a pu être déterminé automatiquement.",
    rule: "fallback",
  };
}

module.exports = { generateDeterministicSummary };
