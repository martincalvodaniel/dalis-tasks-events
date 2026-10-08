import { PersonalIncidentCard } from "@/features/sync/components/personal-incident-card"
import { SyncIncidentCard } from "@/features/sync/components/sync-incident-card"
import type { LocalAccount } from "@/features/workspace/local-account"
import type {
  SyncIncidentOverview,
  SyncIncidentSnapshot,
} from "@/types/sync-incident"

export function SyncIncidentPanel({
  incidents,
  error,
  account,
}: {
  incidents: (SyncIncidentOverview | SyncIncidentSnapshot)[] | undefined
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
      {incidents.map((value) => {
        if ("kind" in value && value.kind === "preference")
          return (
            <PersonalIncidentCard
              key={value.incident.entry.operation.operationId}
              incident={value.incident}
            />
          )
        const incident = "kind" in value ? value.incident : value
        return (
          <SyncIncidentCard
            key={incident.entry.operation.operationId}
            incident={incident}
            account={account}
          />
        )
      })}
    </div>
  )
}
