import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { DelayedStatus } from "@/components/ui/delayed-status"
import { PlanReleaseBoundary } from "@/features/plans/components/plan-release-boundary"

test("does not flash loading copy on the initial render", () => {
  expect(
    renderToStaticMarkup(<DelayedStatus>Leyendo categorías…</DelayedStatus>)
  ).toBe("")
})

test("does not present preparation as required before checking the local release", () => {
  const html = renderToStaticMarkup(
    <PlanReleaseBoundary
      account={{
        userId: "initial-render-proof",
        epoch: "initial-render-proof",
        itemCount: 0,
        offlineReady: true,
      }}
    >
      <p>Protected content</p>
    </PlanReleaseBoundary>
  )
  expect(html).toBe("")
  expect(html).not.toContain("Preparar esta versión")
  expect(html).not.toContain("Protected content")
})
