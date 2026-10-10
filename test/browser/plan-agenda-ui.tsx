import { useState } from "react"
import { createRoot } from "react-dom/client"
import { SWRConfig } from "swr"
import { OFFLINE_ACCOUNT_KEY } from "@/config/pwa"
import { PlanList } from "@/features/plans/components/plan-list"
import { saveLocalPlan } from "@/features/plans/local-plans"
import type { LocalAccount } from "@/features/workspace/local-account"
import {
  ACCOUNT_CONTROL_DATABASE,
  activatePreparedAccount,
  completeRemoteLogout,
  hideLocalAccount,
  readAccountControl,
} from "@/lib/local-db/account-control"
import { localDatabaseName } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { LocalRepository } from "@/lib/local-db/repository"
import { entityIdSchema } from "@/schemas/primitives"

if (location.hostname !== "127.0.0.1" || location.port !== "4217")
  throw new Error("Plan agenda UI proof requires its isolated loopback origin")
const query = new URLSearchParams(location.search)
const runId = entityIdSchema.parse(query.get("run"))
const userId = `browser-test-${runId}-plan-agenda-ui`
const databaseName = localDatabaseName(userId)
const marker = `dalis:plan-agenda-ui:${runId}`
const baselineKey = `${marker}:baseline`
const epochKey = `${marker}:epoch`
const previousChangeKey = `${marker}:previous-change`
const accountChangeKey = "dalis:account-change"
const labels = ["Tarea", "Evento", "Cita", "Nota"]
const variants = ["task", "event", "appointment", "note"] as const
const colors = ["#123abc", "#e85d04", "#2b9348", "#b5179e"]
const date = "2026-10-10"
function uuid(value: number) {
  return `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`
}
function planId(index: number, recurring: boolean) {
  return uuid(index + (recurring ? 11 : 1))
}
function stepId(index: number, recurring: boolean) {
  return uuid(index + (recurring ? 111 : 101))
}
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}
const rootElement = document.getElementById("root")
const statusElement = document.getElementById("status")
const actionsElement = document.getElementById("actions")
if (!rootElement || !statusElement || !actionsElement)
  throw new Error("Plan agenda UI markup is missing")
const status = statusElement
const actions = actionsElement
const existing = await indexedDB.databases()
const reload = query.get("phase") === "reload"
if (reload)
  assert(
    sessionStorage.getItem(marker) === "owned" &&
      existing.some((value) => value.name === databaseName),
    "Reload requires this run's prepared partition"
  )
else {
  assert(
    !existing.some(
      (value) =>
        value.name === ACCOUNT_CONTROL_DATABASE || value.name === databaseName
    ),
    "Existing account control blocks the isolated UI fixture"
  )
  assert(
    localStorage.getItem(OFFLINE_ACCOUNT_KEY) === null,
    "Foreign legacy account blocks the isolated UI fixture"
  )
  sessionStorage.setItem(
    previousChangeKey,
    JSON.stringify(localStorage.getItem(accountChangeKey))
  )
  sessionStorage.setItem(marker, "owned")
}
let control = await readAccountControl()
if (reload)
  assert(
    control.userId === userId &&
      !control.logoutPending &&
      control.epoch === sessionStorage.getItem(epochKey),
    "Reload account ownership changed"
  )
