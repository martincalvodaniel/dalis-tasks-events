import "server-only"

import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { betterAuth } from "better-auth"
import { getAuthDatabaseTestConfig, getAuthEnv } from "@/config/env"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"

const testConfig = getAuthDatabaseTestConfig()

function encodeBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "")
}

async function createIdentityToken(
  key: CryptoKey,
  subject: string,
  email: string
): Promise<string> {
  const encode = (data: Record<string, unknown>) =>
    encodeBase64Url(new TextEncoder().encode(JSON.stringify(data)))
  const now = Math.floor(Date.now() / 1000)
  const message = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: "https://accounts.google.com",
    aud: getAuthEnv().googleClientId,
    sub: subject,
    email,
    email_verified: true,
    name: "Test User",
    iat: now,
    exp: now + 300,
  })}`
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(message)
  )
  return `${message}.${encodeBase64Url(new Uint8Array(signature))}`
}

async function createTestAuth(
  publicKey: CryptoKey,
  options: { stateless?: boolean; cookieCache?: boolean } = {}
) {
  const { auth } = await import("@/lib/auth/auth")
  const instance = betterAuth({
    ...auth.options,
    database: options.stateless ? undefined : auth.options.database,
    user: {
      modelName: options.stateless ? "user" : auth.options.user.modelName,
    },
    account: {
      ...auth.options.account,
      modelName: options.stateless ? "account" : auth.options.account.modelName,
      storeAccountCookie: options.stateless,
    },
    verification: {
      modelName: options.stateless
        ? "verification"
        : auth.options.verification.modelName,
    },
    session: {
      ...auth.options.session,
      modelName: options.stateless ? "session" : auth.options.session.modelName,
      cookieCache: { enabled: options.cookieCache ?? false, strategy: "jwt" },
    },
    logger: { disabled: true },
  })
  const context = await instance.$context
  const google = context.socialProviders.find(
    (provider) => provider.id === "google"
  )
  if (!google?.idToken || !("jwks" in google.idToken)) {
    throw new Error("Google signature verification is not configured")
  }
  // Replace only the key source; signature, issuer, audience and age checks remain active.
  google.idToken.jwks = async () => publicKey
  return instance
}

type TestAuth = Awaited<ReturnType<typeof createTestAuth>>

async function signIn(instance: TestAuth, token: string) {
  const baseUrl = getAuthEnv().baseUrl
  const response = await instance.handler(
    new Request(`${baseUrl}/api/auth/sign-in/social`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl },
      body: JSON.stringify({ provider: "google", idToken: { token } }),
    })
  )
  expect(response.status).toBe(200)
  const payload = (await response.json()) as { user: { id: string } }
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ")
  return { userId: payload.user.id, cookie }
}

describe.skipIf(!testConfig)("persisted Google identity", () => {
  let keyPair: CryptoKeyPair

  beforeAll(async () => {
    // The config guard permits cleanup only in an explicitly selected local test database.
    await (await getDatabase()).dropDatabase()
    await closeDatabaseConnection()
    keyPair = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"]
    )
  })

  afterAll(async () => {
    await (await getDatabase()).dropDatabase()
    await closeDatabaseConnection()
  })

  test("reuses identity across clients, logout and connection restart", async () => {
    const token = await createIdentityToken(
      keyPair.privateKey,
      "test-google-alpha",
      "alpha@example.test"
    )
    const firstClient = await createTestAuth(keyPair.publicKey)
    const first = await signIn(firstClient, token)
    const second = await signIn(await createTestAuth(keyPair.publicKey), token)
    expect(second.userId).toBe(first.userId)

    const baseUrl = getAuthEnv().baseUrl
    const signOut = await firstClient.handler(
      new Request(`${baseUrl}/api/auth/sign-out`, {
        method: "POST",
        headers: { cookie: first.cookie, origin: baseUrl },
      })
    )
    expect(signOut.status).toBe(200)

    await closeDatabaseConnection()
    const restarted = await createTestAuth(keyPair.publicKey)
    const third = await signIn(restarted, token)
    expect(third.userId).toBe(first.userId)

    const sessionResponse = await restarted.handler(
      new Request(`${baseUrl}/api/auth/get-session?disableCookieCache=true`, {
        headers: { cookie: second.cookie },
      })
    )
    expect(sessionResponse.status).toBe(200)
    const persistedSession = (await sessionResponse.json()) as {
      user: { id: string }
    }
    expect(persistedSession.user.id).toBe(first.userId)
    expect(
      await (await getCollection(COLLECTION_NAMES.authUser)).countDocuments()
    ).toBe(1)
    expect(
      await (await getCollection(COLLECTION_NAMES.authAccount)).countDocuments()
    ).toBe(1)
  }, 20000)

  test("isolates different Google identities and enforces provider uniqueness", async () => {
    const instance = await createTestAuth(keyPair.publicKey)
    const alpha = await signIn(
      instance,
      await createIdentityToken(
        keyPair.privateKey,
        "test-google-alpha",
        "alpha@example.test"
      )
    )
    const beta = await signIn(
      instance,
      await createIdentityToken(
        keyPair.privateKey,
        "test-google-beta",
        "beta@example.test"
      )
    )
    expect(beta.userId).not.toBe(alpha.userId)
    const users = await getCollection(COLLECTION_NAMES.authUser)
    expect(await users.countDocuments()).toBe(2)

    const accounts = await getCollection(COLLECTION_NAMES.authAccount)
    await expect(
      accounts.insertOne({
        providerId: "google",
        accountId: "test-google-alpha",
        userId: beta.userId,
      })
    ).rejects.toMatchObject({ code: 11000 })
    expect(await accounts.countDocuments()).toBe(2)
  }, 20000)

  test("keeps the browser Google redirect flow configured", async () => {
    const instance = await createTestAuth(keyPair.publicKey)
    const baseUrl = getAuthEnv().baseUrl
    const response = await instance.handler(
      new Request(`${baseUrl}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: baseUrl },
        body: JSON.stringify({ provider: "google", callbackURL: "/" }),
      })
    )
    expect(response.status).toBe(200)
    const payload = (await response.json()) as { url: string }
    const authorizeUrl = new URL(payload.url)
    expect(authorizeUrl.hostname).toBe("accounts.google.com")
    expect(authorizeUrl.searchParams.get("client_id")).toBe(
      getAuthEnv().googleClientId
    )
    expect(authorizeUrl.searchParams.get("redirect_uri")).toBe(
      `${baseUrl}/api/auth/callback/google`
    )
  })

  test("rejects revoked and expired sessions despite a valid cookie cache", async () => {
    const { getAuthorizedSessionFromHeaders } = await import(
      "@/lib/auth/session"
    )
    const instance = await createTestAuth(keyPair.publicKey, {
      cookieCache: true,
    })
    const token = await createIdentityToken(
      keyPair.privateKey,
      "test-google-alpha",
      "alpha@example.test"
    )
    const signedIn = await signIn(instance, token)
    const headers = new Headers({ cookie: signedIn.cookie })
    const session = await getAuthorizedSessionFromHeaders(
      headers,
      instance.api.getSession
    )
    expect(session?.user.id).toBe(signedIn.userId)
    if (!session) throw new Error("Test session was not persisted")
    const sessions = await getCollection(COLLECTION_NAMES.authSession)
    await sessions.deleteOne({ token: session.session.token })
    expect((await instance.api.getSession({ headers }))?.user.id).toBe(
      signedIn.userId
    )
    expect(
      await getAuthorizedSessionFromHeaders(headers, instance.api.getSession)
    ).toBeNull()

    const next = await signIn(instance, token)
    const nextHeaders = new Headers({ cookie: next.cookie })
    const persisted = await getAuthorizedSessionFromHeaders(
      nextHeaders,
      instance.api.getSession
    )
    if (!persisted) throw new Error("Test session was not persisted")
    await sessions.updateOne(
      { token: persisted.session.token },
      { $set: { expiresAt: new Date(0) } }
    )
    expect(
      await getAuthorizedSessionFromHeaders(
        nextHeaders,
        instance.api.getSession
      )
    ).toBeNull()
  })

  test("requires login for a signed session from the former stateless setup", async () => {
    const { getAuthorizedSessionFromHeaders } = await import(
      "@/lib/auth/session"
    )
    const stateless = await createTestAuth(keyPair.publicKey, {
      stateless: true,
      cookieCache: true,
    })
    const signedIn = await signIn(
      stateless,
      await createIdentityToken(
        keyPair.privateKey,
        "test-google-alpha",
        "alpha@example.test"
      )
    )
    expect(
      await getAuthorizedSessionFromHeaders(
        new Headers({ cookie: signedIn.cookie })
      )
    ).toBeNull()
  })
})
