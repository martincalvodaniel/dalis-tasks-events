import { z } from "zod"
import { entityIdSchema, userIdSchema } from "@/schemas/primitives"
import { remoteChangesPageV2Schema } from "@/schemas/remote-changes-page-v2"
import { syncCommandSchema } from "@/schemas/sync"
import { syncDatabaseTestConfigSchema } from "@/schemas/sync-database-test"

const loopbackOriginSchema = z.string().refine((value) => {
  try {
    const url = new URL(value)
    return (
      url.origin === value &&
      url.protocol === "http:" &&
      ["127.0.0.1", "localhost"].includes(url.hostname) &&
      Number(url.port) >= 1024 &&
      Number(url.port) <= 65535
    )
  } catch {
    return false
  }
}, "Next sync fixture requires an exact loopback origin")

export const nextSyncPublicConfigSchema = z
  .strictObject({
    runId: entityIdSchema,
    origins: z.tuple([loopbackOriginSchema, loopbackOriginSchema]),
  })
  .refine(
    (value) =>
      new URL(value.origins[0]).hostname === "127.0.0.1" &&
      new URL(value.origins[1]).hostname === "localhost" &&
      new URL(value.origins[0]).port !== new URL(value.origins[1]).port,
    "Next sync clients require separate loopback hosts and ports"
  )

export const nextSyncPrivateConfigSchema = syncDatabaseTestConfigSchema
  .safeExtend({
    origins: nextSyncPublicConfigSchema.shape.origins,
    controlOrigin: loopbackOriginSchema,
    authOrigin: loopbackOriginSchema,
    secret: z.string().regex(/^dalis-next-test-[a-f0-9-]{72}$/),
  })
  .refine(
    (value) =>
      nextSyncPublicConfigSchema.safeParse({
        runId: value.runId,
        origins: value.origins,
      }).success &&
      value.origins.includes(value.authOrigin) &&
      new URL(value.controlOrigin).hostname === "127.0.0.1" &&
      !value.origins.includes(value.controlOrigin),
    "Next sync fixture origins are inconsistent"
  )

export const nextSyncCapabilitySchema = z.strictObject({
  runId: entityIdSchema,
})
export const nextSyncDiagnosticSchema = z.strictObject({
  diagnostic: z.enum([
    "private_environment_invalid",
    "capability_invalid",
    "request_origin_mismatch",
  ]),
})
export const nextSyncBootstrapSchema = nextSyncCapabilitySchema.extend({
  identity: z.enum(["owner", "other", "unverified"]),
})
export const nextSyncSessionCommandSchema = nextSyncCapabilitySchema.extend({
  command: z.enum(["revoke", "expire", "cleanup"]),
})
export const nextSyncFinishSchema = nextSyncCapabilitySchema.extend({
  passed: z.boolean(),
})
export const nextSyncStateQuerySchema = nextSyncCapabilitySchema.extend({
  userId: userIdSchema,
})
export const nextSyncActionSchema = nextSyncCapabilitySchema.extend({
  input: z.unknown(),
})
export const nextSyncStateSchema = z.strictObject({
  counts: z.strictObject({
    items: z.number().int().min(0),
    tags: z.number().int().min(0),
    views: z.number().int().min(0),
    receipts: z.number().int().min(0),
  }),
  page: remoteChangesPageV2Schema,
})
export const nextSyncDeviceCommandSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("prepare-local"), userId: userIdSchema }),
  z.strictObject({
    type: z.literal("commit-local"),
    command: syncCommandSchema.refine(
      (command) =>
        ["item.create", "tag.save", "item-view.set"].includes(command.type),
      "Fixture local command is unsupported"
    ),
  }),
  z.strictObject({ type: z.literal("mixed-summary") }),
  z.strictObject({ type: z.literal("mixed-run") }),
  z.strictObject({ type: z.literal("local-snapshot") }),
  z.strictObject({ type: z.literal("cleanup-local") }),
  z.strictObject({ type: z.literal("retired-push"), input: z.unknown() }),
  z.strictObject({
    type: z.literal("bootstrap"),
    identity: nextSyncBootstrapSchema.shape.identity,
  }),
  z.strictObject({ type: z.literal("push"), input: z.unknown() }),
  z.strictObject({ type: z.literal("identity") }),
  z.strictObject({ type: z.literal("pull"), userId: userIdSchema }),
  z.strictObject({
    type: z.literal("session"),
    command: nextSyncSessionCommandSchema.shape.command,
  }),
])
