import { resolve } from "node:path"

const build = await Bun.build({
  entrypoints: [resolve("test/browser/common-plan-release.tsx")],
  target: "browser",
  define: { "process.env.NODE_ENV": JSON.stringify("development") },
})
if (!build.success)
  throw new Error("Common plan release fixture failed to build")
const javascript = await build.outputs[0].text()
const styles = await Promise.all(
  [...new Bun.Glob(".next/static/**/*.css").scanSync(".")].map((path) =>
    Bun.file(path).text()
  )
)
const html =
  '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Prueba de preparación local</title><link rel="stylesheet" href="/ui.css"></head><body class="bg-zinc-950 p-3 text-zinc-100"><h1 class="text-lg">Prueba de preparación local</h1><p id="status" role="status" class="my-3 text-sm">Preparando prueba aislada…</p><div id="root"></div><div id="actions" class="mt-3 flex flex-wrap gap-3"></div><script type="module" src="/fixture.js"></script></body></html>'
Bun.serve({
  hostname: "127.0.0.1",
  port: 4241,
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
console.info("Common plan release fixture: http://127.0.0.1:4241/")
