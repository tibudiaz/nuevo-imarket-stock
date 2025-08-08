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
import { useStore } from "@/hooks/use-store"

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
  store?: string;
}

interface Product {
  id: string;
  name: string;
  category: string;
  cost: number;
  stock: number;
  store?: string;
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
  const { selectedStore } = useStore()
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
          if (selectedStore !== 'all' && sale.store !== selectedStore) return false;
          if (!sale.date) return false;
          const saleDate = new Date(sale.date);

          const weekAgo = new Date();
          weekAgo.setDate(now.getDate() - 7);

          if (timeRange === "week") return saleDate >= weekAgo;
          if (timeRange === "month") return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
          if (timeRange === "year") return saleDate.getFullYear() === now.getFullYear();
          return true;
      });
  }, [sales, timeRange, selectedStore]);

  const salesByPeriodChartData = useMemo<SalesByPeriodData[]>(() => {
    const data: { [key: string]: number } = {};
    filteredSales.forEach(sale => {
        if (sale.date) {
            const date = new Date(sale.date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
            const itemsArray = Array.isArray(sale.items) ? sale.items : Object.values(sale.items || {});
            const amount = itemsArray.reduce((acc, item: any) => acc + Number(item.price || 0) * Number(item.quantity || 1), 0);
            data[date] = (data[date] || 0) + amount;
        }
    });
    return Object.entries(data).map(([name, ventas]) => ({ name, ventas })).reverse();
  }, [filteredSales]);
  
  const topProductsChartData = useMemo<TopProductData[]>(() => {
      const productCounts: { [key: string]: number } = {};
      filteredSales.forEach(sale => {
          const itemsArray = Array.isArray(sale.items) ? sale.items : Object.values(sale.items || {});
          itemsArray.forEach((item: any) => {
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
          const itemsArray = Array.isArray(sale.items) ? sale.items : Object.values(sale.items || {});
          itemsArray.forEach((item: any) => {
              const product = products.find(p => p.id === item.productId);
              if (product?.category) {
                  categorySales[product.category] = (categorySales[product.category] || 0) + ((item.price || 0) * (item.quantity || 1));
              }
          });
      });
      return Object.entries(categorySales).map(([name, value]) => ({ name, value }));
  }, [filteredSales, products]);

  const filteredProducts = useMemo(() => {
      return selectedStore === 'all' ? products : products.filter(p => p.store === selectedStore);
  }, [products, selectedStore]);

  const inventoryByCategoryData = useMemo(() => {
      const categoryStock: { [key: string]: number } = {};
      filteredProducts.forEach(prod => {
          const category = prod.category || 'Sin categoría';
          categoryStock[category] = (categoryStock[category] || 0) + Number(prod.stock || 0);
      });
      return Object.entries(categoryStock).map(([name, stock]) => ({ name, stock }));
  }, [filteredProducts]);

  const financialSummary = useMemo(() => {
      const productMap = new Map(filteredProducts.map(p => [p.id, p]));
      const totalIncome = filteredSales.reduce((sum, sale) => {
          const itemsArray = Array.isArray(sale.items) ? sale.items : Object.values(sale.items || {});
          const saleTotal = itemsArray.reduce((acc, item: any) => acc + Number(item.price || 0) * Number(item.quantity || 1), 0);
          return sum + saleTotal;
      }, 0);
      const totalCosts = filteredSales.reduce((sum, sale) => {
          const itemsArray = Array.isArray(sale.items) ? sale.items : Object.values(sale.items || {});
          const saleCost = itemsArray.reduce((acc, item: any) => {
              const cost = productMap.get(item.productId)?.cost || 0;
              return acc + cost * Number(item.quantity || 1);
          }, 0);
          return sum + saleCost;
      }, 0);
      return { totalIncome, totalCosts, profit: totalIncome - totalCosts };
  }, [filteredSales, filteredProducts]);

  const topCustomersChartData = useMemo(() => {
      const totals: { [key: string]: number } = {};
      filteredSales.forEach(sale => {
          if (sale.customerId) {
              const itemsArray = Array.isArray(sale.items) ? sale.items : Object.values(sale.items || {});
              const saleTotal = itemsArray.reduce((acc, item: any) => acc + Number(item.price || 0) * Number(item.quantity || 1), 0);
              totals[sale.customerId] = (totals[sale.customerId] || 0) + saleTotal;
          }
      });
      return Object.entries(totals)
          .map(([id, total]) => ({ name: customers.find(c => c.id === id)?.name || 'Desconocido', total }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 5);
  }, [filteredSales, customers]);

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
          <TabsContent value="inventory" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Stock por Categoría</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={inventoryByCategoryData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="stock" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="finances" className="mt-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Ingresos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${financialSummary.totalIncome.toFixed(2)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Costos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${financialSummary.totalCosts.toFixed(2)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Ganancias</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${financialSummary.profit.toFixed(2)}</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="customers" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Mejores Clientes</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topCustomersChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={80} />
                    <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                    <Legend />
                    <Bar dataKey="total" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}