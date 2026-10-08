import { z } from "zod"
import { revisionSchema } from "@/schemas/primitives"
import { remoteChangeV2Schema } from "@/schemas/remote-change-v2"

export const maximumRemoteChangesPageBytes = 2 * 1024 * 1024

export const remoteChangesPageV2Schema = z
  .strictObject({
    version: z.literal(2),
    changes: z.array(remoteChangeV2Schema).max(100),
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
    "Mixed change page cursor must match its checkpoint and records"
  )
  .refine(
    (page) =>
      page.changes.every(
        (change, index) => change.sequence === page.changes[0].sequence + index
      ) &&
      new Set(page.changes.map((change) => change.operationId)).size ===
        page.changes.length,
    "Mixed change page must contain contiguous distinct operations"
  )
  .refine(
    (page) =>
      new TextEncoder().encode(JSON.stringify(page)).byteLength <=
      maximumRemoteChangesPageBytes,
    "Mixed change page exceeds its byte limit"
  )
