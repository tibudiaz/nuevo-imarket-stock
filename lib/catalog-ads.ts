export type CatalogAdType = "image" | "carousel" | "video"

export type CatalogAdConfig = {
  enabled: boolean
  type: CatalogAdType
  title?: string
  urls: string[]
}

const toStringValue = (value: unknown) => {
  if (value === null || typeof value === "undefined") return ""
  return String(value)
}

export const normalizeCatalogAdConfig = (data: unknown): CatalogAdConfig => {
  const raw = data && typeof data === "object" ? (data as Record<string, unknown>) : {}
  const rawType = toStringValue(raw.type).toLowerCase()
  const type: CatalogAdType =
    rawType === "video" || rawType === "carousel" || rawType === "image"
      ? (rawType as CatalogAdType)
      : "image"

  const urlsSource = Array.isArray(raw.urls)
    ? raw.urls
    : typeof raw.urls === "string"
      ? raw.urls.split(/[\n,]+/)
      : raw.url
        ? [raw.url]
        : []

  const urls = urlsSource
    .map((value) => toStringValue(value).trim())
    .filter((value) => value.length > 0)

  return {
    enabled: Boolean(raw.enabled),
    type,
    title: toStringValue(raw.title).trim() || undefined,
    urls,
  }
}

export const serializeCatalogAdUrls = (urls: string[]) => {
  return urls.map((url) => url.trim()).filter((url) => url.length > 0)
}
