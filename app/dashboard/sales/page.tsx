"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, Calendar, ShoppingCart, DollarSign, User, Download, Eye } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ref, onValue } from "firebase/database"
import { database } from "@/lib/firebase"
import SaleDetailModal from "@/components/sale-detail-modal"

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
  currency: 'USD' | 'ARS';
}

interface Sale {
  id: string
  date: string
  customerName?: string
  customerDni?: string
  items: SaleItem[]
  totalAmount: number
  paymentMethod?: string
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
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [sales, setSales] = useState<Sale[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [dailySales, setDailySales] = useState<SalesStats>({ count: 0, total: 0 })
  const [weeklySales, setWeeklySales] = useState<SalesStats>({ count: 0, total: 0 })
  const [topProduct, setTopProduct] = useState<TopProductType>({ name: "", count: 0 })
  
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push("/")
      return;
    }

    const salesRef = ref(database, "sales")
    const unsubscribeSales = onValue(salesRef, (snapshot) => {
      if (snapshot.exists()) {
        const salesData: Sale[] = []
        snapshot.forEach((childSnapshot) => {
          salesData.push({
            id: childSnapshot.key || "",
            ...childSnapshot.val(),
          })
        })

        salesData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        setSales(salesData)
        calculateSalesStats(salesData)
      } else {
        setSales([])
        setDailySales({ count: 0, total: 0 })
        setWeeklySales({ count: 0, total: 0 })
        setTopProduct({ name: "", count: 0 })
      }
    })
    
    const productsRef = ref(database, "products")
    const unsubscribeProducts = onValue(productsRef, (snapshot) => {
        if(snapshot.exists()) {
            const productsData: Product[] = [];
            snapshot.forEach(child => {
                productsData.push({ id: child.key!, ...child.val() });
            });
            setProducts(productsData);
        }
    });

    return () => {
      unsubscribeSales()
      unsubscribeProducts()
    }
  }, [router, user, authLoading])

  const calculateSalesStats = (salesData: Sale[]) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - today.getDay())

    const todaySales = salesData.filter((sale) => new Date(sale.date) >= today)
    const todayTotal = todaySales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0)

    const weekSales = salesData.filter((sale) => new Date(sale.date) >= weekStart)
    const weekTotal = weekSales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0)

    const productCounts: Record<string, number> = {}
    salesData.forEach((sale) => {
      if (Array.isArray(sale.items)) {
        sale.items.forEach(item => {
          if (item.productName && typeof item.quantity === 'number') {
            productCounts[item.productName] = (productCounts[item.productName] || 0) + item.quantity;
          }
        });
      }
    })

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
  }

  const filteredSales = sales.filter(
    (sale) =>
      (sale.customerName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sale.customerDni || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sale.items || []).some(item => (item.productName || "").toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const handleViewDetails = (sale: Sale) => {
    setSelectedSale(sale);
    setIsDetailModalOpen(true);
  };

  const downloadSaleReceipt = (sale: Sale) => {
    console.log("Descargar comprobante para la venta:", sale.id)
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Ventas</h1>
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
          </div>
        </div>

        {/* --- CORRECCIÓN CLAVE --- */}
        {/* Este bloque de tarjetas solo se renderizará si el rol del usuario es 'admin'. */}
        {user?.role === 'admin' && (
          <div className="grid gap-4 md:grid-cols-3 mb-6">
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
                  <CardTitle className="text-sm font-medium">Productos Más Vendidos</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                  <div className="text-lg font-medium">{topProduct.name || "Sin datos"}</div>
                  <p className="text-xs text-muted-foreground">
                      {topProduct.count > 0 ? `${topProduct.count} unidades vendidas` : "No hay ventas registradas"}
                  </p>
                  </CardContent>
              </Card>
          </div>
        )}

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>DNI</TableHead>
                <TableHead>Productos</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Método de Pago</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                    No se encontraron ventas
                  </TableCell>
                </TableRow>
              ) : (
                filteredSales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell>{new Date(sale.date).toLocaleDateString()}</TableCell>
                    <TableCell className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {sale.customerName}
                    </TableCell>
                    <TableCell>{sale.customerDni}</TableCell>
                    <TableCell>
                        {(sale.items || []).map(item => `${item.quantity}x ${item.productName}`).join(', ')}
                    </TableCell>
                    <TableCell>${Number(sale.totalAmount).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {sale.paymentMethod === "efectivo"
                          ? "Efectivo"
                          : sale.paymentMethod === "tarjeta"
                            ? "Tarjeta"
                            : "Transferencia"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleViewDetails(sale)}>
                            <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => downloadSaleReceipt(sale)}>
                            <Download className="h-4 w-4" />
                        </Button>
                    </TableCell>
                  </TableRow>
                ))
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