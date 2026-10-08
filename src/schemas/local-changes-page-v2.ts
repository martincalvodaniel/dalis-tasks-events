import { z } from "zod"
import { remoteChangesPageV2Schema } from "@/schemas/remote-changes-page-v2"
import { remotePullQuerySchema } from "@/schemas/remote-sync"

export const localChangesPageInputV2Schema = z.strictObject({
  query: remotePullQuerySchema,
  page: remoteChangesPageV2Schema,
})
