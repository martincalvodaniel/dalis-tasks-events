import { z } from "zod"
import { planOccurrenceSchema } from "@/schemas/plan-occurrence"
import {
  maximumRemoteTaskCatalog,
  remoteTaskPlacementPlanningInputSchema,
  taskPlacementPlanningInputSchema,
} from "@/schemas/remote-task-placement-planning"

export const recurringTaskPlacementPlanningInputSchema =
  taskPlacementPlanningInputSchema
    .safeExtend({
      occurrences: z.array(planOccurrenceSchema).max(maximumRemoteTaskCatalog),
    })
    .superRefine((value, context) => {
      const parents = new Map(value.items.map((item) => [item.id, item]))
      const identities = new Set<string>()
      for (const [index, occurrence] of value.occurrences.entries()) {
        const parent = parents.get(occurrence.seriesId)
        if (parent?.kind !== "plan" || parent.ownerId !== value.userId)
          context.addIssue({
            code: "custom",
            path: ["occurrences", index],
            message: "Movement appearance requires its owned common parent",
          })
        if (identities.has(occurrence.id))
          context.addIssue({
            code: "custom",
            path: ["occurrences", index],
            message: "Duplicate movement appearance identity",
          })
        identities.add(occurrence.id)
      }
    })

export const remoteRecurringTaskPlacementPlanningInputSchema =
  recurringTaskPlacementPlanningInputSchema.superRefine((value, context) => {
    const base = remoteTaskPlacementPlanningInputSchema.safeParse({
      userId: value.userId,
      timestamp: value.timestamp,
      operation: value.operation,
      items: value.items,
      tags: value.tags,
      views: value.views,
      placements: value.placements,
    })
    if (!base.success)
      for (const issue of base.error.issues)
        context.addIssue({
          code: "custom",
          path: issue.path,
          message: issue.message,
        })
    for (const [index, occurrence] of value.occurrences.entries())
      if (occurrence.revision < 1)
        context.addIssue({
          code: "custom",
          path: ["occurrences", index, "revision"],
          message: "Remote movement appearance requires a positive revision",
        })
  })
