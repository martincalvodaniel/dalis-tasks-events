import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"
import {
  applyLocalRecurringPreferenceResult,
  applyLocalSettingsPreferenceResult,
} from "@/lib/local-db/preference-sync-results"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { entityIdSchema } from "@/schemas/primitives"
import { userSettingsEntityKey } from "@/schemas/user-settings-key"
import type { LocalSyncResultInputV2 } from "@/types/local-sync-result-v2"
import type { PreferenceEffect } from "@/types/preference-effects"
import type { UserSettings } from "@/types/preferences"

if (location.hostname !== "127.0.0.1" || location.port !== "4263")
  throw new Error("Settings results proof requires its owned loopback origin")
const query = new URLSearchParams(location.search)
const runId = entityIdSchema.parse(query.get("run"))
const actor = `browser-test-${runId}-settings-results`,
  peer = `${actor}-peer`
const names = [localDatabaseName(actor), localDatabaseName(peer)]
const marker = `dalis:settings-results:${runId}`
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
const sender = crypto.randomUUID()
run.hidden = isReload
reload.hidden = !isReload
statusNode.textContent =
  "Prueba de consumidor local; respuestas remotas ficticias, sin Google ni Mongo."
run.onclick = async () => {
  run.disabled = true
  const database = await openLocalDatabase(actor),
    outbox = await LocalOutbox.open(actor)
  try {
    await snapshot(peer)
    const category = await outbox.commitPreferenceCommand({
      type: "tag.save",
      tagId: crypto.randomUUID(),
      input: { name: "Owned category", color: "#123abc", position: 1024 },
    })
    await put("outbox", { ...category, state: "conflict", attempts: 1 })
    const first = await outbox.commitUserSettingsCommand(
      command("Europe/Madrid"),
      { expectedSettings: null }
    )
    const child = await outbox.commitUserSettingsCommand(
      command("America/Los_Angeles")
    )
    assert(
      await outbox.claim(first.operation.operationId, sender),
      "Settings claim failed"
    )
    const optimistic = (await snapshot()).settings[0] as UserSettings
    const confirmed: PreferenceEffect = {
      store: "settings",
      record: { ...optimistic, timeZone: "Europe/Madrid", revision: 1 },
    }
    const submission: LocalSyncResultInputV2 = {
      operation: first.operation,
      senderId: sender,
      result: {
        kind: "preference",
        outcome: {
          operationId: first.operation.operationId,
          status: "applied",
          effects: {
            version: 1,
            userId: actor,
            operationId: first.operation.operationId,
            sequence: 1,
            effects: [confirmed],
          },
        },
      },
    }
    await check(
      "Generación actual, lease ajeno y otra partición rechazan sin cambios",
      async () => {
        const before = JSON.stringify(await snapshot())
        await refused(() =>
          applyLocalRecurringPreferenceResult(database, actor, submission)
        )
        await refused(() =>
          applyLocalSettingsPreferenceResult(database, actor, {
            ...submission,
            senderId: crypto.randomUUID(),
          })
        )
        await refused(() =>
          applyLocalSettingsPreferenceResult(database, peer, submission)
        )
        assert(
          JSON.stringify(await snapshot()) === before,
          "Rejection changed owned stores"
        )
      }
    )
    await check(
      "Fallo tardío revierte valor, shadow, cola y outcome",
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
            value.key === `operation-outcome:${first.operation.operationId}`
          )
            throw new Error("Injected late settings outcome failure")
          return key === undefined
            ? putRecord.call(this, value)
            : putRecord.call(this, value, key)
        }
        try {
          await refused(() =>
            applyLocalSettingsPreferenceResult(database, actor, submission)
          )
        } finally {
          IDBObjectStore.prototype.put = putRecord
        }
        assert(
          JSON.stringify(await snapshot()) === before,
          "Late failure committed partial settings"
        )
      }
    )
    await check(
      "ACK y evidencia atómicos; hijo conserva valor optimista y rebasa CAS",
      async () => {
        assert(
          (await applyLocalSettingsPreferenceResult(
            database,
            actor,
            submission
          )) === "applied",
          "Settings result was not applied"
        )
        const state = await snapshot(),
          entries = await outbox.listEntries()
        const ack = entries.find(
            (entry) =>
              entry.operation.operationId === first.operation.operationId
          ),
          dependent = entries.find(
            (entry) =>
              entry.operation.operationId === child.operation.operationId
          )
        assert(
          ack?.state === "acknowledged" &&
            ack.lease === null &&
            ack.attempts === 1,
          "Settings ACK lost lease state"
        )
        assert(
          dependent?.operation.baseRevision === 1 &&
            dependent.dependencies[0] === first.operation.operationId,
          "Pending direct child was not rebased"
        )
        assert(
          (state.settings[0] as UserSettings).timeZone ===
            "America/Los_Angeles" &&
            (state.settings[0] as UserSettings).revision === 0,
          "ACK overwrote newer optimistic settings"
        )
        assert(
          state.remoteShadows.length === 1 &&
            state.syncMetadata.some(
              (value) =>
                (value as { key: string }).key ===
                `operation-outcome:${first.operation.operationId}`
            ),
          "Atomic settings evidence is missing"
        )
        assert(
          entries.find(
            (entry) =>
              entry.operation.operationId === category.operation.operationId
          )?.state === "conflict",
          "Category conflict was modified"
        )
      }
    )
    await check(
      "Replay exacto no restaura un valor posterior ni duplica outcome",
      async () => {
        const before = JSON.stringify(await snapshot())
        assert(
          (await applyLocalSettingsPreferenceResult(
            database,
            actor,
            submission
          )) === "replayed",
          "Expected exact replay"
        )
        assert(
          JSON.stringify(await snapshot()) === before,
          "Replay changed owned stores"
        )
      }
    )
    await check(
      "ACK antiguo conserva shadow posterior y CAS deliberadamente mayor",
      async () => {
        const latest: PreferenceEffect = {
          store: "settings",
          record: { ...optimistic, timeZone: "UTC", revision: 4 },
        }
        await put("remoteShadows", {
          version: 2,
          kind: "preference",
          entityKey: userSettingsEntityKey(actor),
          record: latest,
        })
        const entries = await outbox.listEntries(),
          dependent = entries.find(
            (entry) =>
              entry.operation.operationId === child.operation.operationId
          )
        assert(dependent, "Settings dependent is missing")
        await put("outbox", {
          ...dependent,
          operation: { ...dependent.operation, baseRevision: 4 },
        })
        const before = JSON.stringify(await snapshot())
        assert(
          (await applyLocalSettingsPreferenceResult(
            database,
            actor,
            submission
          )) === "replayed",
          "Late result lost exact outcome"
        )
        assert(
          JSON.stringify(await snapshot()) === before,
          "Late replay degraded settings evidence"
        )
      }
    )
    await check(
      "Conflicto conserva intención y dependiente intentado; no ACK local",
      async () => {
        const current = (await outbox.listEntries()).find(
          (entry) => entry.operation.operationId === child.operation.operationId
        )
        assert(current, "Settings child is missing")
        assert(
          await outbox.claim(current.operation.operationId, sender),
          "Settings child claim failed"
        )
        const third = await outbox.commitUserSettingsCommand(
          command("Asia/Tokyo")
        )
        await put("outbox", { ...third, attempts: 1 })
        const remote: PreferenceEffect = {
          store: "settings",
          record: { ...optimistic, revision: 5, timeZone: "UTC" },
        }
        const conflict: LocalSyncResultInputV2 = {
          operation: current.operation,
          senderId: sender,
          result: {
            kind: "preference",
            outcome: {
              operationId: current.operation.operationId,
              status: "conflict",
              current: remote,
            },
          },
        }
        assert(
          (await applyLocalSettingsPreferenceResult(
            database,
            actor,
            conflict
          )) === "applied",
          "Conflict was not recorded"
        )
        const entries = await outbox.listEntries()
        assert(
          entries.find(
            (entry) =>
              entry.operation.operationId === current.operation.operationId
          )?.state === "conflict",
          "Conflict became ACK"
        )
        assert(
          JSON.stringify(
            entries.find(
              (entry) =>
                entry.operation.operationId === third.operation.operationId
            )?.operation
          ) === JSON.stringify(third.operation),
          "Attempted child was rewritten"
        )
        assert(
          ((await snapshot()).settings[0] as UserSettings).timeZone ===
            "Asia/Tokyo",
          "Conflict replaced local intention"
        )
      }
    )
    await check(
      "ACK de categoría aplica con ajuste pendiente sin reemplazarlo",
      async () => {
        const state = await snapshot(),
          settingsBefore = JSON.stringify(state.settings)
        await put("outbox", {
          ...category,
          state: "sending",
          attempts: 1,
          lease: {
            ownerId: sender,
            expiresAt: new Date(Date.now() + 30000).toISOString(),
          },
        })
        const record = state.tags[0] as Extract<
          PreferenceEffect,
          { store: "tags" }
        >["record"]
        const categoryResult: LocalSyncResultInputV2 = {
          operation: category.operation,
          senderId: sender,
          result: {
            kind: "preference",
            outcome: {
              operationId: category.operation.operationId,
              status: "applied",
              effects: {
                version: 1,
                userId: actor,
                operationId: category.operation.operationId,
                sequence: 3,
                effects: [
                  { store: "tags", record: { ...record, revision: 1 } },
                ],
              },
            },
          },
        }
        assert(
          (await applyLocalSettingsPreferenceResult(
            database,
            actor,
            categoryResult
          )) === "applied",
          "Category ACK was not applied"
        )
        const after = await snapshot()
        assert(
          JSON.stringify(after.settings) === settingsBefore &&
            (after.tags[0] as { revision: number }).revision === 1,
          "Category ACK changed pending settings or retained confirmed category"
        )
      }
    )
    await check(
      "Registro extranjero en la partición rechaza el snapshot entero",
      async () => {
        await put("settings", { ...optimistic, userId: peer })
        const before = JSON.stringify(await snapshot())
        await refused(() =>
          applyLocalSettingsPreferenceResult(database, actor, submission)
        )
        assert(
          JSON.stringify(await snapshot()) === before,
          "Foreign record rejection wrote stores"
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
      "Ocho comprobaciones IndexedDB correctas; respuestas de fixture, cola y evidencia conservadas."
  } catch (error) {
    statusNode.textContent = `Fallo: ${error instanceof Error ? error.message : "Unknown settings proof failure"}`
  } finally {
    outbox.close()
    database.close()
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
      "Reload changed settings results"
    )
    statusNode.textContent =
      "Recarga correcta: ajustes, cola, UUID, outcomes y shadows intactos."
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
