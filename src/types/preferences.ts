import type { z } from "zod"
import type {
  itemViewSchema,
  tagSchema,
  taskPlacementSchema,
  userSettingsSchema,
} from "@/schemas/preferences"

export type Tag = z.infer<typeof tagSchema>
export type ItemView = z.infer<typeof itemViewSchema>
export type TaskPlacement = z.infer<typeof taskPlacementSchema>
export type UserSettings = z.infer<typeof userSettingsSchema>
