import "server-only"

import { describe, expect, test } from "bun:test"
import { authorizePersistedSession } from "@/lib/auth/authorized-session"

const now = new Date("2026-10-06T12:00:00Z")
const allowed = new Set(["alpha@example.test"])

function createSession() {
  return {
    user: {
      id: "persisted-user",
      email: "alpha@example.test",
      emailVerified: true,
    },
    session: {
      userId: "persisted-user",
      expiresAt: new Date("2026-10-07T12:00:00Z"),
    },
  }
}

describe("persisted session authorization", () => {
  test("accepts a verified, allowed, unexpired matching identity", () => {
    const session = createSession()
    expect(authorizePersistedSession(session, allowed, now)).toBe(session)
  })

  test("rejects missing, expired and invalid sessions", () => {
    expect(authorizePersistedSession(null, allowed, now)).toBeNull()
    for (const expiresAt of [
      now,
      new Date("2026-10-05"),
      new Date("invalid"),
    ]) {
      const session = createSession()
      session.session.expiresAt = expiresAt
      expect(authorizePersistedSession(session, allowed, now)).toBeNull()
    }
  })

  test("rejects mismatched, empty, unverified and disallowed identities", () => {
    const mismatch = createSession()
    mismatch.session.userId = "another-user"
    expect(authorizePersistedSession(mismatch, allowed, now)).toBeNull()
    const empty = createSession()
    empty.user.id = " "
    expect(authorizePersistedSession(empty, allowed, now)).toBeNull()
    const unverified = createSession()
    unverified.user.emailVerified = false
    expect(authorizePersistedSession(unverified, allowed, now)).toBeNull()
    const disallowed = createSession()
    disallowed.user.email = "other@example.test"
    expect(authorizePersistedSession(disallowed, allowed, now)).toBeNull()
    expect(
      authorizePersistedSession(createSession(), new Set(), now)
    ).toBeNull()
  })
})
