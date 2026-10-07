"use client"

import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { LocalRepository } from "@/lib/local-db/repository"
import { eventDraftSchema } from "@/schemas/calendar-item"
import type { CalendarEvent, CalendarItemDraft } from "@/types/calendar-item"

export type EventDraft = Extract<CalendarItemDraft, { kind: "event" }>

export async function readLocalEvents(account: LocalAccount) {
  await requireActiveAccount(account)
  const repository = await LocalRepository.open(account.userId)
  try {
    const [items, settings] = await Promise.all([
      repository.list("items"),
      repository.get("settings", account.userId),
    ])
    if (!settings || settings.deletedAt)
      throw new Error("Local settings are unavailable")
    await requireActiveAccount(account)
    return {
      events: items.filter(
        (item): item is CalendarEvent => item.kind === "event"
      ),
      timeZone: settings.timeZone,
    }
  } finally {
    repository.close()
  }
}

export async function createLocalEvent(
  account: LocalAccount,
  input: EventDraft,
  itemId: string,
  operationId: string
) {
  const draft = eventDraftSchema.parse(input)
  await requireActiveAccount(account)
  const outbox = await LocalOutbox.open(account.userId)
  try {
    await outbox.commitItemCommand(
      { type: "item.create", itemId, input: draft },
      { operationId }
    )
  } finally {
    outbox.close()
  }
}

export async function updateLocalEvent(
  account: LocalAccount,
  expected: CalendarEvent,
  input: EventDraft,
  operationId: string
) {
  const draft = eventDraftSchema.parse(input)
  await requireActiveAccount(account)
  const outbox = await LocalOutbox.open(account.userId)
  try {
    await outbox.commitItemCommand(
      { type: "item.update", itemId: expected.id, input: draft },
      { operationId, expectedItem: expected }
    )
  } finally {
    outbox.close()
  }
}

export async function deleteLocalEvent(
  account: LocalAccount,
  expected: CalendarEvent,
  operationId: string
) {
  await requireActiveAccount(account)
  const outbox = await LocalOutbox.open(account.userId)
  try {
    await outbox.commitItemCommand(
      { type: "item.delete", itemId: expected.id },
      { operationId, expectedItem: expected }
    )
  } finally {
    outbox.close()
  }
}
