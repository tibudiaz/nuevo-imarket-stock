const normalizeDatabaseUrl = (url: string) => url.replace(/\/+$/, "")

export const fetchPublicRealtimeValue = async <T>(path: string): Promise<T | null> => {
  const databaseUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
  if (!databaseUrl) return null

  const normalizedPath = path.replace(/^\/+/, "")
  const endpoint = `${normalizeDatabaseUrl(databaseUrl)}/${normalizedPath}.json`

  try {
    const response = await fetch(endpoint, { cache: "no-store" })
    if (!response.ok) {
      console.warn(`[firebase-public] No se pudo leer ${normalizedPath}.`, response.status)
      return null
    }
    return (await response.json()) as T | null
  } catch (error) {
    console.error(`[firebase-public] Error al leer ${normalizedPath}:`, error)
    return null
  }
}
