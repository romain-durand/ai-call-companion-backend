import { supabase } from "@/integrations/supabase/client";
import type { ContactItem, ContactFormData, ContactGroupTag } from "./types";

const defaultEmojis: Record<string, string> = {
  family: "👨‍👩‍👧‍👦",
  vip: "⭐",
  clients: "💼",
  deliveries: "📦",
  unknown: "❓",
  medical: "🏥",
  services: "🔧",
  spam: "🚫",
};

export async function getLiveContacts(accountIds: string[]): Promise<ContactItem[]> {
  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("*")
    .in("account_id", accountIds)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!contacts || contacts.length === 0) return [];

  const contactIds = contacts.map((c) => c.id);

  // Fetch group memberships with group details
  const { data: memberships } = await supabase
    .from("contact_group_memberships")
    .select("contact_id, caller_group_id")
    .in("contact_id", contactIds);

  // Fetch groups for those memberships
  const groupIds = [...new Set((memberships || []).map((m) => m.caller_group_id))];
  let groupMap: Record<string, ContactGroupTag> = {};

  if (groupIds.length > 0) {
    const { data: groups } = await supabase
      .from("caller_groups")
      .select("id, name, slug, icon, color")
      .in("id", groupIds);

    (groups || []).forEach((g) => {
      groupMap[g.id] = {
        id: g.id,
        name: g.name,
        emoji: g.icon || defaultEmojis[g.slug] || "👤",
        color: g.color || "hsl(220 15% 50%)",
      };
    });
  }

  // Build contact-to-groups map
  const contactGroupsMap: Record<string, ContactGroupTag[]> = {};
  (memberships || []).forEach((m) => {
    if (!contactGroupsMap[m.contact_id]) contactGroupsMap[m.contact_id] = [];
    const tag = groupMap[m.caller_group_id];
    if (tag) contactGroupsMap[m.contact_id].push(tag);
  });

  return contacts.map((c) => ({
    id: c.id,
    firstName: c.first_name,
    lastName: c.last_name,
    displayName: c.display_name || "Contact sans nom",
    primaryPhone: c.primary_phone_e164,
    secondaryPhone: c.secondary_phone_e164,
    email: c.email as string | null,
    companyName: c.company_name,
    notes: c.notes,
    isFavorite: c.is_favorite,
    isBlocked: c.is_blocked,
    source: c.source,
    groups: contactGroupsMap[c.id] || [],
    createdAt: c.created_at,
  }));
}

export async function createLiveContact(
  accountId: string,
  data: ContactFormData,
): Promise<string> {
  const { data: result, error } = await supabase
    .from("contacts")
    .insert({
      account_id: accountId,
      first_name: data.first_name || null,
      last_name: data.last_name || null,
      display_name: data.display_name || null,
      primary_phone_e164: data.primary_phone_e164 || null,
      secondary_phone_e164: data.secondary_phone_e164 || null,
      email: data.email || null,
      company_name: data.company_name || null,
      notes: data.notes || null,
      is_favorite: data.is_favorite,
      is_blocked: data.is_blocked,
      source: "manual" as const,
    })
    .select("id")
    .single();

  if (error) throw error;
  return result.id;
}

export async function updateLiveContact(
  contactId: string,
  data: ContactFormData,
): Promise<void> {
  const { error } = await supabase
    .from("contacts")
    .update({
      first_name: data.first_name || null,
      last_name: data.last_name || null,
      display_name: data.display_name || null,
      primary_phone_e164: data.primary_phone_e164 || null,
      secondary_phone_e164: data.secondary_phone_e164 || null,
      email: data.email || null,
      company_name: data.company_name || null,
      notes: data.notes || null,
      is_favorite: data.is_favorite,
      is_blocked: data.is_blocked,
    })
    .eq("id", contactId);

  if (error) throw error;
}

export async function deleteLiveContact(contactId: string): Promise<void> {
  // Memberships will cascade via FK or we delete manually
  await supabase
    .from("contact_group_memberships")
    .delete()
    .eq("contact_id", contactId);

  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("id", contactId);

  if (error) throw error;
}

export async function getLiveContactGroups(
  contactId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("contact_group_memberships")
    .select("caller_group_id")
    .eq("contact_id", contactId);

  if (error) throw error;
  return (data || []).map((m) => m.caller_group_id);
}

export async function setLiveContactGroups(
  accountId: string,
  contactId: string,
  groupIds: string[],
): Promise<void> {
  // Remove all existing memberships
  await supabase
    .from("contact_group_memberships")
    .delete()
    .eq("contact_id", contactId);

  // Insert new ones
  if (groupIds.length > 0) {
    const rows = groupIds.map((gid) => ({
      account_id: accountId,
      contact_id: contactId,
      caller_group_id: gid,
    }));
    const { error } = await supabase
      .from("contact_group_memberships")
      .insert(rows);
    if (error) throw error;
  }
}
