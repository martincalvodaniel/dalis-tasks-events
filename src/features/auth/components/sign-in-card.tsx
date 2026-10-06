"use client"

import { useState } from "react"
import { ErrorBanner } from "@/components/ui/error-banner"
import { completePendingRemoteLogout } from "@/features/auth/pending-logout"
import { authClient } from "@/lib/auth/auth-client"

interface SignInCardProps {
  callbackUrl: string
  initialError?: string
}

export function SignInCard({ callbackUrl, initialError }: SignInCardProps) {
  const [error, setError] = useState(initialError)
  const [isPending, setIsPending] = useState(false)

  async function handleSignIn(): Promise<void> {
    setError(undefined)
    setIsPending(true)

    try {
      await completePendingRemoteLogout()
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: callbackUrl,
      })

      if (result.error) {
        setError("No se ha podido conectar con Google. Inténtalo de nuevo.")
        setIsPending(false)
      }
    } catch {
      setError("No se ha podido conectar con Google. Inténtalo de nuevo.")
      setIsPending(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
      <section className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-7 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
            Dalis Tasks & Events
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Bienvenido de nuevo
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Inicia sesión para acceder a la gestión del hogar.
          </p>
        </div>

        {error ? <ErrorBanner>{error}</ErrorBanner> : null}

        <button
          type="button"
          onClick={handleSignIn}
          disabled={isPending}
          className="mt-5 flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 dark:focus:ring-offset-zinc-900"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          {isPending ? "Conectando…" : "Continuar con Google"}
        </button>
      </section>
    </main>
  )
}
