import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { SyncIssueNotice } from "@/features/sync/components/sync-issue-notice"
import type { SyncPassResult } from "@/features/sync/coordinator"
import { SyncContext } from "@/features/sync/sync-context"

function render(conflicts: number, status: SyncPassResult["status"]) {
  return renderToStaticMarkup(
    <SyncContext
      value={{
        userId: "user",
        epoch: "epoch",
        summary: {
          pending: 0,
          ready: 0,
          waiting: 0,
          blocked: 0,
          unsupported: 0,
          sending: 0,
          conflicts,
          rejected: 0,
        },
        error: false,
        busy: false,
        result: { status, uploaded: 0, downloaded: 0 },
        synchronize: () => undefined,
      }}
    >
      <SyncIssueNotice />
    </SyncContext>
  )
}
test("routine success and temporary retries do not add a workspace notice", () => {
  expect(render(0, "settled")).toBe("")
  expect(render(0, "retry_later")).toBe("")
})
test("conflicts link directly to settings and remain visible after a successful pass", () => {
  const html = render(2, "settled")
  expect(html).toContain("2 cambios necesitan")
  expect(html).toContain("/workspace?view=settings")
  expect(html).toContain("Revisar en Ajustes")
})
test("authorization or recovery problems expose a compact paused notice", () => {
  for (const status of [
    "unauthorized",
    "account_changed",
    "recovery_required",
  ] as const)
    expect(render(0, status)).toContain("Sincronización pausada.")
})
