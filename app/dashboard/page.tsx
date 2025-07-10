"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ShoppingBag, Package, DollarSign, TrendingUp } from "lucide-react"
import { ref, onValue } from "firebase/database"
import { database } from "@/lib/firebase"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

// (El resto de las interfaces se mantienen igual)
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
  monthlySales: { name: string; total: number }[]
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
    monthlySales: [],
  })

  useEffect(() => {
    // (El resto del useEffect se mantiene igual)
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

    loadDashboardData()

    setIsLoading(false)
  }, [router])

  const loadDashboardData = () => {
    const salesRef = ref(database, "sales")
    onValue(salesRef, (snapshot) => {
      if (snapshot.exists()) {
        const salesData: Sale[] = []
        let totalSalesAmount = 0
        const monthlySales: { [key: string]: number } = {}

        snapshot.forEach((childSnapshot) => {
          const sale: Sale = {
            id: childSnapshot.key || "",
            ...childSnapshot.val(),
          }
          salesData.push(sale)
          totalSalesAmount += Number(sale.salePrice || 0)

          const saleDate = new Date(sale.date || "")
          const month = saleDate.toLocaleString("default", { month: "short" })
          monthlySales[month] = (monthlySales[month] || 0) + Number(sale.salePrice || 0)
        })

        const formattedMonthlySales = Object.entries(monthlySales).map(([name, total]) => ({
          name,
          total,
        }))

        setDashboardData((prev) => ({
          ...prev,
          totalSales: totalSalesAmount,
          salesGrowth: 20.1, // Simulado
          monthlySales: formattedMonthlySales,
        }))

        calculateProfits(salesData)
      }
    })
    // (El resto de la función se mantiene igual)
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

        setDashboardData((prev) => ({
          ...prev,
          totalProducts: productsData.length,
          totalInvestment: totalInvestment,
          productsGrowth: 12, // Simulado
          investmentGrowth: 5.2, // Simulado
        }))
      }
    })
  }

  const calculateProfits = (salesData: Sale[]) => {
    // (La función se mantiene igual)
    const productsRef = ref(database, "products")
    onValue(productsRef, (snapshot) => {
      if (snapshot.exists()) {
        const productsMap: Record<string, Product> = {}

        snapshot.forEach((childSnapshot) => {
          const product: Product = {
            id: childSnapshot.key || "",
            ...childSnapshot.val(),
          }
          productsMap[product.id] = product
        })

        let totalCost = 0
        salesData.forEach((sale) => {
          const product = sale.productId ? productsMap[sale.productId] : undefined
          if (product) {
            totalCost += Number(product.cost || 0)
          }
        })

        const totalSalesAmount = salesData.reduce((sum, sale) => sum + Number(sale.salePrice || 0), 0)
        const totalProfit = totalSalesAmount - totalCost

        setDashboardData((prev) => ({
          ...prev,
          totalProfit: totalProfit,
          profitGrowth: 10.3, // Simulado
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

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Resumen</TabsTrigger>
            <TabsTrigger value="sales">Ventas</TabsTrigger>
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
            {/* Contenido de la pestaña de ventas */}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}