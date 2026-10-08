import { z } from "zod"
import {
  entityIdSchema,
  timestampSchema,
  userIdSchema,
} from "@/schemas/primitives"
import { syncOperationSchema } from "@/schemas/sync"

export const backupImportRecordSchema = z
  .strictObject({
    key: z.string(),
    importId: entityIdSchema,
    userId: userIdSchema,
    createdAt: timestampSchema,
    sourceJson: z
      .string()
      .min(1)
      .max(16 * 1024 * 1024),
    copies: z
      .array(
        z.strictObject({
          sourceItemId: entityIdSchema,
          operation: syncOperationSchema.refine(
            (operation) =>
              operation.command.type === "item.create" &&
              operation.baseRevision === 0 &&
              operation.command.input.kind !== "birthday" &&
              operation.command.input.recurrence === null,
            "Import records require simple item creations"
          ),
        })
      )
      .min(1)
      .max(50),
  })
  .refine(
    (record) => record.key === `backup-import:${record.importId}`,
    "Import record key does not match its identity"
  )
  .refine((record) => {
    const sources = record.copies.map((copy) => copy.sourceItemId)
    const ids = [
      record.importId,
      ...record.copies.flatMap((copy) => [
        copy.operation.operationId,
        ...("itemId" in copy.operation.command
          ? [copy.operation.command.itemId]
          : []),
      ]),
    ]
    return (
      new Set(sources).size === sources.length &&
      new Set(ids).size === ids.length &&
      ids.every((id) => !sources.includes(id))
    )
  }, "Import record identities must be distinct")
