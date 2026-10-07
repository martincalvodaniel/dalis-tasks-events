import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { canPrepareOfflineShell } from "@/config/pwa"
import { assignLocalCategory, saveLocalTag } from "@/features/tags/local-tags"
import { createLocalTask } from "@/features/tasks/local-tasks"
import { Workspace } from "@/features/workspace/components/workspace"
import {
  loadLocalAccount,
  prepareLocalAccount,
} from "@/features/workspace/local-account"
import { addCivilDays, todayInTimeZone } from "@/lib/calendar/civil-date"
import { resolveEventSchedule } from "@/lib/calendar/event-time"
import {
  possibleZonedInstants,
  resolveZonedInstant,
  ZonedTimeError,
} from "@/lib/calendar/zoned-time"
import {
  ACCOUNT_CONTROL_DATABASE,
  completeRemoteLogout,
  hideLocalAccount,
  readAccountControl,
} from "@/lib/local-db/account-control"
import { localDatabaseName } from "@/lib/local-db/client"
import { LocalOutbox } from "@/lib/local-db/outbox"
import { LocalRepository } from "@/lib/local-db/repository"
import { compareRank } from "@/lib/ordering/rank"
import { runTouchDragChecks } from "./drag-handle"

if (
  location.hostname !== "127.0.0.1" ||
  !["4179", "4184"].includes(location.port)
)
  throw new Error("Workspace fixtures require an isolated loopback origin")

const host = document.getElementById("workspace")
if (host)
  createRoot(host).render(
    <StrictMode>
      <Workspace />
    </StrictMode>
  )
else
  void run().catch((error: unknown) => {
    console.error(error)
    const status = document.getElementById("status")
    if (status) status.textContent = "Ha fallado una comprobación."
  })

