import { getSyncDatabaseTestConfig } from "@/config/env"
import { getSyncChangesResponse } from "@/features/sync/pull-response"
import { pushSyncBatch } from "@/features/sync/push-batch"
import { closeDatabaseConnection, getDatabase } from "@/lib/db/client"
import { readRemoteChanges } from "@/lib/db/remote-changes"
import { executeRemoteItemOperation } from "@/lib/db/remote-item-commands"
import { RemoteItemRepository } from "@/lib/db/remote-items"
import { remotePushInputSchema } from "@/schemas/remote-sync"
import { syncBrowserFixtureSchema } from "@/schemas/sync-browser-test"

const config = getSyncDatabaseTestConfig()
if (!config)
  throw new Error("Isolated browser tests require an owned descriptor")
if ((await getDatabase()).databaseName !== config.mongodbDatabase)
  throw new Error("Browser test database identity is inconsistent")
const runId = config.runId
const userId = `browser-test-${runId}-sync-devices`
const bundles = await Bun.build({
  entrypoints: ["test/browser/sync-devices.ts", "test/browser/sync-device.ts"],
  target: "browser",
})
if (!bundles.success) throw new Error("Sync browser fixtures failed to build")
const javascript = new Map(
  await Promise.all(
    bundles.outputs.map(
      async (file) => [file.path.split("/").at(-1), await file.text()] as const
    )
  )
)
let fixture: ReturnType<typeof syncBrowserFixtureSchema.parse>
let finishing = false
let complete: (passed: boolean) => void = () => undefined
const finished = new Promise<boolean>((resolve) => {
  complete = resolve
})
const headers = { "Cache-Control": "private, no-store" }
async function respond(request: Request): Promise<Response> {
  const url = new URL(request.url)
  if (
    url.searchParams.get("run") !== runId &&
    request.headers.get("x-sync-test-run") !== runId
  )
    return new Response("Fixture capability required", { status: 403, headers })
  if (finishing)
    return new Response("Fixture is closing", { status: 503, headers })
  if (request.method === "GET" && url.pathname === "/fixture-config")
    return Response.json(fixture, { headers })
  if (request.method === "GET" && url.pathname === "/api/sync/identity")
    return Response.json({ userId }, { headers })
  if (request.method === "GET" && url.pathname === "/api/sync/changes")
    return getSyncChangesResponse(request, {
      readActor: async () => userId,
      readChanges: readRemoteChanges,
    })
  if (request.method === "POST" && url.pathname === "/fixture-push") {
    const input = remotePushInputSchema.safeParse(
      await request.json().catch(() => null)
    )
    if (!input.success)
      return new Response("Invalid fixture batch", { status: 400, headers })
    return Response.json(
      await pushSyncBatch(input.data, {
        readActor: async () => userId,
        execute: executeRemoteItemOperation,
      }),
      { headers }
    )
  }
  if (request.method === "GET" && url.pathname === "/fixture-items")
    return Response.json(
      (await (await RemoteItemRepository.open(userId)).page()).items,
      { headers }
    )
  if (
    request.method === "POST" &&
    ["/fixture-pass", "/fixture-fail"].includes(url.pathname)
  ) {
    finishing = true
    setTimeout(() => complete(url.pathname === "/fixture-pass"), 250)
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
      `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prueba integrada de sincronización</title><h1>${device ? "Dispositivo ficticio" : "Dos dispositivos y MongoDB"}</h1><p id="status">Preparando…</p><ol id="results"></ol><div id="actions"></div><script type="module" src="/${device ? "sync-device" : "sync-devices"}.js?run=${runId}"></script></html>`,
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
  console.info(`Sync browser fixture: ${fixture.origins[0]}/?run=${runId}`)
  const deadline = setTimeout(() => complete(false), 600000)
  for (const signal of ["SIGTERM", "SIGINT"] as const)
    process.once(signal, () => complete(false))
  passed = await finished
  clearTimeout(deadline)
} finally {
  for (const server of servers) await server.stop(true)
  await closeDatabaseConnection()
}
if (!passed) throw new Error("Integrated browser sync fixture did not pass")
