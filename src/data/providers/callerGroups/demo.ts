import type { CallerGroupItem } from "../types";
import { callerGroups, behaviorOptions } from "@/data/mockData";

export function getDemoCallerGroups(): CallerGroupItem[] {
  return callerGroups.map((g) => ({
    id: g.id,
    name: g.label,
    emoji: g.emoji,
    description: g.description,
    contactCount: g.memberCount,
    defaultBehavior: g.defaultBehavior,
    color: g.color,
    customInstructions: null,
  }));
}

export { behaviorOptions };
