import { z } from "zod"

export const entityIdSchema = z.uuid()
export const userIdSchema = z.string().trim().min(1).max(128)
export const civilDateSchema = z.iso
  .date()
  .refine((value) => !value.startsWith("0000-"), "Civil year must be positive")
export const timestampSchema = z.iso.datetime({ precision: 3 })
export const revisionSchema = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER)
export const positionSchema = z.number().min(-1e12).max(1e12)
export const occurrenceIdSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-zA-Z0-9:._-]+$/)
export const titleSchema = z.string().trim().min(1).max(160)
export const descriptionSchema = z.string().max(10000)

export const timeZoneSchema = z
  .string()
  .min(1)
  .max(100)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value })
      return true
    } catch {
      return false
    }
  }, "Invalid time zone")

export const localDateTimeSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/)
  .refine(
    (value) => civilDateSchema.safeParse(value.slice(0, 10)).success,
    "Invalid local date"
  )

export const recordMetadataShape = {
  revision: revisionSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  deletedAt: timestampSchema.nullable(),
}
