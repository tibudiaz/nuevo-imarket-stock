"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ref, onValue } from "firebase/database";
import jsPDF from "jspdf";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { database } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";

interface SaleItem {
  productId: string;
  productName?: string;
  quantity: number;
  price: number;
}

interface Sale {
  id: string;
  items: SaleItem[];
}

interface Closure {
  id: string;
  timestamp: number;
  store?: string;
  cantidadProductosVendidos: number;
  dineroTotal: number;
  dineroTotalEfectivo: number;
  dineroTotalBanco: number;
  gananciasLimpias: number;
  cantidadCelularesVendidos: number;
  dineroTotalUSD: number;
  gananciasLimpiasUSD: number;
  dineroTotalEfectivoUSD: number;
  dineroTotalBancoUSD: number;
  accessoriesCashARS?: number;
  accessoriesCashUSD?: number;
  accessoriesBankARS?: number;
  accessoriesBankUSD?: number;
  cellphonesCashARS?: number;
  cellphonesCashUSD?: number;
  cellphonesBankARS?: number;
  cellphonesBankUSD?: number;
  withdrawalsAccCashARS?: number;
  withdrawalsAccBankARS?: number;
  withdrawalsCellCashARS?: number;
  withdrawalsCellBankARS?: number;
  withdrawals?: any[];
  note?: string;
  sales?: Sale[];
}

export default function CashClosuresPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [closures, setClosures] = useState<Closure[]>([]);
  const [filterDate, setFilterDate] = useState<string>("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/");
      return;
    }
    if (user.role !== "admin") {
      router.push("/dashboard");
      return;
    }

    const closuresRef = ref(database, "cashClosures");
    const unsubscribe = onValue(closuresRef, (snapshot) => {
      const data: Closure[] = [];
      snapshot.forEach((child) => {
        data.push({ id: child.key!, ...child.val() });
      });
      setClosures(data);
    });

    return () => unsubscribe();
  }, [authLoading, user, router]);

  const filtered = filterDate
    ? closures.filter(
        (c) =>
          new Date(c.timestamp).toISOString().slice(0, 10) === filterDate
      )
    : closures;

  const handlePrintPDF = (c: Closure) => {
    const doc = new jsPDF();
    const date = new Date(c.timestamp).toLocaleDateString();
    doc.text(`Resumen de Caja - ${date}`, 10, 10);
    let y = 20;
    const accessoriesUSD = (c.accessoriesCashUSD || 0) + (c.accessoriesBankUSD || 0);
    const cellphonesUSD = (c.cellphonesCashUSD || 0) + (c.cellphonesBankUSD || 0);
    doc.text('Accesorios', 10, y); y += 10;
    doc.text(`Efectivo ARS: $${(c.accessoriesCashARS || 0).toFixed(2)}`, 10, y); y += 10;
    doc.text(`Dólares: $${accessoriesUSD.toFixed(2)}`, 10, y); y += 10;
    doc.text(`Banco ARS: $${(c.accessoriesBankARS || 0).toFixed(2)}`, 10, y); y += 10;
    doc.text(`Banco USD: $${(c.accessoriesBankUSD || 0).toFixed(2)}`, 10, y); y += 20;
    doc.text('Celulares', 10, y); y += 10;
    doc.text(`Efectivo ARS: $${(c.cellphonesCashARS || 0).toFixed(2)}`, 10, y); y += 10;
    doc.text(`Dólares: $${cellphonesUSD.toFixed(2)}`, 10, y); y += 10;
    doc.text(`Banco ARS: $${(c.cellphonesBankARS || 0).toFixed(2)}`, 10, y); y += 10;
    doc.text(`Banco USD: $${(c.cellphonesBankUSD || 0).toFixed(2)}`, 10, y); y += 20;
    const withdrawAcc = (c.withdrawalsAccCashARS || 0) + (c.withdrawalsAccBankARS || 0);
    const withdrawCell = (c.withdrawalsCellCashARS || 0) + (c.withdrawalsCellBankARS || 0);
    doc.text('Extracciones', 10, y); y += 10;
    doc.text(`Accesorios: $${withdrawAcc.toFixed(2)}`, 10, y); y += 10;
    doc.text(`Celulares: $${withdrawCell.toFixed(2)}`, 10, y); y += 20;
    if (c.note) {
      doc.text('Notas:', 10, y); y += 10;
      doc.text(c.note, 10, y);
    }
    doc.save(`resumen_caja_${new Date(c.timestamp).toISOString().split('T')[0]}.pdf`);
  };

  return (
    <DashboardLayout title="Cierres de Caja">
      <div className="mb-4 flex items-center gap-2">
        <Button variant="secondary" onClick={() => router.back()}>
          Volver
        </Button>
        <Input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="w-fit"
        />
      </div>
      <div className="space-y-4">
        {filtered.map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <CardTitle>
                {new Date(c.timestamp).toLocaleDateString()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p>Productos vendidos: {c.cantidadProductosVendidos}</p>
              <p>Dinero total ARS: ${c.dineroTotal.toFixed(2)}</p>
              <p>Dinero total USD: ${c.dineroTotalUSD.toFixed(2)}</p>
              {c.note && <p>Nota: {c.note}</p>}
              <details className="mt-2">
                <summary>Ver detalles</summary>
                {c.sales?.map((sale) => (
                  <div key={sale.id} className="ml-4 mt-2">
                    {sale.items?.map((item, idx) => (
                      <div key={idx} className="text-sm">
                        {item.productName || item.productId} - {item.quantity} x ${
                          item.price
                        }
                      </div>
                    ))}
                  </div>
                ))}
              </details>
              <Button onClick={() => handlePrintPDF(c)} className="mt-2">
                Imprimir PDF
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}

