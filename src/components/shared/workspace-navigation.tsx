import type { ReactNode } from "react"
import { NavigationLinks } from "@/components/shared/navigation-links"
import type { WorkspaceView } from "@/config/navigation"

export function WorkspaceNavigation({
  activeView,
  createAction,
}: {
  activeView: WorkspaceView
  createAction?: ReactNode
}) {
  return (
    <>
      <header className="hidden border-b border-zinc-200 bg-white md:block dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <a
            href="/workspace"
            aria-label="Dalis, ir a mi espacio"
            className="text-lg font-bold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700"
          >
            Dalis
          </a>
          <nav
            aria-label="Navegación principal"
            className="flex min-w-0 items-center gap-2 lg:gap-4"
          >
            <NavigationLinks activeView={activeView} />
            {createAction}
          </nav>
        </div>
      </header>
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t border-zinc-200 bg-white px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="min-w-0 flex-1">
          <NavigationLinks activeView={activeView} mobile />
        </div>
        {createAction}
      </nav>
    </>
  )
}
