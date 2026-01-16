const normalizeUrl = (url: string) => {
  const trimmed = url.trim()
  const candidates = [trimmed]

  if (!/^https?:\/\//i.test(trimmed)) {
    const isLocalHost = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/|$)/i.test(trimmed)
    candidates.unshift(`${isLocalHost ? "http" : "https"}://${trimmed}`)
  }

  for (const candidate of candidates) {
    try {
      const parsed = new URL(candidate)
      return parsed.origin.replace(/\/$/, "")
    } catch (error) {
      console.warn("URL inválida para NEXT_PUBLIC_APP_BASE_URL:", error)
    }
  }

  return null
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
