import { NextResponse } from "next/server"

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

export async function GET() {
  try {
    const apiResponse = await fetch(DOLAR_API_URL, { cache: "force-cache" })
    if (apiResponse.ok) {
      const apiData = (await apiResponse.json()) as { venta?: number | string }
      const venta = parseRate(apiData.venta)
      if (venta !== null) {
        return NextResponse.json(
          { venta },
          { headers: { "Cache-Control": "no-store, max-age=0" } },
        )
      }
    }

    const fallbackResponse = await fetch(DOLAR_FALLBACK_URL, { cache: "force-cache" })
    if (!fallbackResponse.ok) {
      return NextResponse.json(
        { error: "No se pudo obtener la cotización" },
        { status: fallbackResponse.status },
      )
    }

    const fallbackData = (await fallbackResponse.json()) as {
      blue?: { value_sell?: number | string }
    }
    const venta = parseRate(fallbackData.blue?.value_sell)
    if (venta !== null) {
      return NextResponse.json(
        { venta },
        { headers: { "Cache-Control": "no-store, max-age=0" } },
      )
    }

    return NextResponse.json({ error: "No se pudo interpretar la cotización" }, { status: 502 })
  } catch (error) {
    console.error("Error al obtener cotización Blue Río Cuarto:", error)
    return NextResponse.json(
      { error: "No se pudo obtener la cotización" },
      { status: 500 },
    )
  }
}
