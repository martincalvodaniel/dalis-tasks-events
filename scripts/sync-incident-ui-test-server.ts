import { resolve } from "node:path"

const bundle = await Bun.build({
  entrypoints: [
    resolve("test/browser/sync-incident-ui.tsx"),
    resolve("test/browser/sync-incident-edit.ts"),
  ],
  target: "browser",
})
if (!bundle.success) throw new Error("Incident UI fixture failed to build")
const javascript = new Map(
  await Promise.all(
    bundle.outputs.map(
      async (file) => [file.path.split("/").at(-1), await file.text()] as const
    )
  )
)
const styles = await Promise.all(
  Array.from(new Bun.Glob(".next/static/**/*.css").scanSync(".")).map((path) =>
    Bun.file(path).text()
  )
)
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Comparación de conflictos</title><link rel="stylesheet" href="/ui.css"></head><body class="p-3 text-zinc-900"><div id="root"></div><p id="status" role="status" class="mt-2 text-sm"></p><div id="actions"></div><script type="module" src="/fixture.js"></script></body></html>`
Bun.serve({
  hostname: "127.0.0.1",
  port: 4180,
  fetch(request) {
    const path = new URL(request.url).pathname
    const headers = { "Cache-Control": "no-store" }
    if (path === "/" || path === "/edit")
      return new Response(
        path === "/edit"
          ? html.replace("/fixture.js", "/sync-incident-edit.js")
          : html,
        {
          headers: { ...headers, "Content-Type": "text/html" },
        }
      )
    if (path === "/fixture.js" || path === "/sync-incident-edit.js")
      return new Response(
        javascript.get(
          path === "/fixture.js"
            ? "sync-incident-ui.js"
            : "sync-incident-edit.js"
        ),
        {
          headers: { ...headers, "Content-Type": "text/javascript" },
        }
      )
    if (path === "/ui.css")
      return new Response(styles.join("\n"), {
        headers: { ...headers, "Content-Type": "text/css" },
      })
    return new Response("Not found", { status: 404, headers })
  },
})
console.info("Incident UI test: http://127.0.0.1:4180")
