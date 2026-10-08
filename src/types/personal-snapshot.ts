import type { z } from "zod"
import type {
  localPreferenceRecordSchema,
  personalSnapshotSchema,
} from "@/schemas/personal-snapshot"

export type LocalPreferenceRecord = z.infer<typeof localPreferenceRecordSchema>
export type PersonalSnapshot = z.infer<typeof personalSnapshotSchema>
