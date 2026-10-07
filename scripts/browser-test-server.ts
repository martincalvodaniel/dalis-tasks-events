import { resolve } from "node:path"

const suite = process.argv[2] ?? "local-db"
if (
  suite !== "local-db" &&
  suite !== "outbox" &&
  suite !== "preferences" &&
  suite !== "ordering" &&
  suite !== "task-ordering" &&
  suite !== "events" &&
  suite !== "occurrence-progress" &&
  suite !== "occurrence-edit" &&
  suite !== "task-snapshot" &&
  suite !== "occurrence-ordering"
)
  throw new Error("Unknown browser test suite")
const entrypoint = resolve(`test/browser/${suite}.ts`)
const build = await Bun.build({ entrypoints: [entrypoint], target: "browser" })
if (!build.success) throw new Error("Browser test bundle failed to build")
const javascript = await build.outputs[0].text()
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pruebas de almacenamiento local</title></head><body><h1>Pruebas de almacenamiento local</h1><p>Datos ficticios en bases de prueba separadas.</p><ol id="results"></ol><p id="status" role="status">Comprobando…</p><div id="actions"></div><script type="module" src="/tests.js"></script></body></html>`

Bun.serve({
  hostname: "127.0.0.1",
  port: 4179,
  fetch(request) {
    const path = new URL(request.url).pathname
    if (path === "/tests.js") {
      return new Response(javascript, {
        headers: {
          "Content-Type": "text/javascript",
          "Cache-Control": "no-store",
        },
      })
    }
    if (path === "/") {
      return new Response(html, {
        headers: { "Content-Type": "text/html", "Cache-Control": "no-store" },
      })
    }
    return new Response("Not found", { status: 404 })
  },
})
console.info("Browser tests: http://127.0.0.1:4179")
