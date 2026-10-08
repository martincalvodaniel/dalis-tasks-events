import type { z } from "zod"
import type {
  preferenceEffectSchema,
  remotePreferenceEffectsSchema,
} from "@/schemas/preference-effects"

export type PreferenceEffect = z.infer<typeof preferenceEffectSchema>
export type RemotePreferenceEffects = z.infer<
  typeof remotePreferenceEffectsSchema
>
