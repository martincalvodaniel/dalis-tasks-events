export function OnlineEntry() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl items-center px-5 py-10">
      <section>
        <p className="text-sm font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
          Dalis
        </p>
        <h1 className="mt-4 text-3xl font-semibold">Tu espacio personal</h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          Abre tu espacio. Este dispositivo se preparará automáticamente con tu
          sesión para que puedas empezar a guardar tareas.
        </p>
        <a
          className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white"
          href="/workspace"
        >
          Abrir mi espacio
        </a>
      </section>
    </main>
  )
}
