import { expect, test } from "bun:test"
import { runInNewContext } from "node:vm"

const origin = "https://preview.example.test"
const assets = ["/workspace", "/_next/static/app.js"]
const bundle = await Bun.build({
  entrypoints: ["src/lib/pwa/service-worker.ts"],
  target: "browser",
  format: "iife",
  define: {
    PWA_CACHE_VERSION: '"protected-preview-test"',
    PWA_ASSET_URLS: JSON.stringify(assets),
  },
})
if (!bundle.success) throw new Error("Worker test build failed")
const source = await bundle.outputs[0].text()

async function installWorker(mode: "allowed" | "redirected" | "private") {
  const entries = new Map<string, Response>()
  const requests: WorkerRequest[] = []
  const deleted: string[] = []
  const listeners = new Map<
    string,
    (event: { waitUntil(work: Promise<void>): void }) => void
  >()
  // Model browser request options explicitly; Bun normalizes same-origin to include.
  class WorkerRequest {
    readonly url: string
    readonly credentials: RequestCredentials
    readonly cache: RequestCache
    constructor(path: string, init: RequestInit) {
      this.url = new URL(path, origin).href
      this.credentials = init.credentials ?? "same-origin"
      this.cache = init.cache ?? "default"
    }
  }
  runInNewContext(source, {
    URL,
    Request: WorkerRequest,
    self: {
      location: { origin },
      addEventListener: (
        name: string,
        listener: typeof listeners extends Map<string, infer Listener>
          ? Listener
          : never
      ) => listeners.set(name, listener),
    },
    caches: {
      open: async () => ({
        put: async (path: string, response: Response) =>
          entries.set(path, response),
      }),
      delete: async (name: string) => {
        deleted.push(name)
        entries.clear()
      },
    },
    fetch: async (request: WorkerRequest) => {
      requests.push(request)
      const redirected = mode === "redirected" || request.credentials === "omit"
      const response = new Response(
        mode === "private"
          ? "Private page"
          : '<div data-offline-shell="dalis"></div>'
      )
      Object.defineProperties(response, {
        url: { value: redirected ? "https://vercel.com/sso-api" : request.url },
        redirected: { value: redirected },
      })
      return response
    },
  })
  let work: Promise<void> | undefined
  listeners.get("install")?.({
    waitUntil: (pending) => {
      work = pending
    },
  })
  if (!work) throw new Error("Worker did not start installation")
  return { work, entries, requests, deleted }
}

test("protected preview precache sends same-origin credentials for every asset", async () => {
  const fixture = await installWorker("allowed")
  await fixture.work
  expect([...fixture.entries.keys()].sort()).toEqual([...assets].sort())
  expect(fixture.requests).toHaveLength(assets.length)
  for (const request of fixture.requests) {
    expect(request.credentials).toBe("same-origin")
    expect(request.cache).toBe("reload")
    expect(new URL(request.url).origin).toBe(origin)
  }
  expect(fixture.deleted).toEqual([])
})

for (const mode of ["redirected", "private"] as const) {
  test(`precache rejects ${mode} responses and removes the failed cache`, async () => {
    const fixture = await installWorker(mode)
    await expect(fixture.work).rejects.toThrow()
    expect(fixture.deleted).toEqual(["dalis-shell:protected-preview-test"])
    expect(fixture.entries.size).toBe(0)
  })
}
