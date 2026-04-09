import { supabase } from "@/integrations/supabase/client";
import type { CallerGroupItem } from "../types";

export async function getLiveCallerGroups(accountIds: string[]): Promise<CallerGroupItem[]> {
  // Fetch groups
  const { data: groups, error } = await supabase
    .from("caller_groups")
    .select("id, name, slug, description, icon, color, priority_rank")
    .in("account_id", accountIds)
    .order("priority_rank", { ascending: true });

  if (error) throw error;
  if (!groups || groups.length === 0) return [];

  // Fetch contact counts per group
  const groupIds = groups.map((g) => g.id);
  const { data: memberships } = await supabase
    .from("contact_group_memberships")
    .select("caller_group_id")
    .in("caller_group_id", groupIds);

  const countMap: Record<string, number> = {};
  (memberships || []).forEach((m) => {
    countMap[m.caller_group_id] = (countMap[m.caller_group_id] || 0) + 1;
  });

  // Fetch call handling rules for default behavior
  const { data: rules } = await supabase
    .from("call_handling_rules")
    .select("caller_group_id, behavior")
    .in("caller_group_id", groupIds);

  const behaviorMap: Record<string, string> = {};
  (rules || []).forEach((r) => {
    behaviorMap[r.caller_group_id] = r.behavior;
  });

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

  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    emoji: g.icon || defaultEmojis[g.slug] || "👤",
    description: g.description || "",
    contactCount: countMap[g.id] || 0,
    defaultBehavior: behaviorMap[g.id] || "answer_and_take_message",
    color: g.color || "hsl(220 15% 50%)",
  }));
}
