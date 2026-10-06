"use client"

import { useEffect, useId, useState } from "react"
import {
  type LocalAccount,
  prepareLocalAccount,
  restoreLocalAccount,
} from "@/features/workspace/local-account"

export function Workspace() {
  const statusHeadingId = useId()
  const [account, setAccount] = useState<LocalAccount | null>(null)
  const [state, setState] = useState<
    "loading" | "unprepared" | "preparing" | "ready" | "error"
  >("loading")
  useEffect(() => {
    let active = true
    restoreLocalAccount()
      .then((restored) => {
        if (!active) return
        setAccount(restored)
        setState(restored ? "ready" : "unprepared")
      })
      .catch(() => {
        if (active) setState("error")
      })
    return () => {
      active = false
    }
  }, [])
  async function prepare() {
    setState("preparing")
    try {
      setAccount(await prepareLocalAccount())
      setState("ready")
    } catch {
      setState("error")
    }
  }
  return (
    <main
      data-offline-shell="dalis"
      className="mx-auto min-h-dvh w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-16"
    >
      <p className="text-sm font-bold uppercase tracking-[0.24em] text-emerald-700 dark:text-emerald-400">
        Dalis
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
        Tu espacio personal
      </h1>
      <p className="mt-3 max-w-xl text-zinc-600 dark:text-zinc-400">
        Tareas, planes y fechas importantes, también sin conexión.
      </p>
      <section
        className="mt-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900"
        aria-labelledby={statusHeadingId}
      >
        <h2 id={statusHeadingId} className="text-xl font-semibold">
          {state === "ready"
            ? "Disponible sin conexión"
            : "Prepara este dispositivo"}
        </h2>
        <div
          role="status"
          aria-live="polite"
          className="mt-3 text-zinc-600 dark:text-zinc-400"
        >
          {state === "loading" ? <p>Comprobando el espacio guardado…</p> : null}
          {state === "preparing" ? (
            <p>
              Guardando el espacio y sus recursos. Mantén esta página abierta…
            </p>
          ) : null}
          {state === "unprepared" ? (
            <p>
              Inicia sesión con Google y prepara el dispositivo una vez con
              conexión. Después podrás volver a abrir tu espacio sin red.
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
        {state === "unprepared" || state === "error" ? (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={prepare}
              className="min-h-12 rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700"
            >
              Preparar este dispositivo
            </button>
            <a
              href="/auth/signin?callbackUrl=%2Fworkspace"
              className="flex min-h-12 items-center justify-center rounded-xl border border-zinc-300 px-5 py-3 font-medium dark:border-zinc-700"
            >
              Iniciar sesión con Google
            </a>
          </div>
        ) : null}
      </section>
      <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
        La sincronización con otros dispositivos todavía no está disponible.
      </p>
    </main>
  )
}