function assert(value: unknown): asserts value {
  if (!value) throw new Error("Workspace browser assertion failed")
}
async function check(label: string, work: () => Promise<void>) {
  const row = document.createElement("li")
  document.getElementById("results")?.append(row)
  row.textContent = label
  await work()
  row.textContent = `Correcto: ${label}`
}
async function session(state: "authorized" | "unauthorized", delay = false) {
  const response = await fetch(`/test/session?state=${state}&delay=${delay}`)
  return (await response.json()) as { userId: string }
}
async function requestStatus() {
  return (await (await fetch("/test/status")).json()) as {
    identityRequests: number
    waiting: boolean
  }
}
async function run() {
  const mode = new URLSearchParams(location.search).get("mode")
  if (mode === "event-time") {
    await check(
      "Zona explícita, offsets fraccionarios y años extremos",
      async () => {
        for (const [local, zone, expected] of [
          ["2026-10-07T00:00", "Asia/Kathmandu", "2026-10-06T18:15:00.000Z"],
          ["0001-01-01T00:00", "UTC", "0001-01-01T00:00:00.000Z"],
          ["0099-01-01T12:34", "UTC", "0099-01-01T12:34:00.000Z"],
          ["9999-12-31T23:59", "UTC", "9999-12-31T23:59:00.000Z"],
          ["1890-01-01T12:00", "Europe/Paris", "1890-01-01T11:50:39.000Z"],
        ])
          assert(
            new Date(resolveZonedInstant(local, zone)).toISOString() ===
              expected
          )
      }
    )
    await check(
      "Saltos, repeticiones y duración real sin elección silenciosa",
      async () => {
        for (const [local, zone] of [
          ["2026-03-29T02:30", "Europe/Madrid"],
          ["2026-10-04T02:15", "Australia/Lord_Howe"],
          ["2011-12-30T12:00", "Pacific/Apia"],
        ]) {
          assert(possibleZonedInstants(local, zone).length === 0)
          let reason: string | null = null
          try {
            resolveZonedInstant(local, zone)
          } catch (error) {
            assert(error instanceof ZonedTimeError)
            reason = error.reason
          }
          assert(reason === "nonexistent")
        }
        assert(
          possibleZonedInstants("2026-10-25T02:30", "Europe/Madrid").length ===
            2
        )
        assert(
          possibleZonedInstants("2026-04-05T01:45", "Australia/Lord_Howe")
            .length === 2
        )
        const schedule = resolveEventSchedule({
          mode: "timed",
          localStart: "2026-03-29T01:30",
          localEnd: "2026-03-29T03:30",
          timeZone: "Europe/Madrid",
        })
        assert(
          schedule.mode === "timed" && schedule.durationMilliseconds === 3600000
        )
        const point = resolveEventSchedule({
          mode: "timed",
          localStart: "2026-10-07T12:00",
          localEnd: null,
          timeZone: "UTC",
        })
        assert(
          point.mode === "timed" &&
            point.end === null &&
            point.durationMilliseconds === null
        )
      }
    )
    const status = document.getElementById("status")
    if (status)
      status.textContent =
        "Conversión temporal comprobada en este navegador, sin cuenta ni escrituras."
    return
  }
  if (mode === "drag-touch") {
    const actions = document.getElementById("actions")
    assert(actions)
    await runTouchDragChecks(actions)
    return
  }
  if (mode === "magnify") {
    const frame = document.createElement("iframe")
    frame.title = "Espacio con texto ampliado"
    frame.src =
      new URLSearchParams(location.search).get("view") === "tags"
        ? "/workspace?view=tags"
        : "/workspace"
    frame.style.width = "100%"
    frame.style.height = "1000px"
    frame.addEventListener("load", () => {
      const root = frame.contentDocument?.documentElement
      if (root) root.style.fontSize = "32px"
    })
    document.getElementById("actions")?.append(frame)
    return
  }
  if (mode === "clock") {
    const frame = document.createElement("iframe")
    frame.title = "Agenda con reloj de prueba"
    frame.src = "/workspace"
    frame.style.width = "100%"
    frame.style.height = "1000px"
    let advance: (() => void) | null = null
    frame.addEventListener("load", () => {
      const frameWindow = frame.contentWindow
      assert(frameWindow)
      let instant = Date.now()
      const simulatedDate = new Proxy(Date, {
        construct(target, argumentsList) {
          return Reflect.construct(
            target,
            argumentsList.length ? argumentsList : [instant]
          )
        },
        get(target, key) {
          return key === "now" ? () => instant : Reflect.get(target, key)
        },
      })
      Object.defineProperty(frameWindow, "Date", {
        value: simulatedDate,
        configurable: true,
      })
      advance = () => {
        instant += 86400000
        frameWindow.dispatchEvent(new Event("focus"))
      }
    })
    const button = document.createElement("button")
    button.textContent = "Avanzar un día de prueba"
    button.addEventListener("click", () => advance?.())
    document.getElementById("actions")?.append(button, frame)
    const status = document.getElementById("status")
    if (status)
      status.textContent = "Tiempo simulado únicamente en este iframe ficticio."
    return
  }
  const { userId } = await session(
    mode === "calendar" ||
      mode === "agenda" ||
      mode === "agenda-inspect" ||
      mode === "task-order" ||
      mode === "task-order-inspect" ||
      mode === "task-drag" ||
      mode === "task-drag-inspect" ||
      mode === "category-drag-inspect" ||
      mode === "category-order-inspect"
      ? "authorized"
      : "unauthorized"
  )
  if (mode === "category-drag-inspect") {
    const repository = await LocalRepository.open(userId)
    const outbox = await LocalOutbox.open(userId)
    try {
      const tags = (await repository.list("tags")).sort(compareRank)
      const entries = await outbox.listEntries()
      assert(tags.map((tag) => tag.name).join() === "Casa,Trabajo,Salud")
      assert(
        entries.length === 14 &&
          entries.filter((entry) => entry.operation.command.type === "tag.move")
            .length === 1
      )
      assert(
        (await repository.list("items")).length === 5 &&
          (await repository.list("taskPlacements")).length === 0
      )
      const status = document.getElementById("status")
      if (status)
        status.textContent =
          "Arrastre guardado una vez: categorías ordenadas, cinco tareas intactas y cancelación sin escrituras."
    } finally {
      repository.close()
      outbox.close()
    }
    return
  }
  if (mode === "compact-form-inspect") {
    const repository = await LocalRepository.open(userId)
    const outbox = await LocalOutbox.open(userId)
    try {
      const entries = await outbox.listEntries()
      const items = await repository.list("items")
      const item = items.find((record) => record.title === "Formulario editado")
      assert(
        entries.length === 3 &&
          entries.every((entry, index) => entry.sequence === index + 1)
      )
      assert(items.length === 2 && item?.kind === "task")
      assert(
        item.description === "Texto conservado" &&
          item.checklist.length === 1 &&
          item.checklist[0].text === "Paso conservado"
      )
      const status = document.getElementById("status")
      if (status)
        status.textContent =
          "Formulario compacto comprobado: cancelar y validar no escriben; crear y editar conservan campos plegados en tres intenciones totales."
    } finally {
      repository.close()
      outbox.close()
    }
    return
  }
  if (mode === "compact-inspect") {
    const button = document.createElement("button")
    button.textContent = "Comprobar agenda compacta"
    button.onclick = async () => {
      const repository = await LocalRepository.open(userId)
      const outbox = await LocalOutbox.open(userId)
      try {
        const items = await repository.list("items", { includeDeleted: true })
        const entries = await outbox.listEntries()
        const tags = (await repository.list("tags")).sort(compareRank)
        const views = await repository.list("itemViews")
        assert(
          entries.length === 25 &&
            entries.every((entry, index) => entry.sequence === index + 1)
        )
        assert(
          items.length === 7 &&
            items.filter((item) => !item.deletedAt).length === 6
        )
        const sent = items.find((item) => item.title === "Enviar informe")
        const notes = items.find((item) => item.title === "Revisar notas")
        const tomorrow = items.find((item) => item.title === "Mañana sin mover")
        assert(
          sent?.kind === "task" &&
            sent.status === "in_progress" &&
            sent.description === "Detalle compacto" &&
            sent.checklist[0]?.completed
        )
        assert(notes?.kind === "task" && notes.status === "not_started")
        assert(
          tomorrow?.deletedAt &&
            items.some((item) => item.title === "Nueva compacta")
        )
        assert(
          tags[0].name === "Casa" &&
            views.find((view) => view.itemId === notes.id)?.primaryTagId ===
              tags[0].id
        )
        const recent = entries
          .slice(15)
          .map((entry) => entry.operation.command.type)
        assert(recent.filter((type) => type === "task.set-status").length === 3)
        assert(recent.filter((type) => type === "task.move").length === 2)
        assert(recent.filter((type) => type === "tag.move").length === 1)
        const status = document.getElementById("status")
        if (status)
          status.textContent =
            "Agenda compacta comprobada: veinticinco intenciones, estados, checklist, categoría, orden y CRUD persistidos."
      } finally {
        repository.close()
        outbox.close()
      }
    }
    document.getElementById("actions")?.append(button)
    return
  }
  if (mode === "task-drag-inspect") {
    const repository = await LocalRepository.open(userId)
    const outbox = await LocalOutbox.open(userId)
    try {
      const settings = await repository.get("settings", userId)
      assert(settings)
      const today = todayInTimeZone(settings.timeZone)
      const items = await repository.list("items")
      const tags = (await repository.list("tags")).sort(compareRank)
      const entries = await outbox.listEntries()
      const placements = await repository.list("taskPlacements")
      const views = await repository.list("itemViews")
      assert(
        items.length === 6 && placements.length === 5 && views.length === 6
      )
      assert(tags.map((tag) => tag.name).join() === "Casa,Trabajo,Salud")
      assert(
        entries.length === 19 &&
          entries.every((entry, index) => entry.sequence === index + 1)
      )
      assert(
        entries.filter((entry) => entry.operation.command.type === "task.move")
          .length === 3
      )
      assert(
        entries.filter((entry) => entry.operation.command.type === "tag.move")
          .length === 1
      )
      for (const item of items) {
        assert(item.kind === "task")
        const expectedDate =
          item.title === "Pendiente de ayer"
            ? addCivilDays(today, -1)
            : item.title === "Pendiente de anteayer"
              ? addCivilDays(today, -2)
              : item.title === "Mañana sin mover"
                ? addCivilDays(today, 1)
                : today
        assert(
          item.scheduledDate === expectedDate &&
            item.status ===
              (item.title === "Pendiente de ayer"
                ? "in_progress"
                : "not_started")
        )
      }
      const moved = items.find((item) => item.title === "Revisar notas")
      assert(
        views.find((view) => view.itemId === moved?.id)?.primaryTagId ===
          tags[0].id
      )
      assert(
        placements.filter((placement) => placement.scope === "day").length === 3
      )
      const status = document.getElementById("status")
      if (status)
        status.textContent =
          "Arrastre de agenda comprobado: diecinueve intenciones, seis fechas intactas y rechazo entre días sin escritura."
    } finally {
      repository.close()
      outbox.close()
    }
    return
  }
  if (
    mode === "task-order" ||
    mode === "task-order-inspect" ||
    mode === "task-drag"
  ) {
    const state = await loadLocalAccount()
    assert(state.account?.userId === userId)
    const account = state.account
    const repository = await LocalRepository.open(userId)
    const outbox = await LocalOutbox.open(userId)
    try {
      const settings = await repository.get("settings", userId)
      assert(settings)
      const today = todayInTimeZone(settings.timeZone)
      if (mode === "task-order" || mode === "task-drag") {
        assert((await repository.list("tags")).length === 0)
        const baseline = (await repository.list("items"))[0]
        assert(baseline?.kind === "task")
        const workId = crypto.randomUUID()
        for (const [name, id, position] of [
          ["Trabajo", workId, 0],
          ["Salud", crypto.randomUUID(), 1],
          ["Casa", crypto.randomUUID(), 2],
        ] as const)
          await saveLocalTag(
            account,
            id,
            { name, color: "#059669", position },
            crypto.randomUUID()
          )
        await assignLocalCategory(
          account,
          baseline.id,
          workId,
          crypto.randomUUID()
        )
        for (const [title, date, status] of [
          ["Revisar notas", today, "not_started"],
          ["Enviar informe", today, "not_started"],
          ["Pendiente de ayer", addCivilDays(today, -1), "in_progress"],
          ["Pendiente de anteayer", addCivilDays(today, -2), "not_started"],
        ] as const) {
          const id = crypto.randomUUID()
          await createLocalTask(
            account,
            {
              kind: "task",
              title,
              description: "",
              scheduledDate: date,
              status,
              checklist: [],
              recurrence: null,
            },
            id,
            crypto.randomUUID()
          )
          await assignLocalCategory(account, id, workId, crypto.randomUUID())
        }
        assert((await outbox.listEntries()).length === 13)
        if (mode === "task-drag") {
          const id = crypto.randomUUID()
          await createLocalTask(
            account,
            {
              kind: "task",
              title: "Mañana sin mover",
              description: "",
              scheduledDate: addCivilDays(today, 1),
              status: "not_started",
              checklist: [],
              recurrence: null,
            },
            id,
            crypto.randomUUID()
          )
          await assignLocalCategory(account, id, workId, crypto.randomUUID())
          assert((await outbox.listEntries()).length === 15)
        }
      } else {
        const items = await repository.list("items")
        const tags = (await repository.list("tags")).sort(compareRank)
        const views = await repository.list("itemViews")
        const placements = await repository.list("taskPlacements")
        const entries = await outbox.listEntries()
        assert(
          items.length === 5 && views.length === 5 && placements.length === 5
        )
        assert(
          JSON.stringify(tags.map((tag) => tag.name)) ===
            JSON.stringify(["Casa", "Trabajo", "Salud"])
        )
        assert(
          entries.length === 19 &&
            entries.every((entry, index) => entry.sequence === index + 1)
        )
        assert(
          entries.filter(
            (entry) => entry.operation.command.type === "task.move"
          ).length === 4
        )
        assert(
          entries.filter((entry) => entry.operation.command.type === "tag.move")
            .length === 1
        )
        assert(entries.at(-1)?.operation.command.type === "task.set-status")
        const sent = items.find((item) => item.title === "Enviar informe")
        const completed = items.find(
          (item) => item.title === "Pendiente de ayer"
        )
        const late = items.find(
          (item) => item.title === "Pendiente de anteayer"
        )
        assert(
          sent?.kind === "task" &&
            completed?.kind === "task" &&
            late?.kind === "task"
        )
        assert(sent.scheduledDate === today && sent.status === "not_started")
        assert(
          completed.scheduledDate === addCivilDays(today, -1) &&
            completed.status === "completed"
        )
        assert(
          late.scheduledDate === addCivilDays(today, -2) &&
            late.status === "not_started"
        )
        assert(
          views.find((view) => view.itemId === sent.id)?.primaryTagId ===
            tags[0].id
        )
        assert(
          placements.find((placement) => placement.occurrenceId === sent.id)
            ?.tagId === tags[0].id
        )
        assert(
          placements.filter((placement) => placement.scope === "day").length ===
            3
        )
        assert(
          placements
            .filter((placement) => placement.scope === "overdue")
            .every((placement) => placement.date === "0001-01-01")
        )
      }
    } finally {
      repository.close()
      outbox.close()
    }
    const status = document.getElementById("status")
    if (status)
      status.textContent =
        mode === "task-drag"
          ? "Agenda de arrastre preparada: seis tareas, tres categorías y quince intenciones."
          : mode === "task-order"
            ? "Agenda de orden preparada: cinco tareas, tres categorías y trece intenciones."
            : "Orden comprobado: diecinueve intenciones, cinco posiciones y fechas conservadas."
    const link = document.createElement("a")
    link.href = "/workspace"
    link.textContent = "Abrir agenda"
    document.getElementById("actions")?.append(link)
    return
  }
  if (mode === "category-order-inspect") {
    const repository = await LocalRepository.open(userId)
    const outbox = await LocalOutbox.open(userId)
    try {
      const tags = (await repository.list("tags")).sort(compareRank)
      assert(
        JSON.stringify(tags.map((tag) => tag.name)) ===
          JSON.stringify(["Casa", "Trabajo", "Familia"])
      )
      const entries = await outbox.listEntries()
      assert(
        entries.length === 9 &&
          entries.every((entry, index) => entry.sequence === index + 1)
      )
      assert(
        entries.filter((entry) => entry.operation.command.type === "tag.move")
          .length === 4
      )
      const items = await repository.list("items")
      assert(
        items.length === 1 &&
          items[0].kind === "task" &&
          items[0].status === "not_started"
      )
      const status = document.getElementById("status")
      if (status)
        status.textContent =
          "Orden conservado: cuatro movimientos, una intención por movimiento y tarea intacta."
    } finally {
      repository.close()
      outbox.close()
    }
    return
  }
  if (mode === "agenda" || mode === "agenda-inspect") {
    const state = await loadLocalAccount()
    assert(state.account?.userId === userId)
    const account = state.account
    const repository = await LocalRepository.open(userId)
    const outbox = await LocalOutbox.open(userId)
    try {
      const settings = await repository.get("settings", userId)
      assert(settings)
      const today = todayInTimeZone(settings.timeZone)
      if (mode === "agenda") {
        assert((await repository.list("tags")).length === 0)
        const baseline = (await repository.list("items"))[0]
        assert(baseline?.kind === "task")
        const tagId = crypto.randomUUID()
        await saveLocalTag(
          account,
          tagId,
          { name: "Trabajo", color: "#059669", position: 0 },
          crypto.randomUUID()
        )
        await assignLocalCategory(
          account,
          baseline.id,
          tagId,
          crypto.randomUUID()
        )
        for (const [title, date, status] of [
          ["Pendiente de ayer", addCivilDays(today, -1), "in_progress"],
          ["Hecha ayer", addCivilDays(today, -1), "completed"],
          ["Comprar pan", today, "not_started"],
        ] as const) {
          const id = crypto.randomUUID()
          await createLocalTask(
            account,
            {
              kind: "task",
              title,
              description: "",
              scheduledDate: date,
              status,
              checklist: [],
              recurrence: null,
            },
            id,
            crypto.randomUUID()
          )
          if (title === "Pendiente de ayer")
            await assignLocalCategory(account, id, tagId, crypto.randomUUID())
        }
      } else
        await check(
          "Completar conserva fecha y el reloj no añade intenciones",
          async () => {
            const items = await repository.list("items")
            const late = items.find(
              (item) => item.title === "Pendiente de ayer"
            )
            assert(items.length === 4 && late?.kind === "task")
            assert(
              late.status === "completed" &&
                late.scheduledDate === addCivilDays(today, -1)
            )
            const entries = await outbox.listEntries()
            assert(
              entries.length === 8 &&
                entries.at(-1)?.operation.command.type === "task.set-status"
            )
          }
        )
    } finally {
      repository.close()
      outbox.close()
    }
    const status = document.getElementById("status")
    if (status)
      status.textContent =
        mode === "agenda"
          ? "Agenda ficticia preparada."
          : "Datos, fecha y cola comprobados."
    const link = document.createElement("a")
    link.href = "/workspace"
    link.textContent = "Abrir agenda"
    document.getElementById("actions")?.append(link)
    return
  }
  if (mode === "calendar") {
    const control = await readAccountControl()
    assert(control.userId === userId && !control.logoutPending)
    await check(
      "Crear desde el día conserva fecha, tarea y outbox tras recarga",
      async () => {
        const repository = await LocalRepository.open(userId)
        const outbox = await LocalOutbox.open(userId)
        try {
          const tasks = await repository.list("items")
          assert(tasks.length === 2)
          const created = tasks.find((item) => item.title === "Plan del sábado")
          assert(
            created?.kind === "task" && created.scheduledDate === "2026-10-10"
          )
          const entries = await outbox.listEntries()
          assert(
            entries.length === 2 &&
              entries.some(
                (entry) =>
                  entry.operation.command.type === "item.create" &&
                  entry.operation.command.itemId === created.id
              )
          )
        } finally {
          repository.close()
          outbox.close()
        }
      }
    )
    const status = document.getElementById("status")
    if (status) status.textContent = "Creación desde calendario comprobada."
    return
  }
  if (mode === "cleanup") {
    const current = await readAccountControl()
    assert(current.userId === null || current.userId === userId)
    for (const name of [localDatabaseName(userId), ACCOUNT_CONTROL_DATABASE])
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(name)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
        request.onblocked = () => reject(new Error("Fixture cleanup blocked"))
      })
    const status = document.getElementById("status")
    for (const registration of await navigator.serviceWorker.getRegistrations())
      if (registration.active?.scriptURL === `${location.origin}/dalis-sw.js`)
        await registration.unregister()
    for (const key of await caches.keys())
      if (key.startsWith("dalis-shell:")) await caches.delete(key)
    if (status) status.textContent = "Datos ficticios limpiados."
    return
  }
  assert(!(await readAccountControl()).userId)
  await check(
    "Sin sesión: solicita Google y no activa ninguna cuenta",
    async () => {
      const state = await loadLocalAccount()
      assert(
        !state.account && state.authenticationRequired && !state.logoutPending
      )
    }
  )
  if (canPrepareOfflineShell) {
    await check("Producción no activa datos si falta el worker", async () => {
      await fetch("/test/session?state=authorized&worker=missing")
      let rejected = false
      try {
        await loadLocalAccount()
      } catch {
        rejected = true
      }
      assert(rejected && !(await readAccountControl()).userId)
    })
  }
  await session("authorized")
  await check(
    canPrepareOfflineShell
      ? "Sesión autorizada prepara automáticamente el shell de producción"
      : "Sesión autorizada prepara automáticamente sin worker en desarrollo",
    async () => {
      const state = await loadLocalAccount()
      assert(
        state.account?.userId === userId &&
          state.account.offlineReady === canPrepareOfflineShell
      )
      assert(
        Boolean(await navigator.serviceWorker.getRegistration("/workspace")) ===
          canPrepareOfflineShell
      )
      await createLocalTask(
        state.account,
        {
          kind: "task",
          title: "Probar mi espacio local",
          description: "",
          scheduledDate: todayInTimeZone(
            Intl.DateTimeFormat().resolvedOptions().timeZone
          ),
          status: "not_started",
          checklist: [],
          recurrence: null,
        },
        crypto.randomUUID(),
        crypto.randomUUID()
      )
    }
  )
  await session("unauthorized")
  await check(
    "Restaurar conserva tarea y no depende de la sesión remota",
    async () => {
      const before = await requestStatus()
      const state = await loadLocalAccount()
      assert(
        state.account?.itemCount === 1 &&
          state.account.offlineReady === canPrepareOfflineShell
      )
      assert(
        (await requestStatus()).identityRequests === before.identityRequests
      )
    }
  )
  await check(
    "Cierre pendiente no inicia preparación ni descarta la cola",
    async () => {
      const control = await hideLocalAccount()
      const before = await requestStatus()
      const state = await loadLocalAccount()
      assert(!state.account && state.logoutPending)
      assert(
        (await requestStatus()).identityRequests === before.identityRequests
      )
      const outbox = await LocalOutbox.open(userId)
      try {
        assert((await outbox.listEntries()).length === 1)
      } finally {
        outbox.close()
      }
      await completeRemoteLogout(control.epoch)
    }
  )
  await check(
    "Cerrar durante una respuesta de identidad impide reactivación",
    async () => {
      await session("authorized", true)
      const control = await readAccountControl()
      const preparation = prepareLocalAccount(control.epoch).then(
        () => false,
        () => true
      )
      for (
        let attempt = 0;
        attempt < 100 && !(await requestStatus()).waiting;
        attempt++
      )
        await new Promise((resolve) => setTimeout(resolve, 10))
      assert((await requestStatus()).waiting)
      const hidden = await hideLocalAccount()
      await fetch("/test/release")
      assert(await preparation)
      assert((await readAccountControl()).logoutPending)
      await completeRemoteLogout(hidden.epoch)
    }
  )
  await session("authorized")
  const status = document.getElementById("status")
  if (status)
    status.textContent = `${canPrepareOfflineShell ? "Seis" : "Cinco"} comprobaciones aprobadas. Abrir el espacio sin preparación manual.`
  const link = document.createElement("a")
  link.href = "/workspace"
  link.textContent = "Abrir espacio con sesión ficticia"
  document.getElementById("actions")?.append(link)
}
