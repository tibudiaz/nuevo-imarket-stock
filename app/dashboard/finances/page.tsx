"use client"

import React, { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DollarSign, TrendingUp, TrendingDown, BarChart, PieChart, Calendar, Download, Smartphone, Headphones } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ref, onValue } from "firebase/database"
import { database } from "@/lib/firebase"
import { Reserve } from "@/components/complete-reserve-modal"
import { toast } from "sonner"
import { useAuth } from "@/hooks/use-auth"

// --- Interfaces de Datos ---
interface SaleItem {
  productId: string;
  productName?: string;
  quantity: number;
  price: number;
  [key: string]: any;
}

interface Sale {
  id: string;
  date: string;
  items: SaleItem[];
  totalAmount: number;
  [key: string]: any;
}

interface Product {
  id: string;
  category?: string;
  cost?: number;
  stock?: number;
  [key: string]: any;
}

interface MonthSale {
  month: string;
  year: number;
  total: number;
}

interface ProductProfitability {
  productId: string;
  productName: string;
  totalSales: number;
  quantity: number;
  cost: number;
  profit: number;
  margin: number;
}

interface FinancialData {
  totalIncome: number;
  totalCosts: number;
  profit: number;
  profitMargin: number;
  monthlySales: MonthSale[];
  productProfitability: ProductProfitability[];
  deviceCount: number;
  deviceTotalCost: number;
  accessoryCount: number;
  accessoryTotalCost: number;
}


