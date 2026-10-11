import { z } from "zod"
import { revisionSchema } from "@/schemas/primitives"
import { remoteChangeV2Schema } from "@/schemas/remote-change-v2"
import { maximumRemoteChangesPageBytes } from "@/schemas/remote-changes-page-v2"
import { remotePlanOccurrenceChangeSchema } from "@/schemas/remote-plan-occurrence-result"

// Prepared future scope; envelope and journal versions remain two.
export const remoteRecurringChangeSchema = z.union([
  remoteChangeV2Schema,
  remotePlanOccurrenceChangeSchema,
])
export const remoteRecurringChangesPageSchema = z
  .strictObject({
    version: z.literal(2),
    changes: z.array(remoteRecurringChangeSchema).max(100),
    nextAfter: revisionSchema,
    through: revisionSchema,
    hasMore: z.boolean(),
  })
  .refine(
    (page) =>
      page.nextAfter <= page.through &&
      page.hasMore === page.nextAfter < page.through &&
      (!page.changes.length ||
        page.changes.at(-1)?.sequence === page.nextAfter),
    "Recurring page cursor must match its checkpoint and records"
  )
  .refine(
    (page) =>
      page.changes.every(
        (change, index) => change.sequence === page.changes[0].sequence + index
      ) &&
      new Set(page.changes.map((change) => change.operationId)).size ===
        page.changes.length,
    "Recurring page must contain contiguous distinct operations"
  )
  .refine(
    (page) =>
      new TextEncoder().encode(JSON.stringify(page)).byteLength <=
      maximumRemoteChangesPageBytes,
    "Recurring page exceeds its byte limit"
  )
