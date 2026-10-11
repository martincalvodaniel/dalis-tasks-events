"use client"

import { type ReactNode, useState } from "react"
import { useSWRConfig } from "swr"
import { ErrorBanner } from "@/components/ui/error-banner"
import { allowsCommonPlanLocalReset } from "@/config/common-plan-reset"
import { ConfirmLocalPlanResetDialog } from "@/features/plans/components/confirm-local-plan-reset-dialog"
import { useLocalPlanRelease } from "@/features/plans/hooks/use-local-plan-release"
import { isAccountSyncCacheKey } from "@/features/sync/manual-sync"
import type { LocalAccount } from "@/features/workspace/local-account"

export function PlanReleaseBoundary({
  account,
  children,
}: {
  account: LocalAccount
  children: ReactNode
}) {
  const { data, error, refresh } = useLocalPlanRelease(account)
  const { mutate } = useSWRConfig()
  const [confirming, setConfirming] = useState(false)
  if (data?.status === "ready" && !error && !confirming) return children
  async function finishPreparation() {
    await mutate(
      (key) =>
        isAccountSyncCacheKey(key, account.userId, account.epoch) &&
        Array.isArray(key) &&
        key[0] !== "dalis:common-plan-release",
      undefined,
      { revalidate: false }
    )
    await mutate("dalis:active-local-account")
    await refresh()
  }
  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <h1 className="text-lg font-semibold">Preparar esta versión</h1>
      {error ? (
        <>
          <ErrorBanner>
            No se pudo comprobar el contenido local. Tus datos se conservan.
          </ErrorBanner>
          <button
            type="button"
            className="mt-3 min-h-11 rounded-lg border px-3"
            onClick={() => {
              void refresh().catch(() => undefined)
            }}
          >
            Reintentar
          </button>
        </>
      ) : !data ? (
        <p role="status" className="mt-3 text-sm">
          Comprobando este dispositivo…
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm">
            El editor de Tarea, Evento, Cita y Nota necesita empezar con un
            espacio local limpio. El contenido anterior aún se conserva aquí.
          </p>
          {allowsCommonPlanLocalReset(window.location.origin) ? (
            <button
              type="button"
              className="mt-4 min-h-11 rounded-lg bg-emerald-700 px-4 font-semibold text-white"
              onClick={() => setConfirming(true)}
            >
              Preparar dispositivo
            </button>
          ) : (
            <ErrorBanner>
              La limpieza de pruebas sólo está disponible en preproducción.
            </ErrorBanner>
          )}
        </>
      )}
      {confirming ? (
        <ConfirmLocalPlanResetDialog
          account={account}
          onClose={() => setConfirming(false)}
          onPrepared={finishPreparation}
        />
      ) : null}
    </main>
  )
}
