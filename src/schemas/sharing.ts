import { z } from "zod"
import {
  entityIdSchema,
  recordMetadataShape,
  timestampSchema,
  userIdSchema,
} from "@/schemas/primitives"

export const sharingRoleSchema = z.enum(["reader", "editor"])
export const shareInvitationInputSchema = z.strictObject({
  itemId: entityIdSchema,
  recipientEmail: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  role: sharingRoleSchema,
})
export const shareInvitationSchema = shareInvitationInputSchema.extend({
  id: entityIdSchema,
  ownerId: userIdSchema,
  status: z.enum(["pending", "accepted", "declined", "revoked", "expired"]),
  expiresAt: timestampSchema,
  ...recordMetadataShape,
})
export const itemMembershipSchema = z.strictObject({
  itemId: entityIdSchema,
  userId: userIdSchema,
  role: sharingRoleSchema,
  revokedAt: timestampSchema.nullable(),
  ...recordMetadataShape,
})
