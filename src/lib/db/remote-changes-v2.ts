import "server-only"

import type { Document } from "mongodb"
import { getDatabase } from "@/lib/db/client"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { RemoteCursorAheadError } from "@/lib/db/remote-changes"
import { RemoteItemViewRepository } from "@/lib/db/remote-item-views"
import { RemoteItemRepository } from "@/lib/db/remote-items"
import { RemoteTagRepository } from "@/lib/db/remote-tags"
import { decodeRemoteChange } from "@/lib/sync/remote-change-v2"
import { validateRemoteChangesPageV2 } from "@/lib/sync/remote-changes-page-v2"
import { revisionSchema, userIdSchema } from "@/schemas/primitives"
import { maximumRemoteChangesPageBytes } from "@/schemas/remote-changes-page-v2"
import { remotePullQuerySchema } from "@/schemas/remote-sync"
import type { RemoteChangeV2 } from "@/types/remote-change-v2"
import type { RemoteChangesPageV2 } from "@/types/remote-changes-page-v2"

// This reader is preparatory: the product still negotiates and downloads transport v1.
export async function readRemoteChangesV2(
  actorInput: unknown,
  queryInput: unknown
): Promise<RemoteChangesPageV2> {
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
        const changes: RemoteChangeV2[] = []
        let recordsBytes = 0
        let stoppedForBytes = false
        try {
          for await (const document of cursor) {
            const { _id, ...value } = document
            const change = decodeRemoteChange(value, actor)
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
        return validateRemoteChangesPageV2(
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
