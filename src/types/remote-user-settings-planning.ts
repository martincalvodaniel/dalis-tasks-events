import type { PreferenceEffect } from "@/types/preference-effects"
import type { UserSettings } from "@/types/preferences"

export type RemoteUserSettingsPlan =
  | { status: "changes"; effects: PreferenceEffect[] }
  | { status: "conflict"; current: UserSettings | null }
  | { status: "unsupported" | "invalid_command" }
