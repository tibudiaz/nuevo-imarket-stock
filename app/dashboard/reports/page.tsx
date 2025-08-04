"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ref, onValue } from "firebase/database"
import { database } from "@/lib/firebase"
import { BarChart, Bar, LineChart, Line, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts"

// --- Interfaces de Datos ---
interface User {
  username: string;
  role: string;
}

interface SaleItem {
    productId: string;
    quantity: number;
    price: number;
    category?: string;
}

interface Sale {
  id: string;
  date: string;
  items: SaleItem[];
  totalAmount: number;
  customerId?: string;
}

interface Product {
  id: string;
  name: string;
  category: string;
  cost: number;
  stock: number;
}

interface Customer {
    id: string;
    name: string;
}

// --- Interfaces para los Gráficos ---
interface SalesByPeriodData {
  name: string;
  ventas: number;
}

interface TopProductData {
  name: string;
  vendidos: number;
}

interface SalesByCategoryData {
  name: string;
  value: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF'];

export default function ReportsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [timeRange, setTimeRange] = useState("month")
  
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem("user")
    if (!storedUser) {
      router.push("/");
      return
    }
    try {
      const parsedUser = JSON.parse(storedUser)
      setUser(parsedUser)
      if (parsedUser.role !== "admin") {
        router.push("/dashboard")
      }
    } catch (e) {
      localStorage.removeItem("user")
      router.push("/")
    }

    const fetchData = (path: string, setter: React.Dispatch<React.SetStateAction<any[]>>) => {
        const dataRef = ref(database, path);
        return onValue(dataRef, (snapshot) => {
            const data: any[] = [];
            if(snapshot.exists()){
                snapshot.forEach(child => {
                    data.push({ id: child.key, ...child.val() });
                });
            }
            setter(data);
            setIsLoading(false);
        }, (error) => {
            console.error(`Error al cargar ${path}:`, error);
            setIsLoading(false);
        });
    }

    const unsubscribeSales = fetchData('sales', setSales);
    const unsubscribeProducts = fetchData('products', setProducts);
    const unsubscribeCustomers = fetchData('customers', setCustomers);

    return () => {
        unsubscribeSales();
        unsubscribeProducts();
        unsubscribeCustomers();
    }

  }, [router])

  const filteredSales = useMemo(() => {
      const now = new Date();
      return sales.filter(sale => {
          // --- CORRECCIÓN: Se asegura de que la fecha exista antes de procesarla ---
          if (!sale.date) return false;
          const saleDate = new Date(sale.date);
          
          const weekAgo = new Date();
          weekAgo.setDate(now.getDate() - 7);

          if (timeRange === "week") return saleDate >= weekAgo;
          if (timeRange === "month") return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
          if (timeRange === "year") return saleDate.getFullYear() === now.getFullYear();
          return true;
      });
  }, [sales, timeRange]);

  const salesByPeriodChartData = useMemo<SalesByPeriodData[]>(() => {
    const data: { [key: string]: number } = {};
    filteredSales.forEach(sale => {
        if (sale.date && sale.totalAmount) {
            const date = new Date(sale.date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
            data[date] = (data[date] || 0) + sale.totalAmount;
        }
    });
    return Object.entries(data).map(([name, ventas]) => ({ name, ventas })).reverse();
  }, [filteredSales]);
  
  const topProductsChartData = useMemo<TopProductData[]>(() => {
      const productCounts: { [key: string]: number } = {};
      filteredSales.forEach(sale => {
          // --- CORRECCIÓN: Se asegura que `items` exista antes de iterar ---
          sale.items?.forEach(item => {
              const product = products.find(p => p.id === item.productId);
              if (product && product.name) {
                  productCounts[product.name] = (productCounts[product.name] || 0) + (item.quantity || 1);
              }
          });
      });
      return Object.entries(productCounts)
          .map(([name, vendidos]) => ({ name, vendidos }))
          .sort((a, b) => b.vendidos - a.vendidos)
          .slice(0, 5);
  }, [filteredSales, products]);

  const salesByCategoryChartData = useMemo<SalesByCategoryData[]>(() => {
      const categorySales: { [key: string]: number } = {};
      filteredSales.forEach(sale => {
          // --- CORRECCIÓN: Se asegura que `items` exista antes de iterar ---
          sale.items?.forEach(item => {
              const product = products.find(p => p.id === item.productId);
              if (product?.category) {
                  categorySales[product.category] = (categorySales[product.category] || 0) + ((item.price || 0) * (item.quantity || 1));
              }
          });
      });
      return Object.entries(categorySales).map(([name, value]) => ({ name, value }));
  }, [filteredSales, products]);

  if (isLoading || !user || user.role !== "admin") {
    return <div className="flex h-screen items-center justify-center">Cargando reportes...</div>;
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
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={salesByPeriodChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                      <Legend />
                      <Line type="monotone" dataKey="ventas" stroke="#8884d8" activeDot={{ r: 8 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Productos Más Vendidos</CardTitle>
                </CardHeader>
                <CardContent className="h-[250px]">
                   <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topProductsChartData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis type="category" dataKey="name" width={80} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="vendidos" fill="#82ca9d" />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Ventas por Categoría</CardTitle>
                </CardHeader>
                <CardContent className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={salesByCategoryChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>
                                {salesByCategoryChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`}/>
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          {/* Aquí irían los demás tabs (Inventario, Finanzas, Clientes) */}
        </Tabs>
      </div>
    </DashboardLayout>
  )
}