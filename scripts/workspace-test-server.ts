import { resolve } from "node:path"
import { entityIdSchema } from "@/schemas/primitives"

const runId = entityIdSchema.parse(process.argv[3] ?? crypto.randomUUID())
const userId = `browser-test-${runId}-workspace`
const production = process.argv[2] === "production"
const port = production ? 4184 : 4179
const build = await Bun.build({
  entrypoints: [resolve("test/browser/workspace.tsx")],
  target: "browser",
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      production ? "production" : "development"
    ),
  },
})
if (!build.success) throw new Error("Workspace test bundle failed")
const javascript = await build.outputs[0].text()
const styles: string[] = []
for await (const path of new Bun.Glob("**/*.css").scan(".next/static"))
  styles.push(await Bun.file(resolve(".next/static", path)).text())
let authorized = false
let delayed = false
let workerUnavailable = false
let identityRequests = 0
let releaseIdentity: (() => void) | null = null
const html = (workspace: boolean) =>
  `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Prueba de espacio local</title><style>${styles.join("\n")}</style></head><body>${workspace ? '<div id="workspace"></div>' : '<main style="padding:20px"><h1>Preparación local con identidad ficticia</h1><ol id="results"></ol><p id="status" role="status">Comprobando…</p><div id="actions"></div></main>'}<script type="module" src="/tests.js"></script></body></html>`

Bun.serve({
  hostname: "127.0.0.1",
  port,
  async fetch(request) {
    const url = new URL(request.url)
    const headers = { "Cache-Control": "no-store" }
    if (url.pathname === "/tests.js")
      return new Response(javascript, {
        headers: { ...headers, "Content-Type": "text/javascript" },
      })
    if (url.pathname === "/test/session") {
      authorized = url.searchParams.get("state") === "authorized"
      delayed = url.searchParams.get("delay") === "true"
      workerUnavailable = url.searchParams.get("worker") === "missing"
      return Response.json({ userId }, { headers })
    }
    if (url.pathname === "/test/status")
      return Response.json(
        { identityRequests, waiting: releaseIdentity !== null },
        { headers }
      )
    if (url.pathname === "/test/release") {
      releaseIdentity?.()
      releaseIdentity = null
      return Response.json({ released: true }, { headers })
    }
    if (url.pathname === "/api/sync/identity") {
      identityRequests++
      if (delayed)
        await new Promise<void>((resolve) => {
          releaseIdentity = resolve
        })
      return Response.json(
        authorized ? { userId } : { error: "Authentication required" },
        { status: authorized ? 200 : 401, headers }
      )
    }
    if (url.pathname === "/api/auth/sign-out") {
      authorized = false
      return Response.json({ success: true }, { headers })
    }
    if (workerUnavailable && url.pathname === "/dalis-sw.js")
      return new Response("Worker unavailable", { status: 404, headers })
    if (production && url.pathname !== "/") {
      const upstream = new URL(
        url.pathname + url.search,
        "http://127.0.0.1:4183"
      )
      const response = await fetch(upstream, {
        redirect: "manual",
        headers: { "Accept-Encoding": "identity" },
      })
      const upstreamHeaders = new Headers(response.headers)
      upstreamHeaders.delete("content-encoding")
      upstreamHeaders.delete("content-length")
      return new Response(await response.arrayBuffer(), {
        status: response.status,
        headers: upstreamHeaders,
      })
    }
    if (url.pathname === "/" || url.pathname === "/workspace")
      return new Response(html(url.pathname === "/workspace"), {
        headers: { ...headers, "Content-Type": "text/html" },
      })
    return new Response("Not found", { status: 404, headers })
  },
})
console.info(`Workspace browser tests: http://127.0.0.1:${port}`)
