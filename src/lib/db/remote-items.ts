import "server-only"

import { type Collection, MongoServerError } from "mongodb"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { calendarItemSchema } from "@/schemas/calendar-item"
import {
  entityIdSchema,
  revisionSchema,
  userIdSchema,
} from "@/schemas/primitives"
import { remoteItemPageQuerySchema } from "@/schemas/remote-items"
import type { CalendarItem } from "@/types/calendar-item"

type ItemDocument = CalendarItem & { _id: string }

function parseStoredItem(document: ItemDocument): CalendarItem {
  const { _id, ...value } = document
  const item = calendarItemSchema.parse(value)
  if (_id !== item.id) throw new Error("Stored item identity is inconsistent")
  return item
}

export class RemoteItemRepository {
  private constructor(
    private readonly actor: string,
    private readonly collection: Collection<ItemDocument>
  ) {}

  static async open(actorInput: unknown): Promise<RemoteItemRepository> {
    const actor = userIdSchema.parse(actorInput)
    return new RemoteItemRepository(
      actor,
      await getCollection<ItemDocument>(COLLECTION_NAMES.items)
    )
  }

  private ownItem(input: unknown): CalendarItem {
    const item = calendarItemSchema.parse(input)
    if (item.ownerId !== this.actor)
      throw new Error("Item belongs to another account")
    return item
  }

  async read(itemIdInput: unknown): Promise<CalendarItem | null> {
    const id = entityIdSchema.parse(itemIdInput)
    const stored = await this.collection.findOne({
      _id: id,
      ownerId: this.actor,
    })
    return stored ? this.ownItem(parseStoredItem(stored)) : null
  }

  async page(
    queryInput: unknown = {}
  ): Promise<{ items: CalendarItem[]; nextAfter: string | null }> {
    const query = remoteItemPageQuerySchema.parse(queryInput)
    const documents = await this.collection
      .find({
        ownerId: this.actor,
        ...(query.afterId ? { _id: { $gt: query.afterId } } : {}),
      })
      .sort({ _id: 1 })
      .limit(query.limit + 1)
      .toArray()
    const hasMore = documents.length > query.limit
    const items = documents
      .slice(0, query.limit)
      .map((record) => this.ownItem(parseStoredItem(record)))
    return { items, nextAfter: hasMore ? (items.at(-1)?.id ?? null) : null }
  }

  async insert(input: unknown): Promise<boolean> {
    const item = this.ownItem(input)
    if (
      item.revision !== 1 ||
      item.deletedAt !== null ||
      item.createdAt !== item.updatedAt
    )
      throw new Error(
        "New remote items require revision one and initial metadata"
      )
    try {
      await this.collection.insertOne({ ...item, _id: item.id })
      return true
    } catch (error) {
      if (
        error instanceof MongoServerError &&
        error.code === 11000 &&
        error.keyPattern?._id === 1
      )
        return false
      throw error
    }
  }

  async replace(baseRevisionInput: unknown, input: unknown): Promise<boolean> {
    const baseRevision = revisionSchema.parse(baseRevisionInput)
    const item = this.ownItem(input)
    if (item.revision !== baseRevision + 1)
      throw new Error("Replacement revision must follow the base revision")
    const result = await this.collection.replaceOne(
      {
        _id: item.id,
        ownerId: this.actor,
        revision: baseRevision,
        deletedAt: null,
        kind: item.kind,
        createdAt: item.createdAt,
      },
      item
    )
    return result.matchedCount === 1
  }
}
