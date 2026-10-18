import { applyPlanOccurrenceCommand } from "@/lib/calendar/plan-occurrence-command"
import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { resolveLocalPlanOccurrenceIncident } from "@/lib/local-db/plan-occurrence-resolution"
import { readLocalSettingsSyncIncidentOverview } from "@/lib/local-db/sync-incidents"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { planOccurrenceRetryOperationCount } from "@/lib/sync/plan-occurrence-resolution"
import { localPlanOccurrenceOutcomeSchema } from "@/schemas/local-plan-occurrence-sync"
import { outboxEntrySchema } from "@/schemas/local-sync"
import { planSchema } from "@/schemas/plan-item"
import { entityIdSchema } from "@/schemas/primitives"
import type { PlanOccurrenceResolutionRequest } from "@/types/plan-occurrence-resolution"

if (location.hostname !== "127.0.0.1" || location.port !== "4179")
  throw new Error("Capacity proof requires its isolated loopback origin")
const runId = entityIdSchema.parse(
  new URLSearchParams(location.search).get("run")
)
const actor = `browser-test-${runId}-appearance-capacity`
const name = localDatabaseName(actor)
const statusNode = document.getElementById("status")
if (!statusNode) throw new Error("Capacity proof status is missing")
const proofStatus = statusNode
const timestamp = "2026-10-18T05:21:00.000Z"
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}
async function run() {
  assert(
    !(await indexedDB.databases()).some((value) => value.name === name),
    "Proof partition already exists"
  )
  const database = await openLocalDatabase(actor)
  const stores = [...database.objectStoreNames]
  const parent = planSchema.parse({
    kind: "plan",
    variant: "task",
    id: crypto.randomUUID(),
    ownerId: actor,
    title: "Capacity proof",
    description: "",
    status: "not_started",
    completedAt: null,
    checklist: [],
    schedule: {
      mode: "all_day",
      startDate: "2026-10-18",
      endDateExclusive: "2026-10-19",
    },
    recurrence: {
      frequency: "daily",
      interval: 1,
      anchorDate: "2026-10-18",
      timeZone: "Europe/Madrid",
      end: { type: "never" },
    },
    revision: 3,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  })
  const command = {
    type: "plan.set-occurrence-status" as const,
    itemId: parent.id,
    occurrenceId: `${parent.id}:2026-10-18`,
    status: "in_progress" as const,
  }
  const local = applyPlanOccurrenceCommand(
    parent,
    null,
    command,
    actor,
    timestamp
  )
  const remote = {
    ...local,
    revision: 2,
    status: "completed" as const,
    completedAt: timestamp,
  }
  const root = outboxEntrySchema.parse({
    userId: actor,
    entityKey: `item:${parent.id}`,
    operation: {
      operationId: crypto.randomUUID(),
      protocolVersion: 1,
      baseRevision: 3,
      command: { ...command, expectedOccurrenceRevision: 0 },
    },
    state: "conflict",
    attempts: 1,
    lease: null,
    sequence: 1,
    dependencies: [],
    createdAt: timestamp,
  })
  const outcome = localPlanOccurrenceOutcomeSchema.parse({
    version: 2,
    kind: "plan-occurrence",
    key: `operation-outcome:${root.operation.operationId}`,
    operation: root.operation,
    result: {
      kind: "plan-occurrence",
      userId: actor,
      outcome: {
        status: "conflict",
        operationId: root.operation.operationId,
        series: parent,
        current: remote,
      },
    },
    local,
    base: null,
    series: parent,
  })
  async function seed(outboxCount: number, metadataCount: number) {
    await runLocalTransaction(database, stores, "readwrite", (context) => {
      for (const store of stores) context.transaction.objectStore(store).clear()
      context.transaction.objectStore("items").add(parent)
      context.transaction.objectStore("occurrences").add(local)
      const outbox = context.transaction.objectStore("outbox"),
        metadata = context.transaction.objectStore("syncMetadata")
      outbox.add(root)
      for (let index = 1; index < outboxCount; index++)
        outbox.add({
          ...root,
          operation: { ...root.operation, operationId: crypto.randomUUID() },
          state: "superseded",
          sequence: index + 1,
        })
      metadata.add(outcome)
      metadata.add({ key: "outbox-sequence", value: outboxCount })
      // Deliberate count sentinels exercise storage capacity, not portable backup validity.
      for (let index = 2; index < metadataCount; index++)
        metadata.add({ key: `owned-capacity:${index}` })
      context.setResult(true)
    })
  }
  async function snapshot() {
    return runLocalTransaction(database, stores, "readonly", (context) => {
      const values: Record<string, unknown> = {}
      let remaining = stores.length
      for (const name of stores) {
        const read = context.transaction.objectStore(name).getAll()
        read.onsuccess = () => {
          values[name] = read.result
          if (!--remaining) context.setResult(JSON.stringify(values))
        }
      }
    })
  }
  async function request(
    choice: "adopt_remote" | "retry_local"
  ): Promise<PlanOccurrenceResolutionRequest> {
    const value = (
      await readLocalSettingsSyncIncidentOverview(database, actor)
    ).find((value) => value.kind === "plan-occurrence")
    assert(value?.kind === "plan-occurrence", "Capacity conflict is missing")
    return {
      userId: actor,
      resolutionId: crypto.randomUUID(),
      operationId: choice === "retry_local" ? crypto.randomUUID() : null,
      ...(choice === "retry_local"
        ? {
            dependentOperationIds: Array.from(
              { length: planOccurrenceRetryOperationCount(value.incident) - 1 },
              () => crypto.randomUUID()
            ),
          }
        : {}),
      choice,
      createdAt: timestamp,
      expected: value.incident,
    }
  }
  async function rejectUnchanged(
    input: PlanOccurrenceResolutionRequest,
    text: string
  ) {
    const before = await snapshot()
    let message = ""
    try {
      await resolveLocalPlanOccurrenceIncident(database, actor, input)
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    assert(
      message.includes(text),
      `Capacity rejection did not identify the exhausted store: ${message}`
    )
    assert(
      before === (await snapshot()),
      "Capacity rejection changed durable state"
    )
  }
  let checks = 0
  async function check(label: string, work: () => Promise<void>) {
    await work()
    const row = document.createElement("li")
    row.textContent = `Correcto: ${label}`
    document.getElementById("results")?.append(row)
    checks++
  }
  try {
    await seed(10000, 2)
    await check("Cola llena rechaza reintento sin cambiar historial", () =>
      rejectUnchangedRequest("retry_local", "complete queue")
    )
    await seed(1, 10000)
    await check(
      "Metadata llena rechaza adopción y reintento sin escrituras",
      async () => {
        await rejectUnchanged(
          await request("adopt_remote"),
          "complete metadata"
        )
        await rejectUnchanged(await request("retry_local"), "complete metadata")
      }
    )
    await seed(9998, 9999)
    let saved: PlanOccurrenceResolutionRequest
    await check(
      "Reintento ocupa exactamente el último hueco de cada store",
      async () => {
        saved = await request("retry_local")
        const result = await resolveLocalPlanOccurrenceIncident(
          database,
          actor,
          saved
        )
        assert(
          result.status === "applied" && result.record.replacement !== null,
          "Boundary retry did not persist its pending replacement"
        )
        await runLocalTransaction(
          database,
          ["outbox", "syncMetadata"],
          "readonly",
          (context) => {
            let remaining = 2
            for (const store of ["outbox", "syncMetadata"]) {
              const read = context.transaction.objectStore(store).count()
              read.onsuccess = () => {
                if (read.result !== 10000)
                  context.fail(
                    new Error("Boundary write did not fill its expected count")
                  )
                else if (!--remaining) context.setResult(true)
              }
            }
          }
        )
      }
    )
    await check(
      "Replay con ambas stores llenas no duplica ni vuelve a escribir",
      async () => {
        const before = await snapshot()
        const result = await resolveLocalPlanOccurrenceIncident(
          database,
          actor,
          saved
        )
        assert(
          result.status === "replayed" && before === (await snapshot()),
          "Full-capacity replay changed state"
        )
      }
    )
    await seed(10000, 9999)
    await check(
      "Adopción permite cola llena porque no crea una operación",
      async () => {
        const result = await resolveLocalPlanOccurrenceIncident(
          database,
          actor,
          await request("adopt_remote")
        )
        assert(
          result.status === "applied" && result.record.replacement === null,
          "Adoption incorrectly required queue space"
        )
      }
    )
    async function rejectUnchangedRequest(choice: "retry_local", text: string) {
      await rejectUnchanged(await request(choice), text)
    }
  } finally {
    database.close()
    await new Promise<void>((resolve, reject) => {
      const deletion = indexedDB.deleteDatabase(name)
      deletion.onsuccess = () => resolve()
      deletion.onerror = () => reject(deletion.error)
      deletion.onblocked = () =>
        reject(new Error("Owned capacity partition cleanup blocked"))
    })
  }
  proofStatus.textContent = `${checks} pruebas correctas; partición propia eliminada`
}
run().catch((error) => {
  proofStatus.textContent =
    error instanceof Error ? error.message : String(error)
  console.error(error)
})
