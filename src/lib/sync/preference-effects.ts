import { remotePreferenceEffectsSchema } from "@/schemas/preference-effects"
import { userIdSchema } from "@/schemas/primitives"
import type { RemotePreferenceEffects } from "@/types/preference-effects"

export function validateRemotePreferenceEffects(
  input: unknown,
  expectedUserId: string
): RemotePreferenceEffects {
  const userId = userIdSchema.parse(expectedUserId)
  const effects = remotePreferenceEffectsSchema.parse(input)
  if (effects.userId !== userId)
    throw new Error("Preference effects belong to another account")
  return effects
}
