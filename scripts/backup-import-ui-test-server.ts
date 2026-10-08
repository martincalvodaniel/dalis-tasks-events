import { resolve } from "node:path"

const build = await Bun.build({
  entrypoints: [resolve("test/browser/backup-import-ui.tsx")],
  target: "browser",
})
if (!build.success) throw new Error("Backup import UI fixture failed to build")
const javascript = await build.outputs[0].text()
const styles = await Promise.all(
  [...new Bun.Glob(".next/static/**/*.css").scanSync(".")].map((path) =>
    Bun.file(path).text()
  )
)
const html =
  '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Prueba de importación local</title><link rel="stylesheet" href="/ui.css"></head><body class="p-3"><div id="root"></div><p id="status" role="status"></p><div id="actions"></div><script type="module" src="/fixture.js"></script></body></html>'
Bun.serve({
  hostname: "127.0.0.1",
  port: 4189,
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
    if (path === "/ui.css")
      return new Response(styles.join("\n"), {
        headers: { ...headers, "Content-Type": "text/css" },
      })
    return new Response("Not found", { status: 404, headers })
  },
})
console.info("Backup import UI fixture: http://127.0.0.1:4189/")
