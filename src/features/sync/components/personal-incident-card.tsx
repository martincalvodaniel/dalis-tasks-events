import { PersonalIncidentVersion } from "@/features/sync/components/personal-incident-version"
import type { PersonalSyncIncidentSnapshot } from "@/types/sync-incident"

export function PersonalIncidentCard({
  incident,
}: {
  incident: PersonalSyncIncidentSnapshot
}) {
  const command = incident.entry.operation.command
  const submitted =
    command.type === "tag.save"
      ? `Guardar categoría: ${command.input.name}`
      : command.type === "tag.delete"
        ? "Eliminar categoría"
        : command.type === "tag.move"
          ? "Reordenar categorías"
          : command.type === "item-view.set"
            ? "Cambiar categoría del elemento"
            : command.type === "task.move"
              ? "Reordenar tareas"
              : "Cambiar preferencias"
  const primary = incident.local.find(
    (entry) => entry.entityKey === incident.entry.entityKey
  )?.record
  const name = primary?.store === "tags" ? primary.record.name : submitted
  return (
    <details className="border-t border-zinc-200 text-sm dark:border-zinc-800">
      <summary className="min-h-11 cursor-pointer py-2 break-words [overflow-wrap:anywhere]">
        {name}
        <span className="ml-2 text-xs text-zinc-500">
          {incident.reason === "conflict"
            ? "Conflicto de preferencias"
            : "Preferencia rechazada"}
        </span>
      </summary>
      <div className="space-y-2 pb-2">
        <p>
          {incident.reason === "conflict"
            ? "Otro cambio afecta a esta preferencia."
            : incident.reason === "unavailable"
              ? "El servidor no permite acceder a esta preferencia."
              : incident.reason === "identity_reuse"
                ? "El identificador del cambio ya se usó para otro contenido."
                : "El servidor no pudo aceptar este cambio."}
        </p>
        <p className="text-xs text-zinc-500">
          Tus cambios y dependencias se conservan. La versión remota es la
          última conocida; puede haber cambios más recientes.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <PersonalIncidentVersion
            label="Tu estado actual"
            snapshot={incident.local}
            tagNames={incident.tagNames}
          />
          <PersonalIncidentVersion
            label="Versión remota conocida"
            snapshot={incident.remote}
            tagNames={incident.tagNames}
          />
        </div>
        <details>
          <summary className="min-h-11 cursor-pointer py-2">
            Cambio enviado e historial conservado
          </summary>
          <p className="text-xs">
            {submitted} · revisión de partida{" "}
            {incident.entry.operation.baseRevision}
          </p>
          <p className="my-1 text-xs">
            {incident.intentions.length}{" "}
            {incident.intentions.length === 1
              ? "intención personal sin confirmar"
              : "intenciones personales sin confirmar"}
            .
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <PersonalIncidentVersion
              label="Estado local al recibir el resultado"
              snapshot={incident.localAtOutcome}
              tagNames={incident.tagNames}
            />
            <PersonalIncidentVersion
              label="Remoto observado al recibir el resultado"
              snapshot={incident.shadowAtOutcome}
              tagNames={incident.tagNames}
            />
          </div>
        </details>
        <p className="text-xs text-zinc-500">
          La resolución de preferencias todavía no está disponible.
        </p>
      </div>
    </details>
  )
}
