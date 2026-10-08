import { z } from "zod"
import { localBackupSchema } from "@/schemas/local-backup"
import {
  entityIdSchema,
  timestampSchema,
  userIdSchema,
} from "@/schemas/primitives"

export const backupImportSelectionSchema = z.strictObject({
  sourceItemId: entityIdSchema,
  itemId: entityIdSchema,
  operationId: entityIdSchema,
})

export const backupImportPreparationSchema = z
  .strictObject({
    sourceJson: z
      .string()
      .min(1)
      .max(16 * 1024 * 1024),
    expected: localBackupSchema,
    sourceItemIds: z.array(entityIdSchema).min(1).max(50),
  })
  .refine(
    (input) => new Set(input.sourceItemIds).size === input.sourceItemIds.length,
    "Import selections must be distinct"
  )

export const backupImportRequestSchema = z
  .strictObject({
    importId: entityIdSchema,
    userId: userIdSchema,
    createdAt: timestampSchema,
    expected: localBackupSchema,
    copies: z.array(backupImportSelectionSchema).min(1).max(50),
  })
  .refine(
    (request) =>
      new Set(request.copies.map((copy) => copy.sourceItemId)).size ===
      request.copies.length,
    "Backup selections must have distinct source identities"
  )
