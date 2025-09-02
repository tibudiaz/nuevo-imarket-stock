"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, Calendar, ShoppingCart, DollarSign, User, Download, Eye, Package, TrendingUp, TrendingDown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ref, onValue } from "firebase/database"
import { database } from "@/lib/firebase"
import SaleDetailModal from "@/components/sale-detail-modal"
import { useAuth } from "@/hooks/use-auth"
import { generateSaleReceiptPdf } from "@/lib/pdf-generator"

// Interfaces
interface UserType {
  username: string
  role: string
}

interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  currency?: 'USD' | 'ARS';
  category?: string;
  cost?: number;
  provider?: string;
  imei?: string;
  barcode?: string;
}

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
  usdtAmount?: number
  [key: string]: any
}

interface Product {
  id: string;
  name?: string;
  provider?: string;
  cost?: number;
  [key: string]: any;
}

interface SalesStats {
  count: number
  total: number
}

interface TopProductType {
  name: string
  count: number
}

export default function SalesPage() {
  const { user, loading: authLoading } = useAuth()
  const searchParams = useSearchParams()
  const typeParam = searchParams.get('type')
  const cellphonesOnly = typeParam === 'celulares'
  const [sales, setSales] = useState<Sale[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [dailySales, setDailySales] = useState<SalesStats>({ count: 0, total: 0 })
  const [weeklySales, setWeeklySales] = useState<SalesStats>({ count: 0, total: 0 })
  const [topProduct, setTopProduct] = useState<TopProductType>({ name: "", count: 0 })
  const [totalProducts, setTotalProducts] = useState(0)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalCost, setTotalCost] = useState(0)
  const [netProfit, setNetProfit] = useState(0)
  const [totalLoss, setTotalLoss] = useState(0)
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [dateFilter, setDateFilter] = useState<'all' | 'week' | 'day'>('all')

  useEffect(() => {
    if (authLoading || !user) return;

    const salesRef = ref(database, "sales");
    const unsubscribeSales = onValue(salesRef, (snapshot) => {
      if (snapshot.exists()) {
        const salesData: Sale[] = [];
        snapshot.forEach((childSnapshot) => {
          salesData.push({
            id: childSnapshot.key || "",
            ...childSnapshot.val(),
          });
        });

        salesData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setSales(salesData);
      } else {
        setSales([]);
        setDailySales({ count: 0, total: 0 });
        setWeeklySales({ count: 0, total: 0 });
        setTopProduct({ name: "", count: 0 });
        setTotalProducts(0);
        setTotalRevenue(0);
        setTotalCost(0);
        setNetProfit(0);
        setTotalLoss(0);
      }
    });

    const productsRef = ref(database, "products");
    const unsubscribeProducts = onValue(productsRef, (snapshot) => {
      if (snapshot.exists()) {
        const productsData: Product[] = [];
        snapshot.forEach((child) => {
          productsData.push({ id: child.key!, ...child.val() });
        });
        setProducts(productsData);
      }
    });

    return () => {
      unsubscribeSales();
      unsubscribeProducts();
    };
    }, [authLoading, user]);
    const salesFilteredByType = useMemo(
      () => cellphonesOnly
        ? sales.filter(sale => (sale.items || []).some(item => item.category === 'Celulares Nuevos' || item.category === 'Celulares Usados'))
        : sales,
      [sales, cellphonesOnly]
    );

    const filteredByDate = useMemo(() => {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const weekStart = new Date(today)
      weekStart.setDate(today.getDate() - today.getDay())
      return salesFilteredByType.filter(sale => {
        const saleDate = new Date(sale.date)
        if (dateFilter === 'day') return saleDate >= today
        if (dateFilter === 'week') return saleDate >= weekStart
        return true
      })
    }, [salesFilteredByType, dateFilter])

    const calculateSalesStats = useCallback((salesData: Sale[]) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - today.getDay())

    const todaySales = salesData.filter((sale) => new Date(sale.date) >= today)
    const todayTotal = todaySales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0)

    const weekSales = salesData.filter((sale) => new Date(sale.date) >= weekStart)
    const weekTotal = weekSales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0)

    const productCounts: Record<string, number> = {}
    let productTotal = 0
    let revenue = 0
    let costTotal = 0
    let loss = 0

    salesData.forEach((sale) => {
      revenue += Number(sale.totalAmount)
      if (Array.isArray(sale.items)) {
        sale.items.forEach(item => {
          if (item.productName && typeof item.quantity === 'number') {
            productCounts[item.productName] = (productCounts[item.productName] || 0) + item.quantity
          }
          productTotal += item.quantity
          const product = products.find(p => p.id === item.productId)
          const isUSD = item.category === 'Celulares Nuevos' || item.category === 'Celulares Usados'
          const cost = Number(product?.cost ?? item.cost ?? 0) * (isUSD ? (sale.usdRate || 1) : 1)
          const unitPrice = Number(item.price) * (isUSD ? (sale.usdRate || 1) : 1)
          costTotal += cost * item.quantity
          const itemProfit = (unitPrice - cost) * item.quantity
          if (itemProfit < 0) {
            loss += Math.abs(itemProfit)
          }
        })
      }
    })
    const profit = revenue - costTotal

    let topProductName = ""
    let topCount = 0
    Object.entries(productCounts).forEach(([product, count]) => {
      if (count > topCount) {
        topProductName = product
        topCount = count
      }
    })

    setDailySales({ count: todaySales.length, total: todayTotal })
    setWeeklySales({ count: weekSales.length, total: weekTotal })
    setTopProduct({ name: topProductName, count: topCount })
    setTotalProducts(productTotal)
    setTotalRevenue(revenue)
    setTotalCost(costTotal)
    setNetProfit(profit)
    setTotalLoss(loss)
  }, [products])

  useEffect(() => {
    if (salesFilteredByType.length > 0) {
      calculateSalesStats(salesFilteredByType)
    } else {
      calculateSalesStats([])
    }
  }, [salesFilteredByType, calculateSalesStats])

  const filteredSales = filteredByDate.filter(
    (sale) =>
      (sale.customerName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sale.customerDni || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sale.items || []).some(item => (item.productName || "").toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const calculateNetSale = useCallback((sale: Sale) => {
    return (sale.items || []).reduce((sum, item) => {
      const product = products.find(p => p.id === item.productId)
      const isUSD = item.category === 'Celulares Nuevos' || item.category === 'Celulares Usados'
      const unitCost = Number(product?.cost ?? item.cost ?? 0) * (isUSD ? (sale.usdRate || 1) : 1)
      const unitPrice = Number(item.price) * (isUSD ? (sale.usdRate || 1) : 1)
      return sum + (unitPrice - unitCost) * item.quantity
    }, 0)
  }, [products])

  const handleViewDetails = (sale: Sale) => {
    setSelectedSale(sale);
    setIsDetailModalOpen(true);
  };

  const downloadSaleReceipt = async (sale: Sale) => {
    try {
      await generateSaleReceiptPdf(sale as any)
    } catch (error) {
      console.error("Error al generar el comprobante:", error)
    }
  }

  const pageTitle = cellphonesOnly ? "Ventas de Celulares" : "Ventas"

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">{pageTitle}</h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar ventas..."
                className="pl-8 w-[250px]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Rango" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="week">Semana</SelectItem>
                <SelectItem value="day">Hoy</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {user?.role === 'admin' && (
          <>
            <div className="grid gap-4 md:grid-cols-4 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Costos Totales</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${totalCost.toFixed(2)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Ganancia Neta</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${netProfit.toFixed(2)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Pérdidas</CardTitle>
                  <TrendingDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${totalLoss.toFixed(2)}</div>
                </CardContent>
              </Card>
            </div>
            <div className="grid gap-4 md:grid-cols-4 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Ventas del Día</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${dailySales.total.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">{dailySales.count} ventas hoy</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Ventas de la Semana</CardTitle>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${weeklySales.total.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground">{weeklySales.count} ventas esta semana</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Producto Más Vendido</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-medium">{topProduct.name || "Sin datos"}</div>
                  <p className="text-xs text-muted-foreground">
                    {topProduct.count > 0 ? `${topProduct.count} unidades vendidas` : "No hay ventas registradas"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Productos Vendidos</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalProducts}</div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                {user?.role === 'admin' && <TableHead>DNI</TableHead>}
                <TableHead>Productos</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Cotización</TableHead>
                {user?.role === 'admin' && <TableHead>Total Neto</TableHead>}
                {user?.role === 'admin' && <TableHead>Método de Pago</TableHead>}
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={user?.role === 'admin' ? 9 : 6} className="text-center py-6 text-muted-foreground">
                    No se encontraron ventas
                  </TableCell>
                </TableRow>
              ) : (
                filteredSales.map((sale) => {
                  const netTotal = calculateNetSale(sale)
                  return (
                    <TableRow key={sale.id}>
                      <TableCell>{new Date(sale.date).toLocaleDateString()}</TableCell>
                      <TableCell className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {sale.customerName}
                      </TableCell>
                      {user?.role === 'admin' && <TableCell>{sale.customerDni}</TableCell>}
                      <TableCell>
                        {(sale.items || []).map(item => {
                          const details = [] as string[]
                          if (item.imei) details.push(`IMEI: ${item.imei}`)
                          if (item.barcode) details.push(`S/N: ${item.barcode}`)
                          const info = details.length ? ` (${details.join(' / ')})` : ''
                          return `${item.quantity}x ${item.productName}${info}`
                        }).join(', ')}
                      </TableCell>
                      <TableCell>${Number(sale.totalAmount).toFixed(2)}</TableCell>
                      <TableCell>{sale.usdRate ? sale.usdRate.toFixed(2) : '-'}</TableCell>
                      {user?.role === 'admin' && (
                        <TableCell className={netTotal >= 0 ? "text-green-600" : "text-red-600"}>
                          ${netTotal.toFixed(2)}
                        </TableCell>
                      )}
                      {user?.role === 'admin' && (
                        <TableCell>
                          <Badge variant="outline">
                            {sale.paymentMethod === "efectivo"
                              ? "Efectivo"
                              : sale.paymentMethod === "efectivo_usd"
                                ? "Efectivo USD"
                                : sale.paymentMethod === "tarjeta"
                                  ? "Tarjeta"
                                  : sale.paymentMethod === "transferencia"
                                    ? "Transferencia"
                                    : sale.paymentMethod === "multiple"
                                      ? "Múltiple"
                                      : sale.paymentMethod === "transferencia_usdt"
                                        ? "Transferencia USDT"
                                        : sale.paymentMethod}
                          </Badge>
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleViewDetails(sale)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => downloadSaleReceipt(sale)}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      
      <SaleDetailModal 
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        sale={selectedSale}
        products={products}
        user={user}
      />
    </DashboardLayout>
  )
}