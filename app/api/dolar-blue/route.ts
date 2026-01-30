import { NextResponse } from "next/server"

const DOLAR_API_URL = "https://dolarapi.com/v1/dolares/blue"

export async function GET() {
  try {
    const apiResponse = await fetch(DOLAR_API_URL, { cache: "no-store" })
    if (!apiResponse.ok) {
      return NextResponse.json(
        { error: "No se pudo obtener la cotización" },
        { status: apiResponse.status },
      )
    }

    const apiData = (await apiResponse.json()) as { venta?: number }
    if (typeof apiData.venta === "number" && Number.isFinite(apiData.venta)) {
      return NextResponse.json({ venta: apiData.venta })
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
