import { resolve } from "node:path"

const runId = crypto.randomUUID()
const bundle = await Bun.build({
  entrypoints: [resolve("test/browser/mixed-sync-store.ts")],
  target: "browser",
  define: { "process.env.NODE_ENV": '"production"' },
})
if (!bundle.success) throw new Error("Mixed sync store fixture failed to build")
const javascript = await bundle.outputs[0].text()
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Prueba de almacén mixto</title></head><body><button id="run">Ejecutar comprobación</button><ol id="results"></ol><p id="status" role="status">Entorno aislado preparado</p><script type="module" src="/fixture.js?run=${runId}"></script></body></html>`
let complete: (passed: boolean) => void = () => undefined
const finished = new Promise<boolean>((resolve) => {
  complete = resolve
})
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch(request) {
    const url = new URL(request.url)
    const headers = { "Cache-Control": "no-store" }
    if (
      url.searchParams.get("run") !== runId &&
      request.headers.get("x-sync-test-run") !== runId
    )
      return new Response("Forbidden", { status: 403, headers })
    if (url.pathname === "/fixture.js" && request.method === "GET")
      return new Response(javascript, {
        headers: { ...headers, "Content-Type": "text/javascript" },
      })
    if (url.pathname === "/" && request.method === "GET")
      return new Response(html, {
        headers: { ...headers, "Content-Type": "text/html" },
      })
    if (
      ["/fixture-pass", "/fixture-fail"].includes(url.pathname) &&
      request.method === "POST"
    ) {
      setTimeout(() => complete(url.pathname === "/fixture-pass"), 100)
      return new Response(null, { status: 204, headers })
    }
    return new Response("Not found", { status: 404, headers })
  },
})
console.info(`Mixed sync store fixture: ${server.url}?run=${runId}`)
const passed = await finished
await server.stop(true)
if (!passed) throw new Error("Mixed sync store browser checks failed")
console.info("Mixed sync store browser checks passed")
