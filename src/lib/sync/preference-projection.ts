import { isUnresolvedOutboxEntry } from "@/lib/sync/outbox-state"
import { personalSnapshotSchema } from "@/schemas/personal-snapshot"
import { preferenceProjectionInputSchema } from "@/schemas/preference-projection"
import { personalShadowEntityKey } from "@/schemas/remote-shadow-v2"
import type { OutboxEntry } from "@/types/local-sync"
import type { PersonalSnapshot } from "@/types/personal-snapshot"
import type { RemoteShadowV2 } from "@/types/remote-shadow-v2"

type PersonalShadow = Extract<RemoteShadowV2, { kind: "preference" }>

export interface PreferenceProjection {
  local: PersonalSnapshot
  shadows: PersonalShadow[]
  pending: boolean
}

function isPersonalIntention(entry: OutboxEntry): boolean {
  switch (entry.operation.command.type) {
    case "tag.save":
    case "tag.delete":
    case "tag.move":
    case "item-view.set":
    case "task.move":
    case "settings.update":
      return true
    default:
      return false
  }
}

// A personal intention can compact secondary identities; preserve the whole local chain.
// This plan neither acknowledges intentions nor invents a tombstone for unobserved absence.
export function planRemotePreferenceProjection(
  input: unknown
): PreferenceProjection {
  const value = preferenceProjectionInputSchema.parse(input)
  const shadows = new Map<string, PersonalShadow>()
  for (const shadow of value.shadows) {
    if (shadow.kind !== "preference")
      throw new Error("Expected a personal projection shadow")
    shadows.set(shadow.entityKey, shadow)
  }
  for (const effect of value.incoming?.effects ?? []) {
    const entityKey = personalShadowEntityKey(effect)
    const previous = shadows.get(entityKey)
    if (previous && previous.record.record.revision > effect.record.revision)
      continue
    if (
      previous &&
      previous.record.record.revision === effect.record.revision &&
      JSON.stringify(previous.record) !== JSON.stringify(effect)
    )
      throw new Error("Remote personal records disagree at the same revision")
    shadows.set(entityKey, {
      version: 2,
      kind: "preference",
      entityKey,
      record: effect,
    })
  }
  if (shadows.size > 10000)
    throw new Error("Personal projection exceeds its shadow identity limit")
  const pending = value.entries.some(
    (entry) => isPersonalIntention(entry) && isUnresolvedOutboxEntry(entry)
  )
  const local = new Map(value.local.map((record) => [record.entityKey, record]))
  if (!pending)
    for (const shadow of shadows.values())
      local.set(shadow.entityKey, {
        entityKey: shadow.entityKey,
        record: shadow.record,
      })
  return {
    local: personalSnapshotSchema.parse([...local.values()]),
    shadows: [...shadows.values()],
    pending,
  }
}
