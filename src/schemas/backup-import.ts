import { z } from "zod"
import { localBackupSchema } from "@/schemas/local-backup"
import { localRecurringBackupSchema } from "@/schemas/local-recurring-backup"
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

function createPreparationSchema<
  T extends typeof localBackupSchema | typeof localRecurringBackupSchema,
>(expected: T) {
  return z
    .strictObject({
      sourceJson: z
        .string()
        .min(1)
        .max(16 * 1024 * 1024),
      expected,
      sourceItemIds: z.array(entityIdSchema).min(1).max(50),
    })
    .refine(
      (input) =>
        new Set(input.sourceItemIds).size === input.sourceItemIds.length,
      "Import selections must be distinct"
    )
}
function createRequestSchema<
  T extends typeof localBackupSchema | typeof localRecurringBackupSchema,
>(expected: T) {
  return z
    .strictObject({
      importId: entityIdSchema,
      userId: userIdSchema,
      createdAt: timestampSchema,
      expected,
      copies: z.array(backupImportSelectionSchema).min(1).max(50),
    })
    .refine(
      (request) =>
        new Set(request.copies.map((copy) => copy.sourceItemId)).size ===
        request.copies.length,
      "Backup selections must have distinct source identities"
    )
}
export const backupImportPreparationSchema =
  createPreparationSchema(localBackupSchema)
export const backupImportRequestSchema = createRequestSchema(localBackupSchema)
export const recurringBackupImportPreparationSchema = createPreparationSchema(
  localRecurringBackupSchema
)
export const recurringBackupImportRequestSchema = createRequestSchema(
  localRecurringBackupSchema
)
