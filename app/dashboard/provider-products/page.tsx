"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { RefreshCcw, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface ProviderProduct {
  name: string
  priceRaw: string
  price: number | null
  columnE?: string
  columnF?: string
  isSpacer?: boolean
}

interface ProviderHeaders {
  columnE?: string
  columnF?: string
}

interface ProviderResponse {
  products: ProviderProduct[]
  headers?: ProviderHeaders
  updatedAt: string
  error?: string
}

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
})

export default function ProviderProductsPage() {
  const [products, setProducts] = useState<ProviderProduct[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [headers, setHeaders] = useState<ProviderHeaders | null>(null)

  const fetchProducts = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/provider-products", { cache: "no-store" })
      const data: ProviderResponse = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "No se pudieron cargar los productos del proveedor.")
      }

      setProducts(data.products)
      setHeaders(data.headers || null)
      setUpdatedAt(data.updatedAt)
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Error inesperado."
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return products
    return products.filter((product) => product.name.toLowerCase().includes(query))
  }, [products, search])

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                Productos del proveedor
              </CardTitle>
              <CardDescription>
                Se muestran los productos disponibles que el proveedor carga en su Google Sheets.
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Badge variant="outline" className="w-fit">
                {updatedAt
                  ? `Actualizado: ${new Date(updatedAt).toLocaleString("es-AR")}`
                  : "Sin actualización"}
              </Badge>
              <Button type="button" variant="outline" onClick={fetchProducts} disabled={isLoading}>
                <RefreshCcw className={isLoading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
                Actualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Input
                placeholder="Buscar producto..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="sm:max-w-xs"
              />
              <p className="text-sm text-muted-foreground">
                {filteredProducts.length} producto{filteredProducts.length === 1 ? "" : "s"}
                {search ? " encontrados" : " disponibles"}.
              </p>
            </div>

            {error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {error}
                <p className="mt-2 text-xs text-destructive/80">
                  Verificá que el Google Sheet esté compartido o que la API tenga permisos de lectura.
                </p>
              </div>
            ) : null}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PRODUCTO</TableHead>
                  <TableHead>PRECIO</TableHead>
                  <TableHead>{headers?.columnE || "Cantidad"}</TableHead>
                  <TableHead className="text-right">{headers?.columnF || "Estado"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                      Cargando productos del proveedor...
                    </TableCell>
                  </TableRow>
                ) : filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                      No hay productos disponibles para mostrar.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product, index) => (
                    product.isSpacer ? (
                      <TableRow key={`spacer-${index}`}>
                        <TableCell colSpan={4} className="py-3">
                          &nbsp;
                        </TableCell>
                      </TableRow>
                    ) : (
                      <TableRow key={`${product.name}-${index}`}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>
                          {product.price !== null ? currencyFormatter.format(product.price) : product.priceRaw}
                        </TableCell>
                        <TableCell>{product.columnE}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {product.columnF}
                        </TableCell>
                      </TableRow>
                    )
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
