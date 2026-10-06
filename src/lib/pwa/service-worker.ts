/// <reference lib="webworker" />

import { offlineCacheKey } from "@/lib/pwa/cache-policy"

declare const PWA_CACHE_VERSION: string
declare const PWA_ASSET_URLS: readonly string[]
const worker = self as unknown as ServiceWorkerGlobalScope
const cacheName = `dalis-shell:${PWA_CACHE_VERSION}`
const assetPaths = new Set(PWA_ASSET_URLS)

async function prepareCache() {
  const cache = await caches.open(cacheName)
  try {
    await Promise.all(
      PWA_ASSET_URLS.map(async (path) => {
        const response = await fetch(
          new Request(path, { credentials: "omit", cache: "reload" })
        )
        if (
          !response.ok ||
          response.redirected ||
          new URL(response.url).pathname !== path
        ) {
          throw new Error("Offline asset could not be prepared")
        }
        if (
          path === "/workspace" &&
          !(await response.clone().text()).includes(
            'data-offline-shell="dalis"'
          )
        ) {
          throw new Error("Offline shell is not neutral")
        }
        await cache.put(path, response)
      })
    )
  } catch (error) {
    await caches.delete(cacheName)
    throw error
  }
}

worker.addEventListener("install", (event) => {
  event.waitUntil(prepareCache())
})

worker.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names
          .filter(
            (name) => name.startsWith("dalis-shell:") && name !== cacheName
          )
          .map((name) => caches.delete(name))
      )
      await worker.clients.claim()
    })()
  )
})

worker.addEventListener("fetch", (event) => {
  const request = event.request
  const key = offlineCacheKey(request, worker.location.origin, assetPaths)
  if (!key) return
  // RSC, APIs, auth, personalized HTML and mutation requests always use the network.
  event.respondWith(
    (async () => {
      const cache = await caches.open(cacheName)
      return (await cache.match(key)) ?? fetch(request)
    })()
  )
})

worker.addEventListener("message", (event) => {
  if (event.data?.type !== "OFFLINE_STATUS" || !event.ports[0]) return
  event.waitUntil(
    (async () => {
      const cache = await caches.open(cacheName)
      const assets = await Promise.all(
        PWA_ASSET_URLS.map((path) => cache.match(path))
      )
      event.ports[0].postMessage({
        type: "OFFLINE_STATUS",
        ready: assets.every(Boolean),
        version: PWA_CACHE_VERSION,
      })
    })()
  )
})
