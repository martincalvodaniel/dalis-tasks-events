import type { SyncTransportV2 } from "@/features/sync/http-transport-v2"
import {
  type LocalSyncRuntimeV2,
  openLocalSyncRuntimeV2,
} from "@/features/sync/local-runtime-v2"
import { applyItemCommand } from "@/lib/calendar/item-command"
import {
  ACCOUNT_CONTROL_DATABASE,
  activatePreparedAccount,
  hideLocalAccount,
  readAccountControl,
} from "@/lib/local-db/account-control"
import { localDatabaseName } from "@/lib/local-db/client"
import { LocalMixedSyncStore } from "@/lib/local-db/mixed-sync-store"
import { LocalOutbox } from "@/lib/local-db/outbox"
import type {
  RemotePushInputV2,
  RemotePushResultV2,
} from "@/types/remote-push-v2"

const runId = new URLSearchParams(location.search).get("run")
if (
  location.hostname !== "127.0.0.1" ||
  !runId ||
  !/^[\da-f-]{36}$/.test(runId)
)
  throw new Error("Runtime fixture requires its isolated loopback capability")
const userId = `browser-test-${runId}-runtime-v2`
const status = document.getElementById("status"),
  results = document.getElementById("results"),
  button = document.getElementById("run")
if (!status || !results || !(button instanceof HTMLButtonElement))
  throw new Error("Runtime fixture markup is missing")
const statusElement = status,
  resultsElement = results,
  runButton = button
const runtimes: LocalSyncRuntimeV2[] = []
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
function emptyPage(after = 0) {
  return {
    version: 2 as const,
    changes: [],
    nextAfter: after,
    through: after,
    hasMore: false,
  }
}
function transport(overrides: Partial<SyncTransportV2> = {}): SyncTransportV2 {
  return {
    readIdentity: async () => userId,
    pull: async (query) => emptyPage(query.after),
    push: async (input) => ({
      transportVersion: 2,
      status: "complete",
      results: [
        {
          kind: "item",
          outcome: {
            operationId: input.operations[0].operationId,
            status: "unsupported",
          },
        },
      ],
    }),
    ...overrides,
  }
}
async function activate() {
  const current = await readAccountControl()
  assert(
    !current.logoutPending && (!current.userId || current.userId === userId),
    "Fixture control belongs to another account"
  )
  const next = await activatePreparedAccount(
    userId,
    new Date().toISOString(),
    current.epoch
  )
  return { userId, epoch: next.epoch }
}
async function open(
  account: { userId: string; epoch: string },
  value = transport()
) {
  const runtime = await openLocalSyncRuntimeV2(account, value)
  runtimes.push(runtime)
  return runtime
}
async function snapshot() {
  const store = await LocalMixedSyncStore.open(userId)
  try {
    return {
      state: await store.readQueueState(),
      cursor: await store.readPullCursor(),
    }
  } finally {
    store.close()
  }
}
function applied(input: RemotePushInputV2): RemotePushResultV2 {
  const operation = input.operations[0]
  assert(
    operation.command.type === "item.create",
    "Runtime fixture expects own create"
  )
  const item = {
    ...applyItemCommand(
      null,
      operation.command,
      userId,
      "2026-10-09T00:00:00.000Z"
    ),
    revision: 1,
  }
  return {
    transportVersion: 2,
    status: "complete",
    results: [
      {
        kind: "item",
        outcome: {
          operationId: operation.operationId,
          status: "applied",
          item,
          sequence: 1,
        },
      },
    ],
  }
}
async function removeDatabase(name: string) {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () =>
      reject(new Error("Runtime fixture cleanup is blocked"))
  })
}

