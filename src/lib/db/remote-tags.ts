import "server-only"

import { type ClientSession, type Collection, MongoServerError } from "mongodb"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import {
  entityIdSchema,
  revisionSchema,
  userIdSchema,
} from "@/schemas/primitives"
import {
  maximumRemoteTags,
  remoteTagSchema,
} from "@/schemas/remote-tag-planning"
import type { Tag } from "@/types/preferences"

type TagDocument = Tag & { _id: string }

function documentId(tag: Pick<Tag, "userId" | "id">): string {
  return JSON.stringify([tag.userId, tag.id])
}

function parseStoredTag(document: TagDocument): Tag {
  const { _id, ...value } = document
  const tag = remoteTagSchema.parse(value)
  if (_id !== documentId(tag))
    throw new Error("Stored category identity is inconsistent")
  return tag
}

export class RemoteTagRepository {
  private constructor(
    private readonly actor: string,
    private readonly collection: Collection<TagDocument>,
    private readonly session?: ClientSession
  ) {}

  static async open(
    actorInput: unknown,
    session?: ClientSession
  ): Promise<RemoteTagRepository> {
    const actor = userIdSchema.parse(actorInput)
    return new RemoteTagRepository(
      actor,
      await getCollection<TagDocument>(COLLECTION_NAMES.tags),
      session
    )
  }

  private ownTag(input: unknown): Tag {
    const tag = remoteTagSchema.parse(input)
    if (tag.userId !== this.actor)
      throw new Error("Category belongs to another account")
    return tag
  }

  async read(tagIdInput: unknown): Promise<Tag | null> {
    const id = entityIdSchema.parse(tagIdInput)
    const stored = await this.collection.findOne(
      { userId: this.actor, id },
      { session: this.session }
    )
    return stored ? this.ownTag(parseStoredTag(stored)) : null
  }

  async catalog(): Promise<Tag[]> {
    const documents = await this.collection
      .find({ userId: this.actor }, { session: this.session })
      .sort({ id: 1 })
      .limit(maximumRemoteTags + 1)
      .toArray()
    if (documents.length > maximumRemoteTags)
      throw new Error("Remote category catalog exceeds the supported limit")
    const tags = documents.map((document) =>
      this.ownTag(parseStoredTag(document))
    )
    const ids = new Set<string>()
    const names = new Set<string>()
    for (const tag of tags) {
      if (ids.has(tag.id)) throw new Error("Duplicate category identity")
      ids.add(tag.id)
      if (!tag.deletedAt) {
        if (names.has(tag.normalizedName))
          throw new Error("Duplicate active category name")
        names.add(tag.normalizedName)
      }
    }
    return tags
  }

  async insert(input: unknown): Promise<boolean> {
    const tag = this.ownTag(input)
    if (
      tag.revision !== 1 ||
      tag.deletedAt !== null ||
      tag.createdAt !== tag.updatedAt
    )
      throw new Error(
        "New remote categories require revision one and initial metadata"
      )
    try {
      await this.collection.insertOne(
        { ...tag, _id: documentId(tag) },
        { session: this.session }
      )
      return true
    } catch (error) {
      if (
        !this.session &&
        error instanceof MongoServerError &&
        error.code === 11000 &&
        (error.keyPattern?._id === 1 ||
          (error.keyPattern?.userId === 1 && error.keyPattern?.id === 1))
      )
        return false
      throw error
    }
  }

  async replace(baseRevisionInput: unknown, input: unknown): Promise<boolean> {
    const baseRevision = revisionSchema.min(1).parse(baseRevisionInput)
    const tag = this.ownTag(input)
    if (tag.revision !== baseRevision + 1)
      throw new Error("Replacement revision must follow the base revision")
    const result = await this.collection.replaceOne(
      {
        _id: documentId(tag),
        userId: this.actor,
        id: tag.id,
        revision: baseRevision,
        deletedAt: null,
        createdAt: tag.createdAt,
      },
      tag,
      { session: this.session }
    )
    return result.matchedCount === 1
  }
}
