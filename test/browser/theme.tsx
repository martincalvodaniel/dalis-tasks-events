import { createRoot } from "react-dom/client"
import { THEME_CHANGE_EVENT, THEME_STORAGE_KEY } from "@/config/theme"
import { ThemeSettings } from "@/features/workspace/components/theme-settings"

if (location.hostname !== "127.0.0.1" || location.port !== "4268")
  throw new Error("Theme proof requires its isolated loopback origin")
const marker = "dalis:theme-fixture-owned"
if (
  !localStorage.getItem(marker) &&
  localStorage.getItem(THEME_STORAGE_KEY) !== null
)
  throw new Error("Foreign theme preference blocks this fixture")
localStorage.setItem(marker, "owned")
const setItem = Storage.prototype.setItem
export function ThemeFixture() {
  function blockStorage() {
    Storage.prototype.setItem = () => {
      throw new Error("Fixture storage unavailable")
    }
  }
  function clean() {
    Storage.prototype.setItem = setItem
    localStorage.removeItem(THEME_STORAGE_KEY)
    localStorage.removeItem(marker)
    document.documentElement.setAttribute("data-theme", "system")
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
  }
  return (
    <main className="dalis-compact-controls mx-auto max-w-sm">
      <h1 className="mb-3 text-base font-semibold">Ajustes · prueba aislada</h1>
      <ThemeSettings />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Preferencia de este dispositivo. Sin conexión a ninguna base de datos.
      </p>
      <button
        type="button"
        onClick={blockStorage}
        className="mt-4 min-h-11 rounded border px-3"
      >
        Simular almacenamiento bloqueado
      </button>
      <button
        type="button"
        onClick={clean}
        className="mt-2 min-h-11 rounded border px-3"
      >
        Limpiar prueba
      </button>
    </main>
  )
}
const root = document.getElementById("root")
if (!root) throw new Error("Theme fixture root is missing")
createRoot(root).render(<ThemeFixture />)
