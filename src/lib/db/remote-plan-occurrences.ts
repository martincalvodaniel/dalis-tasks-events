import "server-only"

import { type ClientSession, type Collection, MongoServerError } from "mongodb"
import type { z } from "zod"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { planOccurrenceSchema } from "@/schemas/plan-occurrence"
import {
  entityIdSchema,
  revisionSchema,
  userIdSchema,
} from "@/schemas/primitives"
import {
  maximumRemotePlanOccurrenceCatalog,
  remotePlanOccurrenceKeySchema,
  remoteStoredPlanOccurrenceSchema,
} from "@/schemas/remote-plan-occurrence-storage"
import type { PlanOccurrence } from "@/types/plan-occurrence"

type OccurrenceDocument = z.infer<typeof remoteStoredPlanOccurrenceSchema> & {
  _id: string
}

function documentId(actor: string, id: string): string {
  return JSON.stringify([actor, id])
}

// Persistence only: the executor must authorize and write the shared series
// guard in the same transaction before mutating an appearance.
export class RemotePlanOccurrenceRepository {
  private constructor(
    private readonly actor: string,
    private readonly collection: Collection<OccurrenceDocument>,
    private readonly session?: ClientSession
  ) {}

  static async open(
    actorInput: unknown,
    session?: ClientSession
  ): Promise<RemotePlanOccurrenceRepository> {
    const actor = userIdSchema.parse(actorInput)
    return new RemotePlanOccurrenceRepository(
      actor,
      await getCollection<OccurrenceDocument>(COLLECTION_NAMES.planOccurrences),
      session
    )
  }

  private parseStored(document: OccurrenceDocument): PlanOccurrence {
    const { _id, ...raw } = document
    const { userId, ...occurrence } =
      remoteStoredPlanOccurrenceSchema.parse(raw)
    if (userId !== this.actor || _id !== documentId(userId, occurrence.id))
      throw new Error("Stored plan occurrence identity is inconsistent")
    return occurrence
  }

  async read(keyInput: unknown): Promise<PlanOccurrence | null> {
    const key = remotePlanOccurrenceKeySchema.parse(keyInput)
    const stored = await this.collection.findOne(
      { userId: this.actor, ...key },
      { session: this.session }
    )
    return stored ? this.parseStored(stored) : null
  }

  async seriesCatalog(seriesIdInput: unknown): Promise<PlanOccurrence[]> {
    const seriesId = entityIdSchema.parse(seriesIdInput)
    const stored = await this.collection
      .find({ userId: this.actor, seriesId }, { session: this.session })
      .sort({ slotKey: 1 })
      .limit(maximumRemotePlanOccurrenceCatalog + 1)
      .toArray()
    if (stored.length > maximumRemotePlanOccurrenceCatalog)
      throw new Error(
        "Remote plan occurrence catalog exceeds the supported limit"
      )
    return stored.map((document) => this.parseStored(document))
  }

  // Complete bounded actor snapshot for mixed ordering; the executor authorizes every parent.
  async catalog(): Promise<PlanOccurrence[]> {
    const stored = await this.collection
      .find({ userId: this.actor }, { session: this.session })
      .sort({ seriesId: 1, slotKey: 1 })
      .limit(maximumRemotePlanOccurrenceCatalog + 1)
      .toArray()
    if (stored.length > maximumRemotePlanOccurrenceCatalog)
      throw new Error(
        "Remote plan occurrence catalog exceeds the supported limit"
      )
    return stored.map((document) => this.parseStored(document))
  }

  async insert(input: unknown): Promise<boolean> {
    const occurrence = planOccurrenceSchema.parse(input)
    if (
      occurrence.revision !== 1 ||
      occurrence.deletedAt !== null ||
      occurrence.createdAt !== occurrence.updatedAt
    )
      throw new Error(
        "New remote plan occurrences require revision one and initial metadata"
      )
    try {
      await this.collection.insertOne(
        {
          ...occurrence,
          userId: this.actor,
          _id: documentId(this.actor, occurrence.id),
        },
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
            error.keyPattern?.seriesId === 1 &&
            error.keyPattern?.slotKey === 1))
      )
        return false
      throw error
    }
  }

  async replace(baseRevisionInput: unknown, input: unknown): Promise<boolean> {
    const baseRevision = revisionSchema.min(1).parse(baseRevisionInput)
    const occurrence = planOccurrenceSchema.parse(input)
    if (occurrence.revision !== baseRevision + 1)
      throw new Error("Replacement revision must follow the base revision")
    const result = await this.collection.replaceOne(
      {
        _id: documentId(this.actor, occurrence.id),
        userId: this.actor,
        seriesId: occurrence.seriesId,
        slotKey: occurrence.slotKey,
        revision: baseRevision,
        createdAt: occurrence.createdAt,
        cancelled: false,
        deletedAt: null,
      },
      { ...occurrence, userId: this.actor },
      { session: this.session }
    )
    return result.matchedCount === 1
  }
}
