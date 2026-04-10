import { supabase } from "@/integrations/supabase/client";

export interface ContactInfo {
  displayName: string;
  phone: string;
}

/**
 * Resolves caller phone numbers to contact names by matching against the contacts table.
 * Returns a Map keyed by phone number (E.164).
 */
export async function resolveContactNames(
  sessions: { caller_phone_e164: string | null }[],
  accountIds: string[]
): Promise<Map<string, ContactInfo>> {
  const phones = [...new Set(sessions.map((s) => s.caller_phone_e164).filter(Boolean))] as string[];
  if (phones.length === 0) return new Map();

  const { data: contacts } = await supabase
    .from("contacts")
    .select("display_name, first_name, last_name, primary_phone_e164")
    .in("account_id", accountIds)
    .in("primary_phone_e164", phones);

  const map = new Map<string, ContactInfo>();
  for (const c of contacts || []) {
    if (!c.primary_phone_e164) continue;
    const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.display_name || "";
    if (name) {
      map.set(c.primary_phone_e164, { displayName: name, phone: c.primary_phone_e164 });
    }
  }
  return map;
}
