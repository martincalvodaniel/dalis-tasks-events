import { readLocalRecurringTasks } from "@/features/tasks/local-recurring-tasks"
import type { LocalAccount } from "@/features/workspace/local-account"
import { occurrencesPage } from "@/lib/calendar/occurrences"
import {
  activatePreparedAccount,
  completeRemoteLogout,
  hideLocalAccount,
  readAccountControl,
} from "@/lib/local-db/account-control"
import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { LocalRepository } from "@/lib/local-db/repository"
import { readLocalTaskSnapshot } from "@/lib/local-db/task-snapshot"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { taskDraftSchema } from "@/schemas/calendar-item"
import { entityIdSchema } from "@/schemas/primitives"

if (location.hostname !== "127.0.0.1" || location.port !== "4179")
  throw new Error("Snapshot fixtures require an isolated loopback origin")
const query = new URLSearchParams(location.search)
const runId = entityIdSchema.parse(query.get("run"))
const userId = `browser-test-${runId}-task-snapshot`
const otherUserId = `browser-test-${runId}-other-task-snapshot`
const itemId = "8a7a7969-1d11-4f36-9ce3-c1b933e849c2"
const firstId = `${itemId}:2026-10-07`
const secondId = `${itemId}:2026-10-08`
const thirdId = `${itemId}:2026-10-09`
const now = "2026-10-07T10:00:00.000Z"
const input = taskDraftSchema.parse({
  kind: "task",
  title: "Test snapshot",
  description: "",
  scheduledDate: "2026-10-07",
  status: "not_started",
  checklist: [],
  recurrence: {
    frequency: "daily",
    anchorDate: "2026-10-07",
    timeZone: "Europe/Madrid",
    interval: 1,
    end: { type: "count", count: 3 },
  },
})
const results = document.getElementById("results")
const statusNode = document.getElementById("status")
const actions = document.getElementById("actions")
if (!results || !statusNode || !actions)
  throw new Error("Test fixture markup is missing")
const resultList = results
const status = statusNode
const actionContainer = actions
function assert(value: unknown): asserts value {
  if (!value) throw new Error("Task snapshot browser assertion failed")
}
async function rejects(work: () => Promise<unknown>) {
  let rejected = false
  try {
    await work()
  } catch {
    rejected = true
  }
  assert(rejected)
}
async function check(label: string, work: () => Promise<void>) {
  const row = document.createElement("li")
  resultList.append(row)
  row.textContent = label
  await work()
  row.textContent = `Correcto: ${label}`
}

