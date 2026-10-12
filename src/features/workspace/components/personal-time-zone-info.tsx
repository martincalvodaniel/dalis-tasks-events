interface PersonalTimeZoneInfoProps {
  timeZone: string | null | undefined
  unavailable?: boolean
}
export function PersonalTimeZoneInfo({
  timeZone,
  unavailable = false,
}: PersonalTimeZoneInfoProps) {
  const pending = timeZone === undefined && !unavailable
  return (
    <dl
      className="mt-3 flex min-w-0 items-center justify-between gap-3 rounded-xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
      aria-busy={pending}
    >
      <dt className="shrink-0 text-zinc-600 dark:text-zinc-400">
        Zona horaria
      </dt>
      <dd className="min-w-0 break-all text-right font-medium">
        {unavailable
          ? "No disponible"
          : (timeZone ?? (pending ? "—" : "Sin configurar"))}
      </dd>
    </dl>
  )
}
