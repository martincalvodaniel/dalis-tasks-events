"use client"

import { canPrepareOfflineShell, OFFLINE_WORKER_URL } from "@/config/pwa"
import { offlineWorkerStatusSchema } from "@/schemas/workspace"

function readWorkerStatus(worker: ServiceWorker): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel()
    const timeout = setTimeout(() => {
      channel.port1.close()
      reject(new Error("Offline worker did not respond"))
    }, 10000)
    channel.port1.onmessage = (event) => {
      clearTimeout(timeout)
      channel.port1.close()
      const result = offlineWorkerStatusSchema.safeParse(event.data)
      if (result.success) resolve(result.data.ready)
      else reject(new Error("Invalid offline worker response"))
    }
    worker.postMessage({ type: "OFFLINE_STATUS" }, [channel.port2])
  })
}

export async function isOfflineShellReady(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false
  const registration =
    await navigator.serviceWorker.getRegistration("/workspace")
  return registration?.active ? readWorkerStatus(registration.active) : false
}

export async function prepareOfflineShell(): Promise<void> {
  if (!canPrepareOfflineShell || !("serviceWorker" in navigator))
    throw new Error("Offline shell preparation is unavailable")
  await navigator.serviceWorker.register(OFFLINE_WORKER_URL, {
    scope: "/",
    updateViaCache: "none",
  })
  const registration = await new Promise<ServiceWorkerRegistration>(
    (resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Offline worker installation timed out")),
        30000
      )
      navigator.serviceWorker.ready.then(
        (value) => {
          clearTimeout(timeout)
          resolve(value)
        },
        (error) => {
          clearTimeout(timeout)
          reject(error)
        }
      )
    }
  )
  if (!registration.active || !(await readWorkerStatus(registration.active)))
    throw new Error("Offline shell is incomplete")
}

export function observeOfflineUpdates(onWaiting: () => void): () => void {
  let disposed = false
  let registration: ServiceWorkerRegistration | undefined
  let installing: ServiceWorker | null = null
  const inspect = () => {
    if (!disposed && registration?.waiting) onWaiting()
  }
  const onUpdate = () => {
    installing?.removeEventListener("statechange", inspect)
    installing = registration?.installing ?? null
    installing?.addEventListener("statechange", inspect)
  }
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .getRegistration("/workspace")
      .then((value) => {
        if (disposed || !value) return
        registration = value
        inspect()
        registration.addEventListener("updatefound", onUpdate)
        onUpdate()
        if (navigator.onLine) void registration.update().catch(() => {})
      })
      .catch(() => {})
  }
  return () => {
    disposed = true
    registration?.removeEventListener("updatefound", onUpdate)
    installing?.removeEventListener("statechange", inspect)
  }
}

export async function checkOfflineUpdate(): Promise<
  "waiting" | "installing" | "current" | "offline" | "unavailable"
> {
  if (!("serviceWorker" in navigator)) return "unavailable"
  if (!navigator.onLine) return "offline"
  const registration =
    await navigator.serviceWorker.getRegistration("/workspace")
  if (!registration?.active) return "unavailable"
  await registration.update()
  if (registration.waiting) return "waiting"
  if (registration.installing) return "installing"
  return "current"
}
