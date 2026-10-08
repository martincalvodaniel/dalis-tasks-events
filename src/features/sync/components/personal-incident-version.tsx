import type { PersonalSnapshot } from "@/types/personal-snapshot"

export function PersonalIncidentVersion({
  label,
  snapshot,
  tagNames,
}: {
  label: string
  snapshot: PersonalSnapshot
  tagNames: Record<string, string>
}) {
  return (
    <section className="min-w-0 rounded border border-zinc-200 p-2 text-xs dark:border-zinc-800">
      <h4 className="font-medium">{label}</h4>
      <ul className="mt-1 space-y-1">
        {snapshot.map(({ entityKey, record }) => (
          <li key={entityKey} className="break-words [overflow-wrap:anywhere]">
            {!record ? (
              "Sin versión observada"
            ) : (
              <>
                {record.store === "tags"
                  ? `${record.record.name} · posición ${record.record.position}`
                  : record.store === "itemViews"
                    ? `Categoría: ${record.record.primaryTagId === null ? "sin categoría" : (tagNames[record.record.primaryTagId] ?? "no disponible")}`
                    : "Preferencia conservada"}
                {record.record.deletedAt ? " · Eliminada" : ""} · revisión{" "}
                {record.record.revision}
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
