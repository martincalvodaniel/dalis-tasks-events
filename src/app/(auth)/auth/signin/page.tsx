import { redirect } from "next/navigation"
import { SignInCard } from "@/features/auth/components/sign-in-card"
import { getSafeCallbackUrl } from "@/lib/auth/callback-url"
import { getAuthorizedSession } from "@/lib/auth/session"

interface SignInPageProps {
  searchParams: Promise<{
    callbackUrl?: string | string[]
    error?: string | string[]
  }>
}

function getFirstValue(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function getErrorMessage(error: string | undefined): string | undefined {
  if (!error) {
    return undefined
  }

  return error === "AccessDenied"
    ? "Tu cuenta no tiene acceso a esta aplicación."
    : "No se ha podido iniciar sesión. Inténtalo de nuevo."
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const query = await searchParams
  const callbackUrl = getSafeCallbackUrl(getFirstValue(query.callbackUrl))
  const session = await getAuthorizedSession()

  if (session) {
    redirect(callbackUrl)
  }

  return (
    <SignInCard
      callbackUrl={callbackUrl}
      initialError={getErrorMessage(getFirstValue(query.error))}
    />
  )
}
