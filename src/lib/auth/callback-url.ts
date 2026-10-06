const DEFAULT_CALLBACK_URL = "/"

export function getSafeCallbackUrl(value: string | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_CALLBACK_URL
  }

  return value
}
