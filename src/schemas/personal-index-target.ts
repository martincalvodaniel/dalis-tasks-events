import { z } from "zod"

const databaseNameSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/)

// Authority resolution from the configured URI belongs to the future configuration adapter.
const mongodbAuthoritySchema = z
  .string()
  .min(1)
  .max(1024)
  .regex(/^[a-zA-Z0-9.:[\],-]+$/)

export const personalIndexConnectionTargetSchema = z.strictObject({
  databaseName: databaseNameSchema,
  mongodbAuthority: mongodbAuthoritySchema,
})

export const personalIndexTargetSchema =
  personalIndexConnectionTargetSchema.extend({
    environment: z.enum(["local", "preproduction"]),
  })
