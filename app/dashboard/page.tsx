"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ShoppingBag, Package, DollarSign, TrendingUp } from "lucide-react"
import { ref, onValue } from "firebase/database"
import { database } from "@/lib/firebase"

// Definir interfaces para los tipos
interface User {
  username: string
  role: string
}

interface Sale {
  id: string
  productId?: string
  salePrice?: number
  date?: string
  [key: string]: any
}

interface Product {
  id: string
  cost?: number
  stock?: number
  [key: string]: any
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
}

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    totalSales: 0,
    totalProducts: 0,
    totalInvestment: 0,
    totalProfit: 0,
    salesGrowth: 0,
    productsGrowth: 0,
    investmentGrowth: 0,
    profitGrowth: 0,
  })

  useEffect(() => {
    // Verificar autenticación
    const storedUser = localStorage.getItem("user")
    if (!storedUser) {
      router.push("/")
      return
    }

    try {
      setUser(JSON.parse(storedUser))
    } catch (e) {
      localStorage.removeItem("user")
      router.push("/")
    }

    // Cargar datos para el dashboard
    loadDashboardData()

    setIsLoading(false)
  }, [router])

  const loadDashboardData = () => {
    // Cargar ventas
    const salesRef = ref(database, "sales")
    onValue(salesRef, (snapshot) => {
      if (snapshot.exists()) {
        const salesData: Sale[] = []
        let totalSalesAmount = 0

        snapshot.forEach((childSnapshot) => {
          const sale: Sale = {
            id: childSnapshot.key || "",
            ...childSnapshot.val(),
          }
          salesData.push(sale)
          totalSalesAmount += Number(sale.salePrice || 0)
        })

        // Calcular crecimiento (simulado)
        const salesGrowth = salesData.length > 0 ? 20.1 : 0 // Valor simulado

        // Actualizar datos del dashboard
        setDashboardData((prev) => ({
          ...prev,
          totalSales: totalSalesAmount,
          salesGrowth: salesGrowth,
        }))

        // Calcular ganancias
        calculateProfits(salesData)
      }
    })

    // Cargar productos
    const productsRef = ref(database, "products")
    onValue(productsRef, (snapshot) => {
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

        // Calcular crecimiento (simulado)
        const productsGrowth = productsData.length > 0 ? 12 : 0 // Valor simulado para nuevos productos
        const investmentGrowth = totalInvestment > 0 ? 5.2 : 0 // Valor simulado

        // Actualizar datos del dashboard
        setDashboardData((prev) => ({
          ...prev,
          totalProducts: productsData.length,
          totalInvestment: totalInvestment,
          productsGrowth: productsGrowth,
          investmentGrowth: investmentGrowth,
        }))
      }
    })
  }

  const calculateProfits = (salesData: Sale[]) => {
    // Cargar productos para obtener costos
    const productsRef = ref(database, "products")
    onValue(productsRef, (snapshot) => {
      if (snapshot.exists()) {
        const productsMap: Record<string, Product> = {}

        // Crear un mapa de productos para búsqueda rápida
        snapshot.forEach((childSnapshot) => {
          const product: Product = {
            id: childSnapshot.key || "",
            ...childSnapshot.val(),
          }
          productsMap[product.id] = product
        })

        // Calcular ganancias
        let totalCost = 0
        salesData.forEach((sale) => {
          const product = sale.productId ? productsMap[sale.productId] : undefined
          if (product) {
            totalCost += Number(product.cost || 0)
          }
        })

        const totalSalesAmount = salesData.reduce((sum, sale) => sum + Number(sale.salePrice || 0), 0)
        const totalProfit = totalSalesAmount - totalCost

        // Calcular crecimiento (simulado)
        const profitGrowth = totalProfit > 0 ? 10.3 : 0 // Valor simulado

        // Actualizar datos del dashboard
        setDashboardData((prev) => ({
          ...prev,
          totalProfit: totalProfit,
          profitGrowth: profitGrowth,
        }))
      }
    })
  }

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Cargando...</div>
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">
          Bienvenido, {user?.username} ({user?.role === "admin" ? "Administrador" : "Moderador"})
        </h1>

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

          {user?.role === "admin" && (
            <>
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
            </>
          )}
        </div>

        <Tabs defaultValue="inventory" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="inventory">Inventario</TabsTrigger>
            <TabsTrigger value="sales">Ventas</TabsTrigger>
            {user?.role === "admin" && (
              <>
                <TabsTrigger value="finances">Finanzas</TabsTrigger>
                <TabsTrigger value="reports">Reportes</TabsTrigger>
              </>
            )}
          </TabsList>
          <TabsContent value="inventory" className="mt-6">
            <h2 className="text-xl font-semibold mb-4">Gestión de Inventario</h2>
            <p>Aquí se mostrará la gestión de inventario y productos.</p>
          </TabsContent>
          <TabsContent value="sales" className="mt-6">
            <h2 className="text-xl font-semibold mb-4">Registro de Ventas</h2>
            <p>Aquí se mostrará el registro y gestión de ventas.</p>
          </TabsContent>
          {user?.role === "admin" && (
            <>
              <TabsContent value="finances" className="mt-6">
                <h2 className="text-xl font-semibold mb-4">Información Financiera</h2>
                <p>Aquí se mostrará la información financiera y costos.</p>
              </TabsContent>
              <TabsContent value="reports" className="mt-6">
                <h2 className="text-xl font-semibold mb-4">Reportes y Estadísticas</h2>
                <p>Aquí se mostrarán reportes y estadísticas detalladas.</p>
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
