const DOLAR_API_URL = "https://dolarapi.com/v1/dolares/blue"
const DOLAR_FALLBACK_URL = "https://api.bluelytics.com.ar/v2/latest"

const parseRate = (value: number | string | undefined) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."))
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

export const fetchDolarBlueRate = async () => {
  const apiResponse = await fetch(DOLAR_API_URL)
  if (apiResponse.ok) {
    const apiData = (await apiResponse.json()) as { venta?: number | string }
    const venta = parseRate(apiData.venta)
    if (venta !== null) {
      return venta
    }
  }

  const fallbackResponse = await fetch(DOLAR_FALLBACK_URL)
  if (!fallbackResponse.ok) {
    throw new Error("No se pudo obtener la cotización")
  }

  const fallbackData = (await fallbackResponse.json()) as {
    blue?: { value_sell?: number | string }
  }
  const venta = parseRate(fallbackData.blue?.value_sell)
  if (venta !== null) {
    return venta
  }

  throw new Error("No se pudo interpretar la cotización")
}
