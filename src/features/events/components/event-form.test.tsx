import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { EventForm } from "@/features/events/components/event-form"

test("the editor exposes named icon actions and separate date/time controls", () => {
  const html = renderToStaticMarkup(
    <EventForm
      scheduledDate="2026-10-10"
      timeZone="Europe/Madrid"
      onSave={async () => undefined}
      onCancel={() => undefined}
    />
  )
  expect(html).toContain('aria-label="Guardar"')
  expect(html).toContain('aria-label="Cancelar"')
  for (const [name, type] of [
    ["localStartDate", "date"],
    ["localStartTime", "time"],
    ["localEndDate", "date"],
    ["localEndTime", "time"],
  ]) {
    const input = html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`))?.[0]
    expect(input).toContain(`type="${type}"`)
  }
  expect(html).not.toContain('type="datetime-local"')
})
