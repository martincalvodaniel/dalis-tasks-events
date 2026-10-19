import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { PlanListHeading } from "@/features/plans/components/plan-list-heading"

test("section disclosure exposes its panel, count and expanded state", () => {
  const html = renderToStaticMarkup(
    <PlanListHeading
      heading="Hoy"
      contentId="today-panel"
      expanded
      count={61}
      onToggle={() => {}}
    />
  )
  expect(html).toContain('aria-expanded="true"')
  expect(html).toContain('aria-controls="today-panel"')
  expect(html).toContain("61 planes")
  expect(html).not.toContain("recuento parcial")
})
test("partial counts and collapsed state are explicit without announcing a false zero while loading", () => {
  const partial = renderToStaticMarkup(
    <PlanListHeading
      heading="Atrasadas"
      contentId="past-panel"
      expanded={false}
      count={12}
      partial
      onToggle={() => {}}
    />
  )
  expect(partial).toContain('aria-expanded="false"')
  expect(partial).toContain("Al menos 12 planes; recuento parcial")
  const loading = renderToStaticMarkup(
    <PlanListHeading
      heading="Hoy"
      contentId="today-panel"
      expanded
      count={null}
      onToggle={() => {}}
    />
  )
  expect(loading).not.toContain("0 planes")
})
test("noncollapsible calendar headings remain plain headings", () => {
  const html = renderToStaticMarkup(
    <PlanListHeading heading="Lunes" contentId="day-panel" expanded count={2} />
  )
  expect(html).toContain("Lunes")
  expect(html).not.toContain("button")
})

test("a single plan uses the singular accessible count", () => {
  const html = renderToStaticMarkup(
    <PlanListHeading
      heading="Atrasadas"
      contentId="past-panel"
      expanded
      count={1}
      onToggle={() => {}}
    />
  )
  expect(html).toContain("1 plan</span>")
  expect(html).not.toContain("1 planes")
})
