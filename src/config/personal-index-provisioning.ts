import "server-only"

import { z } from "zod"
import { personalIndexConnectionTargetSchema } from "@/schemas/personal-index-target"

const configurationSchema = z.strictObject({
  mongodbUri: z.string().min(1).max(4096),
  databaseName: personalIndexConnectionTargetSchema.shape.databaseName,
})

function validateSeed(seed: string) {
  const match = seed.match(
    /^(\[[0-9a-fA-F:]+\]|[a-zA-Z0-9][a-zA-Z0-9.-]*)(?::([1-9][0-9]{0,4}))?$/
  )
  if (!match || (match[2] && Number(match[2]) > 65535))
    throw new Error("Invalid MongoDB seed")
  const host = match[1]
  if (host.length > 253 || host.includes("..") || host.endsWith("."))
    throw new Error("Ambiguous MongoDB seed")
  // URL parsing validates bracketed IPv6 without resolving a host or normalizing the returned authority.
  new URL(`http://${seed}`)
}

export function parsePersonalIndexConnectionConfiguration(input: unknown) {
  try {
    const config = configurationSchema.parse(input)
    if (/\s|#/.test(config.mongodbUri)) throw new Error("Ambiguous MongoDB URI")
    const match = config.mongodbUri.match(
      /^(mongodb(?:\+srv)?):\/\/([^/?#]+)(?:[/?][^#]*)?$/
    )
    if (!match) throw new Error("Invalid MongoDB URI")
    let authority = match[2]
    const separator = authority.indexOf("@")
    if (separator >= 0) {
      if (separator !== authority.lastIndexOf("@"))
        throw new Error("Ambiguous MongoDB userinfo")
      const userinfo = authority.slice(0, separator)
      const colon = userinfo.indexOf(":")
      const username = colon < 0 ? userinfo : userinfo.slice(0, colon)
      const password = colon < 0 ? "" : userinfo.slice(colon + 1)
      if (
        !username ||
        /[:/?#[\]@]/.test(username) ||
        /[:/?#[\]@]/.test(password)
      )
        throw new Error("Invalid MongoDB userinfo")
      decodeURIComponent(username)
      decodeURIComponent(password)
      authority = authority.slice(separator + 1)
    }
    const seeds = authority.split(",")
    if (
      match[1] === "mongodb+srv" &&
      (seeds.length !== 1 || authority.includes(":"))
    )
      throw new Error("Invalid MongoDB SRV authority")
    for (const seed of seeds) validateSeed(seed)
    if (new Set(seeds).size !== seeds.length)
      throw new Error("Duplicate MongoDB seed")
    return personalIndexConnectionTargetSchema.parse({
      databaseName: config.databaseName,
      mongodbAuthority: authority,
    })
  } catch {
    // Neither parser diagnostics nor URI userinfo may escape this configuration boundary.
    throw new Error("Personal index provisioning configuration is invalid")
  }
}
