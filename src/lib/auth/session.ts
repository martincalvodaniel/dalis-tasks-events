import "server-only"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"
import { getAuthEnv } from "@/config/env"
import { isEmailAllowed, parseAllowedEmails } from "@/lib/auth/allowed-emails"
import { auth } from "@/lib/auth/auth"

const allowedEmails = parseAllowedEmails(getAuthEnv().allowedEmails)

export const getAuthorizedSession = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user.email) {
    return null
  }

  return isEmailAllowed(session.user.email, allowedEmails) ? session : null
})

export async function requireAuthorizedSession() {
  const session = await getAuthorizedSession()

  if (!session) {
    redirect("/auth/signin")
  }

  return session
}
