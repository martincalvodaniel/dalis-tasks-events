import { applyPlanOccurrenceCommand } from "@/lib/calendar/plan-occurrence-command"
import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { LocalMixedSyncStore } from "@/lib/local-db/mixed-sync-store"
import { LocalOutbox } from "@/lib/local-db/outbox"
import {
  applyLocalRecurringChangesPage,
  applyLocalSettingsChangesPage as applyLocalSettingsChangesPageDirect,
} from "@/lib/local-db/pull-recurring-changes"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { planSchema } from "@/schemas/plan-item"
import { entityIdSchema } from "@/schemas/primitives"
import type { PreferenceEffect } from "@/types/preference-effects"
import type { UserSettings } from "@/types/preferences"
import type { RemoteRecurringChange } from "@/types/remote-recurring-sync"

if (location.hostname !== "127.0.0.1" || location.port !== "4264")
  throw new Error("Settings results proof requires its owned loopback origin")
const query = new URLSearchParams(location.search)
const runId = entityIdSchema.parse(query.get("run"))
const actor = `browser-test-${runId}-settings-pull`,
  peer = `${actor}-peer`
const names = [localDatabaseName(actor), localDatabaseName(peer)]
const marker = `dalis:settings-pull:${runId}`
const isReload = query.get("phase") === "reload"
const existing = await indexedDB.databases()
if (isReload) {
  if (
    sessionStorage.getItem(marker) !== "owned" ||
    !names.every((name) => existing.some((entry) => entry.name === name))
  )
    throw new Error("Settings results reload ownership is missing")
} else {
  if (names.some((name) => existing.some((entry) => entry.name === name)))
    throw new Error("Existing settings partition blocks this run")
  sessionStorage.setItem(marker, "owned")
}
const status = document.getElementById("status"),
  results = document.getElementById("results")
const run = document.getElementById("run") as HTMLButtonElement
const reload = document.getElementById("reload") as HTMLButtonElement
const cleanup = document.getElementById("cleanup") as HTMLButtonElement
if (!status || !results || !run || !reload || !cleanup)
  throw new Error("Settings results markup is missing")
const statusNode = status,
  resultsNode = results
const stores = [
  "items",
  "occurrences",
  "tags",
  "itemViews",
  "taskPlacements",
  "settings",
  "outbox",
  "remoteShadows",
  "syncMetadata",
]
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}
async function refused(work: () => Promise<unknown>) {
  let failed = false
  try {
    await work()
  } catch {
    failed = true
  }
  assert(failed, "Expected settings rejection")
}
async function check(label: string, work: () => Promise<void>) {
  await work()
  const row = document.createElement("li")
  row.textContent = `Correcto: ${label}`
  resultsNode.append(row)
}
async function snapshot(userId = actor) {
  const database = await openLocalDatabase(userId)
  try {
    return await runLocalTransaction<Record<string, unknown[]>>(
      database,
      stores,
      "readonly",
      (context) => {
        const value: Record<string, unknown[]> = {}
        let remaining = stores.length
        for (const name of stores) {
          const request = context.transaction.objectStore(name).getAll()
          request.onsuccess = () => {
            value[name] = request.result
            if (!--remaining) context.setResult(value)
          }
        }
      }
    )
  } finally {
    database.close()
  }
}
async function put(store: string, value: unknown) {
  const database = await openLocalDatabase(actor)
  try {
    await runLocalTransaction(database, [store], "readwrite", (context) => {
      context.transaction.objectStore(store).put(value)
      context.setResult(undefined)
    })
  } finally {
    database.close()
  }
}
const command = (timeZone: string) => ({
  type: "settings.update" as const,
  input: { timeZone, weekStartsOn: 1 as const, locale: "es-ES" as const },
})
run.hidden = isReload
reload.hidden = !isReload
statusNode.textContent =
  "Prueba de consumidor local; respuestas remotas ficticias, sin Google ni Mongo."
