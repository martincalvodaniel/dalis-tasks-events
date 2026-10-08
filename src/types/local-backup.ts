import type { z } from "zod"
import type { localBackupSchema } from "@/schemas/local-backup"

export type LocalBackup = z.infer<typeof localBackupSchema>
