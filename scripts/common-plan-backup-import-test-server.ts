import { resolve } from "node:path"

const runId = crypto.randomUUID()
const bundle = await Bun.build({
  entrypoints: [resolve("test/browser/common-plan-backup-import.ts")],
  target: "browser",
  define: { "process.env.NODE_ENV": '"production"' },
})
if (!bundle.success)
  throw new Error("Common backup import fixture failed to build")
const javascript = await bundle.outputs[0].text()
const html =
  '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Prueba de importación común</title></head><body><ol id="results"></ol><p id="status" role="status">Comprobando…</p><div id="actions"></div><script type="module" src="/fixture.js"></script></body></html>'
Bun.serve({
  hostname: "127.0.0.1",
  port: 4243,
  fetch(request) {
    const path = new URL(request.url).pathname
    const headers = { "Cache-Control": "no-store" }
    if (path === "/fixture.js")
      return new Response(javascript, {
        headers: { ...headers, "Content-Type": "text/javascript" },
      })
    if (path === "/")
      return new Response(html, {
        headers: { ...headers, "Content-Type": "text/html" },
      })
    return new Response("Not found", { status: 404, headers })
  },
})
console.info(`Common import fixture: http://127.0.0.1:4243/?run=${runId}`)
