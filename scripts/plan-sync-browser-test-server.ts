import { getSyncDatabaseTestConfig } from "@/config/env"
import {
  planSyncProtocolVersion,
  syncProtocolHeader,
} from "@/config/sync-protocol"
import { pushSyncBatchV2 } from "@/features/sync/push-batch-v2"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { ensureIndexes, INDEX_SPECS } from "@/lib/db/ensure-indexes"
import { readRemotePlanChangesV2 } from "@/lib/db/remote-changes-v2"
import { RemoteItemViewRepository } from "@/lib/db/remote-item-views"
import { RemoteItemRepository } from "@/lib/db/remote-items"
import { executeRemoteOperationV4 } from "@/lib/db/remote-operation-commands-v4"
import { RemoteTagRepository } from "@/lib/db/remote-tags"
import { RemoteTaskPlacementRepository } from "@/lib/db/remote-task-placements"
import { encodeSyncProtocolRange } from "@/lib/sync/sync-protocol"
import { planSyncBrowserRemoteSchema } from "@/schemas/plan-sync-browser-test"
import { userIdSchema } from "@/schemas/primitives"
import { remotePushInputV2Schema } from "@/schemas/remote-push-v2"
import { remotePullQuerySchema } from "@/schemas/remote-sync"
import { syncBrowserFixtureSchema } from "@/schemas/sync-browser-test"

const config = getSyncDatabaseTestConfig()
if (!config)
  throw new Error("Plan browser fixture requires its owned descriptor")
const runId = config.runId
const userId = `browser-test-${runId}-sync-devices`
const javascript = new Map<string, string>()
let fixture: ReturnType<typeof syncBrowserFixtureSchema.parse>
let closing = false
let finish: (passed: boolean) => void = () => undefined
const finished = new Promise<boolean>((resolve) => {
  finish = resolve
})
const headers = {
  "Cache-Control": "private, no-store",
  [syncProtocolHeader]: encodeSyncProtocolRange(planSyncProtocolVersion),
}

async function respond(request: Request): Promise<Response> {
  const url = new URL(request.url)
  if (closing)
    return new Response("Fixture is closing", { status: 503, headers })
  if (
    url.searchParams.get("run") !== runId &&
    request.headers.get("x-sync-test-run") !== runId
  )
    return new Response("Fixture capability required", { status: 403, headers })
  if (
    request.method !== "GET" &&
    request.headers.get("x-sync-test-run") !== runId
  )
    return new Response("Fixture mutation capability required", {
      status: 403,
      headers,
    })
  if (request.method === "GET" && url.pathname === "/fixture-config")
    return Response.json(fixture, { headers })
  if (request.method === "GET" && url.pathname === "/fixture-identity")
    return Response.json({ userId }, { headers })
  if (request.method === "POST" && url.pathname === "/fixture-push-v2") {
    const input = remotePushInputV2Schema.safeParse(
      await request.json().catch(() => null)
    )
    if (!input.success)
      return new Response("Invalid plan fixture batch", {
        status: 400,
        headers,
      })
    return Response.json(
      await pushSyncBatchV2(input.data, {
        readActor: async () => userId,
        execute: executeRemoteOperationV4,
      }),
      { headers }
    )
  }
  if (request.method === "GET" && url.pathname === "/fixture-changes-v2") {
    const expectedUserId = url.searchParams.get("expectedUserId")
    if (
      expectedUserId !== null &&
      (!userIdSchema.safeParse(expectedUserId).success ||
        expectedUserId !== userId)
    )
      return Response.json(
        { error: "Fixture account changed", code: "account_changed" },
        { status: 409, headers }
      )
    const query = remotePullQuerySchema.safeParse({
      after: url.searchParams.get("after") ?? undefined,
      through: url.searchParams.get("through"),
      limit: url.searchParams.get("limit") ?? undefined,
    })
    if (!query.success)
      return new Response("Invalid plan fixture query", {
        status: 400,
        headers,
      })
    return Response.json(await readRemotePlanChangesV2(userId, query.data), {
      headers,
    })
  }
  if (request.method === "GET" && url.pathname === "/fixture-records") {
    const items = await (await RemoteItemRepository.open(userId)).catalog()
    const tags = await (await RemoteTagRepository.open(userId)).catalog()
    const views = await (await RemoteItemViewRepository.open(userId)).catalog()
    const placements = await (
      await RemoteTaskPlacementRepository.open(userId)
    ).catalog()
    const page = await readRemotePlanChangesV2(userId, {
      after: 0,
      through: null,
      limit: 100,
    })
    const receiptCount = await (
      await getCollection(COLLECTION_NAMES.syncOperations)
    ).countDocuments({ actorUserId: userId })
    return Response.json(
      planSyncBrowserRemoteSchema.parse({
        items,
        tags,
        views,
        placements,
        page,
        receiptCount,
      }),
      { headers }
    )
  }
  if (
    request.method === "POST" &&
    ["/fixture-pass", "/fixture-fail"].includes(url.pathname)
  ) {
    closing = true
    setTimeout(() => finish(url.pathname === "/fixture-pass"), 250)
    return new Response("Fixture finishing", { headers })
  }
  const bundle = javascript.get(url.pathname.slice(1))
  if (request.method === "GET" && bundle)
    return new Response(bundle, {
      headers: { ...headers, "Content-Type": "text/javascript" },
    })
  if (request.method === "GET" && ["/", "/device"].includes(url.pathname)) {
    const device = url.pathname === "/device"
    return new Response(
      `<!doctype html><html lang="es"><meta charset="utf-8"><title>Prueba de planes con dos dispositivos</title><body><h1>Planes y MongoDB</h1><p id="status">Preparando…</p><div id="actions"></div><ol id="results"></ol><script type="module" src="/${device ? "plan-sync-device" : "plan-sync-devices"}.js?run=${runId}"></script></html>`,
      { headers: { ...headers, "Content-Type": "text/html" } }
    )
  }
  return new Response("Not found", { status: 404, headers })
}

