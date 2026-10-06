import { localDatabaseName, openLocalDatabase } from "@/lib/local-db/client"
import { LOCAL_DATABASE_VERSION } from "@/lib/local-db/migrations"
import { LocalRepository } from "@/lib/local-db/repository"
import { runLocalTransaction } from "@/lib/local-db/transaction"
import { taskSchema } from "@/schemas/calendar-item"
import { entityIdSchema } from "@/schemas/primitives"

const query = new URLSearchParams(location.search)
const runId = entityIdSchema.parse(query.get("run") ?? crypto.randomUUID())
const userA = `browser-test-${runId}-alpha`
const userB = `browser-test-${runId}-beta`
const futureUser = `browser-test-${runId}-future`
const itemId = "65d05aa8-2ed7-4328-9056-8057f00c1bb8"
const metadata = {
  revision: 0,
  createdAt: "2026-10-06T00:00:00.000Z",
  updatedAt: "2026-10-06T00:00:00.000Z",
  deletedAt: null,
}
const task = taskSchema.parse({
  ...metadata,
  id: itemId,
  ownerId: userA,
  kind: "task",
  title: "Test task",
  description: "",
  scheduledDate: "2026-10-06",
  status: "not_started",
  checklist: [],
  recurrence: null,
  completedAt: null,
})
const results = document.getElementById("results")
const status = document.getElementById("status")
const actions = document.getElementById("actions")
if (!results || !status || !actions)
  throw new Error("Test fixture markup is missing")
const resultList = results
const statusElement = status
const actionContainer = actions

function assert(condition: unknown): asserts condition {
  if (!condition) throw new Error("Browser storage assertion failed")
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
  row.textContent = label
  resultList.append(row)
  try {
    await work()
    row.textContent = `Correcto: ${label}`
  } catch (error) {
    row.textContent = `Falló: ${label}`
    throw error
  }
}

async function cleanup() {
  for (const user of [userA, userB, futureUser]) {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(localDatabaseName(user))
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error("Test cleanup blocked"))
    })
  }
}

async function runChecks() {
  const a = await LocalRepository.open(userA)
  const b = await LocalRepository.open(userB)
  try {
    if (query.get("phase") === "reload") {
      await check("Cambios conservados tras recargar la página", async () => {
        const restored = await a.get("items", itemId)
        assert(restored?.title === "Edited test task")
        assert(restored.deletedAt === "2026-10-07T00:00:00.000Z")
        assert((await a.list("items")).length === 0)
        assert((await a.list("items", { includeDeleted: true })).length === 1)
        assert(
          (await b.get("items", itemId))?.title === "Different account task"
        )
      })
      statusElement.textContent =
        "Recarga verificada. Todas las pruebas han pasado."
      const button = document.createElement("button")
      button.textContent = "Limpiar bases de prueba"
      button.onclick = async () => {
        a.close()
        b.close()
        await cleanup()
        statusElement.textContent =
          "Bases de prueba eliminadas. Comprobación terminada."
        button.disabled = true
      }
      actionContainer.append(button)
      return
    }

    await check("Crear, leer y editar una tarea", async () => {
      await a.put("items", task)
      assert((await a.get("items", itemId))?.title === task.title)
      await a.put("items", {
        ...task,
        title: "Edited test task",
        status: "in_progress",
      })
      assert((await a.get("items", itemId))?.title === "Edited test task")
    })
    await check("Dos cuentas con el mismo ID permanecen aisladas", async () => {
      assert((await b.get("items", itemId)) === null)
      await b.put("items", {
        ...task,
        ownerId: userB,
        title: "Different account task",
      })
      assert((await a.get("items", itemId))?.title === "Edited test task")
      assert((await b.get("items", itemId))?.title === "Different account task")
      await rejects(() =>
        a.put("settings", {
          ...metadata,
          userId: userB,
          timeZone: "Europe/Madrid",
          weekStartsOn: 1,
          locale: "es-ES",
        })
      )
    })
    await check("Migración inicial e índices de consulta", async () => {
      const database = await openLocalDatabase(userA)
      assert(database.version === LOCAL_DATABASE_VERSION)
      assert(database.objectStoreNames.length === 8)
      database.close()
      const indexed = await a.list("items", {
        index: "byTaskDate",
        query: ["task", "2026-10-06"],
      })
      assert(indexed.length === 1)
    })
    await check("Abortar no confirma ni conserva una escritura", async () => {
      const database = await openLocalDatabase(userA)
      try {
        await rejects(() =>
          runLocalTransaction(database, ["items"], "readwrite", (context) => {
            context.transaction
              .objectStore("items")
              .put({ ...task, title: "Aborted edit" })
            context.setResult(true)
            context.fail(new Error("Intentional test abort"))
          })
        )
        await rejects(() =>
          runLocalTransaction(database, ["items"], "readwrite", (context) => {
            context.transaction.objectStore("items").add(task)
            context.setResult(true)
          })
        )
        assert((await a.get("items", itemId))?.title === "Edited test task")
      } finally {
        database.close()
      }
    })
    await check(
      "Validación rechaza registros incompatibles sin guardarlos",
      async () => {
        await rejects(() => a.put("items", { ...task, title: "" }))
        assert((await a.get("items", itemId))?.title === "Edited test task")
      }
    )
    await check("Una versión futura se rechaza sin borrar datos", async () => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(
          localDatabaseName(futureUser),
          LOCAL_DATABASE_VERSION + 1
        )
        request.onupgradeneeded = () =>
          request.result.createObjectStore("future")
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      await runLocalTransaction(
        database,
        ["future"],
        "readwrite",
        (context) => {
          context.transaction.objectStore("future").put("preserved", "sentinel")
          context.setResult(true)
        }
      )
      database.close()
      await rejects(() => LocalRepository.open(futureUser))
      const reopened = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(localDatabaseName(futureUser))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      const value = await runLocalTransaction(
        reopened,
        ["future"],
        "readonly",
        (context) => {
          const request = context.transaction
            .objectStore("future")
            .get("sentinel")
          request.onsuccess = () => context.setResult(request.result)
        }
      )
      assert(value === "preserved")
      reopened.close()
    })
    await check(
      "Borrado lógico conserva la tarea y la oculta del listado",
      async () => {
        await a.tombstone("items", itemId, "2026-10-07T00:00:00.000Z")
        assert((await a.list("items")).length === 0)
        const deleted = await a.get("items", itemId)
        assert(deleted?.deletedAt === "2026-10-07T00:00:00.000Z")
        assert(deleted.kind === "task" && deleted.status === "in_progress")
      }
    )
    statusElement.textContent =
      "Siete pruebas correctas. Falta comprobar la recarga."
    const link = document.createElement("a")
    link.href = `/?phase=reload&run=${runId}`
    link.textContent = "Verificar tras recarga"
    actionContainer.append(link)
  } finally {
    a.close()
    b.close()
  }
}

runChecks().catch(() => {
  statusElement.textContent = "Una prueba ha fallado. Revisar el caso indicado."
})
