import { NavigationLinks } from "@/components/shared/navigation-links"
import type { WorkspaceView } from "@/config/navigation"

export function WorkspaceNavigation({
  activeView,
}: {
  activeView: WorkspaceView
}) {
  return (
    <>
      <header className="hidden border-b border-zinc-200 bg-white md:block dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-8 py-4">
          <a
            href="/workspace"
            aria-label="Dalis, ir a mi espacio"
            className="text-lg font-bold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700"
          >
            Dalis
          </a>
          <nav aria-label="Navegación principal">
            <NavigationLinks activeView={activeView} />
          </nav>
        </div>
      </header>
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden dark:border-zinc-800 dark:bg-zinc-900"
      >
        <NavigationLinks activeView={activeView} mobile />
      </nav>
    </>
  )
}
