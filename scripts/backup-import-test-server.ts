import { resolve } from "node:path"

const runId = crypto.randomUUID()
const bundle = await Bun.build({
  entrypoints: [resolve("test/browser/backup-import.ts")],
  target: "browser",
  define: { "process.env.NODE_ENV": '"production"' },
})
if (!bundle.success) throw new Error("Backup import fixture failed to build")
const javascript = await bundle.outputs[0].text()
const html =
  '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Prueba de importación offline</title></head><body><ol id="results"></ol><p id="status" role="status">Comprobando…</p><div id="actions"></div><script type="module" src="/fixture.js"></script></body></html>'
Bun.serve({
  hostname: "127.0.0.1",
  port: 4188,
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
console.info(`Import fixture: http://127.0.0.1:4188/?run=${runId}`)
