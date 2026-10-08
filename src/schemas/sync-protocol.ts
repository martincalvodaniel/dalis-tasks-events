import { z } from "zod"

const protocolVersionSchema = z.number().int().min(1).max(1000000)
export const syncProtocolRangeSchema = z
  .strictObject({
    minimum: protocolVersionSchema,
    maximum: protocolVersionSchema,
  })
  .refine((range) => range.minimum <= range.maximum, "Invalid protocol range")
