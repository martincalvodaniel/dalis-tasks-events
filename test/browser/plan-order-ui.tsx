import { useState } from "react"
import { createRoot } from "react-dom/client"
import { SWRConfig } from "swr"
import { OFFLINE_ACCOUNT_KEY } from "@/config/pwa"
import { PlanAgenda } from "@/features/plans/components/plan-agenda"
import { PlanCalendarBoard } from "@/features/plans/components/plan-calendar-board"
import { saveLocalPlan } from "@/features/plans/local-plans"
import type { LocalAccount } from "@/features/workspace/local-account"
import { addCivilDays, todayInTimeZone } from "@/lib/calendar/civil-date"
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
import { longPressDelay } from "@/lib/ordering/long-press"
import { entityIdSchema } from "@/schemas/primitives"

if (location.hostname !== "127.0.0.1" || location.port !== "4218")
  throw new Error("Plan order UI proof requires its dedicated loopback origin")
const query = new URLSearchParams(location.search)
const runId = entityIdSchema.parse(query.get("run"))
const userId = `browser-test-${runId}-plan-order-ui`
const databaseName = localDatabaseName(userId)
const marker = `dalis:plan-order-ui:${runId}`
const day = todayInTimeZone("Europe/Madrid")
const changeKey = "dalis:account-change"
const protectedStores = [
  "items",
  "occurrences",
  "itemViews",
  "tags",
  "settings",
] as const
function id(index: number) {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`
}
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}
const rootElement = document.getElementById("root")
const statusElement = document.getElementById("status")
const actionsElement = document.getElementById("actions")
if (!rootElement || !statusElement || !actionsElement)
  throw new Error("Order UI fixture markup is missing")
const status = statusElement,
  actions = actionsElement
const reload = query.get("phase") === "reload"
const categories = query.get("categories") === "1"
const databases = await indexedDB.databases()
if (reload) {
  assert(
    sessionStorage.getItem(marker) === "owned" &&
      databases.some((value) => value.name === databaseName),
    "Reload requires this run's owned partition"
  )
} else {
  assert(
    !databases.some(
      (value) =>
        value.name === databaseName || value.name === ACCOUNT_CONTROL_DATABASE
    ) && localStorage.getItem(OFFLINE_ACCOUNT_KEY) === null,
    "Foreign account blocks isolated order UI proof"
  )
  sessionStorage.setItem(
    `${marker}:previous-change`,
    JSON.stringify(localStorage.getItem(changeKey))
  )
  sessionStorage.setItem(marker, "owned")
}
let control = await readAccountControl()
if (!reload) {
  assert(
    control.userId === null && !control.logoutPending,
    "Foreign account control is active"
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
  sessionStorage.setItem(`${marker}:epoch`, control.epoch)
}
assert(
  control.userId === userId &&
    control.epoch === sessionStorage.getItem(`${marker}:epoch`) &&
    !control.logoutPending,
  "Order UI account ownership changed"
)
const account: LocalAccount = {
  userId,
  epoch: control.epoch,
  itemCount: 3,
  offlineReady: false,
}
async function protectedSnapshot() {
  const repository = await LocalRepository.open(userId)
  try {
    return JSON.stringify(
      await Promise.all(
        protectedStores.map((store) =>
          repository.list(store, { includeDeleted: true })
        )
      )
    )
  } finally {
    repository.close()
  }
}
if (!reload) {
  if (categories) {
    const outbox = await LocalOutbox.open(userId)
    try {
      for (let index = 1; index <= 3; index++)
        await outbox.commitPreferenceCommand({
          type: "tag.save",
          tagId: id(50 + index),
          input: {
            name: index === 3 ? "Vacía" : `Categoría ${index}`,
            color: ["#123abc", "#e85d04", "#2b9348"][index - 1],
            position: index * 1024,
          },
        })
    } finally {
      outbox.close()
    }
  }
  for (let index = 1; index <= 3; index++)
    await saveLocalPlan(account, {
      mode: "create",
      itemId: id(index),
      contentOperationId: crypto.randomUUID(),
      viewOperationId: crypto.randomUUID(),
      primaryTagId: categories ? id(index === 1 ? 51 : 52) : null,
      now: new Date().toISOString(),
      input: {
        kind: "plan",
        variant: "task",
        title: `Plan ${index}`,
        description: "",
        status: "not_started",
        checklist: [],
        schedule: {
          mode: "all_day",
          startDate: day,
          endDateExclusive: addCivilDays(day, 1),
        },
        recurrence:
          index === 3
            ? {
                frequency: "daily",
                interval: 1,
                anchorDate: day,
                timeZone: "Europe/Madrid",
                end: { type: "count", count: 3 },
              }
            : null,
      },
    })
  sessionStorage.setItem(`${marker}:baseline`, await protectedSnapshot())
}
const cache = new Map()
export function PlanOrderFixture() {
  const [calendar, setCalendar] = useState(query.get("screen") === "calendar")
  return (
    <SWRConfig value={{ provider: () => cache }}>
      <div className="mb-2 flex gap-2">
        <button
          type="button"
          className="min-h-11 rounded border px-3 text-sm"
          onClick={() => setCalendar(false)}
        >
          Mi espacio
        </button>
        <button
          type="button"
          className="min-h-11 rounded border px-3 text-sm"
          onClick={() => setCalendar(true)}
        >
          Calendario
        </button>
      </div>
      {calendar ? (
        <PlanCalendarBoard account={account} />
      ) : (
        <PlanAgenda account={account} />
      )}
    </SWRConfig>
  )
}
const root = createRoot(rootElement)
root.render(<PlanOrderFixture />)
status.textContent =
  "Preparado: Plan 1 y Plan 2 simples; Plan 3 diario durante tres días."
function todayList() {
  const section = document.querySelector('section[aria-label="Planes del día"]')
  const list = section?.querySelector<HTMLUListElement>("ul[data-order-list]")
  assert(list, "Today's real plan list is missing")
  return list
}
function visibleOrder() {
  return [
    ...todayList().querySelectorAll<HTMLLIElement>(
      ":scope > li[data-order-item]"
    ),
  ].map((row) => row.dataset.orderLabel)
}
function action(label: string, work: () => Promise<void>) {
  const button = document.createElement("button")
  button.textContent = label
  button.className = "mr-2 mt-2 min-h-11 rounded border px-3 text-xs"
  button.onclick = () => {
    void work().catch((error) => {
      status.textContent = "Verificación fallida."
      console.error(
        error instanceof Error ? error.message : "Unknown order proof failure"
      )
    })
  }
  actions.append(button)
  return button
}
async function verifyOrder(expected: string[]) {
  assert(
    JSON.stringify(visibleOrder()) === JSON.stringify(expected),
    "Rendered order differs from expected UI action"
  )
  assert(
    (await protectedSnapshot()) ===
      sessionStorage.getItem(`${marker}:baseline`),
    "Ordering changed parent, appearance, schedule or preferences"
  )
  const repository = await LocalRepository.open(userId),
    outbox = await LocalOutbox.open(userId)
  try {
    const placements = await repository.list("taskPlacements", {
      includeDeleted: true,
    })
    assert(
      placements.length === 3 &&
        placements.every(
          (value) =>
            value.scope === "day" && value.date === day && value.tagId === null
        ),
      "Ordering changed another day or category"
    )
    const entries = await outbox.listEntries()
    assert(
      entries.every(
        (value) =>
          value.state === "pending" &&
          value.attempts === 0 &&
          value.lease === null
      ),
      "Offline UI manufactured an ACK or attempt"
    )
    const moves = entries.filter(
      (value) => value.operation.command.type === "task.move"
    )
    assert(moves.length > 0, "UI did not queue a real movement")
    for (const entry of moves) {
      const command = entry.operation.command
      assert(
        command.type === "task.move" &&
          command.date === day &&
          command.scope === "day" &&
          command.tagId === null,
        "UI queued the wrong movement context"
      )
      assert(
        command.occurrenceId ===
          (command.itemId === id(3) ? `${id(3)}:${day}` : null),
        "UI lost original occurrence identity"
      )
    }
    status.textContent = `Correcto: ${expected.join(" → ")}; ${moves.length} movimientos pendientes, tres posiciones de hoy y demás datos intactos.`
  } finally {
    repository.close()
    outbox.close()
  }
}
action("Verificar Plan 3 primero", () =>
  verifyOrder(["Plan 3", "Plan 1", "Plan 2"])
)
action("Verificar Plan 2 primero", () =>
  verifyOrder(["Plan 2", "Plan 3", "Plan 1"])
)
// This authored component test dispatches touch events; it is not physical-device evidence.
action("Probar pulsación y arrastre de Plan 3", async () => {
  const list = todayList()
  const source = list.querySelector<HTMLElement>(
    `li[data-order-item="${id(3)}:${day}"]`
  )
  const destination = list.querySelector<HTMLElement>(
    `li[data-order-item="${id(1)}"]`
  )
  assert(source && destination, "Mixed UI rows are missing")
  const target = source.querySelector("[data-plan-drag-surface]")
  assert(target, "Plan drag surface is missing")
  source.scrollIntoView({ block: "nearest" })
  const sourceRect = target.getBoundingClientRect(),
    destinationRect = destination.getBoundingClientRect()
  const x = sourceRect.left + sourceRect.width / 2,
    y = sourceRect.top + sourceRect.height / 2
  const touch = (clientX: number, clientY: number) =>
    new Touch({ identifier: 73, target, clientX, clientY })
  target.dispatchEvent(
    new TouchEvent("touchstart", {
      bubbles: true,
      cancelable: true,
      touches: [touch(x, y)],
      changedTouches: [touch(x, y)],
    })
  )
  await new Promise((resolve) => setTimeout(resolve, longPressDelay + 100))
  assert(
    source.dataset.orderDragging === "true",
    "Long press did not select the mixed recurring row"
  )
  const endY = destinationRect.top + 5
  target.dispatchEvent(
    new TouchEvent("touchmove", {
      bubbles: true,
      cancelable: true,
      touches: [touch(x, endY)],
      changedTouches: [touch(x, endY)],
    })
  )
  target.dispatchEvent(
    new TouchEvent("touchend", {
      bubbles: true,
      cancelable: true,
      touches: [],
      changedTouches: [touch(x, endY)],
    })
  )
  for (let attempt = 0; attempt < 40; attempt++) {
    if (
      JSON.stringify(visibleOrder()) ===
      JSON.stringify(["Plan 3", "Plan 1", "Plan 2"])
    ) {
      await verifyOrder(["Plan 3", "Plan 1", "Plan 2"])
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error("Long press did not persist and display the mixed order")
})

if (categories) {
  async function crossCategoryDrag(
    title: string,
    groupId: string,
    peer: string | null,
    side: "before" | "after",
    mode: "drop" | "cancel" | "hold" = "drop"
  ) {
    const section = document.querySelector(
      'section[aria-label="Planes del día"]'
    )
    const source = Array.from(
      section?.querySelectorAll<HTMLElement>("li[data-order-item]") ?? []
    ).find((row) => row.dataset.orderLabel === title)
    const target = source?.querySelector("[data-plan-drag-surface]")
    assert(source && target, "Category drag source is missing")
    source.scrollIntoView({ block: "center" })
    const rect = target.getBoundingClientRect(),
      x = rect.left + rect.width / 2,
      y = rect.top + rect.height / 2
    const touch = (clientX: number, clientY: number) =>
      new Touch({ identifier: 77, target, clientX, clientY })
    target.dispatchEvent(
      new TouchEvent("touchstart", {
        bubbles: true,
        cancelable: true,
        touches: [touch(x, y)],
        changedTouches: [touch(x, y)],
      })
    )
    await new Promise((resolve) => setTimeout(resolve, longPressDelay + 100))
    assert(
      source.dataset.orderDragging === "true",
      "Category drag did not activate"
    )
    if (mode === "hold") {
      target.dispatchEvent(
        new TouchEvent("touchend", {
          bubbles: true,
          cancelable: true,
          touches: [],
          changedTouches: [touch(x, y)],
        })
      )
      await new Promise((resolve) => setTimeout(resolve, 80))
      status.textContent = "Pulsación sin arrastre: no se guarda movimiento."
      return
    }
    const group = section?.querySelector<HTMLElement>(
      `[data-order-category="${groupId}"]`
    )
    assert(group, "Destination category is missing")
    const destination = peer
      ? Array.from(
          group.querySelectorAll<HTMLElement>("li[data-order-item]")
        ).find((row) => row.dataset.orderLabel === peer)
      : group.querySelector<HTMLElement>("h3")
    assert(destination, "Destination row or empty header is missing")
    destination.scrollIntoView({ block: "center" })
    const bounds = destination.getBoundingClientRect(),
      endX = bounds.left + bounds.width / 2,
      endY = side === "before" ? bounds.top + 4 : bounds.bottom - 4
    assert(bounds.height > 0, "Empty category drop zone is hidden during drag")
    target.dispatchEvent(
      new TouchEvent("touchmove", {
        bubbles: true,
        cancelable: true,
        touches: [touch(endX, endY)],
        changedTouches: [touch(endX, endY)],
      })
    )
    await new Promise((resolve) => setTimeout(resolve, 40))
    assert(
      document
        .querySelector("[data-order-preview]")
        ?.textContent?.includes(
          group.querySelector("h3")?.textContent ?? "missing"
        ),
      "Preview did not identify the destination category"
    )
    if (mode === "cancel")
      source.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Escape" })
      )
    target.dispatchEvent(
      new TouchEvent("touchend", {
        bubbles: true,
        cancelable: true,
        touches: [],
        changedTouches: [touch(endX, endY)],
      })
    )
    const itemId = title === "Plan 1" ? id(1) : id(3)
    for (let attempt = 0; attempt < 40; attempt++) {
      const repository = await LocalRepository.open(userId)
      let categoryId: string | null | undefined
      try {
        categoryId = (await repository.get("itemViews", itemId))?.primaryTagId
      } finally {
        repository.close()
      }
      if (
        mode === "cancel" ||
        categoryId === (groupId === "uncategorized" ? null : groupId)
      ) {
        await new Promise((resolve) => setTimeout(resolve, 80))
        status.textContent =
          mode === "cancel"
            ? "Cancelado sin guardar."
            : `Movimiento guardado: ${title} → ${group.querySelector("h3")?.textContent}.`
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    throw new Error("Category movement did not persist")
  }
  action("Mover Plan 1 antes de Plan 2 en Categoría 2", () =>
    crossCategoryDrag("Plan 1", id(52), "Plan 2", "before")
  )
  action("Mover Plan 1 a Categoría 1 vacía", () =>
    crossCategoryDrag("Plan 1", id(51), null, "after")
  )
  action("Mover Plan 3 a Vacía", () =>
    crossCategoryDrag("Plan 3", id(53), null, "after")
  )
  action("Mover Plan 3 a Sin categoría", () =>
    crossCategoryDrag("Plan 3", "uncategorized", null, "after")
  )
  action("Mover Plan 1 después de Plan 2", () =>
    crossCategoryDrag("Plan 1", id(52), "Plan 2", "after")
  )
  action("Cancelar cambio de categoría de Plan 1", () =>
    crossCategoryDrag("Plan 1", id(51), null, "after", "cancel")
  )
  action("Pulsar sin arrastrar Plan 1", () =>
    crossCategoryDrag("Plan 1", id(51), null, "after", "hold")
  )
  action("Verificar movimientos entre categorías", async () => {
    const repository = await LocalRepository.open(userId),
      outbox = await LocalOutbox.open(userId)
    try {
      const baseline = JSON.parse(
        sessionStorage.getItem(`${marker}:baseline`) ?? "null"
      ) as unknown[]
      for (const index of [0, 1, 3, 4])
        assert(
          JSON.stringify(
            await repository.list(protectedStores[index], {
              includeDeleted: true,
            })
          ) === JSON.stringify(baseline[index]),
          "Category drag changed protected content, slots, tags or settings"
        )
      const views = await repository.list("itemViews", { includeDeleted: true })
      assert(
        views.find((view) => view.itemId === id(1))?.primaryTagId === id(52),
        "Plan 1 category is wrong"
      )
      assert(
        views.find((view) => view.itemId === id(2))?.primaryTagId === id(52),
        "Peer category changed"
      )
      assert(
        views.find((view) => view.itemId === id(3))?.primaryTagId === null,
        "Series category is wrong"
      )
      const entries = await outbox.listEntries(),
        moves = entries.filter(
          (entry) => entry.operation.command.type === "task.move"
        )
      assert(
        moves.length === 5,
        "Cancel or a drop produced an unexpected extra command"
      )
      for (const entry of moves) {
        const command = entry.operation.command
        assert(
          command.type === "task.move" &&
            command.date === day &&
            command.scope === "day" &&
            command.occurrenceId ===
              (command.itemId === id(3) ? `${id(3)}:${day}` : null),
          "Movement lost canonical identity or day"
        )
        assert(
          entry.state === "pending" &&
            entry.attempts === 0 &&
            entry.lease === null,
          "UI manufactured a remote ACK"
        )
      }
      const group = document.querySelector(
        `[aria-label="Planes del día"] [data-order-category="${id(52)}"]`
      )
      assert(
        JSON.stringify(
          Array.from(
            group?.querySelectorAll<HTMLElement>("li[data-order-item]") ?? []
          ).map((row) => row.dataset.orderLabel)
        ) === JSON.stringify(["Plan 2", "Plan 1"]),
        "Destination order differs from requested drop"
      )
      status.textContent =
        "Correcto: cinco movimientos atómicos, cancelación sin escritura, orden/categorías persistidos y resto intacto."
    } finally {
      repository.close()
      outbox.close()
    }
  })
}
const reloadLink = document.createElement("a")
reloadLink.textContent = "Recargar prueba"
reloadLink.href = `/?run=${runId}&phase=reload${categories ? "&categories=1" : ""}`
reloadLink.className =
  "mr-2 inline-flex min-h-11 items-center text-xs underline"
actions.append(reloadLink)
action("Limpiar prueba", async () => {
  assert(
    sessionStorage.getItem(marker) === "owned",
    "Cleanup ownership missing"
  )
  const current = await readAccountControl()
  assert(
    current.userId === userId &&
      current.epoch === account.epoch &&
      !current.logoutPending,
    "Cleanup cannot close a foreign account"
  )
  root.unmount()
  const hidden = await hideLocalAccount(),
    closed = await completeRemoteLogout(hidden.epoch)
  assert(
    closed.userId === null && !closed.logoutPending,
    "Owned account failed to close"
  )
  const changed = localStorage.getItem(changeKey)
  for (const name of [databaseName, ACCOUNT_CONTROL_DATABASE])
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      request.onblocked = () =>
        reject(new Error("Owned order fixture cleanup blocked"))
    })
  if (localStorage.getItem(changeKey) === changed) {
    const previous = JSON.parse(
      sessionStorage.getItem(`${marker}:previous-change`) ?? "null"
    ) as string | null
    if (previous === null) localStorage.removeItem(changeKey)
    else localStorage.setItem(changeKey, previous)
  }
  for (const suffix of ["", ":epoch", ":baseline", ":previous-change"])
    sessionStorage.removeItem(`${marker}${suffix}`)
  status.textContent = "Prueba y bases propias eliminadas."
})
