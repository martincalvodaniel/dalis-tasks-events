import type { SyncPassResult } from "@/features/sync/coordinator"
import { OfflineUpdateCheck } from "@/features/workspace/components/offline-update-check"
import type { SyncQueueSummary } from "@/lib/sync/queue-summary"
import type { SyncQueueSummaryV2 } from "@/lib/sync/queue-summary-v2"

interface SyncStatusPanelProps {
  summary: SyncQueueSummary | SyncQueueSummaryV2 | null
  scope?:
    | "own_content"
    | "own_content_and_preferences"
    | "own_content_preferences_and_task_order"
  error: boolean
  busy: boolean
  result: SyncPassResult | null
  onSync(): void
}
const messages: Record<SyncPassResult["status"], string> = {
  settled: "Última revisión terminada.",
  more_work: "Quedan cambios por revisar. Vuelve a sincronizar.",
  unauthorized:
    "Inicia sesión de nuevo para sincronizar. Tus cambios locales se conservan.",
  account_changed:
    "La sesión remota ha cambiado de cuenta. Tus cambios locales se conservan.",
  retry_later:
    "No se pudo terminar. Comprueba la conexión y vuelve a intentarlo; tus cambios se conservan.",
  stopped: "Sincronización detenida. Tus cambios locales se conservan.",
  update_required:
    "La versión local y el servidor no son compatibles. Guarda lo que tengas abierto, cierra todas las pestañas de Dalis y vuelve a abrir la aplicación con conexión. Tus cambios locales se conservan.",
  recovery_required:
    "La sincronización necesita revisión. Tus cambios locales se conservan.",
}

export function SyncStatusPanel({
  summary,
  error,
  busy,
  result,
  onSync,
  scope = "own_content",
}: SyncStatusPanelProps) {
  const unresolved = summary
    ? summary.pending + summary.sending + summary.conflicts + summary.rejected
    : null
  const counts = summary
    ? [
        summary.pending > 0
          ? `${summary.pending} ${summary.pending === 1 ? "pendiente" : "pendientes"}`
          : "",
        summary.sending > 0 ? `${summary.sending} enviando` : "",
        summary.conflicts > 0 ? `${summary.conflicts} en conflicto` : "",
        summary.rejected > 0
          ? `${summary.rejected} ${summary.rejected === 1 ? "rechazado" : "rechazados"}`
          : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : ""
  const pendingLabel =
    unresolved === 0 ? "Sin cambios locales pendientes." : counts
  return (
    <section
      aria-label="Sincronización"
      className="mt-4 rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Sincronización</h2>
        <button
          type="button"
          onClick={onSync}
          disabled={busy || error || !summary}
          className="min-h-11 rounded-lg bg-emerald-700 px-3 font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {busy ? "Sincronizando…" : "Sincronizar ahora"}
        </button>
      </div>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        {scope === "own_content_preferences_and_task_order"
          ? "Sincroniza tareas y eventos sin repetición, categorías, asignaciones y orden de tareas sin repetición mientras la aplicación está abierta. Las repeticiones siguen en este dispositivo."
          : scope === "own_content_and_preferences"
            ? "Automática con conexión mientras la aplicación está abierta. Tareas y eventos sin repetición, categorías y asignaciones. Orden de tareas y repeticiones siguen en este dispositivo."
            : "Automática con conexión mientras la aplicación está abierta. Tareas y eventos sin repetición. Categorías, orden y repeticiones se guardan solo en este dispositivo por ahora."}
      </p>
      <div role="status" aria-live="polite" className="mt-2">
        {error ? (
          <p>
            No se pudo leer la cola local. Recarga para volver a intentarlo.
          </p>
        ) : !summary ? (
          <p>Comprobando cambios locales…</p>
        ) : (
          <>
            <p>{pendingLabel}</p>
            {"personalProjectionBlocked" in summary &&
            summary.personalProjectionBlocked ? (
              <p>
                {summary.personalUnresolved}{" "}
                {summary.personalUnresolved === 1
                  ? "cambio personal pendiente."
                  : "cambios personales pendientes."}{" "}
                Tus categorías y asignaciones locales se conservan.
              </p>
            ) : null}
            {summary.unsupported > 0 ? (
              <p>
                {summary.unsupported} cambios todavía sin sincronización
                disponible.
              </p>
            ) : null}
            {summary.waiting + summary.blocked > 0 ? (
              <p>
                {summary.waiting + summary.blocked} cambios dependen de otras
                operaciones pendientes.
              </p>
            ) : null}
            {summary.conflicts + summary.rejected > 0 ? (
              <p>
                Los borradores se conservan. Puedes revisar los detalles debajo.
              </p>
            ) : null}
          </>
        )}
        {result ? <p className="mt-1">{messages[result.status]}</p> : null}
      </div>
      {result?.status === "update_required" ? <OfflineUpdateCheck /> : null}
      {result?.status === "unauthorized" ? (
        <a
          className="mt-2 inline-flex min-h-11 items-center font-medium text-emerald-700 underline dark:text-emerald-400"
          href="/auth/signin?callbackUrl=%2Fworkspace%3Fview%3Dsettings"
        >
          Iniciar sesión con Google
        </a>
      ) : null}
    </section>
  )
}
