import "server-only"

import {
  fixtureEmail,
  getNextSyncTestConfig,
  type NextSyncPrivateConfig,
} from "@/config/next-sync-test"
import { readNextSettingsFixtureJournal } from "@/lib/sync/next-settings-fixture-journal"
import {
  nextSyncBootstrapSchema,
  nextSyncCapabilitySchema,
  nextSyncIndexControlSchema,
  nextSyncSessionCommandSchema,
  nextSyncStateQuerySchema,
} from "@/schemas/next-sync-test"

interface OwnedSession {
  name: string
  value: string
  token: string
  userId: string
}
interface FixtureState {
  runId: string
  sessions: Map<string, OwnedSession>
  auth?: ReturnType<typeof initializeFixture>
}
const fixtureGlobal = globalThis as typeof globalThis & {
  dalisNextSyncFixture?: FixtureState
}
function ownedState(config: NextSyncPrivateConfig): FixtureState {
  // Next route/action chunks share one registry; it is private to this isolated test process.
  if (!fixtureGlobal.dalisNextSyncFixture)
    fixtureGlobal.dalisNextSyncFixture = {
      runId: config.runId,
      sessions: new Map(),
    }
  if (fixtureGlobal.dalisNextSyncFixture.runId !== config.runId)
    throw new Error("Next fixture process already belongs to another run")
  return fixtureGlobal.dalisNextSyncFixture
}

export function assertNextSyncOwnedCookies(
  headers: Headers,
  registered: ReadonlyMap<string, { name: string }>
) {
  const selected: string[] = []
  for (const part of (headers.get("cookie") ?? "").split(";")) {
    const separator = part.indexOf("=")
    if (separator < 0) continue
    const name = part.slice(0, separator).trim()
    if (!/^(?:__Secure-)?better-auth\./.test(name)) continue
    let value: string
    try {
      value = decodeURIComponent(part.slice(separator + 1).trim())
    } catch {
      throw new Error("Foreign auth cookies block the fixture")
    }
    if (registered.get(value)?.name !== name)
      throw new Error("Foreign auth cookies block the fixture")
    selected.push(value)
  }
  return selected
}

export function validateNextSyncFixtureHeaders(
  headers: Headers,
  input: unknown,
  config: NextSyncPrivateConfig = getNextSyncTestConfig()
) {
  const capability = nextSyncCapabilitySchema.parse(input)
  if (capability.runId !== config.runId)
    throw new Error("Next sync fixture capability is invalid")
  const origin = headers.get("origin")
  if (origin !== null && origin !== config.authOrigin)
    throw new Error("Next sync fixture origin is invalid")
  return {
    config,
    selected: assertNextSyncOwnedCookies(headers, ownedState(config).sessions),
  }
}
export function validateNextSyncFixtureRequest(
  request: Request,
  input: unknown,
  config: NextSyncPrivateConfig = getNextSyncTestConfig()
) {
  const checked = validateNextSyncFixtureHeaders(request.headers, input, config)
  // NextURL canonicalizes 127.0.0.1 to localhost; validate the exact incoming Host instead.
  if (
    new URL(request.url).protocol !== "http:" ||
    request.headers.get("host") !== new URL(checked.config.authOrigin).host
  )
    throw new Error("Next sync fixture request host is invalid")
  return checked
}

async function initializeFixture(config: NextSyncPrivateConfig) {
  // Validate before importing auth or opening a connection; the ordinary app never imports this helper.
  if (config.mongodbDatabase !== `dalis-sync-test-${config.runId}`)
    throw new Error("Next fixture database ownership is invalid")
  const [
    { getDatabase },
    { ensureIndexes },
    { selectPlacementSyncIndexSpecs },
    { auth },
    { betterAuth },
    { testUtils },
  ] = await Promise.all([
    import("@/lib/db/client"),
    import("@/lib/db/ensure-indexes"),
    import("@/lib/db/mixed-sync-index-specs"),
    import("@/lib/auth/auth"),
    import("better-auth"),
    import("better-auth/plugins"),
  ])
  const database = await getDatabase()
  if (database.databaseName !== config.mongodbDatabase)
    throw new Error("Next fixture database ownership is invalid")
  await ensureIndexes(database, selectPlacementSyncIndexSpecs())
  return betterAuth({
    ...auth.options,
    logger: { disabled: true },
    plugins: [...(auth.options.plugins ?? []), testUtils()],
  })
}
async function fixture(config: NextSyncPrivateConfig) {
  const state = ownedState(config)
  state.auth ??= initializeFixture(config)
  return (await state.auth).$context
}

