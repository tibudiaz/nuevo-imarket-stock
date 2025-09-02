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
  cashUsdAmount?: number
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
  currency?: 'USD' | 'ARS'
  category?: string
  cost?: number
  provider?: string
  imei?: string
  barcode?: string
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
          {sale.usdRate && (
            <p className="text-sm text-muted-foreground">
              Cotización dólar: {sale.usdRate.toFixed(2)}
            </p>
          )}
        </DialogHeader>
        <div className="py-4">
          <h3 className="mb-4 text-lg font-medium">Productos Incluidos</h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>IMEI/Serie</TableHead>
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
                  const category = (item.category || '').toLowerCase()
                  const isUSD = category === 'celulares nuevos' || category === 'celulares usados'
                  const unitPriceUSD = Number(item.price)
                  const unitPriceARS = unitPriceUSD * (isUSD ? (sale.usdRate || 1) : 1)
                  const unitCostUSD = Number(productInfo?.cost ?? item.cost ?? 0)
                  const unitCostARS = unitCostUSD * (isUSD ? (sale.usdRate || 1) : 1)
                  const provider = productInfo?.provider || item.provider || 'N/A'
                  const profitPerUnitUSD = unitPriceUSD - unitCostUSD
                  const profitPerUnitARS = unitPriceARS - unitCostARS
                  const subtotalUSD = unitPriceUSD * item.quantity
                  const subtotalARS = unitPriceARS * item.quantity
                  const totalProfitUSD = profitPerUnitUSD * item.quantity
                  const totalProfitARS = profitPerUnitARS * item.quantity

                  return (
                    <TableRow key={`${item.productId}-${index}`}>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell>
                        {item.imei && <div>IMEI: {item.imei}</div>}
                        {item.barcode && <div>S/N: {item.barcode}</div>}
                      </TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>
                        {isUSD ? (
                          <>
                            {`USD ${Number(item.price).toFixed(2)}`}
                            <div className="text-xs text-muted-foreground">
                              {`ARS ${unitPriceARS.toFixed(2)}`}
                            </div>
                          </>
                        ) : (
                          <>{`$${unitPriceARS.toFixed(2)}`}</>
                        )}
                      </TableCell>
                      {user.role === 'admin' && (
                        <TableCell>
                          {isUSD ? (
                            <>
                              {`USD ${unitCostUSD.toFixed(2)}`}
                              <div className="text-xs text-muted-foreground">
                                {`ARS ${unitCostARS.toFixed(2)}`}
                              </div>
                            </>
                          ) : (
                            <>{`$${unitCostARS.toFixed(2)}`}</>
                          )}
                        </TableCell>
                      )}
                      {user.role === 'admin' && (
                        <TableCell className={profitPerUnitARS >= 0 ? "text-green-600" : "text-red-600"}>
                          {isUSD ? (
                            <>
                              {`USD ${totalProfitUSD.toFixed(2)}`}
                              <div className="text-xs text-muted-foreground">
                                {`ARS ${totalProfitARS.toFixed(2)}`}
                              </div>
                            </>
                          ) : (
                            <>{`$${totalProfitARS.toFixed(2)}`}</>
                          )}
                        </TableCell>
                      )}
                      {user.role === 'admin' && <TableCell>{provider}</TableCell>}
                      <TableCell className="text-right">
                        {isUSD ? (
                          <>
                            {`USD ${subtotalUSD.toFixed(2)}`}
                            <div className="text-xs text-muted-foreground">
                              {`ARS ${subtotalARS.toFixed(2)}`}
                            </div>
                          </>
                        ) : (
                          <>{`$${subtotalARS.toFixed(2)}`}</>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {sale.tradeIn && sale.tradeIn.price > 0 && (
                  <TableRow key="trade-in">
                    <TableCell className="font-medium">Parte de Pago: {sale.tradeIn.name || 'Equipo'}</TableCell>
                    <TableCell>
                      {sale.tradeIn.imei && <div>IMEI: {sale.tradeIn.imei}</div>}
                      {sale.tradeIn.serialNumber && <div>S/N: {sale.tradeIn.serialNumber}</div>}
                    </TableCell>
                    <TableCell>1</TableCell>
                    <TableCell>
                      {`USD ${Number(sale.tradeIn.price).toFixed(2)}`}
                      <div className="text-xs text-muted-foreground">
                        {`ARS ${(sale.tradeIn.price * (sale.usdRate || 1)).toFixed(2)}`}
                      </div>
                    </TableCell>
                    {user.role === 'admin' && <TableCell>-</TableCell>}
                    {user.role === 'admin' && <TableCell>-</TableCell>}
                    {user.role === 'admin' && <TableCell>-</TableCell>}
                    <TableCell className="text-right text-red-600">
                      {`-$${(sale.tradeIn.price * (sale.usdRate || 1)).toFixed(2)}`}
                    </TableCell>
                  </TableRow>
                )}
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
                <div>Efectivo USD: ${ (sale.cashUsdAmount ?? 0).toFixed(2) }</div>
                <div>Transferencia: ${ (sale.transferAmount ?? 0).toFixed(2) }</div>
                <div>Tarjeta: ${ (sale.cardAmount ?? 0).toFixed(2) }</div>
              </div>
            ) : (
              <div className="text-sm">
                Método de Pago: <Badge variant="outline">{sale.paymentMethod === "efectivo_usd" ? "Efectivo USD" : sale.paymentMethod}</Badge>
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

