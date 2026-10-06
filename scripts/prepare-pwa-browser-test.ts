import { resolve } from "node:path"

const result = await Bun.build({
  entrypoints: [resolve("test/browser/pwa.ts")],
  target: "browser",
  define: { "process.env.NODE_ENV": '"production"' },
})
if (!result.success) throw new Error("PWA browser test build failed")
await Bun.write("public/pwa-check.js", await result.outputs[0].text())
await Bun.write(
  "public/pwa-check.html",
  '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pruebas de apertura offline</title></head><body><h1>Pruebas de apertura offline</h1><p>Cuenta ficticia local, sin sesión remota.</p><ol id="results"></ol><p id="status" role="status">Comprobando…</p><div id="actions"></div><script type="module" src="/pwa-check.js"></script></body></html>'
)
console.info(
  "PWA browser fixture prepared; remove its generated public files after testing"
)
