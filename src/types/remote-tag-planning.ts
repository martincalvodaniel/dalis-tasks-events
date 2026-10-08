import type { PreferenceEffect } from "@/types/preference-effects"
import type { Tag } from "@/types/preferences"

export type RemoteTagPlan =
  | { status: "changes"; effects: PreferenceEffect[] }
  | { status: "conflict"; current: Tag }
  | { status: "unsupported" | "unavailable" | "invalid_command" }
