"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useMobile } from "@/hooks/use-mobile";
import DashboardLayout from "@/components/dashboard-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Barcode,
  Package,
  Wrench,
  Smartphone,
  AlertTriangle,
  ShoppingBag,
  DollarSign,
  TrendingUp,
  ClipboardList,
  User,
  Wallet,
  Bell,
  Database,
  Settings,
  Calculator,
  BarChart3,
} from "lucide-react";
import MobileScanner from "@/components/mobile-scanner";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ref, onValue } from "firebase/database";
import { database } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { Reserve } from "@/components/complete-reserve-modal";

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name?: string;
  category?: string;
  stock?: number;
  cost?: number;
  [key: string]: any;
}

interface SaleItem {
  productId: string;
  productName?: string;
  quantity: number;
}

interface Sale {
  id: string;
  items: SaleItem[];
  totalAmount: number;
  date?: string;
  customerName?: string;
  [key: string]: any;
}

interface DashboardData {
  totalSales: number;
  totalProducts: number;
  totalInvestment: number;
  totalProfit: number;
  salesGrowth: number;
  productsGrowth: number;
  investmentGrowth: number;
  profitGrowth: number;
  monthlySales: { name: string; total: number }[];
}

export default function MobilePage() {
  const router = useRouter();
  const isMobile = useMobile();
  const { user, loading: authLoading } = useAuth();

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState({
    userAgent: "",
    platform: "",
    screenWidth: 0,
    screenHeight: 0,
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [reserves, setReserves] = useState<Reserve[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [dailySalesData, setDailySalesData] = useState<Sale[]>([]);
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
  });
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [salesLoaded, setSalesLoaded] = useState(false);
  const [reservesLoaded, setReservesLoaded] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDeviceInfo({
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
      });
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const productsRef = ref(database, "products");
    const unsubscribeProducts = onValue(
      productsRef,
      (snapshot) => {
        setProductsLoaded(true);
        if (snapshot.exists()) {
          const productsData: Product[] = [];
          snapshot.forEach((childSnapshot) => {
            if (childSnapshot.key && typeof childSnapshot.val() === "object") {
              productsData.push({
                id: childSnapshot.key,
                ...childSnapshot.val(),
              });
            }
          });
          setProducts(productsData);

          const lowStockAccessories = productsData.filter(
            (product) =>
              product.stock !== undefined &&
              product.stock <= 5 &&
              product.category !== "Celulares Nuevos" &&
              product.category !== "Celulares Usados",
          );
          setLowStockProducts(lowStockAccessories);

          if (lowStockAccessories.length > 0) {
            toast.warning(`${lowStockAccessories.length} productos con bajo stock!`, {
              description: "Revisa el inventario para reponer stock.",
            });
          }
        } else {
          setProducts([]);
          setLowStockProducts([]);
        }
      },
      (error) => {
        console.error("Error al cargar productos:", error);
        setProductsLoaded(true);
        toast.error("Error de conexión", {
          description: "No se pudieron cargar los productos.",
        });
      },
    );

    const categoriesRef = ref(database, "categories");
    const unsubscribeCategories = onValue(
      categoriesRef,
      (snapshot) => {
        setCategoriesLoaded(true);
        const data = snapshot.val();
        const categoryList: Category[] = data
          ? Object.entries(data)
              .map(([id, value]: [string, any]) => ({
                id,
                name: value?.name as string,
              }))
              .filter((category) => Boolean(category.name))
          : [];
        setCategories(categoryList);
      },
      (error) => {
        console.error("Error al cargar categorías:", error);
        setCategoriesLoaded(true);
      },
    );

    return () => {
      unsubscribeProducts();
      unsubscribeCategories();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const reservesRef = ref(database, "reserves");
    const unsubscribeReserves = onValue(
      reservesRef,
      (snapshot) => {
        setReservesLoaded(true);
        const reservesData: Reserve[] = [];
        if (snapshot.exists()) {
          snapshot.forEach((child) => {
            reservesData.push({ id: child.key || "", ...child.val() });
          });
        }
        setReserves(reservesData);
      },
      (error) => {
        console.error("Error al cargar reservas:", error);
        setReservesLoaded(true);
      },
    );

    return () => unsubscribeReserves();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const totalInvestment = products.reduce(
      (sum, product) =>
        sum + Number(product.cost || 0) * Number(product.stock || 0),
      0,
    );

    const activeReserves = reserves
      .filter((reserve) => reserve.status === "reserved")
      .reduce((sum, reserve) => sum + Number(reserve.quantity || 1), 0);

    const totalProductsCount =
      products.reduce((sum, product) => sum + Number(product.stock || 0), 0) +
      activeReserves;

    setDashboardData((prev) => ({
      ...prev,
      totalProducts: totalProductsCount,
      totalInvestment,
      productsGrowth: 12,
      investmentGrowth: 5.2,
    }));
  }, [products, reserves, user]);

  useEffect(() => {
    if (!user || !productsLoaded) return;

    const salesRef = ref(database, "sales");
    const unsubscribeSales = onValue(
      salesRef,
      (snapshot) => {
        setSalesLoaded(true);
        if (snapshot.exists()) {
          const salesData: Sale[] = [];
          let totalSalesAmount = 0;
          const monthlySales: Record<string, number> = {};

          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const salesFromToday: Sale[] = [];

          snapshot.forEach((childSnapshot) => {
            const sale: Sale = {
              id: childSnapshot.key || "",
              ...childSnapshot.val(),
            };
            salesData.push(sale);
            totalSalesAmount += Number(sale.totalAmount || 0);

            const saleDate = sale.date ? new Date(sale.date) : null;
            if (saleDate && saleDate >= today) {
              salesFromToday.push(sale);
            }

            if (saleDate) {
              const month = saleDate.toLocaleString("es-AR", { month: "short" });
              monthlySales[month] = (monthlySales[month] || 0) +
                Number(sale.totalAmount || 0);
            }
          });

          setDailySalesData(salesFromToday);

          const formattedMonthlySales = Object.entries(monthlySales).map(
            ([name, total]) => ({
              name,
              total,
            }),
          );

          const productsMap = new Map(products.map((product) => [product.id, product]));
          let totalCostOfGoodsSold = 0;

          salesData.forEach((sale) => {
            sale.items?.forEach((item) => {
              const productInfo = productsMap.get(item.productId);
              if (productInfo) {
                totalCostOfGoodsSold +=
                  Number(productInfo.cost || 0) * Number(item.quantity ?? 0);
              }
            });
          });

          const totalProfit = totalSalesAmount - totalCostOfGoodsSold;

          setDashboardData((prev) => ({
            ...prev,
            totalSales: totalSalesAmount,
            totalProfit,
            salesGrowth: 20.1,
            profitGrowth: 10.3,
            monthlySales: formattedMonthlySales,
          }));
        } else {
          setDailySalesData([]);
          setDashboardData((prev) => ({
            ...prev,
            totalSales: 0,
            totalProfit: 0,
            monthlySales: [],
          }));
        }
      },
      (error) => {
        console.error("Error al cargar ventas:", error);
        setSalesLoaded(true);
      },
    );

    return () => unsubscribeSales();
  }, [user, products, productsLoaded]);

  const handleScan = (data: string) => {
    setIsScannerOpen(false);
    toast.success("Código escaneado", {
      description: `Buscando producto: ${data}`,
    });
    router.push(`/dashboard/inventory?category=&search=${data}`);
  };

  const handleScannerClose = () => {
    setIsScannerOpen(false);
  };

  const isLoading =
    authLoading ||
    !user ||
    !productsLoaded ||
    !categoriesLoaded ||
    !salesLoaded ||
    !reservesLoaded;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (isScannerOpen) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <MobileScanner onScan={handleScan} onClose={handleScannerClose} />
      </div>
    );
  }

  const quickActions = [
    {
      title: "Inventario",
      description: "Consulta y administra el stock de todos los productos.",
      icon: Package,
      action: () => router.push("/dashboard/inventory"),
    },
    {
      title: "Ventas",
      description: "Gestiona ventas y registra nuevas operaciones.",
      icon: ShoppingBag,
      action: () => router.push("/dashboard/sales"),
    },
    {
      title: "Ventas de Celulares",
      description: "Controla las ventas específicas de celulares.",
      icon: Smartphone,
      action: () => router.push("/dashboard/sales?type=celulares"),
    },
    {
      title: "Reparaciones",
      description: "Supervisa y actualiza el estado de las reparaciones.",
      icon: Wrench,
      action: () => router.push("/dashboard/repairs"),
    },
    {
      title: "Reservas",
      description: "Gestiona las reservas activas y completadas.",
      icon: ClipboardList,
      action: () => router.push("/dashboard/reserves"),
    },
    {
      title: "Bajo Stock",
      description: "Revisa los productos con stock crítico.",
      icon: AlertTriangle,
      action: () => router.push("/dashboard/low-stock"),
    },
    {
      title: "Clientes",
      description: "Administra la información de tus clientes.",
      icon: User,
      action: () => router.push("/dashboard/customers"),
    },
    {
      title: "Simulador de Costos",
      description: "Calcula precios y márgenes rápidamente.",
      icon: Calculator,
      action: () => router.push("/dashboard/simulator"),
    },
    {
      title: "Caja",
      description: "Controla ingresos y extracciones de caja.",
      icon: Wallet,
      action: () => router.push("/dashboard/caja"),
    },
    {
      title: "Finanzas",
      description: "Analiza la rentabilidad y flujo financiero.",
      icon: DollarSign,
      action: () => router.push("/dashboard/finances"),
    },
    {
      title: "Reportes",
      description: "Genera reportes detallados del negocio.",
      icon: BarChart3,
      action: () => router.push("/dashboard/reports"),
    },
    {
      title: "Notificaciones",
      description: "Consulta las alertas y novedades del sistema.",
      icon: Bell,
      action: () => router.push("/dashboard/notifications"),
    },
    {
      title: "Respaldo",
      description: "Gestiona los respaldos de la base de datos.",
      icon: Database,
      action: () => router.push("/dashboard/backup"),
    },
    {
      title: "Configuración",
      description: "Personaliza la configuración del sistema.",
      icon: Settings,
      action: () => router.push("/dashboard/settings"),
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">Panel Rápido</h1>
          <p className="text-muted-foreground">
            Acciones rápidas para {user?.username}
          </p>
        </div>

        {!isMobile && (
          <Card className="border-dashed">
            <CardContent className="text-sm text-muted-foreground pt-4">
              Esta vista está optimizada para dispositivos móviles. Puedes volver al
              dashboard principal desde el menú lateral.
            </CardContent>
          </Card>
        )}

        {user?.role === "admin" && (
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  Ventas Totales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-semibold">
                  ${dashboardData.totalSales.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  +{dashboardData.salesGrowth.toFixed(1)}% desde el mes pasado
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Productos en Stock
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-semibold">
                  {dashboardData.totalProducts}
                </div>
                <p className="text-xs text-muted-foreground">
                  +{dashboardData.productsGrowth} nuevos productos
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Inversión Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-semibold">
                  ${dashboardData.totalInvestment.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  +{dashboardData.investmentGrowth.toFixed(1)}% desde el mes pasado
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Ganancias
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-semibold">
                  ${dashboardData.totalProfit.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  +{dashboardData.profitGrowth.toFixed(1)}% desde el mes pasado
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          <Card
            className="cursor-pointer bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
            onClick={() => setIsScannerOpen(true)}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Barcode className="h-6 w-6" />
                Escanear Producto
              </CardTitle>
              <CardDescription className="text-primary-foreground/80">
                Usa la cámara para buscar un producto o agregarlo a una venta.
              </CardDescription>
            </CardHeader>
          </Card>

          {quickActions.map((action) => (
            <Card
              key={action.title}
              className="cursor-pointer transition-shadow hover:shadow-lg"
              onClick={action.action}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <action.icon className="h-6 w-6" />
                  {action.title}
                </CardTitle>
                <CardDescription>{action.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        {user?.role === "admin" && (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="overview">Resumen</TabsTrigger>
              <TabsTrigger value="sales">Ventas del Día</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Ventas Mensuales</CardTitle>
                  <CardDescription>
                    Seguimiento del total vendido mes a mes.
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-64">
                  {dashboardData.monthlySales.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dashboardData.monthlySales}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="total" fill="#2563eb" name="Ventas" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Aún no hay ventas registradas.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="sales" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Ventas Realizadas Hoy</CardTitle>
                  <CardDescription>
                    Registros del día actual con detalle de clientes y montos.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {dailySalesData.length > 0 ? (
                    dailySalesData.map((sale) => (
                      <div
                        key={sale.id}
                        className="rounded-lg border p-3"
                      >
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {sale.date
                              ? new Date(sale.date).toLocaleTimeString("es-AR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Sin horario"}
                          </span>
                          <span className="font-semibold">
                            ${Number(sale.totalAmount || 0).toFixed(2)}
                          </span>
                        </div>
                        {sale.customerName && (
                          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-4 w-4" />
                            {sale.customerName}
                          </div>
                        )}
                        <div className="mt-2 text-sm">
                          {sale.items?.length
                            ? sale.items
                                .map((item) => item.productName)
                                .filter(Boolean)
                                .join(", ")
                            : "Sin detalles de productos"}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-sm text-muted-foreground">
                      No se han registrado ventas hoy.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Productos con Bajo Stock
            </CardTitle>
            <CardDescription>
              Accesorios y otros artículos con stock crítico.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {lowStockProducts.length > 0 ? (
              lowStockProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.category || "Sin categoría"}
                    </p>
                  </div>
                  <Badge variant="destructive">{product.stock ?? 0}</Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No hay productos con bajo stock.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Categorías del Inventario</CardTitle>
            <CardDescription>
              Accede rápidamente a las categorías disponibles.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {categories.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {categories.map((category) => (
                  <Button
                    key={category.id}
                    variant="secondary"
                    className="justify-start"
                    onClick={() =>
                      router.push(
                        `/dashboard/inventory?category=${encodeURIComponent(
                          category.name,
                        )}`,
                      )
                    }
                  >
                    {category.name}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No hay categorías registradas.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Información del Dispositivo
            </CardTitle>
          </CardHeader>
          <CardContent className="break-words text-xs text-muted-foreground">
            <p>
              <strong>Plataforma:</strong> {deviceInfo.platform}
            </p>
            <p>
              <strong>Resolución:</strong> {deviceInfo.screenWidth}x
              {deviceInfo.screenHeight}
            </p>
            <p>
              <strong>User Agent:</strong> {deviceInfo.userAgent}
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
