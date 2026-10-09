import "server-only"

import {
  personalIndexConnectionTargetSchema,
  personalIndexTargetSchema,
} from "@/schemas/personal-index-target"

export function validatePersonalIndexTarget(
  input: unknown,
  configuredConnection: unknown
) {
  const target = personalIndexTargetSchema.safeParse(input)
  const configured =
    personalIndexConnectionTargetSchema.safeParse(configuredConnection)
  if (
    !target.success ||
    !configured.success ||
    target.data.databaseName !== configured.data.databaseName ||
    target.data.mongodbAuthority !== configured.data.mongodbAuthority
  )
    throw new Error("Personal index provisioning target is invalid")

  // A matching descriptor is not environment authorization or proof of database ownership.
  return { ...target.data }
}
