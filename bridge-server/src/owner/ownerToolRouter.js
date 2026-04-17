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
      case "create_contact":
        response = await createContact(callCtx, args);
        break;
      case "create_caller_group":
        response = await createCallerGroup(callCtx, args);
        break;
      case "set_about_me":
        response = await setAboutMe(callCtx, args);
        break;
      case "create_outbound_mission":
        response = await createOutboundMission(callCtx, args);
        break;
      case "set_confirmation_mode":
        response = await setConfirmationMode(callCtx, args);
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
    supabaseAdmin.from("outbound_missions").select("id", { count: "exact", head: true }).eq("account_id", ctx.accountId).in("status", ["draft", "queued", "in_progress"]),
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

function normalizePhoneFr(raw) {
  if (!raw) return null;
  let p = String(raw).replace(/[\s\-().]/g, "");
  if (!p) return null;
  if (p.startsWith("+")) return p;
  if (p.startsWith("00")) return "+" + p.slice(2);
  if (p.startsWith("0")) return "+33" + p.slice(1);
  // Bare digits without leading 0/+: assume already international without '+'
  if (/^\d{8,}$/.test(p)) return "+" + p;
  return p;
}

function slugify(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || `groupe-${Date.now()}`;
}

async function createContact(ctx, { first_name, last_name, phone, group_query }) {
  if (!first_name && !last_name) return { success: false, message: "Au moins un prénom ou un nom est requis." };
  if (!phone) return { success: false, message: "Numéro de téléphone requis." };
  const e164 = normalizePhoneFr(phone);
  if (!e164 || !/^\+\d{6,15}$/.test(e164)) return { success: false, message: `Numéro invalide: ${phone}` };

  const display = [first_name, last_name].filter(Boolean).join(" ").trim() || e164;

  // Avoid duplicate by phone
  const { data: existing } = await supabaseAdmin
    .from("contacts")
    .select("id, display_name")
    .eq("account_id", ctx.accountId)
    .eq("primary_phone_e164", e164)
    .maybeSingle();
  if (existing) {
    return { success: false, message: `Un contact existe déjà avec ce numéro : ${existing.display_name}.` };
  }

  const { data: created, error } = await supabaseAdmin
    .from("contacts")
    .insert({
      account_id: ctx.accountId,
      first_name: first_name || null,
      last_name: last_name || null,
      display_name: display,
      primary_phone_e164: e164,
      source: "manual",
    })
    .select("id, display_name")
    .single();
  if (error) return { success: false, message: error.message };

  let groupNote = "";
  if (group_query) {
    const { data: groups } = await supabaseAdmin
      .from("caller_groups")
      .select("id, name")
      .eq("account_id", ctx.accountId)
      .ilike("name", `%${group_query}%`)
      .limit(5);
    if (!groups || groups.length === 0) {
      groupNote = ` (groupe « ${group_query} » introuvable, contact créé sans groupe)`;
    } else if (groups.length > 1) {
      groupNote = ` (plusieurs groupes correspondent à « ${group_query} », non assigné)`;
    } else {
      const { error: memErr } = await supabaseAdmin
        .from("contact_group_memberships")
        .insert({ account_id: ctx.accountId, contact_id: created.id, caller_group_id: groups[0].id });
      if (memErr) groupNote = ` (assignation au groupe ${groups[0].name} échouée: ${memErr.message})`;
      else groupNote = ` et assigné au groupe ${groups[0].name}`;
    }
  }

  return { success: true, message: `Contact ${created.display_name} créé${groupNote}.`, contact_id: created.id };
}

async function createCallerGroup(ctx, { name, description, custom_instructions, priority_rank }) {
  if (!name || !name.trim()) return { success: false, message: "Nom du groupe requis." };
  const cleanName = name.trim();
  const baseSlug = slugify(cleanName);
  let slug = baseSlug;

  // Ensure unique slug per account
  for (let i = 1; i < 20; i++) {
    const { data: clash } = await supabaseAdmin
      .from("caller_groups")
      .select("id")
      .eq("account_id", ctx.accountId)
      .eq("slug", slug)
      .maybeSingle();
    if (!clash) break;
    slug = `${baseSlug}-${i + 1}`;
  }

  const rank = Number.isFinite(Number(priority_rank)) ? Math.max(0, Math.min(100, Number(priority_rank))) : 0;

  const { data, error } = await supabaseAdmin
    .from("caller_groups")
    .insert({
      account_id: ctx.accountId,
      name: cleanName,
      slug,
      description: description || null,
      custom_instructions: custom_instructions || null,
      priority_rank: rank,
      group_type: "custom",
    })
    .select("id, name")
    .single();
  if (error) return { success: false, message: error.message };
  return { success: true, message: `Groupe ${data.name} créé.`, group_id: data.id };
}

async function setAboutMe(ctx, { field, content, expires_at, mode }) {
  const allowed = ["about_shareable", "about_confidential", "current_note_shareable", "current_note_confidential"];
  if (!allowed.includes(field)) return { success: false, message: `Champ invalide : ${field}` };

  // Default behavior is APPEND so user-spoken context never silently overwrites prior content.
  // Replacement only when caller explicitly passes mode === "replace".
  const writeMode = mode === "replace" ? "replace" : "append";
  const cleanContent = (content || "").trim();

  let finalValue = cleanContent || null;

  if (writeMode === "append" && cleanContent) {
    const { data: existing, error: readErr } = await supabaseAdmin
      .from("accounts")
      .select(field)
      .eq("id", ctx.accountId)
      .maybeSingle();
    if (readErr) return { success: false, message: readErr.message };
    const prior = (existing?.[field] || "").trim();
    finalValue = prior ? `${prior}\n${cleanContent}` : cleanContent;
  }

  const update = { [field]: finalValue };
  if (field.startsWith("current_note_") && expires_at) {
    update.current_note_expires_at = expires_at;
  }
  const { error } = await supabaseAdmin.from("accounts").update(update).eq("id", ctx.accountId);
  if (error) return { success: false, message: error.message };
  return {
    success: true,
    message: writeMode === "append" ? `Ajouté à ${field}.` : `Champ ${field} remplacé.`,
  };
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
    // Immediate or future-planned missions both enter the queue.
    // The outbound poller picks queued rows when scheduled_at IS NULL or <= now().
    status: "queued",
  };
  const { data, error } = await supabaseAdmin.from("outbound_missions").insert(row).select("id").single();
  if (error) {
    log.error("owner_create_mission_error", null, error.message);
    return { success: false, message: error.message };
  }
  const when = normalizedScheduledAt ? `programmée pour ${normalizedScheduledAt}` : "lancement immédiat";
  return { success: true, message: `Mission créée (${when}).`, mission_id: data.id };
}

async function setConfirmationMode(ctx, { enabled }) {
  if (typeof enabled !== "boolean") return { success: false, message: "Paramètre 'enabled' (boolean) requis." };
  const { error } = await supabaseAdmin.from("accounts").update({ owner_confirm_actions: enabled }).eq("id", ctx.accountId);
  if (error) return { success: false, message: error.message };
  return {
    success: true,
    message: enabled
      ? "OK, je te demanderai confirmation avant chaque action."
      : "OK, je n'exigerai plus de confirmation avant d'exécuter les actions.",
  };
}

module.exports = { handleOwnerToolCall };