else {
  assert(
    control.userId === null && !control.logoutPending,
    "Foreign account blocks the UI fixture"
  )
  const repository = await LocalRepository.open(userId)
  try {
    await repository.put("settings", {
      userId,
      timeZone: "Europe/Madrid",
      weekStartsOn: 1,
      locale: "es-ES",
      revision: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    })
  } finally {
    repository.close()
  }
  control = await activatePreparedAccount(
    userId,
    new Date().toISOString(),
    control.epoch
  )
  sessionStorage.setItem(epochKey, control.epoch)
}
const account: LocalAccount = {
  userId,
  epoch: control.epoch,
  itemCount: 8,
  offlineReady: false,
}
if (!reload) {
  const outbox = await LocalOutbox.open(userId)
  try {
    for (const [index, variant] of variants.entries()) {
      const tagId = uuid(index + 51)
      await outbox.commitPreferenceCommand({
        type: "tag.save",
        tagId,
        input: {
          name: `Categoría ${labels[index]}`,
          color: colors[index],
          position: (index + 1) * 1024,
        },
      })
      for (const recurring of [false, true])
        await saveLocalPlan(account, {
          mode: "create",
          itemId: planId(index, recurring),
          contentOperationId: crypto.randomUUID(),
          viewOperationId: crypto.randomUUID(),
          primaryTagId: tagId,
          now: new Date().toISOString(),
          input: {
            kind: "plan",
            variant,
            title: `${recurring ? "Repetición" : "Simple"} ${labels[index]}`,
            description: "Detalles locales de prueba",
            status: "not_started",
            checklist: [
              {
                id: stepId(index, recurring),
                text: `Paso ${recurring ? "Repetición" : "Simple"} ${labels[index]}`,
                completed: false,
              },
            ],
            schedule: {
              mode: "all_day",
              startDate: date,
              endDateExclusive: "2026-10-11",
            },
            recurrence: recurring
              ? {
                  frequency: "daily",
                  anchorDate: date,
                  interval: 1,
                  timeZone: "Europe/Madrid",
                  end: { type: "count", count: 3 },
                }
              : null,
          },
        })
    }
  } finally {
    outbox.close()
  }
  const repository = await LocalRepository.open(userId)
  try {
    sessionStorage.setItem(
      baselineKey,
      JSON.stringify(await repository.list("items", { includeDeleted: true }))
    )
  } finally {
    repository.close()
  }
}

export function PlanAgendaFixture({
  account: localAccount,
}: {
  account: LocalAccount
}) {
  const [selectionDate, setSelectionDate] = useState(date)
  return (
    <>
      <div className="mb-2 flex gap-2">
        <button
          type="button"
          className="min-h-11 rounded border px-3 text-xs"
          onClick={() => setSelectionDate("2026-10-11")}
        >
          Día siguiente
        </button>
        <button
          type="button"
          className="min-h-11 rounded border px-3 text-xs"
          onClick={() => setSelectionDate(date)}
        >
          Día de prueba
        </button>
      </div>
      <PlanList
        account={localAccount}
        selection={{ kind: "day", date: selectionDate }}
        heading="Planes del día"
      />
    </>
  )
}
const root = createRoot(rootElement)
root.render(
  <SWRConfig value={{ shouldRetryOnError: false }}>
    <PlanAgendaFixture account={account} />
  </SWRConfig>
)
status.textContent = reload
  ? "Prueba recargada; comprueba el progreso guardado."
  : "Preparado: carga más apariciones hasta ver ocho filas."
