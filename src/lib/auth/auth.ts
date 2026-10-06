import "server-only"

import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { getAuthEnv } from "@/config/env"
import { isEmailAllowed, parseAllowedEmails } from "@/lib/auth/allowed-emails"

const authEnv = getAuthEnv()
const allowedEmails = parseAllowedEmails(authEnv.allowedEmails)

export const auth = betterAuth({
  baseURL: authEnv.baseUrl,
  secret: authEnv.secret,
  trustedOrigins: [authEnv.baseUrl],
  socialProviders: {
    google: {
      clientId: authEnv.googleClientId,
      clientSecret: authEnv.googleClientSecret,
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 7 * 24 * 60 * 60,
      strategy: "jwt",
      refreshCache: true,
    },
  },
  account: {
    storeStateStrategy: "cookie",
    storeAccountCookie: true,
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!isEmailAllowed(user.email, allowedEmails)) {
            return false
          }
        },
      },
    },
  },
  plugins: [nextCookies()],
})
