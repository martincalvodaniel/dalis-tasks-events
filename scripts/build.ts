import { readdir } from "node:fs/promises"
import { join } from "node:path"

const nextBuild = Bun.spawn(["bunx", "next", "build"], {
  stdout: "inherit",
  stderr: "inherit",
})
const exitCode = await nextBuild.exited
if (exitCode !== 0) process.exit(exitCode)

async function collectAssets(
  directory: string,
  prefix: string
): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? collectAssets(join(directory, entry.name), `${prefix}/${entry.name}`)
        : Promise.resolve(
            /\.(js|css|woff2?|ttf)$/.test(entry.name)
              ? [`${prefix}/${entry.name}`]
              : []
          )
    )
  )
  return nested.flat()
}
const buildId = (await Bun.file(".next/BUILD_ID").text()).trim()
const assets = [
  "/workspace",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  ...(await collectAssets(".next/static", "/_next/static")),
].sort()
const worker = await Bun.build({
  entrypoints: ["src/lib/pwa/service-worker.ts"],
  target: "browser",
  format: "iife",
  minify: true,
  define: {
    PWA_CACHE_VERSION: JSON.stringify(buildId),
    PWA_ASSET_URLS: JSON.stringify(assets),
  },
})
if (!worker.success) throw new Error("Offline worker build failed")
await Bun.write("public/dalis-sw.js", await worker.outputs[0].text())
console.info(`Prepared offline worker with ${assets.length} neutral resources`)
