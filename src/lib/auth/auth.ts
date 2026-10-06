import "server-only"

import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { getAuthEnv } from "@/config/env"
import { isEmailAllowed, parseAllowedEmails } from "@/lib/auth/allowed-emails"
import { createAuthDatabaseAdapter } from "@/lib/db/auth-adapter"
import { AUTH_MODEL_NAMES } from "@/lib/db/auth-models"

const authEnv = getAuthEnv()
const allowedEmails = parseAllowedEmails(authEnv.allowedEmails)

export const auth = betterAuth({
  baseURL: authEnv.baseUrl,
  secret: authEnv.secret,
  trustedOrigins: [authEnv.baseUrl],
  database: createAuthDatabaseAdapter(),
  user: {
    modelName: AUTH_MODEL_NAMES.user,
  },
  verification: {
    modelName: AUTH_MODEL_NAMES.verification,
  },
  socialProviders: {
    google: {
      clientId: authEnv.googleClientId,
      clientSecret: authEnv.googleClientSecret,
    },
  },
  session: {
    modelName: AUTH_MODEL_NAMES.session,
    cookieCache: {
      enabled: true,
      maxAge: 7 * 24 * 60 * 60,
      strategy: "jwt",
    },
  },
  account: {
    modelName: AUTH_MODEL_NAMES.account,
    storeStateStrategy: "cookie",
    storeAccountCookie: false,
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
