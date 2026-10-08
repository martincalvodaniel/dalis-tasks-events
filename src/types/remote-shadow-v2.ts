import type { z } from "zod"
import type { remoteShadowV2Schema } from "@/schemas/remote-shadow-v2"

export type RemoteShadowV2 = z.infer<typeof remoteShadowV2Schema>
