import "server-only"

import { getDatabase } from "@/lib/db/client"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { RemoteItemRepository } from "@/lib/db/remote-items"
import { revisionSchema, userIdSchema } from "@/schemas/primitives"
import {
  remoteChangesPageSchema,
  remoteItemChangeSchema,
  remotePullQuerySchema,
} from "@/schemas/remote-sync"
import type { RemoteChangesPage, RemoteItemChange } from "@/types/remote-sync"

type ChangeDocument = RemoteItemChange & { _id: string }
type CounterDocument = { _id: string; sequence: number }

export class RemoteCursorAheadError extends Error {
  constructor() {
    super("Pull cursor exceeds the committed journal")
  }
}

export async function readRemoteChanges(
  actorInput: unknown,
  queryInput: unknown
): Promise<RemoteChangesPage> {
  const actor = userIdSchema.parse(actorInput)
  const query = remotePullQuerySchema.parse(queryInput)
  const database = await getDatabase()
  const counters = await getCollection<CounterDocument>(
    COLLECTION_NAMES.syncCounters
  )
  const journal = await getCollection<ChangeDocument>(
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
        const documents = await journal
          .find(
            {
              recipientUserId: actor,
              sequence: { $gt: query.after, $lte: through },
            },
            { session }
          )
          .sort({ sequence: 1 })
          .limit(query.limit)
          .toArray()
        if (documents.length !== Math.min(query.limit, through - query.after))
          throw new Error("Committed journal contains a missing sequence")
        const repository = await RemoteItemRepository.open(actor, session)
        const changes: RemoteItemChange[] = []
        for (const [index, document] of documents.entries()) {
          const { _id, ...value } = document
          const change = remoteItemChangeSchema.parse(value)
          if (
            change.recipientUserId !== actor ||
            change.sequence !== query.after + index + 1
          )
            throw new Error(
              "Stored journal sequence or recipient is inconsistent"
            )
          // Current authorization is checked even for a historical payload.
          if (!(await repository.read(change.item.id)))
            throw new Error("Journal item access is unavailable")
          changes.push(change)
        }
        const nextAfter = changes.at(-1)?.sequence ?? query.after
        return remoteChangesPageSchema.parse({
          changes,
          nextAfter,
          through,
          hasMore: nextAfter < through,
        })
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
