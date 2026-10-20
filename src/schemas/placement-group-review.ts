import { z } from "zod"
import { maximumLocalOperationOutcomeBytes } from "@/schemas/local-preference-outcome-v2"
import {
  taskPlacementEntityKeySchema,
  taskReferenceIdSchema,
} from "@/schemas/ordering"
import { placementResolutionCatalogSchema } from "@/schemas/placement-resolution"
import { planVariantSchema } from "@/schemas/plan-item"
import {
  civilDateSchema,
  entityIdSchema,
  userIdSchema,
} from "@/schemas/primitives"
import { syncOperationSchema } from "@/schemas/sync"

export const placementGroupReviewInputSchema = z
  .strictObject({
    userId: userIdSchema,
    operation: syncOperationSchema,
    local: placementResolutionCatalogSchema,
    observed: placementResolutionCatalogSchema,
  })
  .refine(
    (value) =>
      new TextEncoder().encode(JSON.stringify(value)).byteLength <=
      maximumLocalOperationOutcomeBytes,
    "Mixed placement review exceeds its byte limit"
  )

export const placementGroupReviewSchema = z.strictObject({
  userId: userIdSchema,
  primaryId: taskReferenceIdSchema,
  scope: z.enum(["day", "overdue"]),
  declaredDate: civilDateSchema,
  placementDate: civilDateSchema,
  tagId: entityIdSchema.nullable(),
  includesRecurringPeers: z.boolean(),
  members: z
    .array(
      z.strictObject({
        id: taskReferenceIdSchema,
        parentId: entityIdSchema,
        scheduledDate: civilDateSchema,
        start: z.string(),
        variant: planVariantSchema,
        recurring: z.boolean(),
      })
    )
    .min(1)
    .max(10000),
  localOrder: z.array(taskReferenceIdSchema).min(1).max(10000),
  observedOrder: z.array(taskReferenceIdSchema).min(1).max(10000),
  changedPlacementKeys: z.array(taskPlacementEntityKeySchema).max(10000),
})
