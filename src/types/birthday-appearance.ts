import type { z } from "zod"
import type { birthdayAppearanceSchema } from "@/schemas/birthday-appearance"

export type BirthdayAppearance = z.infer<typeof birthdayAppearanceSchema>
export interface BirthdayAppearancePage {
  appearances: BirthdayAppearance[]
  nextAfter: string | null
}
