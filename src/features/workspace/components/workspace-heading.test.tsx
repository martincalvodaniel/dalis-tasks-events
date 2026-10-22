import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { workspaceDestinations } from "@/config/navigation"
import { WorkspaceHeading } from "@/features/workspace/components/workspace-heading"

test("navigation page titles stay semantic and focusable but visually hidden on mobile", () => {
  for (const destination of workspaceDestinations) {
    const html = renderToStaticMarkup(
      <WorkspaceHeading view={destination.id} />
    )
    expect(html).toContain("<h1")
    expect(html).toContain(destination.label)
    expect(html).toContain('tabindex="-1"')
    expect(html).toContain("sr-only")
    expect(html).toContain("md:not-sr-only")
    expect(html).not.toContain("aria-hidden")
  }
})
