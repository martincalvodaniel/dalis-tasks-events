import { isUnresolvedOutboxEntry } from "@/lib/sync/outbox-state"
import {
  type PreferenceProjection,
  planRemotePreferenceProjection,
} from "@/lib/sync/preference-projection"
import { personalSnapshotSchema } from "@/schemas/personal-snapshot"
import { settingsPreferenceProjectionInputSchema } from "@/schemas/preference-projection"
import { userSettingsEntityKey } from "@/schemas/user-settings-key"
import type { RemoteShadowV2 } from "@/types/remote-shadow-v2"

type PersonalShadow = Extract<RemoteShadowV2, { kind: "preference" }>
// Validate the complete context first; splitting supported domains is not permission to filter a changes page.
export function planSettingsPreferenceProjection(
  input: unknown
): PreferenceProjection {
  const value = settingsPreferenceProjectionInputSchema.parse(input)
  const key = userSettingsEntityKey(value.userId)
  const shadow = value.shadows.find(
    (entry) => entry.kind === "preference" && entry.record.store === "settings"
  )
  let observed: PersonalShadow | null =
    shadow?.kind === "preference" ? shadow : null
  const incomingSettings = value.incoming?.effects.find(
    (effect) => effect.store === "settings"
  )
  if (incomingSettings) {
    if (
      observed &&
      observed.record.record.revision === incomingSettings.record.revision &&
      JSON.stringify(observed.record) !== JSON.stringify(incomingSettings)
    )
      throw new Error("Remote personal settings disagree at the same revision")
    if (
      !observed ||
      observed.record.record.revision < incomingSettings.record.revision
    )
      observed = {
        version: 2,
        kind: "preference",
        entityKey: key,
        record: incomingSettings,
      }
  }
  const legacyEffects =
    value.incoming?.effects.filter((effect) => effect.store !== "settings") ??
    []
  const legacy = planRemotePreferenceProjection(
    {
      ...value,
      local: value.local.filter((entry) => entry.entityKey !== key),
      shadows: value.shadows.filter(
        (entry) =>
          entry.kind === "preference" && entry.record.store !== "settings"
      ),
      incoming: legacyEffects.length
        ? { ...value.incoming, effects: legacyEffects }
        : null,
    },
    { settingsIndependent: true }
  )
  const pending = value.entries.some(
    (entry) =>
      entry.operation.command.type === "settings.update" &&
      isUnresolvedOutboxEntry(entry)
  )
  const local = value.local.find((entry) => entry.entityKey === key) ?? {
    entityKey: key,
    record: null,
  }
  const hasSettings =
    value.local.some((entry) => entry.entityKey === key) ||
    observed !== null ||
    value.entries.some(
      (entry) => entry.operation.command.type === "settings.update"
    )
  const projected =
    !pending && observed ? { entityKey: key, record: observed.record } : local
  const complete = [...legacy.shadows, ...(observed ? [observed] : [])]
  if (complete.length > 10000)
    throw new Error(
      "Personal settings projection exceeds its complete shadow limit"
    )
  return {
    local: personalSnapshotSchema.parse([
      ...legacy.local,
      ...(hasSettings ? [projected] : []),
    ]),
    shadows: complete,
    pending: legacy.pending || pending,
  }
}
