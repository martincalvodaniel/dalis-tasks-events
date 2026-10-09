import "server-only"

import { type ClientSession, type Collection, MongoServerError } from "mongodb"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import {
  entityIdSchema,
  revisionSchema,
  userIdSchema,
} from "@/schemas/primitives"
import { remoteItemViewSchema } from "@/schemas/remote-item-view-planning"
import { maximumRemoteTaskCatalog } from "@/schemas/remote-task-placement-planning"
import type { ItemView } from "@/types/preferences"

type ItemViewDocument = ItemView & { _id: string }

function documentId(view: Pick<ItemView, "userId" | "itemId">): string {
  return JSON.stringify([view.userId, view.itemId])
}

function parseStoredView(document: ItemViewDocument): ItemView {
  const { _id, ...value } = document
  const view = remoteItemViewSchema.parse(value)
  if (_id !== documentId(view))
    throw new Error("Stored item view identity is inconsistent")
  return view
}

// Persistence does not grant access to content. The command executor must
// authorize the current item and category in the same transaction first.
export class RemoteItemViewRepository {
  private constructor(
    private readonly actor: string,
    private readonly collection: Collection<ItemViewDocument>,
    private readonly session?: ClientSession
  ) {}

  static async open(
    actorInput: unknown,
    session?: ClientSession
  ): Promise<RemoteItemViewRepository> {
    const actor = userIdSchema.parse(actorInput)
    return new RemoteItemViewRepository(
      actor,
      await getCollection<ItemViewDocument>(COLLECTION_NAMES.itemViews),
      session
    )
  }

  private ownView(input: unknown): ItemView {
    const view = remoteItemViewSchema.parse(input)
    if (view.userId !== this.actor)
      throw new Error("Item view belongs to another account")
    return view
  }

  async read(itemIdInput: unknown): Promise<ItemView | null> {
    const itemId = entityIdSchema.parse(itemIdInput)
    const stored = await this.collection.findOne(
      { userId: this.actor, itemId },
      { session: this.session }
    )
    return stored ? this.ownView(parseStoredView(stored)) : null
  }

  async catalog(): Promise<ItemView[]> {
    const documents = await this.collection
      .find({ userId: this.actor }, { session: this.session })
      .sort({ itemId: 1 })
      .limit(maximumRemoteTaskCatalog + 1)
      .toArray()
    if (documents.length > maximumRemoteTaskCatalog)
      throw new Error("Remote item view catalog exceeds the supported limit")
    return documents.map((document) => this.ownView(parseStoredView(document)))
  }

  async insert(input: unknown): Promise<boolean> {
    const view = this.ownView(input)
    if (
      view.revision !== 1 ||
      view.deletedAt !== null ||
      view.createdAt !== view.updatedAt
    )
      throw new Error(
        "New remote item views require revision one and initial metadata"
      )
    try {
      await this.collection.insertOne(
        { ...view, _id: documentId(view) },
        { session: this.session }
      )
      return true
    } catch (error) {
      if (
        !this.session &&
        error instanceof MongoServerError &&
        error.code === 11000 &&
        (error.keyPattern?._id === 1 ||
          (error.keyPattern?.userId === 1 && error.keyPattern?.itemId === 1))
      )
        return false
      throw error
    }
  }

  async replace(baseRevisionInput: unknown, input: unknown): Promise<boolean> {
    const baseRevision = revisionSchema.min(1).parse(baseRevisionInput)
    const view = this.ownView(input)
    if (view.revision !== baseRevision + 1)
      throw new Error("Replacement revision must follow the base revision")
    const result = await this.collection.replaceOne(
      {
        _id: documentId(view),
        userId: this.actor,
        itemId: view.itemId,
        revision: baseRevision,
        deletedAt: null,
        createdAt: view.createdAt,
      },
      view,
      { session: this.session }
    )
    return result.matchedCount === 1
  }
}
