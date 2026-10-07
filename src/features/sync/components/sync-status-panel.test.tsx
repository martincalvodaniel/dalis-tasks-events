import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { SyncStatusPanel } from "@/features/sync/components/sync-status-panel"
import type { SyncQueueSummary } from "@/lib/sync/queue-summary"

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
