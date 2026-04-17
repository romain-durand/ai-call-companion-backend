const { supabaseAdmin } = require("../db/supabaseAdmin");
const log = require("../observability/logger");

/**
 * Route owner tool calls to handlers.
 * Returns the Gemini-shaped functionResponse object.
 */
async function handleOwnerToolCall(call, traceId, callCtx) {
  const { name, args = {}, id } = call;
  log.tool("owner_tool_call", traceId, `${name} ${JSON.stringify(args)}`);

  let response;
  try {
    switch (name) {
      case "get_account_overview":
        response = await getAccountOverview(callCtx);
        break;
      case "list_recent_calls":
        response = await listRecentCalls(callCtx, args);
        break;
      case "list_contacts_and_groups":
        response = await listContactsAndGroups(callCtx);
        break;
      case "set_contact_instructions":
        response = await setContactInstructions(callCtx, args);
        break;
      case "set_group_instructions":
        response = await setGroupInstructions(callCtx, args);
        break;
      case "set_about_me":
        response = await setAboutMe(callCtx, args);
        break;
      case "create_outbound_mission":
        response = await createOutboundMission(callCtx, args);
        break;
      case "end_call":
        if (callCtx._hangup) callCtx._hangup(args.reason || "owner_end");
        response = { success: true, message: "Appel terminé." };
        break;
      default:
        response = { success: false, message: `Outil inconnu: ${name}` };
    }
  } catch (e) {
    log.error("owner_tool_error", traceId, `${name}: ${e.message}`);
    response = { success: false, message: e.message };
  }

  return { id, name, response };
}

async function getAccountOverview(ctx) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const [{ count: callsToday }, { count: callbacks }, { count: missions }] = await Promise.all([
    supabaseAdmin.from("call_sessions").select("id", { count: "exact", head: true }).eq("account_id", ctx.accountId).gte("started_at", todayStart.toISOString()),
    supabaseAdmin.from("callback_requests").select("id", { count: "exact", head: true }).eq("account_id", ctx.accountId).eq("status", "pending"),
    supabaseAdmin.from("outbound_missions").select("id", { count: "exact", head: true }).eq("account_id", ctx.accountId).in("status", ["draft", "scheduled", "in_progress"]),
  ]);
  return {
    success: true,
    calls_today: callsToday || 0,
    pending_callbacks: callbacks || 0,
    active_missions: missions || 0,
  };
}

async function listRecentCalls(ctx, { limit = 5 }) {
  const lim = Math.min(Math.max(1, Number(limit) || 5), 20);
  const { data } = await supabaseAdmin
    .from("call_sessions")
    .select("started_at, caller_name_raw, caller_phone_e164, summary_short, summary_long, final_outcome")
    .eq("account_id", ctx.accountId)
    .order("started_at", { ascending: false })
    .limit(lim);
  return {
    success: true,
    calls: (data || []).map((c) => ({
      at: c.started_at,
      from: c.caller_name_raw || c.caller_phone_e164 || "Inconnu",
      outcome: c.final_outcome,
      summary: c.summary_short || c.summary_long || null,
    })),
  };
}

async function listContactsAndGroups(ctx) {
  const [{ data: contacts }, { data: groups }] = await Promise.all([
    supabaseAdmin.from("contacts").select("display_name, primary_phone_e164, custom_instructions").eq("account_id", ctx.accountId).order("display_name").limit(50),
    supabaseAdmin.from("caller_groups").select("name, custom_instructions, priority_rank").eq("account_id", ctx.accountId).order("priority_rank"),
  ]);
  return { success: true, contacts: contacts || [], groups: groups || [] };
}

