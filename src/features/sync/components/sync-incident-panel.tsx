import { SyncIncidentCard } from "@/features/sync/components/sync-incident-card"
import type { LocalAccount } from "@/features/workspace/local-account"
import type { SyncIncidentSnapshot } from "@/types/sync-incident"

export function SyncIncidentPanel({
  incidents,
  error,
  account,
}: {
  incidents: SyncIncidentSnapshot[] | undefined
  error: boolean
  account?: Pick<LocalAccount, "userId" | "epoch">
}) {
  if (error)
    return (
      <p role="alert" className="py-2">
        No se pudieron leer los detalles. Tus cambios se conservan; cierra y
        vuelve a abrir para intentarlo.
      </p>
    )
  if (!incidents)
    return (
      <p role="status" className="py-2">
        Leyendo cambios conservados…
      </p>
    )
  if (incidents.length === 0)
    return <p className="py-2">No hay conflictos ni rechazos guardados.</p>
  return (
    <div>
      {incidents.map((incident) => (
        <SyncIncidentCard
          key={incident.entry.operation.operationId}
          incident={incident}
          account={account}
        />
      ))}
    </div>
  )
}