function addCleanup() {
  const cleanup = document.createElement("button")
  cleanup.textContent = "Limpiar bases de prueba"
  cleanup.onclick = async () => {
    const current = await readAccountControl()
    assert(
      current.userId === userId ||
        current.userId === otherUserId ||
        !current.userId
    )
    const closed = await hideLocalAccount()
    await completeRemoteLogout(closed.epoch)
    for (const actor of [userId, otherUserId])
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(localDatabaseName(actor))
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    status.textContent = "Bases de prueba eliminadas."
    cleanup.disabled = true
  }
  actionContainer.append(cleanup)
}
async function run() {
  if (query.get("phase") === "cleanup") {
    status.textContent = "Datos de prueba listos para limpiar."
    addCleanup()
    return
  }
  const control = await readAccountControl()
  if (
    control.userId &&
    control.userId !== userId &&
    control.userId !== otherUserId
  )
    throw new Error("Fixture cannot replace an unrelated active account")
  const database = await openLocalDatabase(userId)
  const repository = await LocalRepository.open(userId)
  const outbox = await LocalOutbox.open(userId)
  let account: LocalAccount
  async function activate(actor: string) {
    let previous = await readAccountControl()
    if (previous.logoutPending)
      previous = await completeRemoteLogout(previous.epoch)
    const prepared = await activatePreparedAccount(actor, now, previous.epoch)
    return {
      userId: actor,
      epoch: prepared.epoch,
      itemCount: 1,
      offlineReady: false,
    }
  }
  try {
    if (query.get("phase") !== "reload") {
      await rejects(() => readLocalTaskSnapshot(database, userId))
      await repository.put("settings", {
        userId,
        timeZone: "Europe/Madrid",
        weekStartsOn: 1,
        locale: "es-ES",
        revision: 0,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      })
      await outbox.commitItemCommand({ type: "item.create", itemId, input })
      await outbox.commitItemCommand({
        type: "task.set-status",
        itemId,
        occurrenceId: firstId,
        status: "in_progress",
      })
      const parent = await repository.get("items", itemId)
      assert(parent?.kind === "task")
      const second = occurrencesPage(parent, {
        startDate: "2026-10-08",
        endDate: "2026-10-08",
      }).occurrences[0]
      assert(second)
      await outbox.commitOccurrenceCommand(
        { type: "task.cancel-occurrence", itemId, occurrenceId: secondId },
        { expectedItem: parent, expectedOccurrence: second }
      )
      const third = occurrencesPage(parent, {
        startDate: "2026-10-09",
        endDate: "2026-10-09",
      }).occurrences[0]
      assert(third)
      await repository.put("occurrences", { ...third, deletedAt: now })
    }
    account = await activate(userId)
    const before = JSON.stringify(await outbox.listEntries())
    await check(
      "Snapshot incluye tombstones y canceladas para suprimir slots al leer",
      async () => {
        const snapshot = await readLocalTaskSnapshot(database, userId)
        assert(snapshot.items.length === 1 && snapshot.occurrences.length === 3)
        assert(
          snapshot.occurrences.find((record) => record.id === thirdId)
            ?.deletedAt
        )
        assert(
          snapshot.occurrences.find((record) => record.id === secondId)
            ?.cancelled
        )
        const result = await readLocalRecurringTasks(account)
        assert(result.timeZone === "Europe/Madrid")
        assert(
          result.index.generatedPage(itemId, {
            startDate: "2026-10-07",
            endDate: "2026-10-09",
          }).views.length === 0
        )
        assert(
          result.index.exceptionsPage({
            startDate: "2026-10-07",
            endDate: "2026-10-09",
          }).views.length === 1
        )
      }
    )
    if (query.get("phase") !== "reload") {
      await check(
        "Lecturas concurrentes ven generaciones completas, sin mezclar stores",
        async () => {
          async function writeGeneration(revision: number) {
            await runLocalTransaction(
              database,
              ["items", "occurrences", "settings"],
              "readwrite",
              (context) => {
                for (const [store, key] of [
                  ["items", itemId],
                  ["occurrences", firstId],
                  ["settings", userId],
                ] as const) {
                  const objectStore = context.transaction.objectStore(store)
                  const request = objectStore.get(key)
                  request.onsuccess = () =>
                    objectStore.put({ ...request.result, revision })
                }
                context.setResult(true)
              }
            )
          }
          const results = await Promise.all([
            writeGeneration(1),
            readLocalTaskSnapshot(database, userId),
            writeGeneration(2),
            readLocalTaskSnapshot(database, userId),
          ])
          for (const result of [results[1], results[3]]) {
            const revisions = [
              result.settings.revision,
              result.items[0].revision,
              result.occurrences.find((record) => record.id === firstId)
                ?.revision,
            ]
            assert(revisions.every((revision) => revision === revisions[0]))
          }
          assert(
            results[1].settings.revision === 1 &&
              results[3].settings.revision === 2
          )
        }
      )
      await check(
        "Settings inválidos o borrados y registros corruptos no exponen resultado parcial",
        async () => {
          const snapshot = await readLocalTaskSnapshot(database, userId)
          for (const modified of [
            { ...snapshot.settings, timeZone: "Invalid/Zone" },
            { ...snapshot.settings, deletedAt: now },
          ]) {
            await runLocalTransaction(
              database,
              ["settings"],
              "readwrite",
              (context) => {
                context.transaction.objectStore("settings").put(modified)
                context.setResult(true)
              }
            )
            await rejects(() => readLocalRecurringTasks(account))
            await repository.put("settings", snapshot.settings)
          }
          const first = snapshot.occurrences.find(
            (record) => record.id === firstId
          )
          assert(first)
          await runLocalTransaction(
            database,
            ["occurrences"],
            "readwrite",
            (context) => {
              context.transaction
                .objectStore("occurrences")
                .put({ ...first, slotKey: "2026-10-10" })
              context.setResult(true)
            }
          )
          await rejects(() => readLocalTaskSnapshot(database, userId))
          await repository.put("occurrences", first)
          await rejects(() => readLocalTaskSnapshot(database, otherUserId))
        }
      )
    }
    await check(
      "Cuenta/epoch obsoletos y cierre durante lectura rechazan, sin cola nueva",
      async () => {
        await rejects(() =>
          readLocalRecurringTasks({ ...account, epoch: crypto.randomUUID() })
        )
        await rejects(() =>
          readLocalRecurringTasks({ ...account, userId: otherUserId })
        )
        const reading = readLocalRecurringTasks(account).then(
          () => true,
          () => false
        )
        await hideLocalAccount()
        assert(!(await reading))
        account = await activate(userId)
        const other = await LocalRepository.open(otherUserId)
        try {
          await other.put("settings", {
            userId: otherUserId,
            timeZone: "UTC",
            weekStartsOn: 1,
            locale: "es-ES",
            revision: 0,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          })
        } finally {
          other.close()
        }
        const secondAccount = await activate(otherUserId)
        await rejects(() => readLocalRecurringTasks(account))
        const empty = await readLocalRecurringTasks(secondAccount)
        assert(empty.index.seriesIds.length === 0 && empty.timeZone === "UTC")
        account = await activate(userId)
        await readLocalRecurringTasks(account)
        assert(JSON.stringify(await outbox.listEntries()) === before)
      }
    )
    if (query.get("phase") === "reload") {
      const snapshot = await readLocalTaskSnapshot(database, userId)
      assert(
        snapshot.settings.revision === 2 &&
          (await outbox.listEntries()).length === 3
      )
    } else {
      const link = document.createElement("a")
      link.href = `/?run=${runId}&phase=reload`
      link.textContent = "Comprobar recarga"
      actionContainer.append(link)
    }
    status.textContent = "Todas las pruebas han pasado."
    addCleanup()
  } finally {
    database.close()
    repository.close()
    outbox.close()
  }
}
void run().catch((error: unknown) => {
  status.textContent = "Pruebas fallidas."
  addCleanup()
  console.error(error)
})
