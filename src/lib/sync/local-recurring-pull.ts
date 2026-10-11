import { planRemoteItemProjection } from "@/lib/sync/item-projection"
import { decodeRemoteRecurringShadow } from "@/lib/sync/local-plan-occurrence-sync"
import { planRemotePlanOccurrenceProjection } from "@/lib/sync/plan-occurrence-projection"
import { planRemotePreferenceProjection } from "@/lib/sync/preference-projection"
import { validateRemoteRecurringChangesPage } from "@/lib/sync/remote-recurring-changes"
import { planOccurrenceEntityKey } from "@/schemas/local-plan-occurrence-sync"
import {
  localRecurringChangesPageInputSchema,
  localRecurringPullPlanInputSchema,
} from "@/schemas/local-recurring-pull"
import { localPullCursorSchema } from "@/schemas/local-sync"
import { personalQueueDiagnosticsInputSchema } from "@/schemas/personal-queue-diagnostics"
import type { CalendarItem, ItemOccurrence } from "@/types/calendar-item"
import type { LocalPullCursor } from "@/types/local-sync"
import type { PersonalSnapshot } from "@/types/personal-snapshot"
import type { RemoteRecurringShadow } from "@/types/remote-recurring-sync"

export function validateLocalRecurringChangesPageInput(
  input: unknown,
  userId: unknown
) {
  const value = localRecurringChangesPageInputSchema.parse(input)
  const page = validateRemoteRecurringChangesPage(
    value.page,
    userId,
    value.query
  )
  const revisions = new Map<string, number>()
  for (const change of page.changes) {
    if (change.kind === "preference") {
      if (
        change.effects.effects.some(
          (effect) =>
            !["tags", "itemViews", "taskPlacements"].includes(effect.store)
        )
      )
        throw new Error("Recurring pull does not support this personal store")
      continue
    }
    const record = change.kind === "item" ? change.item : change.occurrence
    if (change.kind === "item") {
      const item = change.item
      if (
        item.kind !== "plan" &&
        ((item.kind !== "task" && item.kind !== "event") ||
          item.recurrence !== null)
      )
        throw new Error("Recurring pull does not support this item family")
    }
    if (record.revision < 1)
      throw new Error("Recurring pull requires committed records")
    const key =
      change.kind === "item"
        ? `item:${record.id}`
        : planOccurrenceEntityKey(record.id)
    const previous = revisions.get(key)
    if (previous !== undefined && record.revision <= previous)
      throw new Error("Recurring pull revisions must advance within a page")
    revisions.set(key, record.revision)
  }
  return { query: value.query, page }
}

export interface LocalRecurringPullPlan {
  status: "applied" | "ignored"
  cursor: LocalPullCursor
  items: CalendarItem[]
  occurrences: ItemOccurrence[]
  local: PersonalSnapshot
  shadows: RemoteRecurringShadow[]
}

