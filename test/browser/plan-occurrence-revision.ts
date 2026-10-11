import { planOccurrencesPage } from "@/lib/calendar/plan-occurrences"
import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { commitLocalPlanOccurrenceCommand } from "@/lib/local-db/plan-occurrence-outbox"
import { LocalRepository } from "@/lib/local-db/repository"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { localBackupStoresSchema } from "@/schemas/local-backup"
import { planSchema } from "@/schemas/plan-item"
import { entityIdSchema } from "@/schemas/primitives"

if (location.hostname !== "127.0.0.1" || location.port !== "4179")
  throw new Error(
    "Appearance revision proof requires its isolated loopback origin"
  )
const query = new URLSearchParams(location.search)
const runId = entityIdSchema.parse(query.get("run"))
const actor = `browser-test-${runId}-appearance-revision`
const name = localDatabaseName(actor),
  marker = `dalis:appearance-revision:${runId}`
const status = document.getElementById("status"),
  results = document.getElementById("results"),
  actions = document.getElementById("actions")
if (!status || !results || !actions)
  throw new Error("Revision proof markup is missing")
const statusNode = status,
  resultsNode = results,
  actionsNode = actions
const now = "2026-10-11T09:00:00.000Z",
  later = "2026-10-11T10:00:00.000Z"
