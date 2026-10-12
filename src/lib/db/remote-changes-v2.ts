import "server-only"

import type { Document } from "mongodb"
import { getDatabase } from "@/lib/db/client"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { RemoteCursorAheadError } from "@/lib/db/remote-changes"
import { RemoteItemViewRepository } from "@/lib/db/remote-item-views"
import { RemoteItemRepository } from "@/lib/db/remote-items"
import { RemotePlanOccurrenceRepository } from "@/lib/db/remote-plan-occurrences"
import { RemoteTagRepository } from "@/lib/db/remote-tags"
import { RemoteTaskPlacementRepository } from "@/lib/db/remote-task-placements"
import { RemoteUserSettingsRepository } from "@/lib/db/remote-user-settings"
import { decodeRemoteChange } from "@/lib/sync/remote-change-v2"
import { validateRemoteChangesPageV2 } from "@/lib/sync/remote-changes-page-v2"
import {
  decodeRemoteRecurringChange,
  validateRemoteRecurringChangesPage,
} from "@/lib/sync/remote-recurring-changes"
import { revisionSchema, userIdSchema } from "@/schemas/primitives"
import { maximumRemoteChangesPageBytes } from "@/schemas/remote-changes-page-v2"
import { remotePullQuerySchema } from "@/schemas/remote-sync"
import type { RemoteChangesPageV2 } from "@/types/remote-changes-page-v2"
import type {
  RemoteRecurringChange,
  RemoteRecurringChangesPage,
} from "@/types/remote-recurring-sync"

// Envelope generation is independent of negotiation; new producers require compatible clients.
export async function readRemoteChangesV2(
  actorInput: unknown,
  queryInput: unknown
): Promise<RemoteChangesPageV2> {
  return readChanges(
    actorInput,
    queryInput,
    false,
    decodeRemoteChange,
    validateRemoteChangesPageV2
  )
}

export async function readRemotePlanChangesV2(
  actorInput: unknown,
  queryInput: unknown
): Promise<RemoteChangesPageV2> {
  return readChanges(
    actorInput,
    queryInput,
    true,
    decodeRemoteChange,
    validateRemoteChangesPageV2
  )
}

// Private generation-five preparation; not referenced by any active route.
export async function readRemoteRecurringChangesV2(
  actorInput: unknown,
  queryInput: unknown
): Promise<RemoteRecurringChangesPage> {
  return readChanges(
    actorInput,
    queryInput,
    true,
    decodeRemoteRecurringChange,
    validateRemoteRecurringChangesPage,
    true
  )
}

// Settings history requires an exclusive future negotiation before this port is selected.
export async function readRemoteSettingsChangesV2(
  actorInput: unknown,
  queryInput: unknown
): Promise<RemoteRecurringChangesPage> {
  return readChanges(
    actorInput,
    queryInput,
    true,
    decodeRemoteRecurringChange,
    validateRemoteRecurringChangesPage,
    true,
    true
  )
}

