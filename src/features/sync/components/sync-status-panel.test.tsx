import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { SyncStatusPanel } from "@/features/sync/components/sync-status-panel"
import type { SyncQueueSummary } from "@/lib/sync/queue-summary"
import type { SyncQueueSummaryV2 } from "@/lib/sync/queue-summary-v2"

const empty: SyncQueueSummary = {
  pending: 0,
  ready: 0,
  waiting: 0,
  blocked: 0,
  unsupported: 0,
  sending: 0,
  conflicts: 0,
  rejected: 0,
}
test("finished passes cannot hide unsupported work or conflicts in the settings panel", () => {
  const html = renderToStaticMarkup(
    <SyncStatusPanel
      summary={{ ...empty, pending: 1, unsupported: 1, conflicts: 1 }}
      error={false}
      busy={false}
      result={{ status: "settled", uploaded: 1, downloaded: 1 }}
      onSync={() => undefined}
    />
  )
  expect(html).toContain("1 pendiente")
  expect(html).toContain("1 en conflicto")
  expect(html).toContain("todavía sin sincronización disponible")
  expect(html).not.toContain("Sin cambios locales pendientes.")
})
test("authentication failures preserve drafts and offer a working sign-in destination", () => {
  const html = renderToStaticMarkup(
    <SyncStatusPanel
      summary={empty}
      error={false}
      busy={false}
      result={{ status: "unauthorized", uploaded: 0, downloaded: 0 }}
      onSync={() => undefined}
    />
  )
  expect(html).toContain("Tus cambios locales se conservan")
  expect(html).toContain(
    "/auth/signin?callbackUrl=%2Fworkspace%3Fview%3Dsettings"
  )
})
test("unknown or unreadable queues cannot start a manual pass", () => {
  for (const error of [false, true]) {
    const html = renderToStaticMarkup(
      <SyncStatusPanel
        summary={null}
        error={error}
        busy={false}
        result={null}
        onSync={() => undefined}
      />
    )
    expect(html).toContain("disabled")
    expect(html).not.toContain("Sin cambios locales pendientes.")
  }
})

test("incompatible deployments explain updating while preserving local changes", () => {
  const html = renderToStaticMarkup(
    <SyncStatusPanel
      summary={{ ...empty, pending: 2 }}
      error={false}
      busy={false}
      result={{ status: "update_required", uploaded: 0, downloaded: 0 }}
      onSync={() => undefined}
    />
  )
  expect(html).toContain("2 pendientes")
  expect(html).toContain("no son compatibles")
  expect(html).toContain("cierra todas las pestañas")
  expect(html).toContain("Tus cambios locales se conservan")
  expect(html).not.toContain("Iniciar sesión con Google")
})

test("the current scope remains local for categories until mixed capability is selected", () => {
  const current = renderToStaticMarkup(
    <SyncStatusPanel
      summary={empty}
      error={false}
      busy={false}
      result={null}
      onSync={() => undefined}
    />
  )
  expect(current).toContain("Categorías, orden y repeticiones se guardan solo")
  const prepared = renderToStaticMarkup(
    <SyncStatusPanel
      summary={{
        ...empty,
        personalUnresolved: 0,
        personalProjectionBlocked: false,
      }}
      scope="own_content_and_preferences"
      error={false}
      busy={false}
      result={null}
      onSync={() => undefined}
    />
  )
  expect(prepared).toContain("categorías y asignaciones")
  expect(prepared).toContain("Orden de tareas y repeticiones siguen")
  expect(prepared).not.toContain("cambios personales pendientes")
})

test("a settled mixed pass keeps unresolved personal work visible with independent content progress", () => {
  const summary: SyncQueueSummaryV2 = {
    ...empty,
    pending: 2,
    unsupported: 1,
    blocked: 1,
    conflicts: 1,
    personalUnresolved: 3,
    personalProjectionBlocked: true,
  }
  const html = renderToStaticMarkup(
    <SyncStatusPanel
      summary={summary}
      scope="own_content_and_preferences"
      error={false}
      busy={false}
      result={{ status: "settled", uploaded: 1, downloaded: 2 }}
      onSync={() => undefined}
    />
  )
  expect(html).toContain("3 cambios personales pendientes")
  expect(html).toContain("categorías y asignaciones locales se conservan")
  expect(html).toContain("todavía sin sincronización disponible")
  expect(html).toContain("1 en conflicto")
  expect(html).not.toContain("Sin cambios locales pendientes.")
  expect(html).toContain("Última revisión terminada.")
})
