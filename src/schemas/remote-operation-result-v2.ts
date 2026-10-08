import { z } from "zod"
import {
  maximumPreferenceEffectsBytes,
  preferenceEffectSchema,
  remotePreferenceEffectsSchema,
} from "@/schemas/preference-effects"
import { entityIdSchema } from "@/schemas/primitives"
import { remoteOperationResultSchema } from "@/schemas/remote-sync"

export const maximumRemoteOperationResultBytes = maximumPreferenceEffectsBytes

export const remotePreferenceOperationOutcomeSchema = z
  .discriminatedUnion("status", [
    z.strictObject({
      operationId: entityIdSchema,
      status: z.literal("applied"),
      effects: remotePreferenceEffectsSchema,
    }),
    z.strictObject({
      operationId: entityIdSchema,
      status: z.literal("conflict"),
      current: preferenceEffectSchema,
    }),
    ...(
      [
        "unavailable",
        "unsupported",
        "invalid_command",
        "identity_reuse",
      ] as const
    ).map((status) =>
      z.strictObject({ operationId: entityIdSchema, status: z.literal(status) })
    ),
  ])
  .refine(
    (outcome) =>
      outcome.status !== "applied" ||
      outcome.operationId === outcome.effects.operationId,
    "Preference result identity must match its effects"
  )

// Preparatory result envelopes do not activate transport version two or ACKs.
export const remoteOperationResultV2Schema = z
  .discriminatedUnion("kind", [
    z.strictObject({
      kind: z.literal("item"),
      outcome: remoteOperationResultSchema,
    }),
    z.strictObject({
      kind: z.literal("preference"),
      outcome: remotePreferenceOperationOutcomeSchema,
    }),
  ])
  .refine(
    (result) =>
      new TextEncoder().encode(JSON.stringify(result)).byteLength <=
      maximumRemoteOperationResultBytes,
    "Remote operation result exceeds its byte limit"
  )
