import { resolve } from "node:path"

const runId = crypto.randomUUID()
const bundle = await Bun.build({
  entrypoints: [resolve("test/browser/sync-pull-v2.ts")],
  target: "browser",
  define: { "process.env.NODE_ENV": '"production"' },
})
if (!bundle.success) throw new Error("Mixed pull fixture failed to build")
const javascript = await bundle.outputs[0].text()
const html =
  '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Prueba de descarga mixta</title></head><body><ol id="results"></ol><p id="status" role="status">Comprobando…</p><script type="module" src="/fixture.js"></script></body></html>'
// Bun refuses an occupied port; this fixture never attaches to an existing service.
Bun.serve({
  hostname: "127.0.0.1",
  port: 4192,
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
console.info(`Mixed pull fixture: http://127.0.0.1:4192/?run=${runId}`)
