export type CatalogAdType = "image" | "carousel" | "video"

export type CatalogAdPage = "landing" | "landingBottom" | "nuevos" | "usados"

export type CatalogAdAsset = {
  url: string
  path?: string
  name?: string
  type?: string
}

export type CatalogAdConfig = {
  enabled: boolean
  type: CatalogAdType
  title?: string
  carouselIntervalSeconds?: number
  urls: string[]
  assets?: CatalogAdAsset[]
}

const toStringValue = (value: unknown) => {
  if (value === null || typeof value === "undefined") return ""
  return String(value)
}

const toArrayValue = (value: unknown) => {
  if (Array.isArray(value)) return value
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
  }
  return []
}

const toNumberValue = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value.replace(",", "."))
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

export const normalizeCatalogAdConfig = (data: unknown): CatalogAdConfig => {
  const raw = data && typeof data === "object" ? (data as Record<string, unknown>) : {}
  const rawType = toStringValue(raw.type).toLowerCase()
  const type: CatalogAdType =
    rawType === "video" || rawType === "carousel" || rawType === "image"
      ? (rawType as CatalogAdType)
      : "image"

  const assetsSource = toArrayValue(raw.assets)
  const normalizedAssets = assetsSource
    .map((asset) => {
      if (!asset || typeof asset !== "object") return null
      const assetRecord = asset as Record<string, unknown>
      const url = toStringValue(assetRecord.url).trim()
      if (!url) return null
      return {
        url,
        path: toStringValue(assetRecord.path).trim() || undefined,
        name: toStringValue(assetRecord.name).trim() || undefined,
        type: toStringValue(assetRecord.type).trim() || undefined,
      } satisfies CatalogAdAsset
    })
    .filter((asset): asset is CatalogAdAsset => Boolean(asset))

  const urlsSource =
    normalizedAssets.length > 0
      ? normalizedAssets.map((asset) => asset.url)
      : toArrayValue(raw.urls).length > 0
        ? toArrayValue(raw.urls)
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
    carouselIntervalSeconds: (() => {
      const intervalSeconds = toNumberValue(raw.carouselIntervalSeconds)
      if (intervalSeconds && intervalSeconds > 0) return intervalSeconds
      const intervalMs = toNumberValue(raw.carouselIntervalMs)
      if (intervalMs && intervalMs > 0) return intervalMs / 1000
      return undefined
    })(),
    urls,
    assets: normalizedAssets.length > 0 ? normalizedAssets : undefined,
  }
}

export const serializeCatalogAdUrls = (urls: string[]) => {
  return urls.map((url) => url.trim()).filter((url) => url.length > 0)
}
