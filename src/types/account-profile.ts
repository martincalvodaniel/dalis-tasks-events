import type { z } from "zod"
import type { accountProfileSchema } from "@/schemas/account-profile"

export type AccountProfile = z.infer<typeof accountProfileSchema>
