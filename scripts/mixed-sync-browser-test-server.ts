import { getSyncDatabaseTestConfig } from "@/config/env"
import { pushSyncBatchV2 } from "@/features/sync/push-batch-v2"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import { ensureIndexes, INDEX_SPECS } from "@/lib/db/ensure-indexes"
import { readRemoteChangesV2 } from "@/lib/db/remote-changes-v2"
import { RemoteItemViewRepository } from "@/lib/db/remote-item-views"
import { RemoteItemRepository } from "@/lib/db/remote-items"
import { executeRemoteOperationV2 } from "@/lib/db/remote-operation-commands"
import { RemoteTagRepository } from "@/lib/db/remote-tags"
import { mixedSyncBrowserRemoteSchema } from "@/schemas/mixed-sync-browser-test"
import { remotePushInputV2Schema } from "@/schemas/remote-push-v2"
import { remotePullQuerySchema } from "@/schemas/remote-sync"
import { syncBrowserFixtureSchema } from "@/schemas/sync-browser-test"

const config = getSyncDatabaseTestConfig()
if (!config)
  throw new Error("Mixed browser fixture requires its owned descriptor")
const database = await getDatabase()
if (database.databaseName !== config.mongodbDatabase)
  throw new Error("Mixed browser fixture database identity is inconsistent")
await ensureIndexes(
  database,
  INDEX_SPECS.filter((spec) => spec.provisioning === "explicit")
)
const runId = config.runId
const userId = `browser-test-${runId}-sync-devices`
const bundles = await Bun.build({
  entrypoints: [
    "test/browser/mixed-sync-devices.ts",
    "test/browser/mixed-sync-device.ts",
  ],
  target: "browser",
  define: { "process.env.NODE_ENV": '"production"' },
})
if (!bundles.success) throw new Error("Mixed browser fixture failed to build")
const javascript = new Map(
  await Promise.all(
    bundles.outputs.map(
      async (file) => [file.path.split("/").at(-1), await file.text()] as const
    )
  )
)
let fixture: ReturnType<typeof syncBrowserFixtureSchema.parse>
let closing = false
let finish: (passed: boolean) => void = () => undefined
const finished = new Promise<boolean>((resolve) => {
  finish = resolve
})
const headers = { "Cache-Control": "private, no-store" }
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
  if (request.method === "POST" && url.pathname === "/fixture-push-v2") {
    const input = remotePushInputV2Schema.safeParse(
      await request.json().catch(() => null)
    )
    if (!input.success)
      return new Response("Invalid mixed fixture batch", {
        status: 400,
        headers,
      })
    return Response.json(
      await pushSyncBatchV2(input.data, {
        readActor: async () => userId,
        execute: executeRemoteOperationV2,
      }),
      { headers }
    )
  }
  if (request.method === "GET" && url.pathname === "/fixture-changes-v2") {
    const query = remotePullQuerySchema.safeParse({
      after: url.searchParams.get("after") ?? undefined,
      through: url.searchParams.get("through"),
      limit: url.searchParams.get("limit") ?? undefined,
    })
    if (!query.success)
      return new Response("Invalid mixed fixture query", {
        status: 400,
        headers,
      })
    return Response.json(await readRemoteChangesV2(userId, query.data), {
      headers,
    })
  }
  if (request.method === "GET" && url.pathname === "/fixture-records") {
    const items = (await (await RemoteItemRepository.open(userId)).page()).items
    const tags = await (await RemoteTagRepository.open(userId)).catalog()
    const repository = await RemoteItemViewRepository.open(userId)
    const views = (
      await Promise.all(items.map((item) => repository.read(item.id)))
    ).filter((view) => view !== null)
    const page = await readRemoteChangesV2(userId, {
      after: 0,
      through: null,
      limit: 100,
    })
    return Response.json(
      mixedSyncBrowserRemoteSchema.parse({ items, tags, views, page }),
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
      `<!doctype html><html lang="es"><meta charset="utf-8"><title>Prueba mixta con dos dispositivos</title><body><h1>Dos dispositivos y MongoDB</h1><p id="status">Preparando…</p><div id="actions"></div><ol id="results"></ol><script type="module" src="/${device ? "mixed-sync-device" : "mixed-sync-devices"}.js?run=${runId}"></script></html>`,
      { headers: { ...headers, "Content-Type": "text/html" } }
    )
  }
  return new Response("Not found", { status: 404, headers })
}
const servers: ReturnType<typeof Bun.serve>[] = []
let passed = false
try {
  for (let index = 0; index < 2; index++)
    servers.push(Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: respond }))
  fixture = syncBrowserFixtureSchema.parse({
    runId,
    userId,
    origins: servers.map((server) => `http://127.0.0.1:${server.port}`),
  })
  console.info(
    `Mixed sync browser fixture: ${fixture.origins[0]}/?run=${runId}`
  )
  const deadline = setTimeout(() => finish(false), 600000)
  for (const signal of ["SIGTERM", "SIGINT"] as const)
    process.once(signal, () => finish(false))
  passed = await finished
  clearTimeout(deadline)
} finally {
  for (const server of servers) await server.stop(true)
  await closeDatabaseConnection()
}
if (!passed) throw new Error("Integrated mixed browser fixture did not pass")
