import type { PreferenceEffect } from "@/types/preference-effects"
import type { TaskPlacement } from "@/types/preferences"

export type RemoteTaskPlacementPlan =
  | { status: "changes"; effects: PreferenceEffect[] }
  | { status: "conflict"; current: TaskPlacement }
  | { status: "unsupported" | "unavailable" | "invalid_command" }
