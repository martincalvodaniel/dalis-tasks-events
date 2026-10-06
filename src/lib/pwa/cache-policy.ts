export function offlineCacheKey(
  request: { method: string; url: string; mode: string },
  origin: string,
  assets: ReadonlySet<string>
): string | null {
  if (request.method !== "GET") return null
  const url = new URL(request.url)
  if (url.origin !== origin) return null
  if (
    request.mode === "navigate" &&
    (url.pathname === "/workspace" || url.pathname === "/workspace/")
  )
    return "/workspace"
  if (url.pathname === "/workspace" || url.search) return null
  return assets.has(url.pathname) ? url.pathname : null
}
