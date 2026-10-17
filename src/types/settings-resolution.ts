import type { z } from "zod"
import type {
  settingsResolutionRecordSchema,
  settingsResolutionRequestSchema,
} from "@/schemas/settings-resolution"
export type SettingsResolutionRequest = z.infer<
  typeof settingsResolutionRequestSchema
>
export type SettingsResolutionRecord = z.infer<
  typeof settingsResolutionRecordSchema
>
