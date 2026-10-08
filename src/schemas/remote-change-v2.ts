import { z } from "zod"
import {
  maximumPreferenceEffectsBytes,
  remotePreferenceEffectsSchema,
} from "@/schemas/preference-effects"
import {
  entityIdSchema,
  revisionSchema,
  userIdSchema,
} from "@/schemas/primitives"
import { remoteItemChangeSchema } from "@/schemas/remote-sync"

export const maximumRemoteChangeBytes = maximumPreferenceEffectsBytes

const personalChangeSchema = z
  .strictObject({
    version: z.literal(2),
    kind: z.literal("preference"),
    recipientUserId: userIdSchema,
    operationId: entityIdSchema,
    sequence: revisionSchema.min(1),
    effects: remotePreferenceEffectsSchema,
  })
  .refine(
    (change) =>
      change.recipientUserId === change.effects.userId &&
      change.operationId === change.effects.operationId &&
      change.sequence === change.effects.sequence,
    "Personal journal identity, recipient and sequence must match its effects"
  )

// Keep indexed journal fields at the root for both legacy and new records.
export const remoteChangeV2Schema = z
  .discriminatedUnion("kind", [
    remoteItemChangeSchema.safeExtend({
      version: z.literal(2),
      kind: z.literal("item"),
    }),
    personalChangeSchema,
  ])
  .refine(
    (change) =>
      new TextEncoder().encode(JSON.stringify(change)).byteLength <=
      maximumRemoteChangeBytes,
    "Remote journal entry exceeds its byte limit"
  )
