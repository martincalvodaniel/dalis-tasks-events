import type { z } from "zod"
import type { remoteOperationReceiptV2Schema } from "@/schemas/remote-operation-receipt-v2"

export type RemoteOperationReceiptV2 = z.infer<
  typeof remoteOperationReceiptV2Schema
>
