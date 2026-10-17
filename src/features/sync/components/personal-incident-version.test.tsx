import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { PersonalIncidentVersion } from "@/features/sync/components/personal-incident-version"
import { personalShadowEntityKey } from "@/schemas/remote-shadow-v2"
import type { LocalPreferenceRecord } from "@/types/personal-snapshot"

test("settings comparisons expose both known time zones and their revisions", () => {
  function snapshot(timeZone: string, revision: number) {
    const record: LocalPreferenceRecord = {
      store: "settings",
      record: {
        userId: "settings-comparison-owner",
        timeZone,
        weekStartsOn: 1,
        locale: "es-ES",
        revision,
        createdAt: "2026-10-17T12:00:00.000Z",
        updatedAt: "2026-10-17T12:00:00.000Z",
        deletedAt: null,
      },
    }
    return [{ entityKey: personalShadowEntityKey(record), record }]
  }
  const markup = renderToStaticMarkup(
    <div>
      <PersonalIncidentVersion
        label="Tu estado actual"
        snapshot={snapshot("Europe/Madrid", 2)}
        tagNames={{}}
      />
      <PersonalIncidentVersion
        label="Versión remota conocida"
        snapshot={snapshot("Asia/Tokyo", 3)}
        tagNames={{}}
      />
    </div>
  )
  expect(markup).toContain("Zona horaria: Europe/Madrid")
  expect(markup).toContain("Zona horaria: Asia/Tokyo")
  expect(markup).toContain("Tu estado actual")
  expect(markup).toContain("Versión remota conocida")
  expect(markup).not.toContain("Preferencia conservada")
})
