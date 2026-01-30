import { NextResponse } from "next/server"

const INFO_DOLAR_URL =
  "https://www.infodolar.com/cotizacion-dolar-localidad-rio-cuarto-provincia-cordoba.aspx"
const DOLAR_API_URL = "https://dolarapi.com/v1/dolares/blue"

const normalizeCurrency = (value: string): number | null => {
  const normalized = value.replace(/[^0-9.,]/g, "").replace(/\./g, "").replace(",", ".")
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const parseVentaFromHtml = (html: string): number | null => {
  const tableMatch = html.match(/<table[^>]*id="BluePromedio"[^>]*>([\s\S]*?)<\/table>/i)
  if (!tableMatch) return null

  const tableHtml = tableMatch[1]
  const rowMatches = Array.from(tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi))
  const rowHtml = rowMatches.map((match) => match[1]).find((row) => /colCompraVenta/i.test(row))
  if (!rowHtml) return null
  const dataOrderMatches = Array.from(
    rowHtml.matchAll(/colCompraVenta[^>]*data-order="([^"]+)"/gi),
  )
    .map((match) => match[1])
    .filter(Boolean)

  const textMatches = Array.from(rowHtml.matchAll(/colCompraVenta[^>]*>\s*([^<]+)/gi))
    .map((match) => match[1])
    .filter(Boolean)

  const values = [...dataOrderMatches, ...textMatches]
    .map((value) => normalizeCurrency(value))
    .filter((value): value is number => value !== null)

  if (values.length < 2) return null

  return values[1]
}

export async function GET() {
  try {
    const apiResponse = await fetch(DOLAR_API_URL, { cache: "no-store" })
    if (apiResponse.ok) {
      const apiData = (await apiResponse.json()) as { venta?: number }
      if (typeof apiData.venta === "number" && Number.isFinite(apiData.venta)) {
        return NextResponse.json({ venta: apiData.venta })
      }
    }

    const response = await fetch(INFO_DOLAR_URL, {
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: "No se pudo obtener la cotización" },
        { status: response.status },
      )
    }

    const html = await response.text()
    const venta = parseVentaFromHtml(html)

    if (venta === null) {
      return NextResponse.json(
        { error: "No se pudo interpretar la cotización" },
        { status: 502 },
      )
    }

    return NextResponse.json({ venta })
  } catch (error) {
    console.error("Error al obtener cotización Blue Río Cuarto:", error)
    return NextResponse.json(
      { error: "No se pudo obtener la cotización" },
      { status: 500 },
    )
  }
}
