const normalizeUrl = (url: string) => {
  try {
    const parsed = new URL(url)
    return parsed.origin.replace(/\/$/, "")
  } catch (error) {
    console.warn("URL inválida para NEXT_PUBLIC_APP_BASE_URL:", error)
    return null
  }
}

let cachedOrigin: string | null = null

export const getAppBaseUrl = () => {
  if (cachedOrigin) {
    return cachedOrigin
  }

  const configuredBaseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL?.trim()
  if (configuredBaseUrl) {
    const normalized = normalizeUrl(configuredBaseUrl)
    if (normalized) {
      cachedOrigin = normalized
      return cachedOrigin
    }
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    cachedOrigin = window.location.origin
    return cachedOrigin
  }

  return ""
}
