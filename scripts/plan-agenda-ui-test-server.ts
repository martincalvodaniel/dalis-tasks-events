import { resolve } from "node:path"

const mode = process.argv[2] ?? "agenda"
if (
  mode !== "agenda" &&
  mode !== "tag-order-review" &&
  mode !== "tag-delete-review" &&
  mode !== "placement-review" &&
  mode !== "recurring-placement-review" &&
  mode !== "appearance-cohort-review"
)
  throw new Error("Unknown plan UI fixture mode")
const build = await Bun.build({
  entrypoints: [
    resolve(
      mode === "recurring-placement-review"
        ? "test/browser/recurring-placement-review.tsx"
        : mode === "appearance-cohort-review"
          ? "test/browser/appearance-cohort-review.tsx"
          : mode === "placement-review"
            ? "test/browser/placement-review.tsx"
            : mode === "tag-delete-review"
              ? "test/browser/tag-delete-review.tsx"
              : mode === "tag-order-review"
                ? "test/browser/tag-order-review.tsx"
                : "test/browser/plan-agenda-ui.tsx"
    ),
  ],
  target: "browser",
  define: { "process.env.NODE_ENV": JSON.stringify("development") },
})
if (!build.success) throw new Error("Plan agenda UI fixture failed to build")
const javascript = await build.outputs[0].text()
const styles = await Promise.all(
  [...new Bun.Glob(".next/static/**/*.css").scanSync(".")].map((path) =>
    Bun.file(path).text()
  )
)
const html =
  '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Prueba de planes y apariciones</title><link rel="stylesheet" href="/ui.css"></head><body class="bg-zinc-950 p-3 text-zinc-100"><div id="root"></div><p id="status" role="status" class="mt-3 text-xs"></p><div id="actions" class="mt-2"></div><script type="module" src="/fixture.js"></script></body></html>'
Bun.serve({
  hostname: "127.0.0.1",
  port: 4217,
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
console.info("Plan agenda UI fixture: http://127.0.0.1:4217/")
