import {
  personalSnapshotKeysSchema,
  personalSnapshotSchema,
} from "@/schemas/personal-snapshot"
import { userIdSchema } from "@/schemas/primitives"
import type { PersonalSnapshot } from "@/types/personal-snapshot"

// Null documents express observed absence, never permission, an ACK, or ancestry.
export function validatePersonalSnapshot(
  input: unknown,
  expectedUserIdInput: unknown,
  expectedKeysInput: unknown
): PersonalSnapshot {
  const actor = userIdSchema.parse(expectedUserIdInput)
  const keys = new Set(personalSnapshotKeysSchema.parse(expectedKeysInput))
  const snapshot = personalSnapshotSchema.parse(input)
  if (snapshot.length !== keys.size)
    throw new Error("Personal snapshot does not cover its expected identities")
  for (const entry of snapshot) {
    if (!keys.has(entry.entityKey))
      throw new Error("Personal snapshot contains an unexpected identity")
    if (
      (entry.record && entry.record.record.userId !== actor) ||
      (entry.entityKey.startsWith("settings:") &&
        entry.entityKey !== `settings:${actor}`)
    )
      throw new Error("Personal snapshot belongs to another account")
  }
  return snapshot
}
