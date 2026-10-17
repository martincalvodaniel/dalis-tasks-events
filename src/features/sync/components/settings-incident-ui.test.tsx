import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { PersonalIncidentCard } from "@/features/sync/components/personal-incident-card"
import { SettingsIncidentResolutionDialog } from "@/features/sync/components/settings-incident-resolution-dialog"
import { planLocalSettingsPreferenceResult } from "@/lib/sync/preference-result-plan"
import { projectRecurringSettingsSyncIncidentOverview } from "@/lib/sync/recurring-incident-snapshot"
import { outboxEntrySchema } from "@/schemas/local-sync"
import type { PreferenceEffect } from "@/types/preference-effects"

function fixture() {
  const actor = "settings-ui-owner",
    key = `settings:${actor}`,
    now = "2026-10-17T19:20:00.000Z",
    senderId = crypto.randomUUID()
  function settings(
    revision: number,
    timeZone: string
  ): Extract<PreferenceEffect, { store: "settings" }> {
    return {
      store: "settings",
      record: {
        userId: actor,
        timeZone,
        weekStartsOn: 1,
        locale: "es-ES",
        revision,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    }
  }
  const operation = {
    protocolVersion: 1 as const,
    operationId: crypto.randomUUID(),
    baseRevision: 1,
    command: {
      type: "settings.update" as const,
      input: {
        timeZone: "Asia/Tokyo",
        weekStartsOn: 1 as const,
        locale: "es-ES" as const,
      },
    },
  }
  const entry = outboxEntrySchema.parse({
    userId: actor,
    entityKey: key,
    operation,
    sequence: 1,
    dependencies: [],
    state: "sending",
    attempts: 1,
    createdAt: now,
    lease: { ownerId: senderId, expiresAt: now },
  })
  const result = planLocalSettingsPreferenceResult({
    userId: actor,
    submission: {
      operation,
      senderId,
      result: {
        kind: "preference",
        outcome: {
          operationId: operation.operationId,
          status: "conflict",
          current: settings(2, "UTC"),
        },
      },
    },
    local: [{ entityKey: key, record: settings(1, "Asia/Tokyo") }],
    shadows: [],
    entries: [entry],
    existingOutcome: null,
  })
  const overview = projectRecurringSettingsSyncIncidentOverview({
    userId: actor,
    items: [],
    occurrences: [],
    tags: [],
    itemViews: [],
    taskPlacements: [],
    settings: [settings(1, "Asia/Tokyo").record],
    entries: result.entries,
    shadows: result.shadows,
    outcomes: [result.outcome],
  })[0]
  if (overview.kind !== "preference")
    throw new Error("Settings UI fixture is missing")
  return {
    incident: overview.incident,
    account: { userId: actor, epoch: crypto.randomUUID() },
  }
}

test("settings expose own safe choices and preserve guarded cases without buttons", () => {
  const { incident, account } = fixture(),
    html = renderToStaticMarkup(
      <PersonalIncidentCard incident={incident} account={account} />
    )
  for (const text of [
    "Usar zona remota",
    "Enviar mi zona",
    "Asia/Tokyo",
    "UTC",
  ])
    expect(html).toContain(text)
  const blocked = renderToStaticMarkup(
    <PersonalIncidentCard
      incident={{ ...incident, blockedByRelatedIntentions: true }}
      account={account}
    />
  )
  expect(blocked).not.toContain("Usar zona remota")
  expect(blocked).not.toContain("Enviar mi zona")
  expect(blocked).toContain("se conservan")
})

test("settings confirmation explains the complete decision without claiming ACK or moving plan dates", () => {
  const { incident } = fixture()
  for (const choice of ["adopt_remote", "retry_local"] as const) {
    const html = renderToStaticMarkup(
      <SettingsIncidentResolutionDialog
        incident={incident}
        choice={choice}
        busy={false}
        onConfirm={async () => {}}
        onClose={() => {}}
      />
    )
    expect(html).toContain(choice === "adopt_remote" ? "UTC" : "Asia/Tokyo")
    expect(html).toContain("cambio de zona pendiente")
    expect(html).toContain("no cambia tus planes ni sus fechas")
    expect(html).toContain(
      choice === "adopt_remote"
        ? "última conocida"
        : "pendiente de confirmación"
    )
    expect(html).toContain("Cancelar")
  }
})
