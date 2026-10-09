import { z } from "zod"
import {
  personalIndexExecutionSchema,
  personalIndexTargetSchema,
} from "@/schemas/personal-index-target"

export const personalIndexCliArgumentsSchema = z
  .tuple([
    personalIndexTargetSchema.shape.environment,
    personalIndexTargetSchema.shape.databaseName,
    personalIndexTargetSchema.shape.mongodbAuthority,
    z.literal("--apply"),
    z.literal("--acknowledge-automatic-bootstrap"),
  ])
  .transform(([environment, databaseName, mongodbAuthority]) => ({
    target: { environment, databaseName, mongodbAuthority },
    acknowledgeAutomaticBootstrap: true as const,
  }))
  .pipe(personalIndexExecutionSchema)

export function parsePersonalIndexCliArguments(input: unknown) {
  const parsed = personalIndexCliArgumentsSchema.safeParse(input)
  if (!parsed.success)
    throw new Error("Invalid personal index provisioning arguments")
  return parsed.data
}