const servers: ReturnType<typeof Bun.serve>[] = []
let deadline: ReturnType<typeof setTimeout> | undefined
let passed = false
const stop = () => finish(false)
try {
  const database = await getDatabase()
  if (database.databaseName !== config.mongodbDatabase)
    throw new Error("Plan browser fixture database identity is inconsistent")
  await ensureIndexes(
    database,
    INDEX_SPECS.filter((spec) => spec.provisioning === "explicit")
  )
  const bundles = await Bun.build({
    entrypoints: [
      "test/browser/plan-sync-devices.ts",
      "test/browser/plan-sync-device.ts",
    ],
    target: "browser",
    define: { "process.env.NODE_ENV": '"production"' },
  })
  if (!bundles.success) throw new Error("Plan browser fixture failed to build")
  for (const file of bundles.outputs) {
    const name = file.path.split("/").at(-1)
    if (!name) throw new Error("Plan browser fixture bundle has no filename")
    javascript.set(name, await file.text())
  }
  for (let index = 0; index < 2; index++)
    servers.push(
      Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        fetch: async (request) => {
          try {
            return await respond(request)
          } catch {
            return new Response("Plan fixture request failed", {
              status: 503,
              headers,
            })
          }
        },
      })
    )
  fixture = syncBrowserFixtureSchema.parse({
    runId,
    userId,
    origins: servers.map((server) => `http://127.0.0.1:${server.port}`),
  })
  console.info(`Plan sync browser fixture: ${fixture.origins[0]}/?run=${runId}`)
  deadline = setTimeout(stop, 600000)
  for (const signal of ["SIGTERM", "SIGINT"] as const)
    process.once(signal, stop)
  passed = await finished
} finally {
  if (deadline) clearTimeout(deadline)
  for (const signal of ["SIGTERM", "SIGINT"] as const)
    process.removeListener(signal, stop)
  for (const server of servers) await server.stop(true)
  await closeDatabaseConnection()
}
if (!passed) throw new Error("Integrated plan browser fixture did not pass")
