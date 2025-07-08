"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, LineChart, PieChart, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function ReportsPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ username: string; role: string } | null>(null)
  const [timeRange, setTimeRange] = useState("month")

  useEffect(() => {
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
      }
    } catch (e) {
      localStorage.removeItem("user")
      router.push("/")
    }
  }, [router])

  if (!user || user.role !== "admin") {
    return null // No mostrar nada mientras se redirige
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Reportes y Estadísticas</h1>
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
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </div>
        </div>

        <Tabs defaultValue="sales" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="sales">Ventas</TabsTrigger>
            <TabsTrigger value="inventory">Inventario</TabsTrigger>
            <TabsTrigger value="finances">Finanzas</TabsTrigger>
            <TabsTrigger value="customers">Clientes</TabsTrigger>
          </TabsList>
          <TabsContent value="sales" className="mt-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="col-span-2">
                <CardHeader>
                  <CardTitle>Ventas por Período</CardTitle>
                  <CardDescription>
                    Análisis de ventas para{" "}
                    {timeRange === "week"
                      ? "esta semana"
                      : timeRange === "month"
                        ? "este mes"
                        : timeRange === "quarter"
                          ? "este trimestre"
                          : "este año"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center bg-muted/20">
                  <LineChart className="h-8 w-8 text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Gráfico de Ventas por Período</span>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Productos Más Vendidos</CardTitle>
                  <CardDescription>Top 5 productos con mayor volumen de ventas</CardDescription>
                </CardHeader>
                <CardContent className="h-[250px] flex items-center justify-center bg-muted/20">
                  <BarChart className="h-8 w-8 text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Gráfico de Productos Más Vendidos</span>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Ventas por Categoría</CardTitle>
                  <CardDescription>Distribución de ventas por categoría de producto</CardDescription>
                </CardHeader>
                <CardContent className="h-[250px] flex items-center justify-center bg-muted/20">
                  <PieChart className="h-8 w-8 text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Gráfico de Ventas por Categoría</span>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="inventory" className="mt-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Rotación de Inventario</CardTitle>
                  <CardDescription>Análisis de la rotación de productos en inventario</CardDescription>
                </CardHeader>
                <CardContent className="h-[250px] flex items-center justify-center bg-muted/20">
                  <BarChart className="h-8 w-8 text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Gráfico de Rotación de Inventario</span>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Productos con Bajo Stock</CardTitle>
                  <CardDescription>Productos que requieren reposición</CardDescription>
                </CardHeader>
                <CardContent className="h-[250px] flex items-center justify-center bg-muted/20">
                  <BarChart className="h-8 w-8 text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Gráfico de Productos con Bajo Stock</span>
                </CardContent>
              </Card>
              <Card className="col-span-2">
                <CardHeader>
                  <CardTitle>Valor del Inventario por Tiempo</CardTitle>
                  <CardDescription>Evolución del valor total del inventario</CardDescription>
                </CardHeader>
                <CardContent className="h-[250px] flex items-center justify-center bg-muted/20">
                  <LineChart className="h-8 w-8 text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Gráfico de Valor del Inventario</span>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="finances" className="mt-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="col-span-2">
                <CardHeader>
                  <CardTitle>Ingresos vs Gastos</CardTitle>
                  <CardDescription>Comparativa de ingresos y gastos a lo largo del tiempo</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center bg-muted/20">
                  <LineChart className="h-8 w-8 text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Gráfico de Ingresos vs Gastos</span>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Margen de Ganancia por Producto</CardTitle>
                  <CardDescription>Productos con mayor margen de ganancia</CardDescription>
                </CardHeader>
                <CardContent className="h-[250px] flex items-center justify-center bg-muted/20">
                  <BarChart className="h-8 w-8 text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Gráfico de Margen de Ganancia</span>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Rentabilidad por Categoría</CardTitle>
                  <CardDescription>Análisis de rentabilidad por categoría de producto</CardDescription>
                </CardHeader>
                <CardContent className="h-[250px] flex items-center justify-center bg-muted/20">
                  <PieChart className="h-8 w-8 text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Gráfico de Rentabilidad por Categoría</span>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="customers" className="mt-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Clientes Frecuentes</CardTitle>
                  <CardDescription>Top 10 clientes con mayor frecuencia de compra</CardDescription>
                </CardHeader>
                <CardContent className="h-[250px] flex items-center justify-center bg-muted/20">
                  <BarChart className="h-8 w-8 text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Gráfico de Clientes Frecuentes</span>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Valor de Compra por Cliente</CardTitle>
                  <CardDescription>Clientes con mayor valor de compra</CardDescription>
                </CardHeader>
                <CardContent className="h-[250px] flex items-center justify-center bg-muted/20">
                  <BarChart className="h-8 w-8 text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Gráfico de Valor de Compra</span>
                </CardContent>
              </Card>
              <Card className="col-span-2">
                <CardHeader>
                  <CardTitle>Historial de Compras por Cliente</CardTitle>
                  <CardDescription>Análisis detallado del historial de compras</CardDescription>
                </CardHeader>
                <CardContent className="h-[250px] flex items-center justify-center bg-muted/20">
                  <LineChart className="h-8 w-8 text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Gráfico de Historial de Compras</span>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
