"use client"

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Smartphone, DollarSign, Wallet, CreditCard } from "lucide-react";
import { ref, onValue, push } from "firebase/database";
import { database } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";

interface SaleItem {
  productId: string;
  productName?: string;
  quantity: number;
  price: number;
  currency?: 'USD' | 'ARS';
  category?: string;
}

interface Sale {
  id: string;
  date: string;
  items: SaleItem[];
  paymentMethod?: string;
}

interface Product {
  id: string;
  cost?: number;
  category?: string;
}

export default function CajaPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [lastClosure, setLastClosure] = useState<number>(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/");
      return;
    }
    if (user.role !== 'admin') {
      router.push('/dashboard');
      return;
    }

    const salesRef = ref(database, "sales");
    const unsubscribeSales = onValue(salesRef, (snapshot) => {
      const data: Sale[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          data.push({ id: child.key!, ...child.val() });
        });
      }
      setSales(data);
    });

    const productsRef = ref(database, "products");
    const unsubscribeProducts = onValue(productsRef, (snapshot) => {
      const data: Product[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          data.push({ id: child.key!, ...child.val() });
        });
      }
      setProducts(data);
    });

    const closuresRef = ref(database, "cashClosures");
    const unsubscribeClosures = onValue(closuresRef, (snapshot) => {
      let last = 0;
      snapshot.forEach((child) => {
        const val = child.val();
        if (val.timestamp && val.timestamp > last) last = val.timestamp;
      });
      setLastClosure(last);
    });

    return () => {
      unsubscribeSales();
      unsubscribeProducts();
      unsubscribeClosures();
    };
  }, [authLoading, user, router]);

  const metrics = useMemo(() => {
    const filtered = sales.filter(s => new Date(s.date).getTime() > lastClosure);
    let accessorySales = 0;
    let productsNoPhones = 0;
    let newPhones = 0;
    let usedPhones = 0;

    let totalProducts = 0;
    let totalMoneyARS = 0;
    let totalMoneyUSD = 0;
    let totalCashARS = 0;
    let totalBankARS = 0;
    let totalCashUSD = 0;
    let totalBankUSD = 0;
    let profitARS = 0;
    let profitUSD = 0;
    let cellphoneCount = 0;

    const productMap = new Map(products.map(p => [p.id, p]));

    filtered.forEach(sale => {
      const items = Array.isArray(sale.items) ? sale.items : Object.values(sale.items || {});
      let hasAccessory = false;
      items.forEach(item => {
        const qty = Number(item.quantity || 0);
        const price = Number(item.price || 0) * qty;
        const cost = Number(productMap.get(item.productId)?.cost || 0) * qty;
        const category = (item.category || '').toLowerCase();
        const currency = item.currency || 'ARS';

        totalProducts += qty;
        if (currency === 'USD') {
          totalMoneyUSD += price;
          profitUSD += price - cost;
        } else {
          totalMoneyARS += price;
          profitARS += price - cost;
        }

        if (category === 'celulares nuevos') {
          newPhones += qty;
          cellphoneCount += qty;
        } else if (category === 'celulares usados') {
          usedPhones += qty;
          cellphoneCount += qty;
        } else {
          productsNoPhones += qty;
          hasAccessory = true;
        }
      });
      if (hasAccessory) accessorySales += 1;
      const pm = sale.paymentMethod?.toLowerCase();
      const saleTotalARS = items.filter(i => (i.currency || 'ARS') === 'ARS').reduce((s, i) => s + Number(i.price || 0) * Number(i.quantity || 0), 0);
      const saleTotalUSD = items.filter(i => (i.currency || 'ARS') === 'USD').reduce((s, i) => s + Number(i.price || 0) * Number(i.quantity || 0), 0);
      if (pm === 'efectivo') {
        totalCashARS += saleTotalARS;
        totalCashUSD += saleTotalUSD;
      } else if (pm && pm.includes('transfer')) {
        totalBankARS += saleTotalARS;
        totalBankUSD += saleTotalUSD;
      }
    });

    return {
      accessorySales,
      productsNoPhones,
      newPhones,
      usedPhones,
      totalProducts,
      totalMoneyARS,
      totalMoneyUSD,
      totalCashARS,
      totalBankARS,
      totalCashUSD,
      totalBankUSD,
      profitARS,
      profitUSD,
      cellphoneCount,
    };
  }, [sales, products, lastClosure]);

  const handleCloseCash = async () => {
    const summary = {
      cantidadProductosVendidos: metrics.totalProducts,
      dineroTotal: metrics.totalMoneyARS,
      dineroTotalEfectivo: metrics.totalCashARS,
      dineroTotalBanco: metrics.totalBankARS,
      gananciasLimpias: metrics.profitARS,
      cantidadCelularesVendidos: metrics.cellphoneCount,
      dineroTotalUSD: metrics.totalMoneyUSD,
      gananciasLimpiasUSD: metrics.profitUSD,
      dineroTotalEfectivoUSD: metrics.totalCashUSD,
      dineroTotalBancoUSD: metrics.totalBankUSD,
      timestamp: Date.now(),
    };
    try {
      await push(ref(database, 'cashClosures'), summary);
      setLastClosure(Date.now());
      const text = `cantidad de productos vendidos: ${summary.cantidadProductosVendidos}\n` +
        `dinero total: ${summary.dineroTotal}\n` +
        `dinero total efectivo: ${summary.dineroTotalEfectivo}\n` +
        `dinero total banco: ${summary.dineroTotalBanco}\n` +
        `ganancias limpias: ${summary.gananciasLimpias}\n` +
        `cantidad de celulares vendidos: ${summary.cantidadCelularesVendidos}\n` +
        `dinero total en usd: ${summary.dineroTotalUSD}\n` +
        `ganancias limpias en usd: ${summary.gananciasLimpiasUSD}\n` +
        `dinero total en efectivo usd: ${summary.dineroTotalEfectivoUSD}\n` +
        `dinero total en banco usd: ${summary.dineroTotalBancoUSD}`;
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cierre_caja_${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Error closing cash register', e);
    }
  };

  return (
    <DashboardLayout title="Caja">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ventas de Accesorios</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.accessorySales}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Productos Vendidos (sin celulares)</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.productsNoPhones}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Celulares Nuevos Vendidos</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.newPhones}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Celulares Usados Vendidos</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.usedPhones}</div>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Dinero Total (ARS)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.totalMoneyARS.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Dinero Total (USD)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.totalMoneyUSD.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ganancias Limpias (ARS)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.profitARS.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ganancias Limpias (USD)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.profitUSD.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Efectivo (ARS)</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.totalCashARS.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Transferencias (ARS)</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.totalBankARS.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Efectivo (USD)</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.totalCashUSD.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Transferencias (USD)</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.totalBankUSD.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>
      <div className="mt-6">
        <Button onClick={handleCloseCash} className="w-full md:w-auto" variant="destructive">
          Cerrar Caja
        </Button>
      </div>
    </DashboardLayout>
  );
}

