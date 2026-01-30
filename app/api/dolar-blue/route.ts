import { NextResponse } from "next/server"

const INFO_DOLAR_URL =
  "https://www.infodolar.com/cotizacion-dolar-localidad-rio-cuarto-provincia-cordoba.aspx"

const parseVentaFromHtml = (html: string): number | null => {
  const tableMatch = html.match(/<table[^>]*id="BluePromedio"[^>]*>([\s\S]*?)<\/table>/i)
  if (!tableMatch) return null

  const rowMatch = tableMatch[1].match(/<\/thead>\s*<tr>([\s\S]*?)<\/tr>/i)
  if (!rowMatch) return null

  const values = Array.from(rowMatch[1].matchAll(/colCompraVenta[^>]*>\s*\$?\s*([0-9.,]+)/gi))
    .map((match) => match[1])
    .filter(Boolean)

  if (values.length < 2) return null

  const ventaRaw = values[1]
  const normalized = ventaRaw.replace(/\./g, "").replace(",", ".")
  const venta = Number.parseFloat(normalized)
  return Number.isFinite(venta) ? venta : null
}

export async function GET() {
  try {
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
