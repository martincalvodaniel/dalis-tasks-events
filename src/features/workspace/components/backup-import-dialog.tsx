"use client"

import { useEffect, useId, useRef, useState } from "react"
import { useSWRConfig } from "swr"
import { ErrorBanner } from "@/components/ui/error-banner"
import { isAccountSyncCacheKey } from "@/features/sync/manual-sync"
import { BackupImportSelection } from "@/features/workspace/components/backup-import-selection"
import { BackupItemContent } from "@/features/workspace/components/backup-item-content"
import {
  commitAccountBackupImport,
  prepareAccountBackupImport,
  readAccountBackupImportPreview,
} from "@/features/workspace/import-backup"
import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { maximumBackupBytes } from "@/lib/backup/local-backup"
import type {
  BackupImportComparison,
  BackupImportPlan,
} from "@/types/backup-import"

export function BackupImportDialog({
  account,
  onClose,
}: {
  account: Pick<LocalAccount, "userId" | "epoch">
  onClose: () => void
}) {
  const { mutate } = useSWRConfig()
  const dialog = useRef<HTMLDialogElement>(null)
  const mounted = useRef(false)
  const flight = useRef(false)
  const attempted = useRef(false)
  const heading = useId()
  const [busy, setBusy] = useState(false)
  const [comparison, setComparison] = useState<BackupImportComparison | null>(
    null
  )
  const [selected, setSelected] = useState<string[]>([])
  const [plan, setPlan] = useState<BackupImportPlan | null>(null)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState("")
  useEffect(() => {
    mounted.current = true
    const element = dialog.current
    element?.showModal()
    return () => {
      mounted.current = false
      element?.close()
    }
  }, [])
  async function run(action: () => Promise<void>, message: string) {
    if (flight.current) return
    flight.current = true
    setBusy(true)
    setError("")
    try {
      await action()
    } catch {
      if (mounted.current) setError(message)
    } finally {
      flight.current = false
      if (mounted.current) setBusy(false)
    }
  }
  async function read(file: File | undefined) {
    if (flight.current) return
    setComparison(null)
    setSelected([])
    setPlan(null)
    if (!file) return
    await run(async () => {
      if (file.size > maximumBackupBytes)
        throw new Error("Backup file exceeds size limit")
      const result = await readAccountBackupImportPreview(
        account,
        await file.text()
      )
      if (mounted.current) setComparison(result)
    }, "No se pudo leer esta copia. Elige un JSON válido de esta cuenta, de hasta 16 MB. Tus datos se conservan.")
  }
  async function prepare() {
    if (!comparison || selected.length === 0) return
    await run(async () => {
      const result = await prepareAccountBackupImport(account, {
        sourceJson: comparison.sourceJson,
        expected: comparison.expected,
        sourceItemIds: selected,
      })
      if (mounted.current) setPlan(result)
    }, "No se pudo preparar la selección. Puede haber cambiado tu cuenta o tus datos, o ser demasiado grande. Vuelve a elegir el archivo y selecciona menos elementos si es necesario.")
  }
  async function confirm() {
    if (!plan) return
    await run(async () => {
      attempted.current = true
      await commitAccountBackupImport(account, plan)
      if (!mounted.current) return
      setSaved(
        `${plan.copies.length} ${plan.copies.length === 1 ? "copia guardada" : "copias guardadas"} en este dispositivo. ${plan.copies.length === 1 ? "Se sincronizará" : "Se sincronizarán"} cuando haya conexión.`
      )
      try {
        await requireActiveAccount(account)
        await mutate((key) =>
          isAccountSyncCacheKey(key, account.userId, account.epoch)
        )
        await mutate("dalis:active-local-account")
      } catch {
        if (mounted.current)
          setSaved(
            `${plan.copies.length} copias guardadas. Recarga para actualizar la vista.`
          )
      }
    }, "No se pudo confirmar el resultado. Comprueba tu cuenta y el espacio disponible. Los datos guardados se conservan; reintentar esta misma confirmación evita duplicar las copias. Si tus datos cambiaron antes del guardado, cierra y vuelve a comparar el archivo.")
  }
  return (
    <dialog
      ref={dialog}
      aria-labelledby={heading}
      onCancel={(event) => {
        event.preventDefault()
        if (!flight.current) onClose()
      }}
      onClose={() => {
        if (mounted.current && !flight.current) onClose()
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-1.5rem)] max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-950 backdrop:bg-black/50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id={heading} className="font-semibold">
          Importar copia
        </h2>
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className="min-h-11 px-3 disabled:opacity-50"
        >
          Cerrar
        </button>
      </div>
      {saved ? (
        <p role="status" className="py-2">
          {saved}
        </p>
      ) : plan ? (
        <div className="space-y-2">
          <p>
            Crear {plan.copies.length}{" "}
            {plan.copies.length === 1 ? "copia nueva" : "copias nuevas"}. Los
            originales se conservan.
          </p>
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {plan.copies.map(({ item }) => (
              <li key={item.id}>
                <details>
                  <summary className="flex min-h-11 cursor-pointer items-center break-words font-medium">
                    {item.title}
                  </summary>
                  <div className="pb-2">
                    <BackupItemContent item={item} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {!attempted.current ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setPlan(null)}
                className="min-h-11 rounded-lg border px-3"
              >
                Volver a seleccionar
              </button>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={confirm}
              className="min-h-11 rounded-lg bg-emerald-700 px-3 font-medium text-white disabled:opacity-50"
            >
              {busy
                ? "Guardando…"
                : attempted.current
                  ? "Reintentar confirmación"
                  : `Crear ${plan.copies.length} ${plan.copies.length === 1 ? "copia" : "copias"}`}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="block py-2 text-xs">
            Archivo JSON de esta cuenta (máximo 16 MB)
            <input
              type="file"
              accept=".json,application/json"
              disabled={busy}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                event.currentTarget.value = ""
                void read(file)
              }}
              className="peer sr-only"
            />
            <span className="mt-1 flex min-h-11 w-fit cursor-pointer items-center rounded-lg border border-zinc-300 px-3 text-sm peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-disabled:opacity-50 dark:border-zinc-700">
              Elegir archivo
            </span>
          </label>
          {comparison ? (
            <>
              <BackupImportSelection
                key={comparison.preview.currentExportedAt}
                preview={comparison.preview}
                selected={selected}
                busy={busy}
                onToggle={(id) =>
                  setSelected((current) =>
                    current.includes(id)
                      ? current.filter((key) => key !== id)
                      : current.length < 50
                        ? [...current, id]
                        : current
                  )
                }
              />
              <button
                type="button"
                disabled={busy || selected.length === 0}
                onClick={prepare}
                className="min-h-11 rounded-lg bg-emerald-700 px-3 font-medium text-white disabled:opacity-50"
              >
                {busy
                  ? "Preparando…"
                  : `Revisar ${selected.length} ${selected.length === 1 ? "copia" : "copias"}`}
              </button>
            </>
          ) : null}
        </div>
      )}
      {busy ? (
        <p role="status" className="py-2 text-xs">
          Procesando…
        </p>
      ) : null}
      {error ? (
        <div className="mt-2">
          <ErrorBanner>{error}</ErrorBanner>
        </div>
      ) : null}
    </dialog>
  )
}
