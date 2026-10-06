import "server-only"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"
import { getAuthEnv } from "@/config/env"
import { parseAllowedEmails } from "@/lib/auth/allowed-emails"
import { auth } from "@/lib/auth/auth"
import { authorizePersistedSession } from "@/lib/auth/authorized-session"

const allowedEmails = parseAllowedEmails(getAuthEnv().allowedEmails)

export async function getAuthorizedSessionFromHeaders(
  requestHeaders: Headers,
  readSession: typeof auth.api.getSession = auth.api.getSession
) {
  // Authorization must read persisted state even if cookie caching is enabled later.
  // Rendering a Server Component must not renew sessions or mutate cookies.
  const session = await readSession({
    headers: requestHeaders,
    query: { disableCookieCache: true, disableRefresh: true },
  })
  return authorizePersistedSession(session, allowedEmails)
}

export const getAuthorizedSession = cache(async () =>
  getAuthorizedSessionFromHeaders(await headers())
)

export async function requireAuthorizedSession() {
  const session = await getAuthorizedSession()

  if (!session) {
    redirect("/auth/signin")
  }

  return session
}