// Plans one atomic page, never an ACK. Queue payloads and outcomes remain unchanged.
export function planLocalRecurringChangesPage(
  input: unknown
): LocalRecurringPullPlan {
  const value = localRecurringPullPlanInputSchema.parse(input)
  const { userId, cursor } = value
  const receipt = validateLocalRecurringChangesPageInput(value.receipt, userId)
  const { query, page } = receipt
  personalQueueDiagnosticsInputSchema.parse({
    userId,
    items: value.items,
    entries: value.entries,
  })
  const items = new Map(value.items.map((item) => [item.id, item]))
  const occurrences = new Map(
    value.occurrences.map((record) => [record.id, record])
  )
  if (occurrences.size !== value.occurrences.length)
    throw new Error("Recurring pull contains duplicate occurrence identities")
  for (const record of value.occurrences)
    if (record.kind === "plan" && items.get(record.seriesId)?.kind !== "plan")
      throw new Error("Stored appearance parent is unavailable")
  const shadows = new Map<string, RemoteRecurringShadow>()
  for (const raw of value.shadows) {
    const shadow = decodeRemoteRecurringShadow(raw, userId)
    if (
      shadow.kind === "plan-occurrence" &&
      items.get(shadow.record.seriesId)?.kind !== "plan"
    )
      throw new Error("Stored appearance shadow parent is unavailable")
    if (shadows.has(shadow.entityKey))
      throw new Error("Recurring pull contains duplicate shadow identities")
    shadows.set(shadow.entityKey, shadow)
  }
  let personal = planRemotePreferenceProjection({
    userId,
    local: value.local,
    entries: value.entries,
    incoming: null,
    shadows: [...shadows.values()].filter(
      (shadow) => shadow.kind === "preference"
    ),
  })
  if (query.after < cursor.after && page.nextAfter <= cursor.after)
    return {
      status: "ignored",
      cursor,
      items: value.items,
      occurrences: value.occurrences,
      local: value.local,
      shadows: value.shadows,
    }
  if (
    query.after !== cursor.after ||
    query.through !== cursor.through ||
    (cursor.through !== null && page.through !== cursor.through)
  )
    throw new Error(
      "Recurring pull cursor or checkpoint changed before application"
    )
  for (const change of page.changes) {
    if (change.kind === "item") {
      const id = change.item.id,
        entityKey = `item:${id}`,
        old = shadows.get(entityKey)
      if (old && old.kind !== "item")
        throw new Error("Recurring pull item shadow has another family")
      const projection = planRemoteItemProjection({
        userId,
        local: items.get(id) ?? null,
        shadow: old?.record ?? null,
        incoming: change.item,
        entries: value.entries.filter((entry) => entry.entityKey === entityKey),
      })
      if (projection.local) items.set(id, projection.local)
      shadows.set(entityKey, {
        version: 2,
        kind: "item",
        entityKey,
        record: projection.shadow,
      })
    } else if (change.kind === "preference") {
      personal = planRemotePreferenceProjection({
        userId,
        local: personal.local,
        shadows: personal.shadows,
        entries: value.entries,
        incoming: change.effects,
      })
      for (const shadow of personal.shadows)
        shadows.set(shadow.entityKey, shadow)
    } else {
      const record = change.occurrence,
        parent = items.get(record.seriesId),
        parentShadow = shadows.get(`item:${record.seriesId}`)
      if (parent?.kind !== "plan")
        throw new Error("Incoming appearance parent is unavailable")
      if (parentShadow?.kind === "item" && parentShadow.record.kind !== "plan")
        throw new Error("Incoming appearance parent shadow has another family")
      const knownRevision =
        parentShadow?.kind === "item"
          ? Math.max(parent.revision, parentShadow.record.revision)
          : parent.revision
      if (knownRevision < change.seriesRevision)
        throw new Error("Incoming appearance parent revision is unavailable")
      const local = occurrences.get(record.id),
        entityKey = planOccurrenceEntityKey(record.id),
        old = shadows.get(entityKey)
      if (
        (local && local.kind !== "plan") ||
        (old && old.kind !== "plan-occurrence")
      )
        throw new Error("Recurring pull appearance cache has another family")
      const projection = planRemotePlanOccurrenceProjection({
        userId,
        key: { seriesId: record.seriesId, id: record.id },
        series: parent,
        local: local ?? null,
        shadow: old ?? null,
        incoming: {
          version: 2,
          kind: "plan-occurrence",
          userId,
          entityKey,
          record,
          seriesRevision: change.seriesRevision,
        },
        entries: value.entries,
      })
      if (projection.local) occurrences.set(record.id, projection.local)
      if (projection.shadow) shadows.set(entityKey, projection.shadow)
    }
  }
  if (items.size > 10000 || occurrences.size > 10000 || shadows.size > 10000)
    throw new Error("Recurring pull exceeds its resulting identity limit")
  return {
    status: "applied",
    cursor: localPullCursorSchema.parse({
      key: "pull-cursor",
      after: page.nextAfter,
      through: page.hasMore ? page.through : null,
    }),
    items: [...items.values()],
    occurrences: [...occurrences.values()],
    local: personal.local,
    shadows: [...shadows.values()],
  }
}
