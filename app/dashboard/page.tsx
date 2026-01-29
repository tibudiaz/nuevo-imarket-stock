"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ShoppingBag,
  Package,
  DollarSign,
  TrendingUp,
  User,
  AlertTriangle,
  Box,
  Smartphone,
  RefreshCw,
} from "lucide-react"
import { ref, onValue, set } from "firebase/database"
import { database } from "@/lib/firebase"
import { Reserve } from "@/components/sell-product-modal"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { useAuth } from "@/hooks/use-auth" // Importa el hook de autenticación
import { useStore } from "@/hooks/use-store"
import LoginForm from "@/components/login-form"

// Interfaces (sin cambios)
interface SaleItem {
    productId: string;
    productName: string;
    quantity: number;
    category?: string;
    price?: number;
}

interface Sale {
  id: string
  items: SaleItem[];
  totalAmount: number;
  date?: string
  customerName?: string;
  store?: "local1" | "local2";
  [key: string]: any
}

interface Product {
  id: string;
  name?: string;
  category?: string;
  cost?: number;
  stock?: number;
  [key: string]: any;
}

interface DashboardData {
  totalSales: number
  totalProducts: number
  totalInvestment: number
  totalProfit: number
  salesGrowth: number
  productsGrowth: number
  investmentGrowth: number
  profitGrowth: number
  monthlySales: { name: string; total: number }[]
}

type StoreKey = "local1" | "local2"
type SummaryKey = StoreKey | "all"

type StoreSummary = {
  products: number
  newPhones: number
  usedPhones: number
  productsCount: number
  newPhonesCount: number
  usedPhonesCount: number
  total: number
  totalCount: number
}

const storeLabels: Record<SummaryKey, string> = {
  all: "Todos los locales",
  local1: "Local 1",
  local2: "Local 2",
}

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
})

const createEmptySummary = (): Record<SummaryKey, StoreSummary> => ({
  all: {
    products: 0,
    newPhones: 0,
    usedPhones: 0,
    productsCount: 0,
    newPhonesCount: 0,
    usedPhonesCount: 0,
    total: 0,
    totalCount: 0,
  },
  local1: {
    products: 0,
    newPhones: 0,
    usedPhones: 0,
    productsCount: 0,
    newPhonesCount: 0,
    usedPhonesCount: 0,
    total: 0,
    totalCount: 0,
  },
  local2: {
    products: 0,
    newPhones: 0,
    usedPhones: 0,
    productsCount: 0,
    newPhonesCount: 0,
    usedPhonesCount: 0,
    total: 0,
    totalCount: 0,
  },
})