runButton.addEventListener("click", async () => {
  runButton.disabled = true
  let passed = false
  let outbox: LocalOutbox | null = null
  const check = async (label: string, run: () => Promise<void>) => {
    const row = document.createElement("li")
    row.textContent = label
    resultsElement.append(row)
    await run()
    row.textContent = `Correcto: ${label}`
  }
  try {
    const initial = await readAccountControl()
    assert(
      initial.userId === null && !initial.logoutPending,
      "Runtime origin must start with empty control"
    )
    await check(
      "La cuenta sin activar no abre recursos de sincronización",
      async () => {
        let rejected = false
        try {
          await open({ userId, epoch: initial.epoch })
        } catch {
          rejected = true
        }
        assert(rejected, "Inactive account must reject")
      }
    )
    let account = await activate()
    await check(
      "El cierre espera la descarga y las llamadas simultáneas comparten pasada",
      async () => {
        const entered = deferred<void>(),
          gate = deferred<ReturnType<typeof emptyPage>>()
        const runtime = await open(
          account,
          transport({
            pull: async () => {
              entered.resolve()
              return gate.promise
            },
          })
        )
        const first = runtime.run(),
          second = runtime.run()
        assert(first === second, "Concurrent passes must share promise")
        await entered.promise
        const closing = runtime.close()
        assert(closing === runtime.close(), "Close must be idempotent")
        gate.resolve(emptyPage())
        assert(
          (await first).status === "stopped",
          "Late pull must not apply after stop"
        )
        await closing
        assert(
          (await runtime.run()).status === "stopped",
          "Closed runtime must remain stopped"
        )
        assert(
          (await snapshot()).cursor.after === 0,
          "Stopped pull must preserve cursor"
        )
      }
    )
    await check(
      "Un cambio de época impide aplicar una descarga ya recibida",
      async () => {
        const entered = deferred<void>(),
          gate = deferred<ReturnType<typeof emptyPage>>()
        const runtime = await open(
          account,
          transport({
            pull: async () => {
              entered.resolve()
              return gate.promise
            },
          })
        )
        const pass = runtime.run()
        await entered.promise
        account = await activate()
        gate.resolve(emptyPage())
        const result = await pass
        assert(
          result.status === "account_changed" && result.diagnostics === null,
          "Epoch switch must hide old diagnostics"
        )
        await runtime.close()
        assert(
          (await snapshot()).cursor.after === 0,
          "Epoch switch must retain previous cursor"
        )
      }
    )
    outbox = await LocalOutbox.open(userId)
    const entry = await outbox.commitItemCommand(
      {
        type: "item.create",
        itemId: crypto.randomUUID(),
        input: {
          kind: "task",
          title: "Runtime task",
          description: "",
          scheduledDate: "2026-10-09",
          status: "not_started",
          checklist: [],
          recurrence: null,
        },
      },
      { now: new Date("2026-10-09T00:00:00.000Z") }
    )
    await check(
      "Perder la cuenta durante el envío conserva la intención y libera su lease",
      async () => {
        const entered = deferred<RemotePushInputV2>(),
          gate = deferred<RemotePushResultV2>()
        const runtime = await open(
          account,
          transport({
            push: async (input) => {
              entered.resolve(input)
              return gate.promise
            },
          })
        )
        const pass = runtime.run(),
          input = await entered.promise
        account = await activate()
        gate.resolve(applied(input))
        const result = await pass
        await runtime.close()
        const current = await snapshot(),
          stored = current.state.entries[0]
        assert(
          result.status === "account_changed" && result.uploaded === 0,
          "Remote response after epoch change must not ACK"
        )
        assert(
          stored.state === "pending" && stored.lease === null,
          "Previous sender lease must be released"
        )
        assert(
          JSON.stringify(stored.operation) === JSON.stringify(entry.operation),
          "Intention must survive account change exactly"
        )
        assert(
          current.state.items[0].revision === 0,
          "Late remote item must not replace optimistic local content"
        )
      }
    )
    await check(
      "Cerrar durante el envío libera el lease y permite reabrir sin ACK falso",
      async () => {
        const entered = deferred<RemotePushInputV2>(),
          gate = deferred<RemotePushResultV2>()
        const runtime = await open(
          account,
          transport({
            push: async (input) => {
              entered.resolve(input)
              return gate.promise
            },
          })
        )
        const pass = runtime.run(),
          input = await entered.promise,
          closing = runtime.close()
        gate.resolve(applied(input))
        assert(
          (await pass).status === "stopped",
          "Stopped upload must not apply"
        )
        await closing
        const state = (await snapshot()).state
        assert(
          state.entries[0].state === "pending" &&
            state.entries[0].lease === null,
          "Close must release old lease"
        )
        assert(state.items[0].revision === 0, "Close must retain local item")
      }
    )
    await check(
      "Una pasada posterior confirma el resultado durable y conserva la cuenta",
      async () => {
        let committed = false
        const runtime = await open(
          account,
          transport({
            push: async (input) => {
              committed = true
              return applied(input)
            },
            pull: async (query) => {
              if (!committed) return emptyPage(query.after)
              const result = applied({
                transportVersion: 2,
                expectedUserId: userId,
                operations: [entry.operation],
              })
              assert(
                result.status === "complete" &&
                  result.results[0].kind === "item" &&
                  result.results[0].outcome.status === "applied",
                "Expected item result"
              )
              return {
                version: 2,
                changes:
                  query.after === 0
                    ? [
                        {
                          version: 2,
                          kind: "item",
                          recipientUserId: userId,
                          operationId: entry.operation.operationId,
                          sequence: 1,
                          item: result.results[0].outcome.item,
                        },
                      ]
                    : [],
                nextAfter: 1,
                through: 1,
                hasMore: false,
              }
            },
          })
        )
        const result = await runtime.run()
        assert(
          result.status === "settled" &&
            result.uploaded === 1 &&
            result.downloaded === 1,
          "Durable result and journal must complete together"
        )
        await runtime.close()
        const current = await snapshot()
        assert(
          current.state.entries[0].state === "acknowledged" &&
            current.state.items[0].revision === 1 &&
            current.cursor.after === 1,
          "Confirmed local state must survive reopen"
        )
        assert(
          (await readAccountControl()).epoch === account.epoch,
          "Runtime must not change account control"
        )
      }
    )
    passed = true
    statusElement.textContent = "Seis comprobaciones del runtime correctas"
  } catch (error) {
    statusElement.textContent = `Prueba fallida: ${error instanceof Error ? error.message : "error"}`
  } finally {
    await Promise.all(runtimes.map((runtime) => runtime.close()))
    outbox?.close()
    try {
      const current = await readAccountControl()
      assert(
        current.userId === null || current.userId === userId,
        "Cleanup must not touch another account"
      )
      await hideLocalAccount()
      await removeDatabase(localDatabaseName(userId))
      await removeDatabase(ACCOUNT_CONTROL_DATABASE)
      statusElement.textContent += "; bases ficticias eliminadas"
    } catch {
      passed = false
      statusElement.textContent += "; limpieza pendiente"
    }
    await fetch(passed ? "/fixture-pass" : "/fixture-fail", {
      method: "POST",
      headers: { "x-sync-test-run": runId },
    })
  }
})
