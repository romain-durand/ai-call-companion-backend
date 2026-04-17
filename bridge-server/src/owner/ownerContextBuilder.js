const { supabaseAdmin } = require("../db/supabaseAdmin");
const log = require("../observability/logger");

/**
 * Build a runtime context block for an OWNER session.
 * The owner is the user themselves — we surface useful account data so the
 * assistant can answer questions and reference things by name.
 */
async function buildOwnerRuntimeContext(callCtx) {
  const { accountId, profileId, traceId } = callCtx;
  if (!accountId) return "RUNTIME CONTEXT (owner)\n(no account context available)";

  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      { data: profile },
      { data: account },
      { data: recentCalls },
      { data: pendingCallbacks },
      { data: activeMissions },
      { data: groups },
      { data: modes },
      { data: contacts },
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("display_name, phone_e164").eq("id", profileId).maybeSingle(),
      supabaseAdmin.from("accounts").select("name, timezone, about_shareable, about_confidential, current_note_shareable, current_note_confidential, current_note_expires_at").eq("id", accountId).maybeSingle(),
      supabaseAdmin.from("call_sessions").select("started_at, caller_name_raw, caller_phone_e164, summary_short").eq("account_id", accountId).gte("started_at", todayStart.toISOString()).order("started_at", { ascending: false }).limit(10),
      supabaseAdmin.from("callback_requests").select("caller_name, caller_phone_e164, reason, created_at").eq("account_id", accountId).eq("status", "pending").limit(10),
      supabaseAdmin.from("outbound_missions").select("objective, target_name, target_phone_e164, status").eq("account_id", accountId).in("status", ["draft", "scheduled", "in_progress"]).limit(10),
      supabaseAdmin.from("caller_groups").select("name, custom_instructions").eq("account_id", accountId).order("priority_rank"),
      supabaseAdmin.from("assistant_modes").select("name, is_active").eq("account_id", accountId),
      supabaseAdmin.from("contacts").select("display_name, primary_phone_e164, secondary_phone_e164, custom_instructions").eq("account_id", accountId).order("display_name").limit(200),
    ]);

    const fmt = (v) => (v && String(v).trim() ? String(v).trim() : "(vide)");
    const callsBlock = (recentCalls || []).length
      ? recentCalls.map((c) => `  - ${new Date(c.started_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} — ${c.caller_name_raw || c.caller_phone_e164 || "Inconnu"} : ${c.summary_short || "(pas de résumé)"}`).join("\n")
      : "  (aucun appel aujourd'hui)";
    const callbacksBlock = (pendingCallbacks || []).length
      ? pendingCallbacks.map((c) => `  - ${c.caller_name || c.caller_phone_e164 || "?"} : ${c.reason || "(sans motif)"}`).join("\n")
      : "  (aucun)";
    const missionsBlock = (activeMissions || []).length
      ? activeMissions.map((m) => `  - [${m.status}] ${m.target_name || m.target_phone_e164} → ${m.objective}`).join("\n")
      : "  (aucune mission active)";
    const groupsBlock = (groups || []).map((g) => `  - ${g.name}${g.custom_instructions ? ` (instructions: « ${g.custom_instructions} »)` : ""}`).join("\n") || "  (aucun)";
    const modeBlock = (modes || []).filter((m) => m.is_active).map((m) => m.name).join(", ") || "(aucun)";

    return `RUNTIME CONTEXT — OWNER SESSION
Tu parles à : ${fmt(profile?.display_name)} (téléphone : ${fmt(profile?.phone_e164)})
Compte : ${fmt(account?.name)} — Fuseau : ${fmt(account?.timezone)}
Mode actif : ${modeBlock}

À PROPOS DE MOI (pour rappel à l'utilisateur si demandé) :
  - Général partageable : ${fmt(account?.about_shareable)}
  - Général confidentiel : ${fmt(account?.about_confidential)}
  - Note actuelle partageable : ${fmt(account?.current_note_shareable)}
  - Note actuelle confidentielle : ${fmt(account?.current_note_confidential)}
  - Expiration note : ${fmt(account?.current_note_expires_at)}

APPELS REÇUS AUJOURD'HUI :
${callsBlock}

CALLBACKS EN ATTENTE :
${callbacksBlock}

MISSIONS ACTIVES :
${missionsBlock}

GROUPES D'APPELANTS :
${groupsBlock}

Utilise ces données pour répondre. Pour toute modification, utilise les outils dédiés et confirme AVANT.`;
  } catch (e) {
    log.error("owner_context_build_failed", traceId, e.message);
    return "RUNTIME CONTEXT — OWNER SESSION\n(error loading context)";
  }
}

module.exports = { buildOwnerRuntimeContext };
