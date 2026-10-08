import { z } from "zod"
import { calendarItemSchema } from "@/schemas/calendar-item"
import { itemEntityKeySchema } from "@/schemas/local-sync"
import { taskPlacementEntityKey } from "@/schemas/ordering"
import { preferenceEffectSchema } from "@/schemas/preference-effects"

export function personalShadowEntityKey(
  effect: z.infer<typeof preferenceEffectSchema>
): string {
  switch (effect.store) {
    case "tags":
      return `tag:${effect.record.id}`
    case "itemViews":
      return `item-view:${effect.record.itemId}`
    case "taskPlacements":
      return taskPlacementEntityKey(
        effect.record.occurrenceId,
        effect.record.scope,
        effect.record.date
      )
    case "settings":
      return `settings:${effect.record.userId}`
  }
}

export const remoteShadowV2Schema = z.discriminatedUnion("kind", [
  z
    .strictObject({
      version: z.literal(2),
      kind: z.literal("item"),
      entityKey: itemEntityKeySchema,
      record: calendarItemSchema,
    })
    .refine(
      (shadow) => shadow.entityKey === `item:${shadow.record.id}`,
      "Item shadow identity does not match its record"
    ),
  z
    .strictObject({
      version: z.literal(2),
      kind: z.literal("preference"),
      entityKey: z.string().min(1).max(512),
      record: preferenceEffectSchema,
    })
    .refine(
      (shadow) => shadow.entityKey === personalShadowEntityKey(shadow.record),
      "Personal shadow identity does not match its record"
    ),
])
