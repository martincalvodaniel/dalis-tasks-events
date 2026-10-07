"use client"

import type { z } from "zod"
import type { LocalAccount } from "@/features/workspace/local-account"
import { requireActiveAccount } from "@/features/workspace/require-active-account"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { LocalRepository } from "@/lib/local-db/repository"
import { compareRank } from "@/lib/ordering/rank"
import { tagDraftSchema } from "@/schemas/preferences"
import type { LocalPreferenceCommand } from "@/types/local-sync"
import type { Tag } from "@/types/preferences"

export type TagDraft = z.infer<typeof tagDraftSchema>

export async function readLocalTags(account: LocalAccount) {
  await requireActiveAccount(account)
  const repository = await LocalRepository.open(account.userId)
  try {
    const [tags, views] = await Promise.all([
      repository.list("tags", { index: "byPosition" }),
      repository.list("itemViews"),
    ])
    await requireActiveAccount(account)
    return {
      tags: tags.sort(compareRank),
      views: Object.fromEntries(
        views.map((view) => [view.itemId, view.primaryTagId])
      ),
    }
  } finally {
    repository.close()
  }
}

async function commit(
  account: LocalAccount,
  command: LocalPreferenceCommand,
  operationId: string,
  expectedTag?: Tag
) {
  await requireActiveAccount(account)
  const outbox = await LocalOutbox.open(account.userId)
  try {
    await outbox.commitPreferenceCommand(command, { operationId, expectedTag })
  } finally {
    outbox.close()
  }
}
export function saveLocalTag(
  account: LocalAccount,
  tagId: string,
  draft: TagDraft,
  operationId: string,
  expectedTag?: Tag
) {
  return commit(
    account,
    { type: "tag.save", tagId, input: tagDraftSchema.parse(draft) },
    operationId,
    expectedTag
  )
}
export function deleteLocalTag(
  account: LocalAccount,
  tag: Tag,
  operationId: string
) {
  return commit(
    account,
    { type: "tag.delete", tagId: tag.id },
    operationId,
    tag
  )
}
export function assignLocalCategory(
  account: LocalAccount,
  itemId: string,
  primaryTagId: string | null,
  operationId: string
) {
  return commit(
    account,
    { type: "item-view.set", itemId, primaryTagId },
    operationId
  )
}
