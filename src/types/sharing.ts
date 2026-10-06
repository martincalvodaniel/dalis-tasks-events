import type { z } from "zod"
import type {
  itemMembershipSchema,
  shareInvitationSchema,
  sharingRoleSchema,
} from "@/schemas/sharing"

export type SharingRole = z.infer<typeof sharingRoleSchema>
export type ShareInvitation = z.infer<typeof shareInvitationSchema>
export type ItemMembership = z.infer<typeof itemMembershipSchema>
