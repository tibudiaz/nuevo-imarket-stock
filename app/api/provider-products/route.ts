import { NextResponse } from "next/server"

export const dynamic = "force-static"

const DEFAULT_RANGE = "A:B"

const normalizeText = (value: string) => value.trim().toLowerCase()

const parsePrice = (value: string) => {
  const cleaned = value
    .replace(/[^0-9,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(/,(?=\d{2}$)/g, ".")
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

export async function GET() {
  const sheetId = process.env.GOOGLE_SHEETS_ID
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY
  const range = process.env.GOOGLE_SHEETS_RANGE || DEFAULT_RANGE

  if (!sheetId || !apiKey) {
    return NextResponse.json(
      {
        error:
          "Faltan credenciales de Google Sheets. Configure GOOGLE_SHEETS_ID y GOOGLE_SHEETS_API_KEY.",
      },
      { status: 500 }
    )
  }

  const endpoint = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`
  )
  endpoint.searchParams.set("key", apiKey)

  try {
    const response = await fetch(endpoint.toString(), {
      cache: "force-cache",
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      return NextResponse.json(
        {
          error: "No se pudo leer el Google Sheet del proveedor.",
          details: errorBody,
        },
        { status: response.status }
      )
    }

    const data = await response.json()
    const values: string[][] = data.values || []

    if (values.length === 0) {
      return NextResponse.json({ products: [], updatedAt: new Date().toISOString() })
    }

    const [firstRow, ...rows] = values
    const isHeaderRow =
      firstRow.length >= 2 &&
      (normalizeText(firstRow[0]).includes("nombre") ||
        normalizeText(firstRow[0]).includes("producto") ||
        normalizeText(firstRow[1]).includes("precio") ||
        normalizeText(firstRow[1]).includes("price"))

    const dataRows = isHeaderRow ? rows : values

    const products = dataRows
      .filter((row) => row[0] && row[1])
      .map((row) => ({
        name: row[0].trim(),
        priceRaw: row[1].trim(),
        price: parsePrice(row[1]),
      }))

    return NextResponse.json({
      products,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error al consultar Google Sheets:", error)
    return NextResponse.json(
      {
        error: "Error inesperado consultando el Google Sheet del proveedor.",
      },
      { status: 500 }
    )
  }
}