export default function FinancesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [sales, setSales] = useState<Sale[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [reserves, setReserves] = useState<Reserve[]>([])
  const [timeRange, setTimeRange] = useState("month")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push("/")
      return
    }
    if (user.role !== "admin") {
      toast.error("Acceso denegado", { description: "No tienes permiso para ver esta página." })
      router.push("/dashboard")
      return
    }

    const salesRef = ref(database, "sales")
    const unsubscribeSales = onValue(salesRef, (snapshot) => {
      const salesData: Sale[] = []
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          salesData.push({ id: child.key!, ...child.val() })
        })
      }
      setSales(salesData)
    }, (error) => {
      console.error("Error al cargar ventas:", error)
      toast.error("Error de Ventas", { description: "No se pudieron cargar los datos de ventas." })
    })

    const productsRef = ref(database, "products")
    const unsubscribeProducts = onValue(productsRef, (snapshot) => {
      const productsData: Product[] = []
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          productsData.push({ id: child.key!, ...child.val() })
        })
      }
      setProducts(productsData)
      setIsLoading(false)
    }, (error) => {
      console.error("Error al cargar productos:", error)
      toast.error("Error de Productos", { description: "No se pudieron cargar los datos de productos." })
      setIsLoading(false)
    })

    const reservesRef = ref(database, "reserves")
    const unsubscribeReserves = onValue(reservesRef, (snapshot) => {
      const reservesData: Reserve[] = []
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          reservesData.push({ id: child.key!, ...child.val() })
        })
      }
      setReserves(reservesData)
    })

    return () => {
      unsubscribeSales()
      unsubscribeProducts()
      unsubscribeReserves()
    }
  }, [router, user, authLoading])

  const financialData = useMemo<FinancialData>(() => {
    if (sales.length === 0 && products.length === 0 && reserves.length === 0) {
      return { totalIncome: 0, totalCosts: 0, profit: 0, profitMargin: 0, monthlySales: [], productProfitability: [], deviceCount: 0, deviceTotalCost: 0, accessoryCount: 0, accessoryTotalCost: 0 }
    }

    const now = new Date()
    const filteredSales = sales.filter((sale) => {
      const saleDate = new Date(sale.date)
      if (timeRange === "week") return saleDate >= new Date(now.setDate(now.getDate() - 7))
      if (timeRange === "month") return saleDate >= new Date(now.setMonth(now.getMonth() - 1))
      if (timeRange === "quarter") return saleDate >= new Date(now.setMonth(now.getMonth() - 3))
      if (timeRange === "year") return saleDate >= new Date(now.setFullYear(now.getFullYear() - 1))
      return true
    })

    const totalIncome = filteredSales.reduce((sum, sale) => {
        if (!Array.isArray(sale.items)) return sum
        const saleTotal = sale.items.reduce((acc, item) => acc + Number(item.price || 0) * Number(item.quantity || 1), 0)
        return sum + saleTotal
    }, 0)

    const productMap = new Map(products.map(p => [p.id, p]));

    const totalCosts = filteredSales.reduce((sum, sale) => {
        if (!Array.isArray(sale.items)) return sum
        const saleCost = sale.items.reduce((acc, item) => {
            const product = productMap.get(item.productId)
            const cost = product ? Number(product.cost || 0) : 0
            return acc + cost * Number(item.quantity || 1)
        }, 0)
        return sum + saleCost
    }, 0)

    const profit = totalIncome - totalCosts
    const profitMargin = totalIncome > 0 ? (profit / totalIncome) * 100 : 0

    const salesByMonth: Record<string, { total: number }> = {}
    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
    
    filteredSales.forEach((sale) => {
      const date = new Date(sale.date)
      const monthKey = `${date.getFullYear()}-${monthNames[date.getMonth()]}`
      if (!salesByMonth[monthKey]) {
        salesByMonth[monthKey] = { total: 0 }
      }
      const saleTotal = Array.isArray(sale.items)
        ? sale.items.reduce((acc, item) => acc + Number(item.price || 0) * Number(item.quantity || 1), 0)
        : 0
      salesByMonth[monthKey].total += saleTotal
    })

    const monthlySales = Object.entries(salesByMonth).map(([key, value]) => {
        const [year, month] = key.split('-');
        return { month, year: parseInt(year), total: value.total };
    });

    const salesByProduct: Record<string, ProductProfitability> = {}
    filteredSales.forEach((sale) => {
        if (!Array.isArray(sale.items)) return
        sale.items.forEach(item => {
            const pid = item.productId
            if (!salesByProduct[pid]) {
                const product = productMap.get(pid)
                salesByProduct[pid] = {
                    productId: pid,
                    productName: item.productName || product?.name || "Desconocido",
                    totalSales: 0,
                    quantity: 0,
                    cost: 0,
                    profit: 0,
                    margin: 0,
                }
            }
            const productData = salesByProduct[pid]
            const productCost = productMap.get(pid)?.cost || 0
            const qty = Number(item.quantity || 1)
            const price = Number(item.price || 0)
            productData.totalSales += price * qty
            productData.quantity += qty
            productData.cost += productCost * qty
        })
    })
    
    const productProfitability = Object.values(salesByProduct).map(p => {
        p.profit = p.totalSales - p.cost;
        p.margin = p.totalSales > 0 ? (p.profit / p.totalSales) * 100 : 0;
        return p;
    }).sort((a, b) => b.profit - a.profit);

    let deviceCount = 0;
    let deviceTotalCost = 0;
    let accessoryCount = 0;
    let accessoryTotalCost = 0;

    products.forEach(product => {
        const stock = Number(product.stock) || 0;
        const cost = Number(product.cost) || 0;
        const totalCostForProduct = cost * stock;

        // --- LÓGICA CORREGIDA Y SIMPLIFICADA ---
        const category = product.category;
        if (category === "Celulares Nuevos" || category === "Celulares Usados") {
            deviceCount += stock;
            deviceTotalCost += totalCostForProduct;
        } else {
            accessoryCount += stock;
            accessoryTotalCost += totalCostForProduct;
        }
    });

    const activeReserves = reserves.filter(r => r.status === "reserved");
    activeReserves.forEach(reserve => {
        const prod = productMap.get(reserve.productId || "");
        if (!prod) return;
        const cost = Number(prod.cost) || 0;
        const category = prod.category;
        if (category === "Celulares Nuevos" || category === "Celulares Usados") {
            deviceCount += 1;
            deviceTotalCost += cost;
        } else {
            accessoryCount += 1;
            accessoryTotalCost += cost;
        }
    });

    return { totalIncome, totalCosts, profit, profitMargin, monthlySales, productProfitability, deviceCount, deviceTotalCost, accessoryCount, accessoryTotalCost }
  }, [sales, products, reserves, timeRange])

  const handleExportData = () => {
    try {
      const dataToExport = {
        summary: {
          totalIncome: financialData.totalIncome,
          totalCosts: financialData.totalCosts,
          profit: financialData.profit,
          profitMargin: financialData.profitMargin,
          timeRange,
        },
        monthlySales: financialData.monthlySales,
        productProfitability: financialData.productProfitability,
        exportDate: new Date().toISOString(),
      }
      const jsonData = JSON.stringify(dataToExport, null, 2)
      const blob = new Blob([jsonData], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `finanzas-${timeRange}-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success("Datos exportados", { description: "Los datos financieros han sido exportados correctamente" })
    } catch (error) {
      console.error("Error al exportar datos:", error)
      toast.error("Error", { description: "Ocurrió un error al exportar los datos" })
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center p-6">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <span className="ml-2">Cargando datos financieros...</span>
        </div>
      </DashboardLayout>
    )
  }

  if (!user || user.role !== "admin") {
    return null 
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Finanzas</h1>
          <div className="flex items-center gap-4">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Seleccionar período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Esta Semana</SelectItem>
                <SelectItem value="month">Este Mes</SelectItem>
                <SelectItem value="quarter">Este Trimestre</SelectItem>
                <SelectItem value="year">Este Año</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleExportData}>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${financialData.totalIncome.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Ganancias</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${financialData.profit.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Margen de Ganancia</CardTitle>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{financialData.profitMargin.toFixed(2)}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Dispositivos (Celulares)</CardTitle>
              <Smartphone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{financialData.deviceCount} unidades</div>
              <p className="text-xs text-muted-foreground">
                Valor de costo total: ${financialData.deviceTotalCost.toFixed(2)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Accesorios</CardTitle>
              <Headphones className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{financialData.accessoryCount} unidades</div>
              <p className="text-xs text-muted-foreground">
                Valor de costo total: ${financialData.accessoryTotalCost.toFixed(2)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Costos Totales de Mercadería</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${(financialData.deviceTotalCost + financialData.accessoryTotalCost).toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Resumen</TabsTrigger>
            <TabsTrigger value="products">Productos</TabsTrigger>
            <TabsTrigger value="reports">Reportes</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Resumen Financiero</CardTitle>
                <CardDescription>Visión general de los ingresos, costos y ganancias del negocio.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Ventas por Mes</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[200px] flex items-center justify-center bg-muted/20">
                      {financialData.monthlySales.length > 0 ? (
                        <div className="w-full h-full">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {financialData.monthlySales.map((monthData, index) => (
                              <div key={index} className="flex justify-between">
                                <span>{monthData.month} {monthData.year}</span>
                                <span className="font-medium">${monthData.total.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <BarChart className="h-8 w-8 mb-2" />
                          <span>No hay datos de ventas para mostrar</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Distribución de Ventas por Categoría</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[200px] flex items-center justify-center bg-muted/20">
                      {financialData.productProfitability.length > 0 ? (
                        <div className="w-full h-full">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {financialData.productProfitability.slice(0, 5).map((product, index) => (
                              <div key={index} className="flex justify-between">
                                <span>{product.productName}</span>
                                <span className="font-medium">${product.totalSales.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <PieChart className="h-8 w-8 mb-2" />
                          <span>No hay datos de ventas para mostrar</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="products" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Rentabilidad por Producto</CardTitle>
                <CardDescription>Análisis de costos, precios y márgenes de ganancia por producto.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Precio Venta</TableHead>
                      <TableHead>Costo</TableHead>
                      <TableHead>Margen</TableHead>
                      <TableHead>Ganancia</TableHead>
                      <TableHead>Vendidos</TableHead>
                      <TableHead>Ganancia Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {financialData.productProfitability.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                          No hay datos de productos para mostrar
                        </TableCell>
                      </TableRow>
                    ) : (
                      financialData.productProfitability.slice(0, 10).map((product, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{product.productName}</TableCell>
                          <TableCell>${(product.totalSales / product.quantity).toFixed(2)}</TableCell>
                          <TableCell>${(product.cost / product.quantity).toFixed(2)}</TableCell>
                          <TableCell>{product.margin.toFixed(2)}%</TableCell>
                          <TableCell>${(product.profit / product.quantity).toFixed(2)}</TableCell>
                          <TableCell>{product.quantity}</TableCell>
                          <TableCell>${product.profit.toFixed(2)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="reports" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Reportes Financieros</CardTitle>
                <CardDescription>Reportes detallados de ingresos, gastos y ganancias.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Reporte Mensual</CardTitle>
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="text-sm text-muted-foreground">Ingresos:</div>
                          <div className="text-sm font-medium text-right">${financialData.totalIncome.toFixed(2)}</div>
                          <div className="text-sm text-muted-foreground">Costos:</div>
                          <div className="text-sm font-medium text-right">${financialData.totalCosts.toFixed(2)}</div>
                          <div className="text-sm text-muted-foreground">Ganancias:</div>
                          <div className="text-sm font-medium text-right">${financialData.profit.toFixed(2)}</div>
                          <div className="text-sm text-muted-foreground">Margen:</div>
                          <div className="text-sm font-medium text-right">{financialData.profitMargin.toFixed(2)}%</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium">Productos Más Rentables</CardTitle>
                      <BarChart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                          {financialData.productProfitability.slice(0, 5).map((product, index) => (
                            <React.Fragment key={index}>
                              <div className="text-sm text-muted-foreground">{product.productName}:</div>
                              <div className="text-sm font-medium text-right">${product.profit.toFixed(2)}</div>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}