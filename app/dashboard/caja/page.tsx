"use client"

import { useEffect, useState, useMemo } from "react";
import jsPDF from "jspdf";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Smartphone, DollarSign, Wallet, CreditCard } from "lucide-react";
import { ref, onValue, push } from "firebase/database";
import { database } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { useStore } from "@/hooks/use-store";

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
  store?: string;
}

interface Product {
  id: string;
  cost?: number;
  category?: string;
  store?: string;
}

export default function CajaPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { selectedStore } = useStore();
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
        if (
          val.timestamp &&
          (selectedStore === 'all' || val.store === selectedStore) &&
          val.timestamp > last
        ) {
          last = val.timestamp;
        }
      });
      setLastClosure(last);
    });

    return () => {
      unsubscribeSales();
      unsubscribeProducts();
      unsubscribeClosures();
    };
  }, [authLoading, user, router, selectedStore]);

  const metrics = useMemo(() => {
    const filtered = sales.filter(s =>
      new Date(s.date).getTime() > lastClosure &&
      (selectedStore === 'all' || s.store === selectedStore)
    );
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

    let accCashARS = 0;
    let accCashUSD = 0;
    let accBankARS = 0;
    let accBankUSD = 0;
    let cellCashARS = 0;
    let cellCashUSD = 0;
    let cellBankARS = 0;
    let cellBankUSD = 0;

    const productMap = new Map(
      (selectedStore === 'all' ? products : products.filter(p => p.store === selectedStore)).map(p => [p.id, p])
    );

    filtered.forEach(sale => {
      const items = Array.isArray(sale.items) ? sale.items : Object.values(sale.items || {});
      let hasAccessory = false;
      const pm = sale.paymentMethod?.toLowerCase();
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

        const isCell = category === 'celulares nuevos' || category === 'celulares usados';
        if (isCell) {
          if (category === 'celulares nuevos') {
            newPhones += qty;
          } else if (category === 'celulares usados') {
            usedPhones += qty;
          }
          cellphoneCount += qty;
        } else {
          productsNoPhones += qty;
          hasAccessory = true;
        }

        if (pm === 'efectivo') {
          if (currency === 'USD') {
            totalCashUSD += price;
            if (isCell) cellCashUSD += price; else accCashUSD += price;
          } else {
            totalCashARS += price;
            if (isCell) cellCashARS += price; else accCashARS += price;
          }
        } else if (pm && pm.includes('transfer')) {
          if (currency === 'USD') {
            totalBankUSD += price;
            if (isCell) cellBankUSD += price; else accBankUSD += price;
          } else {
            totalBankARS += price;
            if (isCell) cellBankARS += price; else accBankARS += price;
          }
        }
      });
      if (hasAccessory) accessorySales += 1;
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
      accessoriesCashARS: accCashARS,
      accessoriesCashUSD: accCashUSD,
      accessoriesBankARS: accBankARS,
      accessoriesBankUSD: accBankUSD,
      cellphonesCashARS: cellCashARS,
      cellphonesCashUSD: cellCashUSD,
      cellphonesBankARS: cellBankARS,
      cellphonesBankUSD: cellBankUSD,
    };
  }, [sales, products, lastClosure, selectedStore]);

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
      store: selectedStore,
    };
    try {
      await push(ref(database, 'cashClosures'), summary);
      setLastClosure(Date.now());
      setSales([]);
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

  const handlePrintPDF = () => {
    const doc = new jsPDF();
    const today = new Date().toLocaleDateString();
    doc.text(`Resumen de Caja - ${today}`, 10, 10);
    let y = 20;
    const accessoriesUSD = metrics.accessoriesCashUSD + metrics.accessoriesBankUSD;
    const cellphonesUSD = metrics.cellphonesCashUSD + metrics.cellphonesBankUSD;
    doc.text('Accesorios', 10, y); y += 10;
    doc.text(`Efectivo ARS: $${metrics.accessoriesCashARS.toFixed(2)}`, 10, y); y += 10;
    doc.text(`Dólares: $${accessoriesUSD.toFixed(2)}`, 10, y); y += 10;
    doc.text(`Banco ARS: $${metrics.accessoriesBankARS.toFixed(2)}`, 10, y); y += 10;
    doc.text(`Banco USD: $${metrics.accessoriesBankUSD.toFixed(2)}`, 10, y); y += 20;
    doc.text('Celulares', 10, y); y += 10;
    doc.text(`Efectivo ARS: $${metrics.cellphonesCashARS.toFixed(2)}`, 10, y); y += 10;
    doc.text(`Dólares: $${cellphonesUSD.toFixed(2)}`, 10, y); y += 10;
    doc.text(`Banco ARS: $${metrics.cellphonesBankARS.toFixed(2)}`, 10, y); y += 10;
    doc.text(`Banco USD: $${metrics.cellphonesBankUSD.toFixed(2)}`, 10, y);
    doc.save(`resumen_caja_${new Date().toISOString().split('T')[0]}.pdf`);
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
      <div className="mt-6 flex flex-col md:flex-row gap-2">
        <Button onClick={handleCloseCash} className="w-full md:w-auto" variant="destructive">
          Cerrar Caja
        </Button>
        <Button onClick={handlePrintPDF} className="w-full md:w-auto" variant="secondary">
          Imprimir PDF
        </Button>
      </div>
    </DashboardLayout>
  );
}

