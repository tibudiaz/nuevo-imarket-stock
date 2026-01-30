import { NextResponse } from "next/server"

export const dynamic = "force-static"

const DEFAULT_RANGES = ["B:B", "C:C", "E:E", "F:F"]

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
  const ranges = process.env.GOOGLE_SHEETS_RANGE
    ? process.env.GOOGLE_SHEETS_RANGE.split(",").map((value) => value.trim())
    : DEFAULT_RANGES

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
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet`
  )
  ranges.filter(Boolean).forEach((range) => {
    endpoint.searchParams.append("ranges", range)
  })
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
    const valueRanges: Array<{ values?: string[][] }> = data.valueRanges || []
    const maxRows = valueRanges.reduce(
      (currentMax, valueRange) => Math.max(currentMax, valueRange.values?.length ?? 0),
      0
    )
    const values: string[][] = Array.from({ length: maxRows }, (_, rowIndex) =>
      valueRanges.map((valueRange) => valueRange.values?.[rowIndex]?.[0] ?? "")
    )

    if (values.length === 0) {
      return NextResponse.json({ products: [], updatedAt: new Date().toISOString() })
    }

    const [firstRow, ...rows] = values
    const isHeaderRow =
      firstRow.length >= 2 &&
      (normalizeText(firstRow[0] || "").includes("nombre") ||
        normalizeText(firstRow[0] || "").includes("producto") ||
        normalizeText(firstRow[1] || "").includes("precio") ||
        normalizeText(firstRow[1] || "").includes("price"))

    const dataRows = isHeaderRow ? rows : values
    const columnEHeader = isHeaderRow ? firstRow[2]?.trim() || "" : ""
    const columnFHeader = isHeaderRow ? firstRow[3]?.trim() || "" : ""

    const products = dataRows
      .filter((row) => row[0] && (row[1] || row[2] || row[3]))
      .map((row) => {
        const baseName = row[0].trim()
        const priceRaw = (row[1] || "").trim()
        return {
          name: baseName,
          priceRaw,
          price: parsePrice(priceRaw),
          columnE: row[2]?.trim() || "",
          columnF: row[3]?.trim() || "",
        }
      })

    return NextResponse.json({
      products,
      headers: {
        columnE: columnEHeader,
        columnF: columnFHeader,
      },
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
