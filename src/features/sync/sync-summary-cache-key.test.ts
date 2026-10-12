import { expect, test } from "bun:test"
import { isAccountSyncCacheKey } from "@/features/sync/manual-sync"
import { mixedSyncSummaryCacheKey } from "@/features/sync/sync-summary-cache-key"

test("summary cache separates negotiation while retaining account-wide invalidation", () => {
  const account = { userId: "cache-owner", epoch: crypto.randomUUID() }
  const oldKey = mixedSyncSummaryCacheKey(account, 2)
  const newKey = mixedSyncSummaryCacheKey(account, 3)
  const planKey = mixedSyncSummaryCacheKey(account, 4)
  const recurringKey = mixedSyncSummaryCacheKey(account, 5)
  const settingsKey = mixedSyncSummaryCacheKey(account, 6)
  expect(settingsKey[3]).toBe(6)
  expect(settingsKey).not.toEqual(recurringKey)
  expect(recurringKey).toEqual([
    "dalis:sync-queue",
    account.userId,
    account.epoch,
    5,
  ])
  expect(recurringKey).not.toEqual(planKey)
  expect(recurringKey).not.toEqual(newKey)
  expect(planKey).toEqual([
    "dalis:sync-queue",
    account.userId,
    account.epoch,
    4,
  ])
  expect(planKey).not.toEqual(newKey)
  expect(oldKey).toEqual(["dalis:sync-queue", account.userId, account.epoch, 2])
  expect(newKey).toEqual(["dalis:sync-queue", account.userId, account.epoch, 3])
  expect(newKey).not.toEqual(oldKey)
  for (const key of [oldKey, newKey, planKey, recurringKey, settingsKey]) {
    expect(isAccountSyncCacheKey(key, account.userId, account.epoch)).toBe(true)
    expect(isAccountSyncCacheKey(key, "another-owner", account.epoch)).toBe(
      false
    )
    expect(
      isAccountSyncCacheKey(key, account.userId, crypto.randomUUID())
    ).toBe(false)
  }
  account.userId = "changed-owner"
  expect(newKey[1]).toBe("cache-owner")
  expect(recurringKey[1]).toBe("cache-owner")
})

test("summary cache rejects invalid account identity and unsupported negotiation", () => {
  const account = { userId: "cache-owner", epoch: crypto.randomUUID() }
  expect(() =>
    mixedSyncSummaryCacheKey({ ...account, userId: "" }, 3)
  ).toThrow()
  expect(() =>
    mixedSyncSummaryCacheKey({ ...account, epoch: "invalid" }, 3)
  ).toThrow()
  for (const protocol of [0, 1, 7, 99, Number.NaN])
    expect(() => mixedSyncSummaryCacheKey(account, protocol as 5)).toThrow()
})