export async function bootstrapNextSyncSession(
  request: Request,
  input: unknown,
  onPhase: (
    phase: "auth_context" | "find_user" | "save_user" | "login" | "cookie"
  ) => void = () => {}
) {
  const parsed = nextSyncBootstrapSchema.parse(input)
  const { config } = validateNextSyncFixtureRequest(request, {
    runId: parsed.runId,
  })
  onPhase("auth_context")
  const context = await fixture(config)
  const email = fixtureEmail(config.runId, parsed.identity)
  onPhase("find_user")
  const existing = await context.internalAdapter.findUserByEmail(email)
  let user = existing?.user
  if (!user) {
    onPhase("save_user")
    user = await context.test.saveUser(
      context.test.createUser({
        email,
        emailVerified: parsed.identity !== "unverified",
        name: "Next sync fixture",
      })
    )
  }
  onPhase("login")
  const login = await context.test.login({ userId: user.id })
  onPhase("cookie")
  const ownedSessions = ownedState(config).sessions
  for (const cookie of login.cookies) {
    if (cookie.name !== "better-auth.session_token" || cookie.secure)
      throw new Error("Unexpected fixture session cookie")
    ownedSessions.set(cookie.value, {
      name: cookie.name,
      value: cookie.value,
      token: login.token,
      userId: user.id,
    })
  }
  // Cookie material is returned only to the fixture route for Set-Cookie, never to JSON or logs.
  return { userId: user.id, cookies: login.cookies }
}

export async function controlNextSyncSession(request: Request, input: unknown) {
  const parsed = nextSyncSessionCommandSchema.parse(input)
  let checkedRequest = request
  if (parsed.command === "cleanup") {
    const headers = new Headers(request.headers)
    headers.delete("cookie")
    checkedRequest = new Request(request.url, { headers })
  }
  const checked = validateNextSyncFixtureRequest(checkedRequest, {
    runId: parsed.runId,
  })
  const config = checked.config
  const ownedSessions = ownedState(config).sessions
  // Cleanup ignores foreign cookies but never deletes or overwrites them.
  const selected =
    parsed.command === "cleanup"
      ? [...ownedSessions.keys()].filter((value) => {
          const owned = ownedSessions.get(value)
          if (!owned) return false
          return (request.headers.get("cookie") ?? "")
            .split(";")
            .some((part) => {
              const separator = part.indexOf("=")
              if (
                separator < 0 ||
                part.slice(0, separator).trim() !== owned.name
              )
                return false
              try {
                return (
                  decodeURIComponent(part.slice(separator + 1).trim()) === value
                )
              } catch {
                return false
              }
            })
        })
      : checked.selected
  const context = selected.length ? await fixture(config) : null
  for (const value of selected) {
    const owned = ownedSessions.get(value)
    if (!owned || !context)
      throw new Error("Next fixture session ownership is invalid")
    if (parsed.command === "expire")
      await context.internalAdapter.updateSession(owned.token, {
        expiresAt: new Date(0),
      })
    else await context.internalAdapter.deleteSession(owned.token)
  }
  return {
    names:
      parsed.command === "cleanup"
        ? selected.flatMap((value) => {
            const owned = ownedSessions.get(value)
            return owned ? [owned.name] : []
          })
        : [],
  }
}

export async function readNextSyncFixtureState(
  request: Request,
  input: unknown
) {
  return readNextFixtureStateForScope(request, input, "plans")
}

export async function readNextRecurringSyncFixtureState(
  request: Request,
  input: unknown
) {
  return readNextFixtureStateForScope(request, input, "recurring")
}

export async function readNextSettingsSyncFixtureState(
  request: Request,
  input: unknown
) {
  return readNextFixtureStateForScope(request, input, "settings")
}

