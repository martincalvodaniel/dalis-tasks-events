import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { LocalRepository } from "@/lib/local-db/repository"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { commitLocalUserSettingsCommand } from "@/lib/local-db/user-settings-outbox"
import { entityIdSchema } from "@/schemas/primitives"
import { userSettingsEntityKey } from "@/schemas/user-settings-key"
import type { UserSettings } from "@/types/preferences"

if (location.hostname !== "127.0.0.1" || location.port !== "4262")
  throw new Error("Settings proof requires its owned loopback origin")
const query = new URLSearchParams(location.search)
const runId = entityIdSchema.parse(query.get("run"))
const actor = `browser-test-${runId}-settings`,
  other = `${actor}-peer`
const names = [localDatabaseName(actor), localDatabaseName(other)]
const marker = `dalis:settings-outbox:${runId}`
const isReload = query.get("phase") === "reload"
const databases = await indexedDB.databases()
if (isReload) {
  if (
    sessionStorage.getItem(marker) !== "owned" ||
    !names.every((name) => databases.some((entry) => entry.name === name))
  )
    throw new Error("Settings reload ownership is missing")
} else {
  if (names.some((name) => databases.some((entry) => entry.name === name)))
    throw new Error("Existing settings partition blocks this run")
  sessionStorage.setItem(marker, "owned")
}
const status = document.getElementById("status")
const results = document.getElementById("results")
const run = document.getElementById("run") as HTMLButtonElement
const reload = document.getElementById("reload") as HTMLButtonElement
const cleanup = document.getElementById("cleanup") as HTMLButtonElement
if (!status || !results || !run || !reload || !cleanup)
  throw new Error("Settings proof markup is missing")
const statusNode = status,
  resultsNode = results
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}
async function rejects(work: () => Promise<unknown>) {
  let failed = false
  try {
    await work()
  } catch {
    failed = true
  }
  assert(failed, "Expected settings operation rejection")
}
async function check(label: string, work: () => Promise<void>) {
  await work()
  const row = document.createElement("li")
  row.textContent = `Correcto: ${label}`
  resultsNode.append(row)
}
const command = (timeZone: string) => ({
  type: "settings.update" as const,
  input: { timeZone, weekStartsOn: 1 as const, locale: "es-ES" as const },
})
async function snapshot(userId = actor) {
  const repository = await LocalRepository.open(userId),
    outbox = await LocalOutbox.open(userId)
  try {
    return {
      settings: await repository.list("settings", { includeDeleted: true }),
      entries: await outbox.listEntries(),
    }
  } finally {
    repository.close()
    outbox.close()
  }
}
async function writeMetadata(input: unknown) {
  const database = await openLocalDatabase(actor)
  try {
    await runLocalTransaction(
      database,
      ["syncMetadata"],
      "readwrite",
      (context) => {
        context.transaction.objectStore("syncMetadata").put(input)
        context.setResult(undefined)
      }
    )
  } finally {
    database.close()
  }
}
run.hidden = isReload
reload.hidden = !isReload
statusNode.textContent =
  "Particiones propias listas; sin servidor remoto ni ACK fabricados."
