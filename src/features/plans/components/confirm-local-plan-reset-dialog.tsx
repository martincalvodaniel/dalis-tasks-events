"use client"

import { useState } from "react"
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"
import { confirmLocalPlanReset } from "@/features/plans/local-plan-release"
import type { LocalAccount } from "@/features/workspace/local-account"

export function ConfirmLocalPlanResetDialog({
  account,
  onClose,
  onPrepared,
}: {
  account: LocalAccount
  onClose: () => void
  onPrepared: () => Promise<unknown>
}) {
  const [busy, setBusy] = useState(false)
  return (
    <ConfirmationDialog
      heading="¿Borrar el contenido local anterior?"
      confirmLabel="Borrar y continuar"
      pendingLabel="Preparando…"
      failureMessage="No se pudo preparar este dispositivo. Cierra otras pestañas de la aplicación y vuelve a intentarlo."
      busy={busy}
      onClose={onClose}
      onConfirm={async (operationId) => {
        setBusy(true)
        try {
          await confirmLocalPlanReset(account, operationId)
          await onPrepared()
          onClose()
        } finally {
          setBusy(false)
        }
      }}
    >
      <p className="mt-3 text-sm">
        Se borrarán de esta cuenta en este dispositivo los elementos,
        categorías, orden y cambios pendientes de la versión anterior. No se
        puede deshacer.
      </p>
      <p className="mt-2 text-sm">
        Se conservan la sesión y tus ajustes. La base remota no se modifica.
        Cierra otras pestañas de preproducción antes de continuar.
      </p>
    </ConfirmationDialog>
  )
}