async function readNextFixtureStateForScope(
  request: Request,
  input: unknown,
  scope: "plans" | "recurring" | "settings"
) {
  const parsed = nextSyncStateQuerySchema.parse(input)
  const { config } = validateNextSyncFixtureRequest(request, {
    runId: parsed.runId,
  })
  const context = await fixture(config)
  const user = await context.internalAdapter.findUserById(parsed.userId)
  if (
    !user ||
    !(["owner", "other", "unverified"] as const).some(
      (identity) => user.email === fixtureEmail(config.runId, identity)
    )
  )
    throw new Error("Next fixture actor is not owned by this run")
  const [
    { COLLECTION_NAMES, getCollection },
    {
      readRemotePlanChangesV2,
      readRemoteRecurringChangesV2,
      readRemoteSettingsChangesV2,
    },
  ] = await Promise.all([
    import("@/lib/db/collections"),
    import("@/lib/db/remote-changes-v2"),
  ])
  const receipts = await getCollection(COLLECTION_NAMES.syncOperations)
  const items = await getCollection(COLLECTION_NAMES.items)
  const tags = await getCollection(COLLECTION_NAMES.tags)
  const views = await getCollection(COLLECTION_NAMES.itemViews)
  return {
    counts: {
      items: await items.countDocuments({ ownerId: parsed.userId }),
      tags: await tags.countDocuments({ userId: parsed.userId }),
      views: await views.countDocuments({ userId: parsed.userId }),
      receipts: await receipts.countDocuments({ actorUserId: parsed.userId }),
      ...(scope !== "plans"
        ? {
            occurrences: await (
              await getCollection(COLLECTION_NAMES.planOccurrences)
            ).countDocuments({ userId: parsed.userId }),
          }
        : {}),
      ...(scope === "settings"
        ? {
            settings: await (
              await getCollection(COLLECTION_NAMES.userSettings)
            ).countDocuments({ userId: parsed.userId }),
          }
        : {}),
    },
    page:
      scope === "settings"
        ? await readNextSettingsFixtureJournal((query) =>
            readRemoteSettingsChangesV2(parsed.userId, query)
          )
        : await (scope === "recurring"
            ? readRemoteRecurringChangesV2
            : readRemotePlanChangesV2)(parsed.userId, { after: 0, limit: 100 }),
  }
}

// Fault injection is limited to the exact registered index in this run's database.
export async function controlNextSyncFixtureReadiness(
  request: Request,
  input: unknown
) {
  return controlNextFixtureReadinessForScope(request, input, "plans")
}

export async function controlNextRecurringSyncFixtureReadiness(
  request: Request,
  input: unknown
) {
  return controlNextFixtureReadinessForScope(request, input, "recurring")
}

export async function controlNextSettingsSyncFixtureReadiness(
  request: Request,
  input: unknown
) {
  return controlNextFixtureReadinessForScope(request, input, "settings")
}

async function controlNextFixtureReadinessForScope(
  request: Request,
  input: unknown,
  scope: "plans" | "recurring" | "settings"
) {
  const parsed = nextSyncIndexControlSchema.parse(input)
  const { config } = validateNextSyncFixtureRequest(request, {
    runId: parsed.runId,
  })
  await fixture(config)
  const [
    { getDatabase },
    { ensureIndexes },
    {
      selectPlacementSyncIndexSpecs,
      selectRecurringSyncIndexSpecs,
      selectSettingsSyncIndexSpecs,
    },
  ] = await Promise.all([
    import("@/lib/db/client"),
    import("@/lib/db/ensure-indexes"),
    import("@/lib/db/mixed-sync-index-specs"),
  ])
  const database = await getDatabase()
  if (
    database.databaseName !== `dalis-sync-test-${config.runId}` ||
    database.databaseName !== config.mongodbDatabase
  )
    throw new Error("Readiness fault injection ownership changed")
  const selected =
    scope === "settings"
      ? selectSettingsSyncIndexSpecs()
      : scope === "recurring"
        ? selectRecurringSyncIndexSpecs()
        : selectPlacementSyncIndexSpecs()
  const placement = selected.find(
    (spec) =>
      spec.options.name ===
      (scope === "settings"
        ? "user_settings_user_uidx"
        : scope === "recurring"
          ? "plan_occurrences_user_series_slot_uidx"
          : "task_placements_user_scope_date_occurrence_uidx")
  )
  if (!placement || typeof placement.options.name !== "string")
    throw new Error("Owned readiness index is missing")
  if (parsed.command === "block")
    await database
      .collection(placement.collection)
      .dropIndex(placement.options.name)
  else await ensureIndexes(database, selected)
  return { complete: true }
}

export async function prepareNextRecurringSyncFixture(request: Request) {
  return prepareNextFixtureForScope(request, "recurring")
}
export async function prepareNextSettingsSyncFixture(request: Request) {
  return prepareNextFixtureForScope(request, "settings")
}
async function prepareNextFixtureForScope(
  request: Request,
  scope: "recurring" | "settings"
) {
  const { config } = validateNextSyncFixtureRequest(request, {
    runId: request.headers.get("x-sync-test-run"),
  })
  const [
    { getDatabase },
    { ensureIndexes },
    { selectRecurringSyncIndexSpecs, selectSettingsSyncIndexSpecs },
  ] = await Promise.all([
    import("@/lib/db/client"),
    import("@/lib/db/ensure-indexes"),
    import("@/lib/db/mixed-sync-index-specs"),
  ])
  const database = await getDatabase()
  if (
    database.databaseName !== config.mongodbDatabase ||
    database.databaseName !== `dalis-sync-test-${config.runId}`
  )
    throw new Error("Recurring fixture database ownership changed")
  await ensureIndexes(
    database,
    scope === "settings"
      ? selectSettingsSyncIndexSpecs()
      : selectRecurringSyncIndexSpecs()
  )
}
