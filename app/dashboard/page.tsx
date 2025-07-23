"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ShoppingBag, Package, DollarSign, TrendingUp, User, AlertTriangle } from "lucide-react"
import { ref, onValue } from "firebase/database"
import { database } from "@/lib/firebase"
import { getAuth } from "firebase/auth"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

// Interfaces
interface User {
  username: string
  role: string
}

interface SaleItem {
    productId: string;
    productName: string;
    quantity: number;
}

interface Sale {
  id: string
  items: SaleItem[];
  totalAmount: number;
  date?: string
  customerName?: string;
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

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
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

  useEffect(() => {
    const auth = getAuth();

    if (auth.currentUser) {
      const role = auth.currentUser.email?.endsWith("@admin.com")
        ? "admin"
        : "moderator";
      const currentUser = {
        username: auth.currentUser.email || "",
        role,
      };
      setUser(currentUser);
      localStorage.setItem("user", JSON.stringify(currentUser));
      setIsLoading(false);
      return;
    }

    const storedUser = localStorage.getItem("user");
    if (!storedUser) {
      router.push("/");
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
    } catch (e) {
      localStorage.removeItem("user");
      router.push("/");
    } finally {
      setIsLoading(false);
    }
  }, [router])

  useEffect(() => {
    if (!user) return; // Espera a que el usuario esté verificado

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

        // Filtro para bajo stock excluyendo celulares
        const lowStockAccessories = productsData.filter(p => 
          p.stock !== undefined && 
          p.stock <= 5 && 
          p.category !== 'Celulares Nuevos' && 
          p.category !== 'Celulares Usados'
        );
        
        setLowStockProducts(lowStockAccessories);

        // Alerta para ambos roles si hay bajo stock de accesorios
        if (lowStockAccessories.length > 0) {
            toast.warning(`${lowStockAccessories.length} productos con bajo stock!`, {
                description: 'Revisa el inventario de accesorios para reponer stock.',
            });
        }
        
        setDashboardData((prev) => ({
          ...prev,
          totalProducts: productsData.reduce((sum, p) => sum + (p.stock || 0), 0),
          totalInvestment: totalInvestment,
          productsGrowth: 12, // Simulado
          investmentGrowth: 5.2, // Simulado
        }))
      }
    });

    return () => unsubscribeProducts();
  }, [user]);

  useEffect(() => {
    if (products.length === 0) return;

    const salesRef = ref(database, "sales")
    const unsubscribeSales = onValue(salesRef, (snapshot) => {
      if (snapshot.exists()) {
        const salesData: Sale[] = []
        let totalSalesAmount = 0
        const monthlySales: { [key: string]: number } = {}
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const salesFromToday: Sale[] = [];

        snapshot.forEach((childSnapshot) => {
          const sale: Sale = {
            id: childSnapshot.key || "",
            ...childSnapshot.val(),
          }
          salesData.push(sale)
          totalSalesAmount += Number(sale.totalAmount || 0)

          const saleDate = new Date(sale.date || "")
          
          if (sale.date && saleDate >= today) {
              salesFromToday.push(sale);
          }
          
          const month = saleDate.toLocaleString("es-AR", { month: "short" })
          monthlySales[month] = (monthlySales[month] || 0) + Number(sale.totalAmount || 0)
        })

        setSales(salesData);
        setDailySalesData(salesFromToday);

        const formattedMonthlySales = Object.entries(monthlySales).map(([name, total]) => ({
          name,
          total,
        }))

        const productsMap = new Map(products.map(p => [p.id, p]));
        let totalCostOfGoodsSold = 0;
        salesData.forEach((sale) => {
            sale.items?.forEach(item => {
                const productInfo = productsMap.get(item.productId);
                if(productInfo){
                    totalCostOfGoodsSold += (Number(productInfo.cost) || 0) * item.quantity;
                }
            });
        });

        const totalProfit = totalSalesAmount - totalCostOfGoodsSold;

        setDashboardData((prev) => ({
          ...prev,
          totalSales: totalSalesAmount,
          totalProfit: totalProfit,
          salesGrowth: 20.1, // Simulado
          profitGrowth: 10.3, // Simulado
          monthlySales: formattedMonthlySales,
        }))
      }
    })
    
    return () => unsubscribeSales();
  }, [products]);

  if (isLoading || !user) {
    return <div className="flex h-screen items-center justify-center">Cargando...</div>
  }

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
                                  <TableHead>Productos</TableHead>
                                  <TableHead className="text-right">Monto</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {dailySalesData.length > 0 ? (
                                  dailySalesData.map(sale => (
                                      <TableRow key={sale.id}>
                                          {/* --- CORRECCIÓN 1: Verificamos si la fecha existe --- */}
                                          <TableCell>{sale.date ? new Date(sale.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</TableCell>
                                          <TableCell>
                                              <div className="flex items-center gap-2">
                                                  <User className="h-4 w-4 text-muted-foreground" />
                                                  {sale.customerName}
                                              </div>
                                          </TableCell>
                                          <TableCell>{sale.items.map(item => item.productName).join(', ')}</TableCell>
                                           {/* --- CORRECCIÓN 2: Verificamos si el monto existe y lo formateamos --- */}
                                          <TableCell className="text-right">${(sale.totalAmount || 0).toFixed(2)}</TableCell>
                                      </TableRow>
                                  ))
                              ) : (
                                  <TableRow>
                                      <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                                          No se han registrado ventas hoy.
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