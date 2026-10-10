"use client"

import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import type { Plan } from "@/types/plan-item"

export function CancelPlanOccurrenceDialog({
  plan,
  busy,
  onConfirm,
  onClose,
}: {
  plan: Plan
  busy: boolean
  onConfirm: (operationId: string) => Promise<void>
  onClose: () => void
}) {
  return (
    <ConfirmationDialog
      heading="¿Cancelar esta aparición?"
      busy={busy}
      onConfirm={onConfirm}
      onClose={onClose}
      confirmLabel="Cancelar aparición"
      pendingLabel="Guardando…"
      cancelLabel="Conservar aparición"
      failureMessage="No se pudo cancelar. Si cambió en otra pestaña, cierra este diálogo y vuelve a abrirlo."
    >
      <p className="mt-3 font-semibold">{plan.title}</p>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        Sólo se cancela esta aparición. La serie y las demás fechas se conservan
        en este dispositivo.
      </p>
    </ConfirmationDialog>
  )
}
