import "server-only"

import { type ClientSession, type Collection, MongoServerError } from "mongodb"
import { COLLECTION_NAMES, getCollection } from "@/lib/db/collections"
import { revisionSchema, userIdSchema } from "@/schemas/primitives"
import { remoteUserSettingsSchema } from "@/schemas/remote-user-settings-planning"
import type { UserSettings } from "@/types/preferences"

type SettingsDocument = UserSettings & { _id: string }
function documentId(actor: string) {
  return JSON.stringify([actor])
}

export class RemoteUserSettingsRepository {
  private constructor(
    private readonly actor: string,
    private readonly collection: Collection<SettingsDocument>,
    private readonly session?: ClientSession
  ) {}
  static async open(actorInput: unknown, session?: ClientSession) {
    const actor = userIdSchema.parse(actorInput)
    return new RemoteUserSettingsRepository(
      actor,
      await getCollection<SettingsDocument>(COLLECTION_NAMES.userSettings),
      session
    )
  }
  private ownSettings(input: unknown): UserSettings {
    const record = remoteUserSettingsSchema.parse(input)
    if (record.userId !== this.actor)
      throw new Error("Personal settings belong to another account")
    return record
  }
  async read(): Promise<UserSettings | null> {
    const stored = await this.collection.findOne(
      { userId: this.actor },
      { session: this.session }
    )
    if (!stored) return null
    const { _id, ...value } = stored
    const record = this.ownSettings(value)
    if (_id !== documentId(this.actor))
      throw new Error("Stored personal settings identity is inconsistent")
    return record
  }
  async insert(input: unknown): Promise<boolean> {
    const record = this.ownSettings(input)
    if (record.revision !== 1 || record.deletedAt)
      throw new Error(
        "New personal settings require revision one and active content"
      )
    try {
      await this.collection.insertOne(
        { ...record, _id: documentId(this.actor) },
        { session: this.session }
      )
      return true
    } catch (error) {
      if (
        !this.session &&
        error instanceof MongoServerError &&
        error.code === 11000 &&
        (error.keyPattern?._id === 1 || error.keyPattern?.userId === 1)
      )
        return false
      throw error
    }
  }
  async replace(baseInput: unknown, input: unknown): Promise<boolean> {
    const base = revisionSchema.min(1).parse(baseInput)
    const record = this.ownSettings(input)
    if (record.revision !== base + 1)
      throw new Error("Personal settings revision must follow its base")
    const result = await this.collection.replaceOne(
      {
        _id: documentId(this.actor),
        userId: this.actor,
        revision: base,
        deletedAt: null,
        createdAt: record.createdAt,
      },
      record,
      { session: this.session }
    )
    return result.matchedCount === 1
  }
}
