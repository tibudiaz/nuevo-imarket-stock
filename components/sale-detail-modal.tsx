"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatUsdCurrency } from "@/lib/price-converter"

// Interfaces
interface Sale {
  id: string
  date: string
  customerName?: string
  customerDni?: string
  items: SaleItem[]
  totalAmount: number
  paymentMethod?: string
  cashAmount?: number
  transferAmount?: number
  cardAmount?: number
  receiptNumber?: string
  usdRate?: number
  [key: string]: any
}

interface SaleItem {
  productId: string
  productName: string
  quantity: number
  price: number
  currency: 'USD' | 'ARS'
  category?: string
  cost?: number
  provider?: string
}

interface Product {
  id: string
  name?: string
  provider?: string
  cost?: number
  [key: string]: any
}

interface User {
  username: string
  role: string
}

interface SaleDetailModalProps {
  isOpen: boolean
  onClose: () => void
  sale: Sale | null
  products: Product[]
  user: User | null
}

export default function SaleDetailModal({ isOpen, onClose, sale, products, user }: SaleDetailModalProps) {
  if (!sale || !user) return null

  const productsMap = new Map(products.map(p => [p.id, p]))

  const USD_PRICE_THRESHOLD = 3500

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Detalle de Venta: {sale.receiptNumber || sale.id}</DialogTitle>
          <DialogDescription>
            Realizada el {new Date(sale.date).toLocaleString('es-AR')} por {sale.customerName} (DNI: {sale.customerDni})
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <h3 className="mb-4 text-lg font-medium">Productos Incluidos</h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Precio Unitario</TableHead>
                  {user.role === 'admin' && <TableHead>Costo Unitario</TableHead>}
                  {user.role === 'admin' && <TableHead>Ganancia</TableHead>}
                  {user.role === 'admin' && <TableHead>Proveedor</TableHead>}
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sale.items.map((item, index) => {
                  const productInfo = productsMap.get(item.productId)
                  const cost = productInfo?.cost ?? item.cost ?? 0
                  const isUSD = item.currency === 'USD' || Number(item.price) < USD_PRICE_THRESHOLD
                  const unitPriceInARS = Number(item.price) * (isUSD ? (sale.usdRate || 1) : 1)
                  const unitCostInARS = Number(cost) * (isUSD ? (sale.usdRate || 1) : 1)
                  const provider = productInfo?.provider || item.provider || 'N/A'
                  const profitPerUnit = unitPriceInARS - unitCostInARS
                  const subtotal = unitPriceInARS * item.quantity
                  const totalProfit = profitPerUnit * item.quantity

                  return (
                    <TableRow key={`${item.productId}-${index}`}>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>
                        {isUSD ? (
                          <>
                            {formatUsdCurrency(Number(item.price))}
                            <br />
                            <span className="text-xs text-muted-foreground">
                              {formatCurrency(unitPriceInARS)}
                            </span>
                          </>
                        ) : (
                          formatCurrency(unitPriceInARS)
                        )}
                      </TableCell>
                      {user.role === 'admin' && (
                        <TableCell>
                          {isUSD ? (
                            <>
                              {formatUsdCurrency(Number(cost))}
                              <br />
                              <span className="text-xs text-muted-foreground">
                                {formatCurrency(unitCostInARS)}
                              </span>
                            </>
                          ) : (
                            formatCurrency(unitCostInARS)
                          )}
                        </TableCell>
                      )}
                      {user.role === 'admin' && (
                        <TableCell className={profitPerUnit >= 0 ? "text-green-600" : "text-red-600"}>
                          {formatCurrency(totalProfit)}
                        </TableCell>
                      )}
                      {user.role === 'admin' && <TableCell>{provider}</TableCell>}
                      <TableCell className="text-right">{formatCurrency(subtotal)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex justify-end items-center gap-4">
            <div className="text-sm">Cotización: {sale.usdRate ? `$${sale.usdRate.toFixed(2)}` : '-'}</div>
            {sale.paymentMethod === "multiple" ? (
              <div className="text-sm space-y-1">
                <div>
                  Método de Pago: <Badge variant="outline">Múltiple</Badge>
                </div>
                <div>Efectivo: {formatCurrency(sale.cashAmount ?? 0)}</div>
                <div>Transferencia: {formatCurrency(sale.transferAmount ?? 0)}</div>
                <div>Tarjeta: {formatCurrency(sale.cardAmount ?? 0)}</div>
              </div>
            ) : (
              <div className="text-sm">
                Método de Pago: <Badge variant="outline">{sale.paymentMethod}</Badge>
              </div>
            )}
            <div className="text-xl font-bold">
              Total: {formatCurrency(sale.totalAmount)}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

