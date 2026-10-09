import "server-only"

import { type ClientSession, type Collection, MongoServerError } from "mongodb"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { revisionSchema, userIdSchema } from "@/schemas/primitives"
import {
  maximumRemoteTaskCatalog,
  remoteTaskPlacementKeySchema,
  remoteTaskPlacementSchema,
} from "@/schemas/remote-task-placement-planning"
import type { TaskPlacement } from "@/types/preferences"

type PlacementDocument = TaskPlacement & { _id: string }

function documentId(
  placement: Pick<TaskPlacement, "userId" | "scope" | "date" | "occurrenceId">
): string {
  return JSON.stringify([
    placement.userId,
    placement.scope,
    placement.date,
    placement.occurrenceId,
  ])
}

function parseStoredPlacement(document: PlacementDocument): TaskPlacement {
  const { _id, ...value } = document
  const placement = remoteTaskPlacementSchema.parse(value)
  if (_id !== documentId(placement))
    throw new Error("Stored task placement identity is inconsistent")
  return placement
}

// The executor must authorize the task and category before using this
// persistence primitive within the same transaction.
export class RemoteTaskPlacementRepository {
  private constructor(
    private readonly actor: string,
    private readonly collection: Collection<PlacementDocument>,
    private readonly session?: ClientSession
  ) {}

  static async open(
    actorInput: unknown,
    session?: ClientSession
  ): Promise<RemoteTaskPlacementRepository> {
    const actor = userIdSchema.parse(actorInput)
    return new RemoteTaskPlacementRepository(
      actor,
      await getCollection<PlacementDocument>(COLLECTION_NAMES.taskPlacements),
      session
    )
  }

  private ownPlacement(input: unknown): TaskPlacement {
    const placement = remoteTaskPlacementSchema.parse(input)
    if (placement.userId !== this.actor)
      throw new Error("Task placement belongs to another account")
    return placement
  }

  async read(keyInput: unknown): Promise<TaskPlacement | null> {
    const key = remoteTaskPlacementKeySchema.parse(keyInput)
    const stored = await this.collection.findOne(
      { userId: this.actor, ...key },
      { session: this.session }
    )
    return stored ? this.ownPlacement(parseStoredPlacement(stored)) : null
  }

  async catalog(): Promise<TaskPlacement[]> {
    const documents = await this.collection
      .find({ userId: this.actor }, { session: this.session })
      .sort({ scope: 1, date: 1, occurrenceId: 1 })
      .limit(maximumRemoteTaskCatalog + 1)
      .toArray()
    if (documents.length > maximumRemoteTaskCatalog)
      throw new Error(
        "Remote task placement catalog exceeds the supported limit"
      )
    return documents.map((document) =>
      this.ownPlacement(parseStoredPlacement(document))
    )
  }

  async insert(input: unknown): Promise<boolean> {
    const placement = this.ownPlacement(input)
    if (
      placement.revision !== 1 ||
      placement.deletedAt !== null ||
      placement.createdAt !== placement.updatedAt
    )
      throw new Error(
        "New remote task placements require revision one and initial metadata"
      )
    try {
      await this.collection.insertOne(
        { ...placement, _id: documentId(placement) },
        { session: this.session }
      )
      return true
    } catch (error) {
      if (
        !this.session &&
        error instanceof MongoServerError &&
        error.code === 11000 &&
        (error.keyPattern?._id === 1 ||
          (error.keyPattern?.userId === 1 &&
            error.keyPattern?.scope === 1 &&
            error.keyPattern?.date === 1 &&
            error.keyPattern?.occurrenceId === 1))
      )
        return false
      throw error
    }
  }

  async replace(baseRevisionInput: unknown, input: unknown): Promise<boolean> {
    const baseRevision = revisionSchema.min(1).parse(baseRevisionInput)
    const placement = this.ownPlacement(input)
    if (placement.revision !== baseRevision + 1)
      throw new Error("Replacement revision must follow the base revision")
    const result = await this.collection.replaceOne(
      {
        _id: documentId(placement),
        userId: this.actor,
        scope: placement.scope,
        date: placement.date,
        occurrenceId: placement.occurrenceId,
        revision: baseRevision,
        deletedAt: null,
        createdAt: placement.createdAt,
      },
      placement,
      { session: this.session }
    )
    return result.matchedCount === 1
  }
}
