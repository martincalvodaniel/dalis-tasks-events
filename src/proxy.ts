import { getSessionCookie } from "better-auth/cookies"
import { type NextRequest, NextResponse } from "next/server"

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (
    pathname === "/workspace" ||
    pathname === "/api/sync/identity" ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/auth")
  ) {
    return NextResponse.next()
  }

  if (getSessionCookie(request)) {
    return NextResponse.next()
  }

  const signInUrl = new URL("/auth/signin", request.url)
  signInUrl.searchParams.set("callbackUrl", `${pathname}${search}`)

  return NextResponse.redirect(signInUrl)
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|.*\\..*).*)"],
}
