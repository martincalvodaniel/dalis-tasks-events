"use client"

export function navigateWorkspace(href: string) {
  const url = new URL(href, window.location.href)
  if (
    url.origin !== window.location.origin ||
    url.pathname !== "/workspace" ||
    url.hash
  )
    return false
  if (url.href !== window.location.href) {
    window.history.pushState(null, "", url.pathname + url.search)
    window.dispatchEvent(new PopStateEvent("popstate"))
  }
  return true
}

export function handleWorkspaceNavigation(event: MouseEvent) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return
  if (!(event.target instanceof Element)) return
  const link = event.target.closest("a")
  if (
    !link ||
    link.hasAttribute("download") ||
    (link.target && link.target !== "_self")
  )
    return
  const href = link.getAttribute("href")
  if (!href || href.startsWith("#")) return
  const url = new URL(href, window.location.href)
  if (
    url.origin !== window.location.origin ||
    url.pathname !== "/workspace" ||
    url.hash
  )
    return
  event.preventDefault()
  navigateWorkspace(href)
}