const now = "2026-10-12T10:00:00.000Z"
function remoteSettings(
  userId: string,
  revision: number,
  timeZone = "Europe/Madrid"
): PreferenceEffect {
  return {
    store: "settings",
    record: {
      userId,
      revision,
      timeZone,
      weekStartsOn: 1,
      locale: "es-ES",
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
  }
}
function remoteTag(userId: string, id: string, revision = 1): PreferenceEffect {
  return {
    store: "tags",
    record: {
      id,
      userId,
      name: "Remote category",
      normalizedName: "remote category",
      color: "#123abc",
      position: 1024,
      revision,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
  }
}
function change(
  userId: string,
  effect: PreferenceEffect,
  sequence: number
): RemoteRecurringChange {
  const operationId = crypto.randomUUID()
  return {
    version: 2,
    kind: "preference",
    recipientUserId: userId,
    operationId,
    sequence,
    effects: { version: 1, userId, operationId, sequence, effects: [effect] },
  }
}
function receipt(changes: RemoteRecurringChange[], after = 0) {
  return {
    query: { after, through: null, limit: 100 },
    page: {
      version: 2 as const,
      changes,
      nextAfter: after + changes.length,
      through: after + changes.length,
      hasMore: false,
    },
  }
}
let futureStore: LocalMixedSyncStore | null = null
function applyLocalSettingsChangesPage(
  database: IDBDatabase,
  userId: string,
  input: unknown
) {
  return futureStore &&
    userId === actor &&
    database.name === localDatabaseName(actor)
    ? futureStore.applyChangesPage(input)
    : applyLocalSettingsChangesPageDirect(database, userId, input)
}
run.onclick = async () => {
  run.disabled = true
  const database = await openLocalDatabase(actor),
    otherDatabase = await openLocalDatabase(peer),
    outbox = await LocalOutbox.open(actor),
    otherOutbox = await LocalOutbox.open(peer)
  try {
    futureStore = await LocalMixedSyncStore.openSettings(actor)
    const pending = await outbox.commitUserSettingsCommand(command("UTC"), {
      expectedSettings: null,
    })
    const tagId = crypto.randomUUID()
    const page = receipt([
      change(actor, remoteSettings(actor, 1), 1),
      change(actor, remoteTag(actor, tagId), 2),
    ])
    await check(
      "Puerto anterior y actor distinto rechazan la página completa",
      async () => {
        const before = JSON.stringify(await snapshot())
        await refused(() =>
          applyLocalRecurringChangesPage(database, actor, page)
        )
        await refused(() => applyLocalSettingsChangesPage(database, peer, page))
        assert(
          JSON.stringify(await snapshot()) === before,
          "Rejected pull changed stores"
        )
      }
    )
    await check(
      "Fallo al guardar cursor revierte ajustes, categorías y shadows",
      async () => {
        const before = JSON.stringify(await snapshot()),
          putRecord = IDBObjectStore.prototype.put
        IDBObjectStore.prototype.put = function (
          value: unknown,
          key?: IDBValidKey
        ) {
          if (
            this.name === "syncMetadata" &&
            value &&
            typeof value === "object" &&
            "key" in value &&
            value.key === "pull-cursor"
          )
            throw new Error("Injected owned cursor failure")
          return key === undefined
            ? putRecord.call(this, value)
            : putRecord.call(this, value, key)
        }
        try {
          await refused(() =>
            applyLocalSettingsChangesPage(database, actor, page)
          )
        } finally {
          IDBObjectStore.prototype.put = putRecord
        }
        assert(
          JSON.stringify(await snapshot()) === before,
          "Cursor failure committed a partial page"
        )
      }
    )
    await check(
      "Ajuste pendiente conserva valor; categoría, evidencia y cursor se guardan juntos",
      async () => {
        assert(
          (await applyLocalSettingsChangesPage(database, actor, page)) ===
            "applied",
          "Complete pull was not applied"
        )
        const state = await snapshot()
        assert(
          (state.settings[0] as UserSettings).timeZone === "UTC" &&
            (state.settings[0] as UserSettings).revision === 0,
          "Pull overwrote pending settings"
        )
        assert(
          state.tags.length === 1 &&
            state.remoteShadows.length === 2 &&
            state.syncMetadata.some(
              (value) =>
                (value as { key: string; after: number }).key ===
                  "pull-cursor" && (value as { after: number }).after === 2
            ),
          "Complete page or cursor is missing"
        )
        assert(
          JSON.stringify((await outbox.listEntries())[0]) ===
            JSON.stringify(pending),
          "Pull acknowledged or rewrote the intention"
        )
      }
    )
    await check(
      "Página antigua se ignora sin reescribir datos ni cola",
      async () => {
        const before = JSON.stringify(await snapshot())
        assert(
          (await applyLocalSettingsChangesPage(database, actor, page)) ===
            "ignored",
          "Old page was not ignored"
        )
        assert(
          JSON.stringify(await snapshot()) === before,
          "Old page changed stores"
        )
      }
    )
    await check(
      "Corrupción, revisión contradictoria y checkpoint incorrecto no avanzan cursor",
      async () => {
        const before = JSON.stringify(await snapshot())
        const foreign = remoteSettings(peer, 2)
        await refused(() =>
          applyLocalSettingsChangesPage(
            database,
            actor,
            receipt(
              [
                change(actor, remoteTag(actor, crypto.randomUUID()), 3),
                change(actor, foreign, 4),
              ],
              2
            )
          )
        )
        await refused(() =>
          applyLocalSettingsChangesPage(
            database,
            actor,
            receipt(
              [change(actor, remoteSettings(actor, 1, "Asia/Tokyo"), 3)],
              2
            )
          )
        )
        await refused(() =>
          applyLocalSettingsChangesPage(
            database,
            actor,
            receipt(
              [
                change(actor, remoteSettings(actor, 2), 2),
                change(actor, remoteSettings(actor, 3), 3),
              ],
              1
            )
          )
        )
        assert(
          JSON.stringify(await snapshot()) === before,
          "Invalid page advanced cursor or wrote earlier effects"
        )
      }
    )
    await check(
      "Serie, aparición y ajuste comparten TX sin alterar zona de la serie",
      async () => {
        const series = planSchema.parse({
          kind: "plan",
          variant: "appointment",
          id: crypto.randomUUID(),
          ownerId: actor,
          title: "Owned series",
          description: "",
          status: "not_started",
          completedAt: null,
          checklist: [],
          schedule: {
            mode: "all_day",
            startDate: "2026-10-12",
            endDateExclusive: "2026-10-13",
          },
          recurrence: {
            frequency: "daily",
            interval: 1,
            anchorDate: "2026-10-12",
            timeZone: "America/New_York",
            end: { type: "never" },
          },
          revision: 1,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        })
        const appearance = {
          ...applyPlanOccurrenceCommand(
            series,
            null,
            {
              type: "plan.set-occurrence-status",
              itemId: series.id,
              occurrenceId: `${series.id}:2026-10-12`,
              status: "completed",
            },
            actor,
            now
          ),
          revision: 1,
        }
        const mixed: RemoteRecurringChange[] = [
          {
            version: 2,
            kind: "item",
            recipientUserId: actor,
            operationId: crypto.randomUUID(),
            sequence: 3,
            item: series,
          },
          {
            version: 2,
            kind: "plan-occurrence",
            recipientUserId: actor,
            operationId: crypto.randomUUID(),
            sequence: 4,
            seriesRevision: 1,
            occurrence: appearance,
          },
          change(actor, remoteSettings(actor, 2, "Asia/Tokyo"), 5),
        ]
        assert(
          (await applyLocalSettingsChangesPage(
            database,
            actor,
            receipt(mixed, 2)
          )) === "applied",
          "Mixed recurring settings page failed"
        )
        const state = await snapshot()
        assert(
          JSON.stringify(state.items) === JSON.stringify([series]) &&
            JSON.stringify(state.occurrences) === JSON.stringify([appearance]),
          "Mixed page changed recurrence or lost appearance"
        )
        assert(
          (state.settings[0] as UserSettings).timeZone === "UTC" &&
            JSON.stringify((await outbox.listEntries())[0]) ===
              JSON.stringify(pending),
          "Mixed page changed pending settings"
        )
      }
    )
    await check(
      "Categoría bloqueada no impide descargar ajustes en otra partición propia",
      async () => {
        const category = await otherOutbox.commitPreferenceCommand({
          type: "tag.save",
          tagId: crypto.randomUUID(),
          input: { name: "Local category", color: "#123abc", position: 1024 },
        })
        await runLocalTransaction(
          otherDatabase,
          ["outbox"],
          "readwrite",
          (context) => {
            context.transaction
              .objectStore("outbox")
              .put({ ...category, state: "conflict", attempts: 1 })
            context.setResult(undefined)
          }
        )
        assert(
          category.operation.command.type === "tag.save",
          "Category producer returned another family"
        )
        const download = receipt([
          change(peer, remoteSettings(peer, 1, "Asia/Tokyo"), 1),
          change(peer, remoteTag(peer, category.operation.command.tagId), 2),
        ])
        assert(
          (await applyLocalSettingsChangesPage(
            otherDatabase,
            peer,
            download
          )) === "applied",
          "Independent settings pull failed"
        )
        const state = await snapshot(peer)
        assert(
          (state.settings[0] as UserSettings).revision === 1 &&
            (state.settings[0] as UserSettings).timeZone === "Asia/Tokyo" &&
            (state.tags[0] as { revision: number }).revision === 0,
          "Category conflict froze settings or replaced its local value"
        )
        assert(
          (await otherOutbox.listEntries())[0].state === "conflict",
          "Pull acknowledged a category conflict"
        )
      }
    )
    await check(
      "Registros locales extranjeros abortan incluso página vacía",
      async () => {
        await put("settings", {
          ...((await snapshot()).settings[0] as UserSettings),
          userId: peer,
        })
        const before = JSON.stringify(await snapshot())
        await refused(() =>
          applyLocalSettingsChangesPage(database, actor, receipt([], 5))
        )
        assert(
          JSON.stringify(await snapshot()) === before,
          "Foreign snapshot was filtered or repaired"
        )
        await runLocalTransaction(
          database,
          ["settings"],
          "readwrite",
          (context) => {
            context.transaction.objectStore("settings").delete(peer)
            context.setResult(undefined)
          }
        )
      }
    )
    sessionStorage.setItem(
      `${marker}:proof`,
      JSON.stringify({ primary: await snapshot(), peer: await snapshot(peer) })
    )
    statusNode.textContent =
      "Ocho comprobaciones IndexedDB correctas; descarga completa, pendientes y cursor atómicos."
  } catch (error) {
    statusNode.textContent = `Fallo: ${error instanceof Error ? error.message : "Unknown settings pull failure"}`
  } finally {
    futureStore?.close()
    futureStore = null
    outbox.close()
    otherOutbox.close()
    database.close()
    otherDatabase.close()
  }
}

reload.onclick = async () => {
  try {
    assert(
      sessionStorage.getItem(`${marker}:proof`) ===
        JSON.stringify({
          primary: await snapshot(),
          peer: await snapshot(peer),
        }),
      "Reload changed settings pull"
    )
    statusNode.textContent =
      "Recarga correcta: ajustes, cola, UUID, cursor y shadows intactos."
  } catch (error) {
    statusNode.textContent = `Fallo: ${error instanceof Error ? error.message : "Unknown reload failure"}`
  }
}
cleanup.onclick = async () => {
  assert(
    sessionStorage.getItem(marker) === "owned",
    "Settings cleanup ownership is missing"
  )
  for (const name of names)
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error("Settings cleanup blocked"))
    })
  sessionStorage.removeItem(marker)
  sessionStorage.removeItem(`${marker}:proof`)
  run.disabled = true
  reload.disabled = true
  cleanup.disabled = true
  statusNode.textContent = "Particiones de prueba propias eliminadas."
}
