import { resolve } from "node:path"

const runId = crypto.randomUUID()
const versions = await Promise.all(
  [1, 2].map(async (version) => {
    const build = await Bun.build({
      entrypoints: [resolve("src/lib/pwa/service-worker.ts")],
      target: "browser",
      define: {
        PWA_CACHE_VERSION: JSON.stringify(`fixture:${runId}:v${version}`),
        PWA_ASSET_URLS: JSON.stringify(["/workspace", "/fixture.js"]),
      },
    })
    if (!build.success) throw new Error("Worker fixture failed to build")
    return build.outputs[0].text()
  })
)
const bundle = await Bun.build({
  entrypoints: [resolve("test/browser/pwa-update.tsx")],
  target: "browser",
  define: { "process.env.NODE_ENV": '"production"' },
})
if (!bundle.success) throw new Error("Update UI fixture failed to build")
const javascript = await bundle.outputs[0].text()
const styles = await Promise.all(
  [...new Bun.Glob(".next/static/**/*.css").scanSync(".")].map((path) =>
    Bun.file(path).text()
  )
)
const html = `<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width, initial-scale=1"><meta charset="utf-8"><title>Prueba de actualización offline</title><link rel="stylesheet" href="/ui.css"></head><body class="p-3"><div data-offline-shell="dalis" id="root"></div><p id="status" role="status"></p><div id="actions"></div><script type="module" src="/fixture.js"></script></body></html>`
let deployed = 0
Bun.serve({
  hostname: "127.0.0.1",
  port: 4186,
  fetch(request) {
    const url = new URL(request.url)
    const headers = { "Cache-Control": "no-store" }
    if (url.pathname === "/fixture-config")
      return Response.json({ runId }, { headers })
    if (
      url.pathname === "/fixture-deploy" &&
      request.method === "POST" &&
      request.headers.get("x-update-test-run") === runId
    ) {
      deployed = 1
      return Response.json({ version: 2 }, { headers })
    }
    if (url.pathname === "/dalis-sw.js")
      return new Response(versions[deployed], {
        headers: {
          ...headers,
          "Content-Type": "application/javascript",
          "Service-Worker-Allowed": "/",
        },
      })
    if (url.pathname === "/fixture.js")
      return new Response(javascript, {
        headers: { ...headers, "Content-Type": "text/javascript" },
      })
    if (url.pathname === "/ui.css")
      return new Response(styles.join("\n"), {
        headers: { ...headers, "Content-Type": "text/css" },
      })
    if (url.pathname === "/" || url.pathname === "/workspace")
      return new Response(html, {
        headers: { ...headers, "Content-Type": "text/html" },
      })
    return new Response("Not found", { status: 404, headers })
  },
})
console.info(`Update fixture: http://127.0.0.1:4186/?run=${runId}`)
