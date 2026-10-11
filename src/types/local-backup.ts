import type { z } from "zod"
import type {
  localBackupSchema,
  localBackupV1Schema,
  localBackupV2Schema,
} from "@/schemas/local-backup"
import type { localRecurringBackupSchema } from "@/schemas/local-recurring-backup"

export type LocalBackup = z.infer<typeof localBackupSchema>
export type LocalBackupV1 = z.infer<typeof localBackupV1Schema>
export type LocalBackupV2 = z.infer<typeof localBackupV2Schema>
export type LocalRecurringBackup = z.infer<typeof localRecurringBackupSchema>
