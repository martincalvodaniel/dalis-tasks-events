const previewOrigin =
  "https://dalis-tasks-events-git-int-martincalvodaniels-projects.vercel.app"

export function allowsCommonPlanLocalReset(origin: string): boolean {
  if (origin === previewOrigin) return true
  try {
    const url = new URL(origin)
    return (
      url.origin === origin &&
      url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost")
    )
  } catch {
    return false
  }
}
