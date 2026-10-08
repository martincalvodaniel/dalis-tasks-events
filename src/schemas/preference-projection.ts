import { z } from "zod"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { personalSnapshotSchema } from "@/schemas/personal-snapshot"
import { remotePreferenceEffectsSchema } from "@/schemas/preference-effects"
import { userIdSchema } from "@/schemas/primitives"
import { remoteShadowV2Schema } from "@/schemas/remote-shadow-v2"

export const preferenceProjectionInputSchema = z
  .strictObject({
    userId: userIdSchema,
    local: personalSnapshotSchema,
    shadows: z.array(remoteShadowV2Schema).max(10000),
    incoming: remotePreferenceEffectsSchema.nullable(),
    entries: z.array(outboxEntrySchema).max(10000),
  })
  .superRefine((input, context) => {
    const reject = (message: string) =>
      context.addIssue({ code: "custom", message })
    for (const snapshot of input.local) {
      if (
        !snapshot.entityKey.startsWith("tag:") &&
        !snapshot.entityKey.startsWith("item-view:")
      )
        reject("Personal projection does not support this local store")
      if (snapshot.record && snapshot.record.record.userId !== input.userId)
        reject("Personal projection local record belongs to another account")
    }
    const shadowKeys = new Set<string>()
    for (const shadow of input.shadows) {
      if (
        shadow.kind !== "preference" ||
        (shadow.record.store !== "tags" && shadow.record.store !== "itemViews")
      )
        reject("Personal projection does not support this shadow store")
      if (
        shadow.kind === "preference" &&
        shadow.record.record.userId !== input.userId
      )
        reject("Personal projection shadow belongs to another account")
      if (shadowKeys.has(shadow.entityKey))
        reject("Personal projection contains duplicate shadow identities")
      shadowKeys.add(shadow.entityKey)
    }
    if (input.incoming) {
      if (input.incoming.userId !== input.userId)
        reject("Personal projection effects belong to another account")
      for (const effect of input.incoming.effects)
        if (effect.store !== "tags" && effect.store !== "itemViews")
          reject("Personal projection does not support this effect store")
    }
    const operationIds = new Set<string>()
    const sequences = new Set<number>()
    const entries = new Map(
      input.entries.map((entry) => [entry.operation.operationId, entry])
    )
    for (const entry of input.entries) {
      if (entry.userId !== input.userId)
        reject("Personal projection intention belongs to another account")
      if (
        operationIds.has(entry.operation.operationId) ||
        sequences.has(entry.sequence)
      )
        reject("Personal projection contains duplicate intention identities")
      operationIds.add(entry.operation.operationId)
      sequences.add(entry.sequence)
      for (const dependency of entry.dependencies) {
        const parent = entries.get(dependency)
        if (!parent || parent.sequence >= entry.sequence)
          reject("Personal projection has missing or unordered dependencies")
      }
    }
  })