const verify = document.createElement("button")
verify.textContent = "Verificar cambios"
verify.className = "min-h-11 rounded border px-3 text-sm"
async function verifyProgress(expectCancelled = false) {
  try {
    const current = await readAccountControl()
    assert(
      current.userId === userId &&
        current.epoch === account.epoch &&
        !current.logoutPending,
      "Verification account ownership changed"
    )
    const repository = await LocalRepository.open(userId)
    const outbox = await LocalOutbox.open(userId)
    try {
      const parents = await repository.list("items", { includeDeleted: true })
      const occurrences = await repository.list("occurrences", {
        includeDeleted: true,
      })
      const entries = await outbox.listEntries()
      assert(
        JSON.stringify(parents) === sessionStorage.getItem(baselineKey),
        "UI occurrence changes mutated a parent or simple plan"
      )
      assert(occurrences.length === 1, "UI changed an unrelated occurrence")
      const occurrence = occurrences[0]
      assert(
        occurrence.kind === "plan" &&
          occurrence.id === `${planId(0, true)}:${date}` &&
          occurrence.status === "completed" &&
          occurrence.completedAt &&
          occurrence.checklist.length === 1 &&
          occurrence.checklist[0].id === stepId(0, true) &&
          occurrence.checklist[0].completed &&
          occurrence.cancelled === expectCancelled,
        "Expected recurring task progress is missing"
      )
      assert(
        entries.length === (expectCancelled ? 23 : 22) &&
          entries.every(
            (entry) =>
              entry.state === "pending" &&
              entry.attempts === 0 &&
              entry.lease === null
          ),
        "UI manufactured an ACK or unexpected intention"
      )
      const operations = entries.filter(
        (entry) =>
          entry.operation.command.type.startsWith("plan.") &&
          "occurrenceId" in entry.operation.command
      )
      assert(
        operations.length === (expectCancelled ? 3 : 2) &&
          operations.every(
            (entry) =>
              "occurrenceId" in entry.operation.command &&
              entry.operation.command.occurrenceId === occurrence.id
          ),
        "UI did not preserve the original occurrence slot"
      )
      status.textContent = expectCancelled
        ? "Correcto: cancelación conserva slot, progreso, padres y cola pendiente."
        : "Correcto: una aparición completada con su paso; padres, otras fechas y cola pendientes conservados."
    } finally {
      repository.close()
      outbox.close()
    }
  } catch (error) {
    status.textContent = "Verificación fallida."
    console.error(
      error instanceof Error ? error.message : "Plan agenda verification failed"
    )
  }
}
verify.onclick = () => {
  void verifyProgress()
}
actions.append(verify)
const verifyCancellation = document.createElement("button")
verifyCancellation.textContent = "Verificar cancelación"
verifyCancellation.className = "ml-3 min-h-11 rounded border px-3 text-sm"
verifyCancellation.onclick = () => {
  void verifyProgress(true)
}
actions.append(verifyCancellation)
const reloadLink = document.createElement("a")
reloadLink.textContent = "Verificar tras recarga"
reloadLink.href = `/?run=${runId}&phase=reload`
reloadLink.className =
  "ml-3 inline-flex min-h-11 items-center text-sm underline"
actions.append(reloadLink)
const cleanup = document.createElement("button")
cleanup.textContent = "Limpiar prueba"
cleanup.className = "ml-3 min-h-11 rounded border px-3 text-sm"
cleanup.onclick = async () => {
  assert(
    sessionStorage.getItem(marker) === "owned",
    "Cleanup run ownership is missing"
  )
  const current = await readAccountControl()
  assert(
    current.userId === userId &&
      current.epoch === account.epoch &&
      !current.logoutPending,
    "Cleanup cannot hide a foreign account"
  )
  root.unmount()
  const hidden = await hideLocalAccount()
  const closed = await completeRemoteLogout(hidden.epoch)
  assert(
    closed.userId === null &&
      !closed.logoutPending &&
      closed.epoch === hidden.epoch,
    "Owned local account closure changed"
  )
  const changeAfterClosure = localStorage.getItem(accountChangeKey)
  for (const name of [databaseName, ACCOUNT_CONTROL_DATABASE])
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      request.onblocked = () =>
        reject(new Error("Owned UI fixture cleanup is blocked"))
    })
  if (localStorage.getItem(accountChangeKey) === changeAfterClosure) {
    const previous = JSON.parse(
      sessionStorage.getItem(previousChangeKey) ?? "null"
    ) as string | null
    if (previous === null) localStorage.removeItem(accountChangeKey)
    else localStorage.setItem(accountChangeKey, previous)
  }
  sessionStorage.removeItem(previousChangeKey)
  sessionStorage.removeItem(marker)
  sessionStorage.removeItem(epochKey)
  sessionStorage.removeItem(baselineKey)
  status.textContent = "Prueba y bases propias eliminadas."
  cleanup.disabled = true
  verify.disabled = true
  verifyCancellation.disabled = true
}
actions.append(cleanup)
