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
                  const unitPriceInARS = item.price * (item.currency === 'USD' ? (sale.usdRate || 1) : 1)
                  const unitCost = productInfo?.cost ?? item.cost ?? 0
                  const provider = productInfo?.provider || item.provider || 'N/A'
                  const profitPerUnit = unitPriceInARS - unitCost
                  const subtotal = unitPriceInARS * item.quantity
                  const totalProfit = profitPerUnit * item.quantity

                  return (
                    <TableRow key={`${item.productId}-${index}`}>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>${unitPriceInARS.toFixed(2)}</TableCell>
                      {user.role === 'admin' && <TableCell>${unitCost.toFixed(2)}</TableCell>}
                      {user.role === 'admin' && (
                        <TableCell className={profitPerUnit >= 0 ? "text-green-600" : "text-red-600"}>
                          ${totalProfit.toFixed(2)}
                        </TableCell>
                      )}
                      {user.role === 'admin' && <TableCell>{provider}</TableCell>}
                      <TableCell className="text-right">${subtotal.toFixed(2)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex justify-end items-center gap-4">
            {sale.paymentMethod === "multiple" ? (
              <div className="text-sm space-y-1">
                <div>
                  Método de Pago: <Badge variant="outline">Múltiple</Badge>
                </div>
                <div>Efectivo: ${ (sale.cashAmount ?? 0).toFixed(2) }</div>
                <div>Transferencia: ${ (sale.transferAmount ?? 0).toFixed(2) }</div>
                <div>Tarjeta: ${ (sale.cardAmount ?? 0).toFixed(2) }</div>
              </div>
            ) : (
              <div className="text-sm">
                Método de Pago: <Badge variant="outline">{sale.paymentMethod}</Badge>
              </div>
            )}
            <div className="text-xl font-bold">
              Total: ${sale.totalAmount.toFixed(2)}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