const stepId = "00000000-0000-4000-8000-000000000099"
function uuid(index: number) {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`
}
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}
async function rejects(work: () => Promise<unknown>) {
  let failed = false
  try {
    await work()
  } catch {
    failed = true
  }
  assert(failed, "Expected revision operation rejection")
}
async function check(label: string, work: () => Promise<void>) {
  const row = document.createElement("li")
  row.textContent = label
  resultsNode.append(row)
  await work()
  row.textContent = `Correcto: ${label}`
}

async function run() {
  const existing = await indexedDB.databases()
  const reload = query.get("phase") === "reload"
  if (reload)
    assert(
      sessionStorage.getItem(marker) === "owned" &&
        existing.some((record) => record.name === name),
      "Reload ownership is missing"
    )
  else {
    assert(
      !existing.some((record) => record.name === name),
      "Existing revision partition blocks proof"
    )
    sessionStorage.setItem(marker, "owned")
  }
  const database = await openLocalDatabase(actor),
    repository = await LocalRepository.open(actor),
    outbox = await LocalOutbox.open(actor)
  async function snapshot() {
    return JSON.stringify({
      items: await repository.list("items", { includeDeleted: true }),
      occurrences: await repository.list("occurrences", {
        includeDeleted: true,
      }),
      outbox: await outbox.listEntries(),
    })
  }
  try {
    if (!reload) {
      await check(
        "Cuatro variantes capturan revisión7 de aparición y base3 de serie, sin ACK",
        async () => {
          for (const [index, variant] of (
            ["task", "event", "appointment", "note"] as const
          ).entries()) {
            const parent = planSchema.parse({
              kind: "plan",
              variant,
              id: uuid(index + 1),
              ownerId: actor,
              title: "Revision proof",
              description: "",
              status: "not_started",
              completedAt: null,
              schedule: {
                mode: "all_day",
                startDate: "2026-10-11",
                endDateExclusive: "2026-10-12",
              },
              checklist: [{ id: stepId, text: "Step", completed: false }],
              recurrence: {
                frequency: "daily",
                interval: 1,
                anchorDate: "2026-10-11",
                timeZone: "Europe/Madrid",
                end: { type: "count", count: 3 },
              },
              revision: 3,
              createdAt: now,
              updatedAt: now,
              deletedAt: null,
            })
            const current = {
              ...planOccurrencesPage(parent, {
                startDate: "2026-10-11",
                endDate: "2026-10-11",
              }).occurrences[0],
              revision: 7,
            }
            await repository.put("items", parent)
            await repository.put("occurrences", current)
            const command = {
              type: "plan.set-occurrence-checklist-entry" as const,
              itemId: parent.id,
              occurrenceId: current.id,
              entryId: stepId,
              completed: true,
            }
            const options = {
              expectedItem: parent,
              expectedOccurrence: current,
              operationId: uuid(index + 21),
              now: new Date(later),
              captureRemoteRevision: true,
            }
            const entry = await commitLocalPlanOccurrenceCommand(
              database,
              actor,
              command,
              options
            )
            assert(
              entry.operation.baseRevision === 3 &&
                "expectedOccurrenceRevision" in entry.operation.command &&
                entry.operation.command.expectedOccurrenceRevision === 7 &&
                entry.state === "pending" &&
                entry.attempts === 0,
              "Captured revisions were confused or acknowledged"
            )
            const saved = await repository.get("occurrences", current.id)
            assert(
              saved?.kind === "plan" &&
                saved.revision === 7 &&
                saved.checklist[0].completed,
              "Optimism advanced confirmed revision"
            )
            assert(
              JSON.stringify(await repository.get("items", parent.id)) ===
                JSON.stringify(parent),
              "Appearance mutation changed parent"
            )
            const before = await snapshot()
            assert(
              JSON.stringify(
                await commitLocalPlanOccurrenceCommand(
                  database,
                  actor,
                  command,
                  options
                )
              ) === JSON.stringify(entry),
              "Replay changed intention"
            )
            await rejects(() =>
              commitLocalPlanOccurrenceCommand(database, actor, command, {
                ...options,
                captureRemoteRevision: false,
              })
            )
            await rejects(() =>
              commitLocalPlanOccurrenceCommand(database, actor, command, {
                ...options,
                expectedOccurrence: { ...current, revision: 6 },
              })
            )
            await rejects(() =>
              commitLocalPlanOccurrenceCommand(database, actor, command, {
                ...options,
                operationId: uuid(index + 41),
              })
            )
            assert(
              (await snapshot()) === before,
              "Replay or rejected CAS changed durable state"
            )
          }
        }
      )
      await check(
        "Primer slot captura0; writer actual conserva payload histórico",
        async () => {
          const parent = await repository.get("items", uuid(1))
          assert(parent?.kind === "plan", "Parent is missing")
          for (const [date, capture] of [
            ["2026-10-12", true],
            ["2026-10-13", false],
          ] as const) {
            const current = planOccurrencesPage(parent, {
              startDate: date,
              endDate: date,
            }).occurrences[0]
            const entry = await commitLocalPlanOccurrenceCommand(
              database,
              actor,
              {
                type: "plan.set-occurrence-status",
                itemId: parent.id,
                occurrenceId: current.id,
                status: "completed",
              },
              {
                expectedItem: parent,
                expectedOccurrence: current,
                captureRemoteRevision: capture,
                now: new Date(later),
              }
            )
            assert(
              "expectedOccurrenceRevision" in entry.operation.command ===
                capture,
              "Writer changed active historical payload"
            )
            if ("expectedOccurrenceRevision" in entry.operation.command)
              assert(
                entry.operation.command.expectedOccurrenceRevision === 0,
                "Generated revision was not zero"
              )
          }
        }
      )
      await check(
        "Desbordamiento de secuencia revierte aparición e intención",
        async () => {
          const parent = await repository.get("items", uuid(2))
          assert(parent?.kind === "plan", "Rollback parent missing")
          const current = planOccurrencesPage(parent, {
            startDate: "2026-10-12",
            endDate: "2026-10-12",
          }).occurrences[0]
          await runLocalTransaction(
            database,
            ["syncMetadata"],
            "readwrite",
            (context) => {
              context.transaction
                .objectStore("syncMetadata")
                .put({ key: "outbox-sequence", value: Number.MAX_SAFE_INTEGER })
              context.setResult(true)
            }
          )
          const before = await snapshot()
          await rejects(() =>
            commitLocalPlanOccurrenceCommand(
              database,
              actor,
              {
                type: "plan.cancel-occurrence",
                itemId: parent.id,
                occurrenceId: current.id,
              },
              {
                expectedItem: parent,
                expectedOccurrence: current,
                captureRemoteRevision: true,
              }
            )
          )
          assert(
            (await snapshot()) === before,
            "Failed transaction persisted appearance or intent"
          )
        }
      )
    }
    await check(
      "Backup y recarga conservan UUID, payload, dependencias y revisiones",
      async () => {
        const entries = await outbox.listEntries()
        assert(
          entries.length === 6 &&
            entries.filter(
              (entry) => "expectedOccurrenceRevision" in entry.operation.command
            ).length === 5,
          "Reload changed appearance intentions"
        )
        const stores = localBackupStoresSchema.parse({
          items: await repository.list("items", { includeDeleted: true }),
          occurrences: await repository.list("occurrences", {
            includeDeleted: true,
          }),
          outbox: entries,
          tags: [],
          itemViews: [],
          taskPlacements: [],
          settings: [],
          memberships: [],
          invitations: [],
          remoteShadows: [],
          syncMetadata: [],
        })
        assert(
          JSON.stringify(stores.outbox) === JSON.stringify(entries),
          "Backup discarded revision evidence"
        )
        assert(
          stores.items.every(
            (item) =>
              item.revision === 3 &&
              item.kind === "plan" &&
              item.status === "not_started"
          ),
          "Parent state changed"
        )
      }
    )
    const reloadLink = document.createElement("a")
    reloadLink.textContent = "Comprobar recarga"
    reloadLink.href = `/?run=${runId}&phase=reload`
    actionsNode.append(reloadLink)
    const cleanup = document.createElement("button")
    cleanup.textContent = "Limpiar bases propias"
    cleanup.onclick = async () => {
      assert(
        sessionStorage.getItem(marker) === "owned",
        "Cleanup ownership missing"
      )
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(name)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
        request.onblocked = () => reject(new Error("Revision cleanup blocked"))
      })
      sessionStorage.removeItem(marker)
      statusNode.textContent = "Base propia eliminada."
      cleanup.disabled = true
    }
    actionsNode.append(cleanup)
    statusNode.textContent = "Todas las pruebas han pasado."
  } finally {
    repository.close()
    outbox.close()
    database.close()
  }
}
void run().catch((error: unknown) => {
  statusNode.textContent = "Pruebas fallidas."
  console.error(
    error instanceof Error ? error.message : "Revision proof failed"
  )
})
