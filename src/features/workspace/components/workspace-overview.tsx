"use client"

import { DeviceSettings } from "@/features/workspace/components/device-settings"
import { useLocalAccount } from "@/features/workspace/hooks/use-local-account"

export function WorkspaceOverview() {
  const { account } = useLocalAccount()
  if (!account) return <DeviceSettings />
  return (
    <section
      aria-label="Resumen del espacio"
      className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8 dark:border-emerald-900 dark:bg-emerald-950"
    >
      <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
        Disponible sin conexión
      </p>
      <h2 className="mt-3 text-2xl font-semibold">Tu espacio, a mano</h2>
      <p className="mt-3 text-zinc-600 dark:text-zinc-300">
        {account.itemCount === 0
          ? "Todavía no hay elementos guardados en este dispositivo."
          : `${account.itemCount} ${account.itemCount === 1 ? "elemento guardado" : "elementos guardados"} en este dispositivo.`}
      </p>
      <a
        href="/workspace?view=settings"
        className="mt-6 inline-flex min-h-12 items-center rounded-xl border border-emerald-700 px-5 py-3 font-semibold text-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700 dark:text-emerald-200"
      >
        Gestionar este dispositivo
      </a>
    </section>
  )
}