run.onclick = async () => {
  run.disabled = true
  const outbox = await LocalOutbox.open(actor)
  let notifications = 0
  const listener = (event: Event) => {
    if (event instanceof CustomEvent && event.detail.userId === actor)
      notifications++
  }
  window.addEventListener("dalis:outbox-changed", listener)
  try {
    const blockedCategory = await outbox.commitPreferenceCommand({
      type: "tag.save",
      tagId: crypto.randomUUID(),
      input: { name: "Owned category", color: "#123abc", position: 1024 },
    })
    const firstId = crypto.randomUUID()
    const first = await outbox.commitUserSettingsCommand(
      command("Europe/Madrid"),
      { operationId: firstId, expectedSettings: null }
    )
    await check(
      "Guardado atómico y revisión local provisional, sin dependencia de categoría",
      async () => {
        const state = await snapshot()
        assert(
          first.entityKey === userSettingsEntityKey(actor) &&
            first.operation.baseRevision === 0 &&
            first.dependencies.length === 0,
          "Settings should be independent of category tail"
        )
        assert(
          state.settings[0].revision === 0 &&
            state.settings[0].timeZone === "Europe/Madrid",
          "Settings projection was not stored atomically"
        )
        assert(
          state.entries.length === 2 &&
            state.entries.every((entry) => entry.state === "pending"),
          "Projection cannot imply an ACK"
        )
        assert(
          state.entries[0].operation.operationId ===
            blockedCategory.operation.operationId,
          "Category intention was lost"
        )
      }
    )
    const original = JSON.stringify(await snapshot())
    await check(
      "Replay exacto no duplica ni restaura un valor posterior",
      async () => {
        const replay = await outbox.commitUserSettingsCommand(
          command("Europe/Madrid"),
          { operationId: firstId, expectedSettings: null }
        )
        assert(
          JSON.stringify(replay) === JSON.stringify(first) &&
            JSON.stringify(await snapshot()) === original,
          "Settings replay changed stores"
        )
      }
    )
    const database = await openLocalDatabase(actor)
    try {
      await runLocalTransaction(
        database,
        ["outbox"],
        "readwrite",
        (context) => {
          context.transaction
            .objectStore("outbox")
            .put({ ...first, attempts: 1 })
          context.setResult(undefined)
        }
      )
    } finally {
      database.close()
    }
    const expected = (await snapshot()).settings[0]
    const second = await outbox.commitUserSettingsCommand(
      command("America/Los_Angeles"),
      { expectedSettings: expected }
    )
    await check(
      "Dependencia propia y payload intentado conservados",
      async () => {
        const state = await snapshot()
        const attempted = state.entries.find(
          (entry) => entry.operation.operationId === firstId
        )
        assert(
          second.dependencies.length === 1 &&
            second.dependencies[0] === firstId,
          "Settings dependency must be its prior intention"
        )
        assert(
          attempted?.attempts === 1 &&
            JSON.stringify(attempted.operation) ===
              JSON.stringify(first.operation),
          "Attempted settings were rewritten"
        )
        assert(
          state.settings[0].revision === 0 &&
            state.settings[0].timeZone === "America/Los_Angeles",
          "Optimistic settings advanced revision"
        )
      }
    )
    await check(
      "Editor obsoleto e identidad reutilizada no escriben",
      async () => {
        const before = JSON.stringify(await snapshot())
        await rejects(() =>
          outbox.commitUserSettingsCommand(command("UTC"), {
            expectedSettings: expected,
          })
        )
        await rejects(() =>
          outbox.commitUserSettingsCommand(command("UTC"), {
            operationId: firstId,
          })
        )
        await rejects(() =>
          outbox.commitUserSettingsCommand(command("UTC"), {
            operationId: blockedCategory.operation.operationId,
          })
        )
        assert(
          JSON.stringify(await snapshot()) === before,
          "Rejected settings changed stores"
        )
      }
    )
    await check(
      "Fallo tardío revierte valor, cola y secuencia sin notificación",
      async () => {
        const before = JSON.stringify(await snapshot()),
          notified = notifications
        const put = IDBObjectStore.prototype.put
        IDBObjectStore.prototype.put = function (
          value: unknown,
          key?: IDBValidKey
        ) {
          if (
            this.name === "syncMetadata" &&
            typeof value === "object" &&
            value !== null &&
            "key" in value &&
            value.key === "outbox-sequence"
          )
            throw new Error("Injected owned settings abort")
          return key === undefined
            ? put.call(this, value)
            : put.call(this, value, key)
        }
        try {
          await rejects(() => outbox.commitUserSettingsCommand(command("UTC")))
        } finally {
          IDBObjectStore.prototype.put = put
        }
        assert(
          JSON.stringify(await snapshot()) === before &&
            notifications === notified,
          "Failed transaction committed or notified"
        )
      }
    )
    await check("Partición y expected de otra cuenta se rechazan", async () => {
      const database = await openLocalDatabase(other)
      try {
        await rejects(() =>
          commitLocalUserSettingsCommand(database, actor, command("UTC"))
        )
      } finally {
        database.close()
      }
      const foreignExpected = {
        ...(await snapshot()).settings[0],
        userId: other,
      }
      await rejects(() =>
        outbox.commitUserSettingsCommand(command("UTC"), {
          expectedSettings: foreignExpected,
        })
      )
      assert(
        (await snapshot(other)).settings.length === 0,
        "Foreign settings partition changed"
      )
    })
    await check(
      "Revisión positiva sin evidencia remota no fabrica CAS",
      async () => {
        const repository = await LocalRepository.open(actor)
        const before = (await snapshot()).settings[0]
        try {
          await repository.put("settings", { ...before, revision: 7 })
          await rejects(() => outbox.commitUserSettingsCommand(command("UTC")))
          assert(
            (await snapshot()).settings[0].revision === 7,
            "Invalid evidence was repaired automatically"
          )
          await repository.put("settings", before)
        } finally {
          repository.close()
        }
      }
    )
    await check(
      "Límite de secuencia rechaza el nuevo cambio entero",
      async () => {
        const before = JSON.stringify(await snapshot())
        await writeMetadata({
          key: "outbox-sequence",
          value: Number.MAX_SAFE_INTEGER,
        })
        await rejects(() => outbox.commitUserSettingsCommand(command("UTC")))
        assert(
          JSON.stringify(await snapshot()) === before,
          "Sequence overflow changed settings"
        )
        await writeMetadata({ key: "outbox-sequence", value: 3 })
      }
    )
    await check(
      "CAS toma el shadow observado y conserva su revisión hasta ACK",
      async () => {
        const repository = await LocalRepository.open(other)
        const now = "2026-10-12T08:00:00.000Z"
        const value: UserSettings = {
          userId: other,
          timeZone: "Europe/Madrid",
          weekStartsOn: 1,
          locale: "es-ES",
          revision: 4,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        }
        try {
          await repository.put("settings", value)
        } finally {
          repository.close()
        }
        const database = await openLocalDatabase(other)
        try {
          await runLocalTransaction(
            database,
            ["remoteShadows"],
            "readwrite",
            (context) => {
              context.transaction.objectStore("remoteShadows").put({
                version: 2,
                kind: "preference",
                entityKey: userSettingsEntityKey(other),
                record: { store: "settings", record: value },
              })
              context.setResult(undefined)
            }
          )
        } finally {
          database.close()
        }
        const peer = await LocalOutbox.open(other)
        try {
          const created = await peer.commitUserSettingsCommand(command("UTC"), {
            expectedSettings: value,
          })
          assert(
            created.operation.baseRevision === 4 &&
              created.dependencies.length === 0,
            "Settings CAS was not derived from evidence"
          )
          assert(
            (await snapshot(other)).settings[0].revision === 4,
            "Local edit manufactured a remote revision"
          )
        } finally {
          peer.close()
        }
      }
    )
    sessionStorage.setItem(
      `${marker}:proof`,
      JSON.stringify({ primary: await snapshot(), peer: await snapshot(other) })
    )
    statusNode.textContent =
      "Nueve comprobaciones IndexedDB correctas; pendientes conservados sin ACK remoto."
  } catch (error) {
    statusNode.textContent = `Fallo: ${error instanceof Error ? error.message : "Unknown settings test failure"}`
  } finally {
    outbox.close()
    window.removeEventListener("dalis:outbox-changed", listener)
  }
}
reload.onclick = async () => {
  try {
    const expected = sessionStorage.getItem(`${marker}:proof`)
    assert(
      expected &&
        JSON.stringify({
          primary: await snapshot(),
          peer: await snapshot(other),
        }) === expected,
      "Settings reload lost stores or pending intentions"
    )
    statusNode.textContent =
      "Recarga correcta: valores, revisiones, UUID, intentos y dependencias intactos."
  } catch (error) {
    statusNode.textContent = `Fallo: ${error instanceof Error ? error.message : "Settings reload failed"}`
  }
}
cleanup.onclick = async () => {
  assert(
    sessionStorage.getItem(marker) === "owned",
    "Cleanup ownership is missing"
  )
  for (const name of names)
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      request.onblocked = () =>
        reject(new Error("Owned settings cleanup blocked"))
    })
  sessionStorage.removeItem(marker)
  sessionStorage.removeItem(`${marker}:proof`)
  run.disabled = true
  reload.disabled = true
  cleanup.disabled = true
  statusNode.textContent = "Particiones de prueba propias eliminadas."
}
