"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ref, onValue } from "firebase/database";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

  return (
    <DashboardLayout title="Cierres de Caja">
      <Input
        type="date"
        value={filterDate}
        onChange={(e) => setFilterDate(e.target.value)}
        className="mb-4 w-fit"
      />
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
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}

