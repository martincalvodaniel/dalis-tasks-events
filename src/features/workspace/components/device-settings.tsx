"use client"

import { useId, useState } from "react"
import { canPrepareOfflineShell } from "@/config/pwa"
import { DeviceSyncSettings } from "@/features/sync/components/device-sync-settings"
import { BackupSettings } from "@/features/workspace/components/backup-settings"
import { useLocalAccount } from "@/features/workspace/hooks/use-local-account"
import {
  closeLocalAccount,
  prepareLocalAccount,
} from "@/features/workspace/local-account"

export function DeviceSettings() {
  const statusHeadingId = useId()
  const {
    account,
    error,
    isLoading,
    logoutPending,
    authenticationRequired,
    refresh,
  } = useLocalAccount()
  const [preparing, setPreparing] = useState(false)
  const [failed, setFailed] = useState(false)
  const [notice, setNotice] = useState("")
  const displayedNotice = account
    ? ""
    : notice ||
      (logoutPending
        ? "Espacio oculto en este dispositivo. Falta cerrar la sesión remota cuando vuelva la conexión; tus cambios locales se conservan."
        : "")
  const state = preparing
    ? "preparing"
    : account
      ? "ready"
      : isLoading
        ? "loading"
        : failed || error
          ? "error"
          : "unprepared"
  async function prepare() {
    setPreparing(true)
    setFailed(false)
    try {
      await prepareLocalAccount()
      await refresh()
    } catch {
      setFailed(true)
    } finally {
      setPreparing(false)
    }
  }
  async function close(switchAccount = false) {
    setFailed(false)
    try {
      const completed = await closeLocalAccount()
      await refresh()
      setNotice(
        completed
          ? "Sesión cerrada. Tus cambios locales se conservan para cuando vuelvas con la misma cuenta."
          : "Espacio oculto en este dispositivo. Falta cerrar la sesión remota cuando vuelva la conexión; tus cambios locales se conservan."
      )
      if (switchAccount && completed)
        window.location.assign("/auth/signin?callbackUrl=%2Fworkspace")
    } catch {
      setFailed(true)
    }
  }
  return (
    <div>
      <section
        className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900"
        aria-labelledby={statusHeadingId}
      >
        <h2 id={statusHeadingId} className="text-xl font-semibold">
          {state === "ready"
            ? account?.offlineReady
              ? "Disponible sin conexión"
              : "Espacio local preparado"
            : "Prepara este dispositivo"}
        </h2>
        <div
          role="status"
          aria-live="polite"
          className="mt-3 text-zinc-600 dark:text-zinc-400"
        >
          {state === "loading" ? (
            <p>Comprobando la sesión y preparando tu espacio…</p>
          ) : null}
          {state === "preparing" ? (
            <p>
              Guardando el espacio y sus recursos. Mantén esta página abierta…
            </p>
          ) : null}
          {state === "unprepared" ? (
            <p>
              {authenticationRequired
                ? "Inicia sesión con Google. Tu espacio se preparará automáticamente al volver."
                : "Prepara este dispositivo con conexión para volver a abrir tu espacio."}
            </p>
          ) : null}
          {state === "error" ? (
            <p>
              No se pudo preparar o recuperar el espacio. Comprueba la conexión,
              inicia sesión y vuelve a intentarlo. Tus cambios locales se
              conservan.
            </p>
          ) : null}
          {state === "ready" ? (
            <p>
              Tu espacio está guardado en este dispositivo.{" "}
              {account?.itemCount
                ? `${account.itemCount} ${account.itemCount === 1 ? "elemento guardado" : "elementos guardados"}.`
                : "Aún no hay elementos guardados."}
            </p>
          ) : null}
        </div>
        {!canPrepareOfflineShell ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Modo de desarrollo: tus cambios se guardan en este navegador. La
            reapertura sin red se prueba con la versión de producción.
          </p>
        ) : null}
        {state === "unprepared" || state === "error" ? (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {!authenticationRequired ? (
              <button
                type="button"
                onClick={prepare}
                className="min-h-12 rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700"
              >
                {state === "error"
                  ? "Volver a intentarlo"
                  : "Preparar este dispositivo"}
              </button>
            ) : null}
            <a
              href="/auth/signin?callbackUrl=%2Fworkspace"
              className="flex min-h-12 items-center justify-center rounded-xl border border-zinc-300 px-5 py-3 font-medium dark:border-zinc-700"
            >
              Iniciar sesión con Google
            </a>
          </div>
        ) : null}
      </section>
      {state === "ready" ? (
        <div className="mt-5 flex flex-wrap gap-4">
          <button
            type="button"
            onClick={() => close()}
            className="min-h-12 rounded-xl border border-zinc-300 px-4 py-3 text-sm font-medium dark:border-zinc-700"
          >
            Cerrar sesión
          </button>
          <button
            type="button"
            onClick={() => close(true)}
            className="min-h-12 rounded-xl border border-zinc-300 px-4 py-3 text-sm font-medium dark:border-zinc-700"
          >
            Cambiar cuenta
          </button>
        </div>
      ) : null}
      {displayedNotice ? (
        <p
          role="status"
          className="mt-5 text-sm text-zinc-600 dark:text-zinc-400"
        >
          {displayedNotice}
        </p>
      ) : null}
      {account ? (
        <>
          <DeviceSyncSettings key={account.epoch} account={account} />
          <BackupSettings key={`backup:${account.epoch}`} account={account} />
        </>
      ) : null}
    </div>
  )
}
