export const workspaceDestinations = [
  {
    id: "overview",
    label: "Mi espacio",
    href: "/workspace",
    icon: "home",
    description: "Tareas, planes y fechas importantes, también sin conexión.",
  },
  {
    id: "calendar",
    label: "Calendario",
    href: "/workspace?view=calendar",
    icon: "calendar",
    description:
      "Tareas y eventos, mes a mes. Selecciona un día para organizarlo.",
  },
  {
    id: "tags",
    label: "Categorías",
    href: "/workspace?view=tags",
    icon: "tag",
    description: "Organiza tus tareas y eventos con categorías personales.",
  },
  {
    id: "settings",
    label: "Ajustes",
    href: "/workspace?view=settings",
    icon: "settings",
    description: "Tu cuenta y la preparación de este dispositivo.",
  },
] as const

export type WorkspaceView = (typeof workspaceDestinations)[number]["id"]
export type NavigationIconName = (typeof workspaceDestinations)[number]["icon"]

export function workspaceViewFromSearch(search: string): WorkspaceView {
  const requested = new URLSearchParams(search).get("view")
  return (
    workspaceDestinations.find((destination) => destination.id === requested)
      ?.id ?? "overview"
  )
}