export default function Dashboard() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth() // Utiliza el hook de autenticación
  const { selectedStore } = useStore()
  const [sales, setSales] = useState<Sale[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    totalSales: 0,
    totalProducts: 0,
    totalInvestment: 0,
    totalProfit: 0,
    salesGrowth: 0,
    productsGrowth: 0,
    investmentGrowth: 0,
    profitGrowth: 0,
    monthlySales: [],
  })
  const [products, setProducts] = useState<Product[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [dailySalesData, setDailySalesData] = useState<Sale[]>([]);
  const [reserves, setReserves] = useState<Reserve[]>([]);
  const [dailySalesSummary, setDailySalesSummary] = useState<Record<SummaryKey, StoreSummary>>(createEmptySummary);
  const [catalogVisibility, setCatalogVisibility] = useState({ newPhones: true, usedPhones: true })

  // Se elimina el useEffect que manejaba la autenticación localmente

  useEffect(() => {
    if (!user) return; // Espera a que el usuario esté verificado por el hook

    const productsRef = ref(database, "products")
    const unsubscribeProducts = onValue(productsRef, (snapshot) => {
      if (snapshot.exists()) {
        const productsData: Product[] = []
        let totalInvestment = 0
        snapshot.forEach((childSnapshot) => {
          const product: Product = {
            id: childSnapshot.key || "",
            ...childSnapshot.val(),
          }
          productsData.push(product)
          totalInvestment += Number(product.cost || 0) * Number(product.stock || 0)
        })
        
        setProducts(productsData);

        const lowStockAccessories = productsData.filter(p => 
          p.stock !== undefined && 
          p.stock <= 5 && 
          p.category !== 'Celulares Nuevos' && 
          p.category !== 'Celulares Usados'
        );
        
        setLowStockProducts(lowStockAccessories);

        if (lowStockAccessories.length > 0) {
            toast.warning(`${lowStockAccessories.length} productos con bajo stock!`, {
                description: 'Revisa el inventario de accesorios para reponer stock.',
            });
        }
        
        const activeReserves = reserves
          .filter(r => r.status === "reserved")
          .reduce((sum, r) => sum + (r.quantity || 1), 0)
        setDashboardData((prev) => ({
          ...prev,
          totalProducts:
            productsData.reduce((sum, p) => sum + (p.stock || 0), 0) + activeReserves,
          totalInvestment: totalInvestment,
          productsGrowth: 12, // Simulado
          investmentGrowth: 5.2, // Simulado
        }))
      }
    });

    return () => unsubscribeProducts();
  }, [user, reserves]); // Se agrega 'reserves' a las dependencias

  useEffect(() => {
    if (products.length === 0 && reserves.length === 0) return;
    const activeReserves = reserves
      .filter(r => r.status === "reserved")
      .reduce((sum, r) => sum + (r.quantity || 1), 0);
    setDashboardData((prev) => ({
      ...prev,
      totalProducts:
        products.reduce((sum, p) => sum + (p.stock || 0), 0) + activeReserves,
    }));
  }, [products, reserves]);

  useEffect(() => {
    if (!user) return;

    const reservesRef = ref(database, "reserves");
    const unsubscribeReserves = onValue(reservesRef, (snapshot) => {
      const reservesData: Reserve[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          reservesData.push({ id: child.key || "", ...child.val() });
        });
      }
      setReserves(reservesData);
    });

    return () => unsubscribeReserves();
  }, [user]);

  useEffect(() => {
    if (!user) return

    const visibilityRef = ref(database, "catalogVisibility")
    const unsubscribeVisibility = onValue(visibilityRef, (snapshot) => {
      if (!snapshot.exists()) {
        setCatalogVisibility({ newPhones: true, usedPhones: true })
        return
      }

      const data = snapshot.val() || {}
      setCatalogVisibility({
        newPhones: data.newPhones !== false,
        usedPhones: data.usedPhones !== false,
      })
    })

    return () => unsubscribeVisibility()
  }, [user])

  const handleCatalogVisibilityChange = async (
    key: "newPhones" | "usedPhones",
    checked: boolean | "indeterminate",
  ) => {
    const nextValue = checked === true
    const previous = catalogVisibility
    const nextState = {
      ...catalogVisibility,
      [key]: nextValue,
    }
    setCatalogVisibility(nextState)

    try {
      await set(ref(database, "catalogVisibility"), nextState)
    } catch (error) {
      console.error("Error al actualizar visibilidad del catálogo:", error)
      setCatalogVisibility(previous)
      toast.error("No se pudo actualizar la visibilidad del catálogo.")
    }
  }

  useEffect(() => {
    if (products.length === 0) {
      setDailySalesSummary(createEmptySummary());
      setDailySalesData([]);
    }

    const salesRef = ref(database, "sales")
    const unsubscribeSales = onValue(salesRef, (snapshot) => {
      const summary = createEmptySummary()
      const salesData: Sale[] = []
      let totalSalesAmount = 0
      const monthlySales: { [key: string]: number } = {}
      const filteredDailySales: Sale[] = []

      const productsMap = new Map(products.map(p => [p.id, p]));
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date()
      endOfDay.setHours(23, 59, 59, 999)

      let totalCostOfGoodsSold = 0

      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const sale: Sale = {
            id: childSnapshot.key || "",
            ...childSnapshot.val(),
          }

          salesData.push(sale)

          const saleDate = sale.date ? new Date(sale.date) : null
          const saleStore: StoreKey = sale.store === "local2" ? "local2" : "local1"
          const isToday = !!(saleDate && saleDate >= startOfDay && saleDate <= endOfDay)

          if (isToday) {
            const saleCategoryTotals: StoreSummary = {
              products: 0,
              newPhones: 0,
              usedPhones: 0,
              productsCount: 0,
              newPhonesCount: 0,
              usedPhonesCount: 0,
              total: 0,
              totalCount: 0,
            }

            sale.items?.forEach((item) => {
              const quantity = Number(item.quantity) || 0
              const price = Number(item.price) || 0
              const lineTotal = price * quantity

              saleCategoryTotals.totalCount += quantity

              if (item.category === "Celulares Nuevos") {
                saleCategoryTotals.newPhones += lineTotal
                saleCategoryTotals.newPhonesCount += quantity
              } else if (item.category === "Celulares Usados") {
                saleCategoryTotals.usedPhones += lineTotal
                saleCategoryTotals.usedPhonesCount += quantity
              } else {
                saleCategoryTotals.products += lineTotal
                saleCategoryTotals.productsCount += quantity
              }
            })

            let saleTotalForSummary =
              saleCategoryTotals.products + saleCategoryTotals.newPhones + saleCategoryTotals.usedPhones

            if (saleTotalForSummary === 0 && Number(sale.totalAmount || 0) > 0) {
              const fallbackAmount = Number(sale.totalAmount || 0)
              saleCategoryTotals.products += fallbackAmount
              saleTotalForSummary = fallbackAmount
            }

            summary[saleStore].products += saleCategoryTotals.products
            summary[saleStore].newPhones += saleCategoryTotals.newPhones
            summary[saleStore].usedPhones += saleCategoryTotals.usedPhones
            summary[saleStore].productsCount += saleCategoryTotals.productsCount
            summary[saleStore].newPhonesCount += saleCategoryTotals.newPhonesCount
            summary[saleStore].usedPhonesCount += saleCategoryTotals.usedPhonesCount
            summary[saleStore].total += saleTotalForSummary
            summary[saleStore].totalCount += saleCategoryTotals.totalCount

            summary.all.products += saleCategoryTotals.products
            summary.all.newPhones += saleCategoryTotals.newPhones
            summary.all.usedPhones += saleCategoryTotals.usedPhones
            summary.all.productsCount += saleCategoryTotals.productsCount
            summary.all.newPhonesCount += saleCategoryTotals.newPhonesCount
            summary.all.usedPhonesCount += saleCategoryTotals.usedPhonesCount
            summary.all.total += saleTotalForSummary
            summary.all.totalCount += saleCategoryTotals.totalCount

            if (selectedStore === "all" || saleStore === selectedStore) {
              filteredDailySales.push(sale)
            }
          }

          if (selectedStore === "all" || saleStore === selectedStore) {
            const saleAmount = Number(sale.totalAmount || 0)
            totalSalesAmount += saleAmount

            if (saleDate) {
              const month = saleDate.toLocaleString("es-AR", { month: "short" })
              monthlySales[month] = (monthlySales[month] || 0) + saleAmount
            }

            sale.items?.forEach((item) => {
              const productInfo = productsMap.get(item.productId)
              if (productInfo) {
                totalCostOfGoodsSold += (Number(productInfo.cost) || 0) * (Number(item.quantity) || 0)
              }
            })
          }
        })
      }

      filteredDailySales.sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0
        const dateB = b.date ? new Date(b.date).getTime() : 0
        return dateB - dateA
      })

      const totalProfit = totalSalesAmount - totalCostOfGoodsSold

      const formattedMonthlySales = Object.entries(monthlySales).map(([name, total]) => ({
        name,
        total,
      }))

      setSales(salesData)
      setDailySalesData(filteredDailySales)
      setDailySalesSummary(summary)

      setDashboardData((prev) => ({
        ...prev,
        totalSales: totalSalesAmount,
        totalProfit: totalProfit,
        salesGrowth: 20.1, // Simulado
        profitGrowth: 10.3, // Simulado
        monthlySales: formattedMonthlySales,
      }))
    })

    return () => unsubscribeSales();
  }, [products, selectedStore]);

  if (authLoading) { // Se usa el estado de carga del hook
    return <div className="flex h-screen items-center justify-center">Cargando...</div>
  }
  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold text-slate-800">iMarket</h1>
            <p className="mt-2 text-slate-600">Sistema de gestión para tu negocio de celulares</p>
          </div>
          <LoginForm />
        </div>
      </div>
    )
  }

  const selectedSummaryKey: SummaryKey = selectedStore === "all" ? "all" : selectedStore
  const selectedStoreSummary = dailySalesSummary[selectedSummaryKey]
  const selectedStoreLabel = storeLabels[selectedSummaryKey]

  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">
          Bienvenido, {user?.username} ({user?.role === "admin" ? "Administrador" : "Moderador"})
        </h1>

        {/* --- VISTA PARA ADMIN --- */}
        {user.role === 'admin' && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Ventas Totales</CardTitle>
                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${dashboardData.totalSales.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">
                  +{dashboardData.salesGrowth.toFixed(1)}% desde el mes pasado
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Productos en Stock</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData.totalProducts}</div>
                <p className="text-xs text-muted-foreground">+{dashboardData.productsGrowth} nuevos productos</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Inversión Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${dashboardData.totalInvestment.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">
                  +{dashboardData.investmentGrowth.toFixed(1)}% desde el mes pasado
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Ganancias</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${dashboardData.totalProfit.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">
                  +{dashboardData.profitGrowth.toFixed(1)}% desde el mes pasado
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* --- VISTA PARA MODERADOR --- */}
        {user.role === 'moderator' && (
          <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-1 mb-6">
            <Card className="col-span-1">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-destructive">Productos con Bajo Stock</CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                {lowStockProducts.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead>Categoría</TableHead>
                          <TableHead className="text-right">Stock Actual</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                          {lowStockProducts.map((p) => (
                              <TableRow key={p.id}>
                                  <TableCell className="font-medium">{p.name}</TableCell>
                                  <TableCell>{p.category}</TableCell>
                                  <TableCell className="text-right">
                                      <Badge variant="destructive">{p.stock}</Badge>
                                  </TableCell>
                              </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No hay productos con bajo stock.</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Ventas de Productos (Hoy)</CardTitle>
              <Box className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currencyFormatter.format(selectedStoreSummary.products)}</div>
              <p className="text-xs text-muted-foreground">Resumen diario - {selectedStoreLabel}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Ventas de Celulares Nuevos (Hoy)</CardTitle>
              <Smartphone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  id="catalog-new-phones"
                  checked={catalogVisibility.newPhones}
                  onCheckedChange={(checked) => handleCatalogVisibilityChange("newPhones", checked)}
                />
                <label htmlFor="catalog-new-phones">Mostrar en catálogo</label>
              </div>
              <div className="text-2xl font-bold">{currencyFormatter.format(selectedStoreSummary.newPhones)}</div>
              <p className="text-xs text-muted-foreground">Resumen diario - {selectedStoreLabel}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Ventas de Celulares Usados (Hoy)</CardTitle>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  id="catalog-used-phones"
                  checked={catalogVisibility.usedPhones}
                  onCheckedChange={(checked) => handleCatalogVisibilityChange("usedPhones", checked)}
                />
                <label htmlFor="catalog-used-phones">Mostrar en catálogo</label>
              </div>
              <div className="text-2xl font-bold">{currencyFormatter.format(selectedStoreSummary.usedPhones)}</div>
              <p className="text-xs text-muted-foreground">Resumen diario - {selectedStoreLabel}</p>
            </CardContent>
          </Card>
        </div>

        {selectedStore === "all" ? (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Estado de ventas por local (Hoy)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {(["local1", "local2"] as StoreKey[]).map((store) => {
                  const summary = dailySalesSummary[store]
                  const hasSales = summary.total > 0
                  return (
                    <div key={store} className="rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{storeLabels[store]}</span>
                        <Badge variant={hasSales ? "default" : "destructive"}>
                          {hasSales ? "Con ventas" : "Sin ventas"}
                        </Badge>
                      </div>
                      <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                        <p>
                          Productos: {currencyFormatter.format(summary.products)} · {summary.productsCount}{" "}
                          {summary.productsCount === 1 ? "unidad" : "unidades"}
                        </p>
                        <p>
                          Celulares nuevos: {currencyFormatter.format(summary.newPhones)} · {summary.newPhonesCount}{" "}
                          {summary.newPhonesCount === 1 ? "unidad" : "unidades"}
                        </p>
                        <p>
                          Celulares usados: {currencyFormatter.format(summary.usedPhones)} · {summary.usedPhonesCount}{" "}
                          {summary.usedPhonesCount === 1 ? "unidad" : "unidades"}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Estado de ventas - {selectedStoreLabel}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Actividad diaria</span>
                  <Badge variant={selectedStoreSummary.total > 0 ? "default" : "destructive"}>
                    {selectedStoreSummary.total > 0 ? "Con ventas hoy" : "Sin ventas hoy"}
                  </Badge>
                </div>
                <p>
                  Productos: {currencyFormatter.format(selectedStoreSummary.products)} · {selectedStoreSummary.productsCount}{" "}
                  {selectedStoreSummary.productsCount === 1 ? "unidad" : "unidades"}
                </p>
                <p>
                  Celulares nuevos: {currencyFormatter.format(selectedStoreSummary.newPhones)} · {selectedStoreSummary.newPhonesCount}{" "}
                  {selectedStoreSummary.newPhonesCount === 1 ? "unidad" : "unidades"}
                </p>
                <p>
                  Celulares usados: {currencyFormatter.format(selectedStoreSummary.usedPhones)} · {selectedStoreSummary.usedPhonesCount}{" "}
                  {selectedStoreSummary.usedPhonesCount === 1 ? "unidad" : "unidades"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* --- Gráficos y Tablas (SOLO PARA ADMIN) --- */}
        {user.role === 'admin' && (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="overview">Resumen</TabsTrigger>
              <TabsTrigger value="sales">Ventas del Día</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Ventas Mensuales</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={dashboardData.monthlySales}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="total" fill="#8884d8" name="Ventas" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="sales" className="mt-6">
              <Card>
                  <CardHeader>
                      <CardTitle>Ventas Realizadas Hoy</CardTitle>
                  </CardHeader>
                  <CardContent>
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead>Hora</TableHead>
                                  <TableHead>Cliente</TableHead>
                                  {selectedStore === "all" && <TableHead>Local</TableHead>}
                                  <TableHead>Productos</TableHead>
                                  <TableHead className="text-right">Monto</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {dailySalesData.length > 0 ? (
                                  dailySalesData.map(sale => (
                                      <TableRow key={sale.id}>
                                          <TableCell>{sale.date ? new Date(sale.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</TableCell>
                                          <TableCell>
                                              <div className="flex items-center gap-2">
                                                  <User className="h-4 w-4 text-muted-foreground" />
                                                  {sale.customerName}
                                              </div>
                                          </TableCell>
                                          {selectedStore === "all" && (
                                            <TableCell>{storeLabels[sale.store === "local2" ? "local2" : "local1"]}</TableCell>
                                          )}
                                          <TableCell>{sale.items?.map(item => item.productName).join(', ') || '-'}</TableCell>
                                          <TableCell className="text-right">${(sale.totalAmount || 0).toFixed(2)}</TableCell>
                                      </TableRow>
                                  ))
                              ) : (
                                  <TableRow>
                                      <TableCell colSpan={selectedStore === "all" ? 5 : 4} className="text-center py-6 text-muted-foreground">
                                          No se han registrado ventas hoy en {selectedStoreLabel.toLowerCase()}.
                                      </TableCell>
                                  </TableRow>
                              )}
                          </TableBody>
                      </Table>
                  </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  )
}
