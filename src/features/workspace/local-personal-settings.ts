"use client"
import type { z } from "zod"
import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { LocalRepository } from "@/lib/local-db/repository"
import {
  userSettingsInputSchema,
  userSettingsSchema,
} from "@/schemas/preferences"
import { userIdSchema } from "@/schemas/primitives"
import { accountControlSchema } from "@/schemas/workspace"
import type { OutboxEntry } from "@/types/local-sync"
import type { UserSettings } from "@/types/preferences"

type UserSettingsInput = z.infer<typeof userSettingsInputSchema>
type AccountIdentity = Pick<LocalAccount, "userId" | "epoch">
interface PersonalSettingsPorts {
  requireActive(account: AccountIdentity): Promise<void>
  readSettings(userId: string): Promise<unknown>
  commitSettings(
    userId: string,
    input: UserSettingsInput,
    expectedSettings: UserSettings | null
  ): Promise<OutboxEntry>
}
const defaultPorts: PersonalSettingsPorts = {
  requireActive: requireActiveAccount,
  readSettings: async (userId) => {
    const repository = await LocalRepository.open(userId)
    try {
      return (await repository.get("settings", userId)) ?? null
    } finally {
      repository.close()
    }
  },
  commitSettings: async (userId, input, expectedSettings) => {
    const outbox = await LocalOutbox.open(userId)
    try {
      return await outbox.commitUserSettingsCommand(
        { type: "settings.update", input },
        { expectedSettings }
      )
    } finally {
      outbox.close()
    }
  },
}
function captureAccount(account: AccountIdentity): AccountIdentity {
  return {
    userId: userIdSchema.parse(account.userId),
    epoch: accountControlSchema.shape.epoch.parse(account.epoch),
  }
}
function ownSettings(input: unknown, userId: string): UserSettings | null {
  const record = userSettingsSchema.nullable().parse(input)
  if (record && record.userId !== userId)
    throw new Error("Personal settings belong to another account")
  return record
}
export async function readLocalPersonalSettings(
  accountInput: AccountIdentity,
  ports: PersonalSettingsPorts = defaultPorts
): Promise<UserSettings | null> {
  const account = captureAccount(accountInput)
  await ports.requireActive(account)
  const value = ownSettings(
    await ports.readSettings(account.userId),
    account.userId
  )
  await ports.requireActive(account)
  return value
}
// Account control and product data are separate partitions. A post-commit account change preserves the durable intention.
export async function saveLocalPersonalSettings(
  accountInput: AccountIdentity,
  input: unknown,
  expectedInput: unknown,
  ports: PersonalSettingsPorts = defaultPorts
): Promise<OutboxEntry> {
  const account = captureAccount(accountInput)
  const settings = userSettingsInputSchema.parse(input),
    expectedSettings = ownSettings(expectedInput, account.userId)
  await ports.requireActive(account)
  const entry = await ports.commitSettings(
    account.userId,
    settings,
    expectedSettings
  )
  await ports.requireActive(account)
  return entry
}
