import { z } from "zod"
import { tagSchema } from "@/schemas/preferences"
import {
  revisionSchema,
  timestampSchema,
  userIdSchema,
} from "@/schemas/primitives"
import { syncOperationSchema } from "@/schemas/sync"

export const maximumRemoteTags = 10000
export const remoteTagSchema = tagSchema.safeExtend({
  revision: revisionSchema.min(1),
})

export const remoteTagPlanningInputSchema = z
  .strictObject({
    userId: userIdSchema,
    timestamp: timestampSchema,
    operation: syncOperationSchema,
    tags: z.array(remoteTagSchema).max(maximumRemoteTags),
  })
  .superRefine((value, context) => {
    const ids = new Set<string>()
    const names = new Set<string>()
    for (const [index, tag] of value.tags.entries()) {
      if (tag.userId !== value.userId)
        context.addIssue({
          code: "custom",
          path: ["tags", index, "userId"],
          message: "Category belongs to another account",
        })
      if (ids.has(tag.id))
        context.addIssue({
          code: "custom",
          path: ["tags", index, "id"],
          message: "Duplicate category identity",
        })
      ids.add(tag.id)
      if (!tag.deletedAt) {
        if (names.has(tag.normalizedName))
          context.addIssue({
            code: "custom",
            path: ["tags", index, "normalizedName"],
            message: "Duplicate active category name",
          })
        names.add(tag.normalizedName)
      }
    }
  })
