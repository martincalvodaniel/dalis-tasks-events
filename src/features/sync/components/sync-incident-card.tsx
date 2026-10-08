import { SyncIncidentActions } from "@/features/sync/components/sync-incident-actions"
import { incidentTaskStatuses } from "@/features/sync/components/sync-incident-copy"
import { SyncIncidentVersion } from "@/features/sync/components/sync-incident-version"
import type { LocalAccount } from "@/features/workspace/local-account"
import type { SyncIncidentSnapshot } from "@/types/sync-incident"

const reasons: Record<SyncIncidentSnapshot["reason"], string> = {
  conflict: "Otro cambio en el mismo elemento",
  unavailable: "El servidor no permite acceder a este elemento",
  invalid_command: "El servidor no pudo aceptar el cambio",
  identity_reuse: "El identificador del cambio ya se usó para otro contenido",
}

export function SyncIncidentCard({
  incident,
  account,
}: {
  incident: SyncIncidentSnapshot
  account?: Pick<LocalAccount, "userId" | "epoch">
}) {
  const { command } = incident.entry.operation
  const sentDraft =
    command.type === "item.create" || command.type === "item.update"
      ? command.input
      : null
  const submitted =
    command.type === "item.create"
      ? "Crear elemento"
      : command.type === "item.update"
        ? "Editar elemento"
        : command.type === "item.delete"
          ? "Eliminar elemento"
          : command.type === "task.set-status"
            ? `Cambiar estado: ${incidentTaskStatuses[command.status]}`
            : command.type === "task.set-checklist-entry"
              ? `Marcar punto de checklist: ${command.completed ? "completado" : "pendiente"}`
              : "Cambio guardado"
  return (
    <details className="border-t border-zinc-200 dark:border-zinc-800">
      <summary className="min-h-11 cursor-pointer py-3 break-words [overflow-wrap:anywhere]">
        {incident.local?.title ??
          incident.localAtOutcome?.title ??
          incident.remote?.title ??
          "Elemento sin versión disponible"}
        <span className="ml-2 text-xs text-zinc-500">
          {incident.reason === "conflict" ? "Conflicto" : "Rechazado"}
        </span>
      </summary>
      <div className="space-y-2 pb-3">
        <p>{reasons[incident.reason]}</p>
        <p className="text-xs text-zinc-500">
          La versión remota es la última conocida en este dispositivo; puede
          haber cambios más recientes.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <SyncIncidentVersion
            label="Tu borrador actual"
            item={incident.local}
          />
          <SyncIncidentVersion
            label="Versión remota conocida"
            item={incident.remote}
          />
        </div>
        <details>
          <summary className="min-h-11 cursor-pointer py-3">
            Cambio enviado e historial conservado
          </summary>
          <p>
            {submitted} · revisión de partida{" "}
            {incident.entry.operation.baseRevision}
          </p>
          {sentDraft ? (
            <SyncIncidentVersion label="Contenido enviado" item={sentDraft} />
          ) : null}
          <p className="mt-2">
            {incident.intentions.length}{" "}
            {incident.intentions.length === 1
              ? "intención sin confirmar"
              : "intenciones sin confirmar"}{" "}
            para este elemento.
          </p>
          <ol className="mt-1 space-y-1">
            {incident.intentions.map((entry) => (
              <li key={entry.operation.operationId}>
                Cambio {entry.sequence} ·{" "}
                {entry.state === "conflict"
                  ? "en conflicto"
                  : entry.state === "rejected"
                    ? "rechazado"
                    : entry.state === "sending"
                      ? "enviando"
                      : "pendiente"}
              </li>
            ))}
          </ol>
        </details>
        {account ? (
          <SyncIncidentActions account={account} incident={incident} />
        ) : null}
      </div>
    </details>
  )
}