async function readChanges<Change extends RemoteRecurringChange, Page>(
  actorInput: unknown,
  queryInput: unknown,
  allowPlans: boolean,
  decode: (input: unknown, actor: string) => Change,
  validate: (input: unknown, actor: string, query: unknown) => Page,
  allowSeries = false,
  allowSettings = false
): Promise<Page> {
  const actor = userIdSchema.parse(actorInput)
  const query = remotePullQuerySchema.parse(queryInput)
  const database = await getDatabase()
  const counters = await getCollection<{ _id: string; sequence: number }>(
    COLLECTION_NAMES.syncCounters
  )
  const journal = await getCollection<Document & { _id: string }>(
    COLLECTION_NAMES.syncChanges
  )
  return database.client.withSession((session) =>
    session.withTransaction(
      async () => {
        const counter = await counters.findOne({ _id: actor }, { session })
        const committed = revisionSchema.parse(counter?.sequence ?? 0)
        const through = query.through ?? committed
        if (through > committed || query.after > through)
          throw new RemoteCursorAheadError()
        const cursor = journal
          .find(
            {
              recipientUserId: actor,
              sequence: { $gt: query.after, $lte: through },
            },
            { session }
          )
          .sort({ sequence: 1 })
          .limit(query.limit)
        const items = await RemoteItemRepository.open(actor, session)
        const tags = await RemoteTagRepository.open(actor, session)
        const views = await RemoteItemViewRepository.open(actor, session)
        const placements = await RemoteTaskPlacementRepository.open(
          actor,
          session
        )
        const occurrences = await RemotePlanOccurrenceRepository.open(
          actor,
          session
        )
        const settings = allowSettings
          ? await RemoteUserSettingsRepository.open(actor, session)
          : null
        const changes: Change[] = []
        let recordsBytes = 0
        let stoppedForBytes = false
        try {
          for await (const document of cursor) {
            const { _id, ...value } = document
            const change = decode(value, actor)
            if (change.sequence !== query.after + changes.length + 1)
              throw new Error(
                "Stored mixed journal contains a missing sequence"
              )
            const recordBytes = new TextEncoder().encode(
              JSON.stringify(change)
            ).byteLength
            const envelopeBytes = new TextEncoder().encode(
              JSON.stringify({
                version: 2,
                changes: [],
                nextAfter: change.sequence,
                through,
                hasMore: change.sequence < through,
              })
            ).byteLength
            if (
              envelopeBytes + recordsBytes + recordBytes + changes.length >
              maximumRemoteChangesPageBytes
            ) {
              if (!changes.length)
                throw new Error(
                  "Journal entry cannot fit in a bounded mixed page"
                )
              stoppedForBytes = true
              break
            }
            // Soft-deleted current records retain ownership; absence is not permission.
            if (change.kind === "item") {
              if (!(await items.read(change.item.id)))
                throw new Error("Journal item access is unavailable")
            } else if (change.kind === "plan-occurrence") {
              const record = change.occurrence
              const parent = await items.read(record.seriesId)
              const current = await occurrences.read({
                seriesId: record.seriesId,
                id: record.id,
              })
              // Tombstones and a removed recurrence rule retain ownership of history.
              if (parent?.kind !== "plan" || !current)
                throw new Error("Journal appearance access is unavailable")
              if (
                parent.revision < change.seriesRevision ||
                current.revision < record.revision
              )
                throw new Error(
                  "Journal appearance evidence exceeds its current revisions"
                )
            } else
              for (const effect of change.effects.effects) {
                if (effect.store === "tags") {
                  if (!(await tags.read(effect.record.id)))
                    throw new Error("Journal category access is unavailable")
                } else if (effect.store === "itemViews") {
                  if (
                    !(await views.read(effect.record.itemId)) ||
                    !(await items.read(effect.record.itemId)) ||
                    (effect.record.primaryTagId !== null &&
                      !(await tags.read(effect.record.primaryTagId)))
                  )
                    throw new Error(
                      "Journal personal view access is unavailable"
                    )
                } else if (effect.store === "taskPlacements") {
                  const record = effect.record
                  const current = await placements.read({
                    occurrenceId: record.occurrenceId,
                    scope: record.scope,
                    date: record.date,
                  })
                  const separator = record.occurrenceId.indexOf(":")
                  const isAppearance = separator > 0
                  const task = await items.read(
                    allowSeries && isAppearance
                      ? record.occurrenceId.slice(0, separator)
                      : record.occurrenceId
                  )
                  if (
                    !current ||
                    !task ||
                    (task.kind !== "task" &&
                      !(allowPlans && task.kind === "plan")) ||
                    (isAppearance && (!allowSeries || task?.kind !== "plan"))
                  )
                    throw new Error(
                      "Journal task placement access is unavailable"
                    )
                  if (allowSeries && current.revision < record.revision)
                    throw new Error(
                      "Journal placement evidence exceeds its current revision"
                    )
                  // A placement can belong to an implicit slot with no materialized exception.
                  // Never regenerate today's rule to authorize a durable historical position.
                  // Historical and current category ownership must both remain available.
                  // Later completion, reprogramming or soft deletion cannot invalidate history.
                  for (const tagId of new Set([record.tagId, current.tagId]))
                    if (tagId !== null && !(await tags.read(tagId)))
                      throw new Error(
                        "Journal task placement category access is unavailable"
                      )
                } else if (effect.store === "settings" && settings) {
                  const current = await settings.read()
                  if (!current)
                    throw new Error(
                      "Journal personal settings access is unavailable"
                    )
                  if (current.revision < effect.record.revision)
                    throw new Error(
                      "Journal settings evidence exceeds its current revision"
                    )
                } else
                  throw new Error(
                    "Journal preference store is not supported by this reader"
                  )
              }
            changes.push(change)
            recordsBytes += recordBytes
          }
        } finally {
          await cursor.close()
        }
        if (
          !stoppedForBytes &&
          changes.length !== Math.min(query.limit, through - query.after)
        )
          throw new Error("Committed mixed journal contains a missing sequence")
        const nextAfter = changes.at(-1)?.sequence ?? query.after
        return validate(
          {
            version: 2,
            changes,
            nextAfter,
            through,
            hasMore: nextAfter < through,
          },
          actor,
          query
        )
      },
      {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
        readPreference: "primary",
        timeoutMS: 15000,
      }
    )
  )
}
