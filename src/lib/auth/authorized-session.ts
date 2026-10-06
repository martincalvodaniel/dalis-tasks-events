import "server-only"

import { isEmailAllowed } from "@/lib/auth/allowed-emails"

interface SessionIdentity {
  user: { id: string; email: string; emailVerified: boolean }
  session: { userId: string; expiresAt: Date }
}

export function authorizePersistedSession<T extends SessionIdentity>(
  session: T | null,
  allowedEmails: ReadonlySet<string>,
  now: Date = new Date()
): T | null {
  if (!session) return null

  const expiresAt = session.session.expiresAt.getTime()
  if (
    !session.user.id.trim() ||
    session.session.userId !== session.user.id ||
    !session.user.emailVerified ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= now.getTime() ||
    !isEmailAllowed(session.user.email, allowedEmails)
  ) {
    return null
  }

  return session
}
