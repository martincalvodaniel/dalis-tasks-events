"use client"

import { type ReactNode, useEffect, useId, useRef, useState } from "react"
import { ErrorBanner } from "@/components/ui/error-banner"

export function ConfirmationDialog({
  heading,
  children,
  confirmLabel,
  pendingLabel,
  cancelLabel = "Cancelar",
  failureMessage,
  busy,
  onConfirm,
  onClose,
}: {
  heading: string
  children: ReactNode
  confirmLabel: string
  pendingLabel: string
  cancelLabel?: string
  failureMessage: string
  busy: boolean
  onConfirm: (operationId: string) => Promise<void>
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const intent = useRef<string | null>(null)
  const headingId = useId()
  const [error, setError] = useState(false)
  const buttonLabel = busy ? pendingLabel : confirmLabel
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  async function confirm() {
    intent.current ??= crypto.randomUUID()
    setError(false)
    try {
      await onConfirm(intent.current)
    } catch {
      setError(true)
    }
  }
  return (
    <dialog
      ref={dialog}
      aria-labelledby={headingId}
      onClose={onClose}
      onCancel={(event) => {
        if (busy) event.preventDefault()
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] min-w-0 max-w-lg overflow-y-auto rounded-3xl border border-zinc-200 bg-white p-5 wrap-anywhere text-zinc-900 backdrop:bg-black/40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
    >
      <h2 id={headingId} className="text-xl font-semibold">
        {heading}
      </h2>
      {children}
      {error ? (
        <div className="mt-4">
          <ErrorBanner>{failureMessage}</ErrorBanner>
        </div>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className="min-h-12 rounded-xl border border-zinc-300 px-4 py-3 disabled:opacity-50 dark:border-zinc-700"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void confirm()
          }}
          className="min-h-12 rounded-xl bg-red-700 px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          {buttonLabel}
        </button>
      </div>
    </dialog>
  )
}
