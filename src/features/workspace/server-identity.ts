import "server-only"

import { getAuthorizedSession } from "@/lib/auth/session"
import { workspaceIdentitySchema } from "@/schemas/workspace"

export async function getWorkspaceIdentity() {
  const session = await getAuthorizedSession()
  return session
    ? workspaceIdentitySchema.parse({ userId: session.user.id })
    : null
}
