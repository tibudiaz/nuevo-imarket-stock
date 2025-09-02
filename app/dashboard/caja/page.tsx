"use client"

import { useEffect, useState, useMemo } from "react";
import jsPDF from "jspdf";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Package, Smartphone, DollarSign, Wallet, CreditCard } from "lucide-react";
import { ref, onValue, push } from "firebase/database";
import { database } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { useStore } from "@/hooks/use-store";
import { toast } from "sonner";

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
  cashAmount?: number;
  cashUsdAmount?: number;
  transferAmount?: number;
  cardAmount?: number;
  usdRate?: number;
  store?: string;
}

interface Product {
  id: string;
  cost?: number;
  category?: string;
  store?: string;
}

interface Withdrawal {
  id: string;
  box: 'accessories' | 'cellphones';
  method: 'cash' | 'transfer';
  amount: number;
  note?: string;
  timestamp: number;
  store?: string;
}

export default function CajaPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { selectedStore } = useStore();
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [lastClosure, setLastClosure] = useState<number>(0);
  const [note, setNote] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/");
      return;
    }
    if (user.role !== 'admin' && user.role !== 'moderator') {
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

    const withdrawalsRef = ref(database, "cashWithdrawals");
    const unsubscribeWithdrawals = onValue(withdrawalsRef, (snapshot) => {
      const data: Withdrawal[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          data.push({ id: child.key!, ...child.val() });
        });
      }
      setWithdrawals(data);
    });

    return () => {
      unsubscribeSales();
      unsubscribeProducts();
      unsubscribeClosures();
      unsubscribeWithdrawals();
    };
  }, [authLoading, user, router, selectedStore]);

  const filteredSales = useMemo(() =>
    sales.filter(
      (s) =>
        new Date(s.date).getTime() > lastClosure &&
        (selectedStore === 'all' || s.store === selectedStore)
    ),
    [sales, lastClosure, selectedStore]
  );

  const filteredWithdrawals = useMemo(
    () =>
      withdrawals.filter(
        (w) =>
          w.timestamp > lastClosure &&
          (selectedStore === 'all' || w.store === selectedStore)
      ),
    [withdrawals, lastClosure, selectedStore]
  );

  const metrics = useMemo(() => {
    const filtered = filteredSales;
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

    let withdrawAccCashARS = 0;
    let withdrawAccBankARS = 0;
    let withdrawCellCashARS = 0;
    let withdrawCellBankARS = 0;

    const productMap = new Map(
      (selectedStore === 'all' ? products : products.filter(p => p.store === selectedStore)).map(p => [p.id, p])
    );

    filtered.forEach(sale => {
      const items = Array.isArray(sale.items) ? sale.items : Object.values(sale.items || {});
      let hasAccessory = false;
      const pm = sale.paymentMethod?.toLowerCase();
      let accessoryTotalARS = 0;
      let cellphoneTotalARS = 0;
      items.forEach(item => {
        const qty = Number(item.quantity || 0);
        const price = Number(item.price || 0) * qty;
        const cost = Number(productMap.get(item.productId)?.cost || 0) * qty;
        const category = (item.category || '').toLowerCase();
        const currency = item.currency || 'ARS';
        const priceInARS = currency === 'USD' ? price * (sale.usdRate || 1) : price;

        totalProducts += qty;
        if (currency === 'USD') {
          totalMoneyUSD += price;
          profitUSD += price - cost;
        } else {
          totalMoneyARS += price;
          profitARS += price - cost;
        }

        const isCell = category.includes('celulares');
        if (isCell) {
          if (category === 'celulares nuevos') {
            newPhones += qty;
          } else if (category === 'celulares usados') {
            usedPhones += qty;
          }
          cellphoneCount += qty;
          cellphoneTotalARS += priceInARS;
        } else {
          productsNoPhones += qty;
          hasAccessory = true;
          accessoryTotalARS += priceInARS;
        }

        if (pm === 'efectivo' || pm === 'efectivo_usd') {
          if (pm === 'efectivo_usd') {
            const priceUSD = currency === 'USD' ? price : price / (sale.usdRate || 1);
            totalCashUSD += priceUSD;
            if (isCell) cellCashUSD += priceUSD; else accCashUSD += priceUSD;
          } else if (currency === 'USD') {
            totalCashUSD += price;
            if (isCell) cellCashUSD += price; else accCashUSD += price;
          } else {
            totalCashARS += price;
            if (isCell) cellCashARS += price; else accCashARS += price;
          }
        } else if (pm === 'tarjeta' || (pm && pm.includes('transfer'))) {
          if (currency === 'USD') {
            totalBankUSD += price;
            if (isCell) cellBankUSD += price; else accBankUSD += price;
          } else {
            totalBankARS += price;
            if (isCell) cellBankARS += price; else accBankARS += price;
          }
        }
      });

      if (pm === 'multiple') {
        const saleTotalARS = accessoryTotalARS + cellphoneTotalARS;
        const cash = sale.cashAmount || 0;
        const cashUSD = sale.cashUsdAmount || 0;
        const bank = (sale.transferAmount || 0) + (sale.cardAmount || 0);
        totalCashARS += cash;
        totalCashUSD += cashUSD;
        totalBankARS += bank;
        const accRatio = saleTotalARS ? accessoryTotalARS / saleTotalARS : 0;
        const cellRatio = saleTotalARS ? cellphoneTotalARS / saleTotalARS : 0;
        accCashARS += cash * accRatio;
        cellCashARS += cash * cellRatio;
        accCashUSD += cashUSD * accRatio;
        cellCashUSD += cashUSD * cellRatio;
        accBankARS += bank * accRatio;
        cellBankARS += bank * cellRatio;
      }

      if (hasAccessory) accessorySales += 1;
    });

    filteredWithdrawals.forEach((w) => {
      const amt = Number(w.amount || 0);
      if (w.box === 'cellphones') {
        if (w.method === 'cash') withdrawCellCashARS += amt;
        else withdrawCellBankARS += amt;
      } else {
        if (w.method === 'cash') withdrawAccCashARS += amt;
        else withdrawAccBankARS += amt;
      }
    });

    totalCashARS -= withdrawAccCashARS + withdrawCellCashARS;
    totalBankARS -= withdrawAccBankARS + withdrawCellBankARS;
    accCashARS -= withdrawAccCashARS;
    accBankARS -= withdrawAccBankARS;
    cellCashARS -= withdrawCellCashARS;
    cellBankARS -= withdrawCellBankARS;

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
      withdrawalsAccCashARS: withdrawAccCashARS,
      withdrawalsAccBankARS: withdrawAccBankARS,
      withdrawalsCellCashARS: withdrawCellCashARS,
      withdrawalsCellBankARS: withdrawCellBankARS,
    };
  }, [filteredSales, filteredWithdrawals, products, selectedStore]);

  const generatePDF = (summary: any) => {
    const doc = new jsPDF();
    const today = new Date(summary.timestamp).toLocaleDateString();
    doc.text(`Resumen de Caja - ${today}`, 10, 10);
    let y = 20;
    const accessoriesUSD = summary.accessoriesCashUSD + summary.accessoriesBankUSD;
    const cellphonesUSD = summary.cellphonesCashUSD + summary.cellphonesBankUSD;
    doc.text('Accesorios', 10, y); y += 10;
    doc.text(`Efectivo ARS: $${summary.accessoriesCashARS.toFixed(2)}`, 10, y); y += 10;
    doc.text(`Dólares: $${accessoriesUSD.toFixed(2)}`, 10, y); y += 10;
    doc.text(`Banco ARS: $${summary.accessoriesBankARS.toFixed(2)}`, 10, y); y += 10;
    doc.text(`Banco USD: $${summary.accessoriesBankUSD.toFixed(2)}`, 10, y); y += 20;
    doc.text('Celulares', 10, y); y += 10;
    doc.text(`Efectivo ARS: $${summary.cellphonesCashARS.toFixed(2)}`, 10, y); y += 10;
    doc.text(`Dólares: $${cellphonesUSD.toFixed(2)}`, 10, y); y += 10;
    doc.text(`Banco ARS: $${summary.cellphonesBankARS.toFixed(2)}`, 10, y); y += 10;
    doc.text(`Banco USD: $${summary.cellphonesBankUSD.toFixed(2)}`, 10, y); y += 20;
    const withdrawAcc = (summary.withdrawalsAccCashARS || 0) + (summary.withdrawalsAccBankARS || 0);
    const withdrawCell = (summary.withdrawalsCellCashARS || 0) + (summary.withdrawalsCellBankARS || 0);
    doc.text('Extracciones', 10, y); y += 10;
    doc.text(`Accesorios: $${withdrawAcc.toFixed(2)}`, 10, y); y += 10;
    doc.text(`Celulares: $${withdrawCell.toFixed(2)}`, 10, y); y += 20;
    if (summary.note) {
      doc.text('Notas:', 10, y); y += 10;
      doc.text(summary.note, 10, y);
    }
    doc.save(`resumen_caja_${new Date(summary.timestamp).toISOString().split('T')[0]}.pdf`);
  };

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
      accessoriesCashARS: metrics.accessoriesCashARS,
      accessoriesCashUSD: metrics.accessoriesCashUSD,
      accessoriesBankARS: metrics.accessoriesBankARS,
      accessoriesBankUSD: metrics.accessoriesBankUSD,
      cellphonesCashARS: metrics.cellphonesCashARS,
      cellphonesCashUSD: metrics.cellphonesCashUSD,
      cellphonesBankARS: metrics.cellphonesBankARS,
      cellphonesBankUSD: metrics.cellphonesBankUSD,
      withdrawalsAccCashARS: metrics.withdrawalsAccCashARS,
      withdrawalsAccBankARS: metrics.withdrawalsAccBankARS,
      withdrawalsCellCashARS: metrics.withdrawalsCellCashARS,
      withdrawalsCellBankARS: metrics.withdrawalsCellBankARS,
      timestamp: Date.now(),
      store: selectedStore,
      note,
    };
    try {
      await push(ref(database, "cashClosures"), {
        ...summary,
        sales: filteredSales,
        withdrawals: filteredWithdrawals,
      });
      generatePDF(summary);
      setLastClosure(summary.timestamp);
      setNote("");
      setDialogOpen(false);
      toast.success("Caja cerrada correctamente");
    } catch (e) {
      console.error("Error closing cash register", e);
      toast.error("Error al cerrar la caja");
    }
  };

  const handlePrintPDF = () => {
    const summary = {
      accessoriesCashARS: metrics.accessoriesCashARS,
      accessoriesCashUSD: metrics.accessoriesCashUSD,
      accessoriesBankARS: metrics.accessoriesBankARS,
      accessoriesBankUSD: metrics.accessoriesBankUSD,
      cellphonesCashARS: metrics.cellphonesCashARS,
      cellphonesCashUSD: metrics.cellphonesCashUSD,
      cellphonesBankARS: metrics.cellphonesBankARS,
      cellphonesBankUSD: metrics.cellphonesBankUSD,
      timestamp: Date.now(),
      note,
    };
    generatePDF(summary);
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
        {user?.role === 'admin' && (
          <>
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
          </>
        )}
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
        <Button onClick={() => setDialogOpen(true)} className="w-full md:w-auto" variant="destructive">
          Cerrar Caja
        </Button>
        <Button onClick={handlePrintPDF} className="w-full md:w-auto" variant="secondary">
          Imprimir PDF
        </Button>
        <Button asChild className="w-full md:w-auto">
          <Link href="/dashboard/caja/cierres">Ver cierres anteriores</Link>
        </Button>
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anotaciones del cierre</DialogTitle>
          </DialogHeader>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Agregar anotación"
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCloseCash}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

