import { resolve } from "node:path"

const build = await Bun.build({
  entrypoints: [resolve("test/browser/user-settings-pull.ts")],
  target: "browser",
})
if (!build.success) throw new Error("Personal settings fixture failed to build")
const javascript = await build.outputs[0].text()
const html =
  '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prueba de confirmación local</title></head><body><h1>Descarga local de ajustes</h1><p id="status" role="status">Preparando prueba propia…</p><ol id="results"></ol><button id="run">Ejecutar comprobaciones</button><button id="reload">Verificar recarga</button><button id="cleanup">Limpiar prueba propia</button><script type="module" src="/fixture.js"></script></body></html>'
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 4264,
  fetch(request) {
    const path = new URL(request.url).pathname
    const headers = { "Cache-Control": "no-store" }
    if (path === "/")
      return new Response(html, {
        headers: { ...headers, "Content-Type": "text/html" },
      })
    if (path === "/fixture.js")
      return new Response(javascript, {
        headers: { ...headers, "Content-Type": "text/javascript" },
      })
    return new Response("Not found", { status: 404 })
  },
})
console.info(`Personal settings pull fixture: http://127.0.0.1:${server.port}/`)
