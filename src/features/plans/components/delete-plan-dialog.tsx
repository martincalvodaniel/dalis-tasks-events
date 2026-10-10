"use client"

import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import type { Plan } from "@/types/plan-item"

export function DeletePlanDialog({
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
      heading="¿Eliminar este plan?"
      busy={busy}
      onConfirm={onConfirm}
      onClose={onClose}
      confirmLabel="Eliminar plan"
      pendingLabel="Eliminando…"
      cancelLabel="Conservar plan"
      failureMessage="No se pudo eliminar. Si cambió en otra pestaña, cierra este diálogo y vuelve a abrirlo."
    >
      <p className="mt-3 font-semibold">{plan.title}</p>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        El borrado quedará guardado en este dispositivo.
      </p>
    </ConfirmationDialog>
  )
}
