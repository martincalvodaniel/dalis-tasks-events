import { createRoot } from "react-dom/client"
import { SWRConfig } from "swr"
import { OFFLINE_ACCOUNT_KEY } from "@/config/pwa"
import { PlanCalendarBoard } from "@/features/plans/components/plan-calendar-board"
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

if (location.hostname !== "127.0.0.1" || location.port !== "4251")
  throw new Error("Plan agenda UI proof requires its isolated loopback origin")
const query = new URLSearchParams(location.search)
const calendarMode = query.get("mode") === "calendar"
const runId = entityIdSchema.parse(query.get("run"))
const userId = `browser-test-${runId}-plan-gestures`
const databaseName = localDatabaseName(userId)
const marker = `dalis:plan-gestures:${runId}`
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
  itemCount: 4,
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
      for (const recurring of calendarMode ? [false, true] : [false])
        await saveLocalPlan(account, {
          mode: "create",
          itemId: planId(index, recurring),
          contentOperationId: crypto.randomUUID(),
          viewOperationId: crypto.randomUUID(),
          primaryTagId: uuid(51),
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

const root = createRoot(rootElement)
root.render(
  <SWRConfig value={{ shouldRetryOnError: false }}>
    {calendarMode ? (
      <PlanCalendarBoard account={account} />
    ) : (
      <PlanList
        account={account}
        selection={{ kind: "upcoming", date }}
        heading="Hoy y próximas"
      />
    )}
  </SWRConfig>
)
status.textContent = "Preparado para pulsación prolongada sobre planes."
const settle = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  )
function dispatchTouchGesture(
  target: Element,
  type: string,
  identifier: number,
  x: number,
  y: number
) {
  const touch = new Touch({ identifier, target, clientX: x, clientY: y })
  const ended = type === "touchend" || type === "touchcancel"
  const event = new TouchEvent(type, {
    bubbles: true,
    cancelable: true,
    touches: ended ? [] : [touch],
    targetTouches: ended ? [] : [touch],
    changedTouches: [touch],
  })
  target.dispatchEvent(event)
  return event
}
const run = document.createElement("button")
run.textContent = "Probar gestos de orden"
run.className = "min-h-11 rounded border px-3 text-sm"
run.onclick = async () => {
  run.disabled = true
  try {
    const source = rootElement.querySelector<HTMLElement>(
      `li[data-order-item="${planId(3, false)}"]`
    )
    const destination = rootElement.querySelector<HTMLElement>(
      `li[data-order-item="${planId(0, false)}"]`
    )
    const title = source?.querySelector("h4")
    assert(source && destination && title, "Gesture rows are missing")
    assert(
      getComputedStyle(title).userSelect === "none",
      "Row selection must be disabled before long press starts"
    )
    const selection = new Event("selectstart", {
      bubbles: true,
      cancelable: true,
    })
    title.dispatchEvent(selection)
    assert(selection.defaultPrevented, "Native row selection was not blocked")
    const editable = document.createElement("input")
    source.append(editable)
    try {
      assert(
        getComputedStyle(editable).userSelect === "text",
        "Editable field selection must remain available"
      )
      const fieldSelection = new Event("selectstart", {
        bubbles: true,
        cancelable: true,
      })
      editable.dispatchEvent(fieldSelection)
      assert(
        !fieldSelection.defaultPrevented,
        "Editable field selection was intercepted"
      )
    } finally {
      editable.remove()
    }
    const capture = source.setPointerCapture
    source.setPointerCapture = () => undefined
    const origin = title.getBoundingClientRect(),
      target = destination.getBoundingClientRect()
    const dispatch = (type: string, x = origin.left + 8, y = origin.top + 8) =>
      dispatchTouchGesture(
        title,
        type
          .replace("pointerdown", "touchstart")
          .replace("pointerup", "touchend")
          .replace("pointermove", "touchmove"),
        42,
        x,
        y
      )
    const outbox = await LocalOutbox.open(userId)
    const before = (await outbox.listEntries()).length
    outbox.close()
    try {
      title.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          isPrimary: true,
          pointerId: 99,
          pointerType: "mouse",
          button: 0,
          clientX: origin.left + 8,
          clientY: origin.top + 8,
        })
      )
      title.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          isPrimary: true,
          pointerId: 99,
          pointerType: "mouse",
          button: 0,
          clientX: origin.left + 8,
          clientY: origin.top + 8,
        })
      )
      dispatch("pointerdown")
      const menu = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
      })
      title.dispatchEvent(menu)
      assert(
        menu.defaultPrevented,
        "Native callout must be blocked before the activation timer"
      )
      dispatch("pointerup")
      dispatch("pointerdown")
      assert(
        !dispatch("pointermove", origin.left + 30).defaultPrevented,
        "Movement before pickup must permit native scroll"
      )
      dispatch("pointerup")
      dispatch("pointerdown")
      await new Promise((resolve) => setTimeout(resolve, 500))
      assert(
        source.dataset.orderDragging === "true",
        "Touch hold did not visibly select the plan"
      )
      source.dispatchEvent(
        new PointerEvent("pointercancel", {
          bubbles: true,
          pointerId: 42,
          pointerType: "touch",
        })
      )
      assert(
        source.dataset.orderDragging === "true",
        "Pointer cancellation incorrectly cancelled the native touch gesture"
      )
      assert(
        rootElement.querySelector("[data-order-preview]"),
        "Touch pickup did not show a drag preview"
      )
      assert(
        dispatch("pointermove", target.left + 50, target.top + 3)
          .defaultPrevented,
        "Picked-up touch must block native scroll"
      )
      dispatch("pointerup", target.left + 50, target.top + 3)
      await new Promise((resolve) => setTimeout(resolve, 100))
      await settle()
      const stored = await LocalOutbox.open(userId)
      try {
        const entries = await stored.listEntries()
        assert(
          entries.length === before + 1,
          "Long press must enqueue exactly one operation"
        )
        const last = entries.at(-1)
        assert(
          last?.operation.command.type === "task.move" &&
            last.operation.command.itemId === planId(3, false),
          "Long press must retain the moved plan identity"
        )
        assert(
          last.operation.command.date === date &&
            last.operation.command.beforeId === planId(0, false),
          "Drop must retain day and neighbor"
        )
      } finally {
        stored.close()
      }
      assert(
        rootElement
          .querySelector("li[data-order-item]")
          ?.getAttribute("data-order-item") === planId(3, false),
        "UI did not refresh the manual order"
      )
      status.textContent =
        "Gestos OK: toque corto y scroll sin intención; pulsación prolongada guarda un único orden."
    } finally {
      source.setPointerCapture = capture
    }
  } catch (error) {
    status.textContent = `Fallo: ${error instanceof Error ? error.message : "Gesture check failed"}`
  }
}
actions.append(run)
const verify = document.createElement("button")
verify.textContent = "Verificar orden guardado"
verify.className = "min-h-11 rounded border px-3 text-sm"
verify.onclick = async () => {
  const repository = await LocalRepository.open(userId)
  try {
    const placements = await repository.list("taskPlacements", {
      includeDeleted: true,
    })
    assert(
      placements.some((record) => record.occurrenceId === planId(3, false)),
      "Placement was not persisted"
    )
    assert(
      rootElement
        .querySelector("li[data-order-item]")
        ?.getAttribute("data-order-item") === planId(3, false),
      "Reload lost the manual order"
    )
    status.textContent = "Orden guardado y recarga OK."
  } catch (error) {
    status.textContent = `Fallo: ${error instanceof Error ? error.message : "Persistence check failed"}`
  } finally {
    repository.close()
  }
}
actions.append(verify)
const move = document.createElement("button")
move.textContent = "Probar cambio de día"
move.className = "min-h-11 rounded border px-3 text-sm"
move.hidden = !calendarMode
move.onclick = async () => {
  move.disabled = true
  try {
    while (
      rootElement.querySelector("button")?.textContent ===
      "Completar recuento del mes"
    ) {
      rootElement.querySelector<HTMLButtonElement>("button")?.click()
      await new Promise((resolve) => setTimeout(resolve, 60))
    }
    const destination = rootElement.querySelector<HTMLElement>(
      '[data-order-drop-date="2026-10-12"]'
    )
    assert(destination, "Calendar target is missing")
    const outbox = await LocalOutbox.open(userId)
    const before = (await outbox.listEntries()).length
    outbox.close()
    async function drag(
      key: string,
      cancelled = false,
      targetDate = "2026-10-12"
    ) {
      window.scrollTo({ top: 0, behavior: "instant" })
      await settle()
      const source = rootElement?.querySelector<HTMLElement>(
        `li[data-order-item="${key}"]`
      )
      const title = source?.querySelector("h4")
      const cell = rootElement?.querySelector<HTMLElement>(
        `[data-order-drop-date="${targetDate}"]`
      )
      assert(source && title && cell, "Calendar drag source is missing")
      const capture = source.setPointerCapture
      source.setPointerCapture = () => undefined
      const origin = title.getBoundingClientRect()
      const dispatch = (
        type: string,
        x = origin.left + 8,
        y = origin.top + 8
      ) =>
        dispatchTouchGesture(
          title,
          type
            .replace("pointerdown", "touchstart")
            .replace("pointerup", "touchend")
            .replace("pointermove", "touchmove"),
          43,
          x,
          y
        )
      try {
        dispatch("pointerdown")
        await new Promise((resolve) => setTimeout(resolve, 500))
        const target = cell.getBoundingClientRect()
        assert(
          dispatch(
            "pointermove",
            target.left + target.width / 2,
            target.top + target.height / 2
          ).defaultPrevented,
          "Calendar date drag must block native scroll after pickup"
        )
        if (cancelled)
          source.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
          )
        dispatch(
          "pointerup",
          target.left + target.width / 2,
          target.top + target.height / 2
        )
        await new Promise((resolve) => setTimeout(resolve, 100))
        await settle()
      } finally {
        source.setPointerCapture = capture
      }
    }
    await drag(planId(0, false), true)
    await drag(planId(0, false), false, date)
    await drag(planId(0, false))
    await drag(`${planId(0, true)}:${date}`)
    const repository = await LocalRepository.open(userId),
      saved = await LocalOutbox.open(userId)
    try {
      const entries = await saved.listEntries()
      assert(
        entries.length === before + 2,
        `Calendar drops must enqueue two operations: ${entries.length - before}`
      )
      assert(
        entries.at(-2)?.operation.command.type === "item.update" &&
          entries.at(-1)?.operation.command.type === "plan.update-occurrence",
        "Calendar drops must use original producers"
      )
      const simple = await repository.get("items", planId(0, false)),
        parent = await repository.get("items", planId(0, true))
      const occurrence = await repository.get(
        "occurrences",
        `${planId(0, true)}:${date}`
      )
      assert(
        simple?.kind === "plan" &&
          simple.schedule.mode === "all_day" &&
          simple.schedule.startDate === "2026-10-12" &&
          simple.schedule.endDateExclusive === "2026-10-13",
        "Simple interval was not moved"
      )
      assert(
        parent?.kind === "plan" &&
          parent.schedule.mode === "all_day" &&
          parent.schedule.startDate === date,
        "Occurrence drag moved its parent"
      )
      assert(
        occurrence?.kind === "plan" &&
          occurrence.slotKey === date &&
          occurrence.schedule.mode === "all_day" &&
          occurrence.schedule.startDate === "2026-10-12",
        "Appearance identity or date was lost"
      )
      assert(
        !rootElement.querySelector(
          `li[data-order-item="${planId(0, false)}"]`
        ) &&
          !rootElement.querySelector(
            `li[data-order-item="${planId(0, true)}:${date}"]`
          ),
        "Moved rows remain on the original day"
      )
      status.textContent =
        "Calendario OK: cancelación y misma fecha sin escritura; plan y aparición movidos con dos intenciones, serie intacta."
    } finally {
      repository.close()
      saved.close()
    }
  } catch (error) {
    status.textContent = `Fallo: ${error instanceof Error ? error.message : "Calendar check failed"}`
  }
}
actions.append(move)
const verifyDate = document.createElement("button")
verifyDate.textContent = "Verificar fecha guardada"
verifyDate.className = "min-h-11 rounded border px-3 text-sm"
verifyDate.hidden = !calendarMode
verifyDate.onclick = async () => {
  const repository = await LocalRepository.open(userId)
  try {
    const simple = await repository.get("items", planId(0, false)),
      occurrence = await repository.get(
        "occurrences",
        `${planId(0, true)}:${date}`
      )
    assert(
      simple?.kind === "plan" &&
        simple.schedule.mode === "all_day" &&
        simple.schedule.startDate === "2026-10-12" &&
        occurrence?.kind === "plan" &&
        occurrence.schedule.mode === "all_day" &&
        occurrence.schedule.startDate === "2026-10-12",
      "Reload lost moved dates"
    )
    status.textContent = "Fechas y aparición conservadas tras recarga."
  } catch (error) {
    status.textContent = `Fallo: ${error instanceof Error ? error.message : "Date check failed"}`
  } finally {
    repository.close()
  }
}
actions.append(verifyDate)
const progressProofKey = `${marker}:progress`
const progressProof = document.createElement("button")
progressProof.textContent = "Probar tres estados"
progressProof.className = "min-h-11 rounded border px-3 text-sm"
progressProof.onclick = async () => {
  progressProof.disabled = true
  const repository = await LocalRepository.open(userId)
  const outbox = await LocalOutbox.open(userId)
  try {
    if (calendarMode)
      assert(
        query.get("date") === date,
        "Progress fixture must select its seeded day"
      )
    if (calendarMode) {
      for (let page = 0; page < 20; page++) {
        const more = [
          ...rootElement.querySelectorAll<HTMLButtonElement>("button"),
        ].find((button) => button.textContent === "Cargar más apariciones")
        if (!more) break
        more.click()
        for (let attempt = 0; attempt < 120 && more.disabled; attempt++)
          await new Promise((resolve) => setTimeout(resolve, 16))
        await settle()
      }
    }
    const before = (await outbox.listEntries()).length
    let expectedCount = before
    for (const recurring of calendarMode ? [false, true] : [false]) {
      for (const [index] of variants.entries()) {
        const itemId = planId(index, recurring)
        const rowKey = recurring ? `${itemId}:${date}` : itemId
        const row = rootElement.querySelector<HTMLElement>(
          `li[data-order-item="${rowKey}"]`
        )
        const button = row?.querySelector<HTMLButtonElement>("article > button")
        assert(row && button, "Progress row is missing")
        const details = row.querySelector("details")
        assert(!details?.open, "Progress must start outside details")
        for (const [desired, pressed] of [
          ["in_progress", "mixed"],
          ["completed", "true"],
          ["not_started", "false"],
        ] as const) {
          assert(!button.disabled, "Progress control is unexpectedly disabled")
          button.click()
          for (let attempt = 0; attempt < 120; attempt++) {
            if (
              !button.disabled &&
              button.getAttribute("aria-pressed") === pressed
            )
              break
            await new Promise((resolve) => setTimeout(resolve, 16))
          }
          expectedCount++
          assert(
            !button.disabled && button.getAttribute("aria-pressed") === pressed,
            "Progress state did not refresh"
          )
          assert(!details?.open, "Changing progress must not open details")
          const value = recurring
            ? await repository.get("occurrences", rowKey)
            : await repository.get("items", itemId)
          assert(
            value?.kind === "plan" && value.status === desired,
            "Progress state was not persisted"
          )
          assert(
            (value.completedAt !== null) === (desired === "completed"),
            "Completion timestamp does not follow status"
          )
          assert(
            value.checklist.every((step) => !step.completed),
            "Plan progress changed checklist steps"
          )
          const entries = await outbox.listEntries()
          const last = entries.at(-1)
          assert(
            entries.length === expectedCount && last?.state === "pending",
            "One click must persist one pending intention"
          )
          assert(
            last.operation.command.type ===
              (recurring ? "plan.set-occurrence-status" : "plan.set-status") &&
              "status" in last.operation.command &&
              last.operation.command.status === desired,
            "Progress intention does not match the requested state"
          )
          if (recurring)
            assert(
              (await repository.get("items", itemId))?.kind === "plan" &&
                ((await repository.get("items", itemId)) as { status: string })
                  .status === "not_started",
              "Appearance progress changed its parent"
            )
        }
      }
    }
    sessionStorage.setItem(progressProofKey, String(expectedCount))
    status.textContent = `Tres estados OK: ${expectedCount - before} intenciones exactas, sin abrir detalles ni cambiar pasos/series.`
  } catch (error) {
    status.textContent = `Fallo: ${error instanceof Error ? error.message : "Progress check failed"}`
  } finally {
    repository.close()
    outbox.close()
  }
}
actions.append(progressProof)
const verifyProgress = document.createElement("button")
verifyProgress.textContent = "Verificar estados tras recarga"
verifyProgress.className = "min-h-11 rounded border px-3 text-sm"
verifyProgress.onclick = async () => {
  const repository = await LocalRepository.open(userId)
  const outbox = await LocalOutbox.open(userId)
  try {
    const expected = Number(sessionStorage.getItem(progressProofKey))
    assert(
      expected > 0 && (await outbox.listEntries()).length === expected,
      "Reload lost progress intentions"
    )
    for (const recurring of calendarMode ? [false, true] : [false])
      for (const [index] of variants.entries()) {
        const itemId = planId(index, recurring)
        const value = recurring
          ? await repository.get("occurrences", `${itemId}:${date}`)
          : await repository.get("items", itemId)
        assert(
          value?.kind === "plan" &&
            value.status === "not_started" &&
            value.completedAt === null,
          "Reload lost reopened progress"
        )
      }
    status.textContent = "Tres estados y cola conservados tras recarga."
  } catch (error) {
    status.textContent = `Fallo: ${error instanceof Error ? error.message : "Progress reload failed"}`
  } finally {
    repository.close()
    outbox.close()
  }
}
actions.append(verifyProgress)
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
  sessionStorage.removeItem(progressProofKey)
  status.textContent = "Prueba y bases propias eliminadas."
  cleanup.disabled = true
  run.disabled = true
  verify.disabled = true
  move.disabled = true
  verifyDate.disabled = true
  progressProof.disabled = true
  verifyProgress.disabled = true
}
actions.append(cleanup)
