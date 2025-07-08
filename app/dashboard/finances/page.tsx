"use client"

import React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DollarSign, TrendingUp, TrendingDown, BarChart, PieChart, Calendar, Download } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ref, onValue } from "firebase/database"
import { database } from "@/lib/firebase"
import { useToast } from "@/components/ui/use-toast"

// Definir interfaces para los tipos
interface User {
  username: string
  role: string
}

interface Sale {
  id: string
  date: string
  productId?: string
  salePrice?: number | string
  [key: string]: any
}

interface Product {
  id: string
  cost?: number
  [key: string]: any
}

interface MonthSale {
  month: string
  year: number
  total: number
}

interface ProductProfitability {
  productId: string
  productName: string
  totalSales: number
  quantity: number
  cost: number
  profit: number
  margin: number
}

interface FinancialData {
  totalIncome: number
  totalCosts: number
  profit: number
  profitMargin: number
  monthlySales: MonthSale[]
  productProfitability: ProductProfitability[]
}

export default function FinancesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [user, setUser] = useState<User | null>(null)
  const [sales, setSales] = useState<Sale[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [timeRange, setTimeRange] = useState("month")
  const [isLoading, setIsLoading] = useState(true)
  const [financialData, setFinancialData] = useState<FinancialData>({
    totalIncome: 0,
    totalCosts: 0,
    profit: 0,
    profitMargin: 0,
    monthlySales: [],
    productProfitability: [],
  })

  useEffect(() => {
    setIsLoading(true)

    // Verificar autenticación y rol
    const storedUser = localStorage.getItem("user")
    if (!storedUser) {
      router.push("/")
      return
    }

    try {
      const parsedUser = JSON.parse(storedUser)
      setUser(parsedUser)

      // Redirigir si no es administrador
      if (parsedUser.role !== "admin") {
        router.push("/dashboard")
        return
      }
    } catch (e) {
      localStorage.removeItem("user")
      router.push("/")
      return
    }

    // Cargar ventas desde Firebase con manejo de errores
    try {
      const salesRef = ref(database, "sales")
      const unsubscribeSales = onValue(
        salesRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const salesData: Sale[] = []
            snapshot.forEach((childSnapshot) => {
              salesData.push({
                id: childSnapshot.key || "",
                ...childSnapshot.val(),
              })
            })
            setSales(salesData)
          } else {
            setSales([])
          }
        },
        (error) => {
          console.error("Error al cargar ventas:", error)
          toast({
            title: "Error",
            description: "No se pudieron cargar los datos de ventas",
            variant: "destructive",
          })
          setSales([])
        },
      )

      // Cargar productos desde Firebase con manejo de errores
      const productsRef = ref(database, "products")
      const unsubscribeProducts = onValue(
        productsRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const productsData: Product[] = []
            snapshot.forEach((childSnapshot) => {
              productsData.push({
                id: childSnapshot.key || "",
                ...childSnapshot.val(),
              })
            })
            setProducts(productsData)
          } else {
            setProducts([])
          }
        },
        (error) => {
          console.error("Error al cargar productos:", error)
          toast({
            title: "Error",
            description: "No se pudieron cargar los datos de productos",
            variant: "destructive",
          })
          setProducts([])
        },
      )

      return () => {
        unsubscribeSales && unsubscribeSales()
        unsubscribeProducts && unsubscribeProducts()
      }
    } catch (error) {
      console.error("Error general:", error)
      toast({
        title: "Error de conexión",
        description: "No se pudo conectar con la base de datos",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [router, toast])

  // Calcular datos financieros cuando cambian las ventas o el rango de tiempo
  useEffect(() => {
    calculateFinancialData()
  }, [sales, products, timeRange])

  const calculateFinancialData = () => {
    if (sales.length === 0) {
      setFinancialData({
        totalIncome: 0,
        totalCosts: 0,
        profit: 0,
        profitMargin: 0,
        monthlySales: [],
        productProfitability: [],
      })
      return
    }

    // Filtrar ventas según el rango de tiempo seleccionado
    const now = new Date()
    const filteredSales = sales.filter((sale) => {
      const saleDate = new Date(sale.date)
      if (timeRange === "week") {
        const weekStart = new Date(now)
        weekStart.setDate(now.getDate() - 7)
        return saleDate >= weekStart
      } else if (timeRange === "month") {
        const monthStart = new Date(now)
        monthStart.setMonth(now.getMonth() - 1)
        return saleDate >= monthStart
      } else if (timeRange === "quarter") {
        const quarterStart = new Date(now)
        quarterStart.setMonth(now.getMonth() - 3)
        return saleDate >= quarterStart
      } else if (timeRange === "year") {
        const yearStart = new Date(now)
        yearStart.setFullYear(now.getFullYear() - 1)
        return saleDate >= yearStart
      }
      return true // Si no hay filtro, incluir todas
    })

    // Calcular ingresos totales
    const totalIncome = filteredSales.reduce((sum, sale) => sum + Number(sale.salePrice || 0), 0)

    // Calcular costos totales (basados en el costo de los productos vendidos)
    let totalCosts = 0
    filteredSales.forEach((sale) => {
      const product = products.find((p) => p.id === sale.productId)
      if (product) {
        totalCosts += Number(product.cost || 0)
      }
    })

    // Calcular ganancia y margen
    const profit = totalIncome - totalCosts
    const profitMargin = totalIncome > 0 ? (profit / totalIncome) * 100 : 0

    // Simplificar el cálculo de ventas mensuales
    const monthlySales: MonthSale[] = []
    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

    // Agrupar ventas por mes (versión simplificada)
    const salesByMonth: Record<string, MonthSale> = {}
    filteredSales.forEach((sale) => {
      const date = new Date(sale.date)
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`
      if (!salesByMonth[monthKey]) {
        salesByMonth[monthKey] = {
          month: monthNames[date.getMonth()],
          year: date.getFullYear(),
          total: 0,
        }
      }
      salesByMonth[monthKey].total += Number(sale.salePrice || 0)
    })

    // Convertir a array para gráficos
    Object.values(salesByMonth).forEach((monthData) => {
      monthlySales.push(monthData)
    })

    // Simplificar el cálculo de rentabilidad por producto
    const productProfitability: ProductProfitability[] = []
    const salesByProduct: Record<string, ProductProfitability> = {}

    filteredSales.forEach((sale) => {
      if (!sale.productId) return

      if (!salesByProduct[sale.productId]) {
        salesByProduct[sale.productId] = {
          productId: sale.productId,
          productName: sale.productName || "Producto sin nombre",
          totalSales: 0,
          quantity: 0,
          cost: 0,
          profit: 0,
          margin: 0,
        }
      }

      salesByProduct[sale.productId].totalSales += Number(sale.salePrice || 0)
      salesByProduct[sale.productId].quantity += 1

      const product = products.find((p) => p.id === sale.productId)
      if (product) {
        salesByProduct[sale.productId].cost += Number(product.cost || 0)
      }
    })

    // Calcular ganancia y margen por producto
    Object.values(salesByProduct).forEach((productData) => {
      productData.profit = productData.totalSales - productData.cost
      productData.margin = productData.totalSales > 0 ? (productData.profit / productData.totalSales) * 100 : 0
      productProfitability.push(productData)
    })

    // Ordenar por ganancia (de mayor a menor)
    productProfitability.sort((a, b) => b.profit - a.profit)

    setFinancialData({
      totalIncome,
      totalCosts,
      profit,
      profitMargin,
      monthlySales,
      productProfitability,
    })
  }

  const handleExportData = () => {
    try {
      // Crear un objeto con los datos a exportar
      const dataToExport = {
        summary: {
          totalIncome: financialData.totalIncome,
          totalCosts: financialData.totalCosts,
          profit: financialData.profit,
          profitMargin: financialData.profitMargin,
          timeRange: timeRange,
        },
        monthlySales: financialData.monthlySales,
        productProfitability: financialData.productProfitability,
        exportDate: new Date().toISOString(),
      }

      // Convertir a JSON
      const jsonData = JSON.stringify(dataToExport, null, 2)

      // Crear un blob y descargar
      const blob = new Blob([jsonData], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `finanzas-${timeRange}-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: "Datos exportados",
        description: "Los datos financieros han sido exportados correctamente",
      })
    } catch (error) {
      console.error("Error al exportar datos:", error)
      toast({
        title: "Error",
        description: "Ocurrió un error al exportar los datos",
        variant: "destructive",
      })
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
    return null // No mostrar nada mientras se redirige
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

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${financialData.totalIncome.toFixed(2)}</div>
              <div className="flex items-center text-xs text-green-500">
                <TrendingUp className="mr-1 h-3 w-3" />
                <span>
                  Período:{" "}
                  {timeRange === "week"
                    ? "Semanal"
                    : timeRange === "month"
                      ? "Mensual"
                      : timeRange === "quarter"
                        ? "Trimestral"
                        : "Anual"}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Costos Totales</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${financialData.totalCosts.toFixed(2)}</div>
              <div className="flex items-center text-xs text-red-500">
                <TrendingDown className="mr-1 h-3 w-3" />
                <span>Costos de productos vendidos</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Ganancias</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${financialData.profit.toFixed(2)}</div>
              <div className="flex items-center text-xs text-green-500">
                <TrendingUp className="mr-1 h-3 w-3" />
                <span>Ingresos - Costos</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Margen de Ganancia</CardTitle>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{financialData.profitMargin.toFixed(2)}%</div>
              <div className="flex items-center text-xs text-green-500">
                <TrendingUp className="mr-1 h-3 w-3" />
                <span>Porcentaje de ganancia</span>
              </div>
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
                          {/* Aquí iría un gráfico real, pero para simplificar mostramos datos */}
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {financialData.monthlySales.map((monthData, index) => (
                              <div key={index} className="flex justify-between">
                                <span>
                                  {monthData.month} {monthData.year}
                                </span>
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
                          {/* Aquí iría un gráfico real, pero para simplificar mostramos datos */}
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
