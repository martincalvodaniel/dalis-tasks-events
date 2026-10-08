import type { PreferenceEffect } from "@/types/preference-effects"
import type { ItemView } from "@/types/preferences"

export type RemoteItemViewPlan =
  | { status: "changes"; effects: PreferenceEffect[] }
  | { status: "conflict"; current: ItemView }
  | { status: "unsupported" | "unavailable" | "invalid_command" }
