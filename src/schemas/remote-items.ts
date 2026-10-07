import { z } from "zod"
import { entityIdSchema } from "@/schemas/primitives"

export const remoteItemPageQuerySchema = z.strictObject({
  afterId: entityIdSchema.nullable().default(null),
  limit: z.number().int().min(1).max(100).default(50),
})