async function setContactInstructions(ctx, { contact_query, instructions }) {
  if (!contact_query) return { success: false, message: "contact_query manquant" };
  const { data: matches } = await supabaseAdmin
    .from("contacts")
    .select("id, display_name")
    .eq("account_id", ctx.accountId)
    .ilike("display_name", `%${contact_query}%`)
    .limit(5);
  if (!matches || matches.length === 0) return { success: false, message: `Aucun contact ne correspond à « ${contact_query} ».` };
  if (matches.length > 1) {
    return {
      success: false,
      message: "Plusieurs contacts correspondent — précise lequel.",
      matches: matches.map((m) => m.display_name),
    };
  }
  const { error } = await supabaseAdmin
    .from("contacts")
    .update({ custom_instructions: instructions || null })
    .eq("id", matches[0].id);
  if (error) return { success: false, message: error.message };
  return { success: true, message: `Instructions mises à jour pour ${matches[0].display_name}.`, contact: matches[0].display_name };
}

async function setGroupInstructions(ctx, { group_query, instructions }) {
  if (!group_query) return { success: false, message: "group_query manquant" };
  const { data: matches } = await supabaseAdmin
    .from("caller_groups")
    .select("id, name")
    .eq("account_id", ctx.accountId)
    .ilike("name", `%${group_query}%`)
    .limit(5);
  if (!matches || matches.length === 0) return { success: false, message: `Aucun groupe ne correspond à « ${group_query} ».` };
  if (matches.length > 1) {
    return { success: false, message: "Plusieurs groupes correspondent — précise lequel.", matches: matches.map((m) => m.name) };
  }
  const { error } = await supabaseAdmin
    .from("caller_groups")
    .update({ custom_instructions: instructions || null })
    .eq("id", matches[0].id);
  if (error) return { success: false, message: error.message };
  return { success: true, message: `Instructions mises à jour pour le groupe ${matches[0].name}.`, group: matches[0].name };
}

async function setAboutMe(ctx, { field, content, expires_at }) {
  const allowed = ["about_shareable", "about_confidential", "current_note_shareable", "current_note_confidential"];
  if (!allowed.includes(field)) return { success: false, message: `Champ invalide : ${field}` };
  const update = { [field]: content || null };
  if (field.startsWith("current_note_") && expires_at) {
    update.current_note_expires_at = expires_at;
  }
  const { error } = await supabaseAdmin.from("accounts").update(update).eq("id", ctx.accountId);
  if (error) return { success: false, message: error.message };
  return { success: true, message: `Champ ${field} mis à jour.` };
}

async function createOutboundMission(ctx, args) {
  const { objective, target_phone, target_name, context_flexible, context_secret, allow_consult_user, scheduled_at } = args;
  if (!objective || !target_phone) return { success: false, message: "objective et target_phone sont requis." };

  // Sanitize scheduled_at: treat past or near-future (<30s) timestamps as "immediate" (null).
  // This avoids missions stuck in "scheduled" state when the model echoes the current time.
  let normalizedScheduledAt = null;
  if (scheduled_at) {
    const ts = Date.parse(scheduled_at);
    if (!Number.isNaN(ts) && ts - Date.now() > 30_000) {
      normalizedScheduledAt = new Date(ts).toISOString();
    }
  }

  const row = {
    account_id: ctx.accountId,
    objective,
    target_phone_e164: target_phone,
    target_name: target_name || null,
    context_flexible: context_flexible || null,
    context_secret: context_secret || null,
    allow_consult_user: !!allow_consult_user,
    scheduled_at: normalizedScheduledAt,
    // Immediate or scheduled — both go to "scheduled" so the outbound poller picks them up
    // (poller fires when scheduled_at IS NULL OR scheduled_at <= now()).
    status: "scheduled",
  };
  const { data, error } = await supabaseAdmin.from("outbound_missions").insert(row).select("id").single();
  if (error) {
    log.error("owner_create_mission_error", null, error.message);
    return { success: false, message: error.message };
  }
  const when = normalizedScheduledAt ? `programmée pour ${normalizedScheduledAt}` : "lancement immédiat";
  return { success: true, message: `Mission créée (${when}).`, mission_id: data.id };
}

module.exports = { handleOwnerToolCall };
