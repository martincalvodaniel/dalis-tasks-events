import { z } from "zod"
import { planOccurrenceSchema } from "@/schemas/plan-occurrence"
import {
  civilDateSchema,
  entityIdSchema,
  localDateTimeSchema,
  occurrenceIdSchema,
  revisionSchema,
  userIdSchema,
} from "@/schemas/primitives"

export const maximumRemotePlanOccurrenceCatalog = 10000

export const remotePlanOccurrenceKeySchema = z
  .strictObject({ seriesId: entityIdSchema, id: occurrenceIdSchema })
  .refine((key) => {
    const prefix = `${key.seriesId}:`
    return (
      key.id.startsWith(prefix) &&
      z
        .union([civilDateSchema, localDateTimeSchema])
        .safeParse(key.id.slice(prefix.length)).success
    )
  }, "Plan occurrence key must preserve a valid original slot")

export const remoteStoredPlanOccurrenceSchema = planOccurrenceSchema.safeExtend(
  {
    userId: userIdSchema,
    revision: revisionSchema.min(1),
  }
)
