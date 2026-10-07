import { z } from "zod"
import { entityIdSchema } from "@/schemas/primitives"

export const syncDatabaseTestConfigSchema = z
  .strictObject({
    runId: entityIdSchema,
    port: z.number().int().min(1024).max(65535),
    mongodbUri: z.string(),
    mongodbDatabase: z.string(),
  })
  .refine(
    (config) => config.mongodbDatabase === `dalis-sync-test-${config.runId}`,
    "Sync test database must match its run identity"
  )
  .refine(
    (config) =>
      config.mongodbUri ===
      `mongodb://127.0.0.1:${config.port}/?replicaSet=dalis-sync-test&directConnection=true`,
    "Sync tests require the exact isolated loopback connection"
  )
