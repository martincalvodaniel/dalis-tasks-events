import { z } from "zod"
import { userIdSchema } from "@/schemas/primitives"

const googlePhotoSchema = z
  .url()
  .max(2048)
  .refine((value) => {
    const url = new URL(value)
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (url.hostname === "googleusercontent.com" ||
        url.hostname.endsWith(".googleusercontent.com"))
    )
  }, "Account photos require a Google HTTPS URL")

// Presentation cache only. This profile never authorizes access or selects an account.
export const accountProfileSchema = z.strictObject({
  userId: userIdSchema,
  name: z.string().trim().max(200),
  email: z.email().max(254),
  image: googlePhotoSchema.nullable(),
})

export function accountProfileForUser(input: unknown, userId: string) {
  const profile = accountProfileSchema.safeParse(input)
  return profile.success && profile.data.userId === userId ? profile.data : null
}
