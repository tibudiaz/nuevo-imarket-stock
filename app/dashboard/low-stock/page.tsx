"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { ref, onValue } from "firebase/database";
import { database } from "@/lib/firebase";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

interface Product {
  id: string;
  name?: string;
  category?: string;
  stock?: number;
  [key: string]: any;
}

export default function LowStockPage() {
  const { user, loading: authLoading } = useAuth();
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!user) return;

    const productsRef = ref(database, "products");
    const unsubscribe = onValue(productsRef, (snapshot) => {
      if (snapshot.exists()) {
        const productsData: Product[] = [];
        snapshot.forEach((child) => {
          const product: Product = {
            id: child.key || "",
            ...child.val(),
          };
          productsData.push(product);
        });

        const lowStock = productsData.filter(
          (p) =>
            p.stock !== undefined &&
            p.stock <= 5 &&
            p.category !== "Celulares Nuevos" &&
            p.category !== "Celulares Usados"
        );

        setLowStockProducts(lowStock);

        if (lowStock.length > 0) {
          toast.warning(`${lowStock.length} productos con bajo stock!`, {
            description: "Revisa el inventario de accesorios para reponer stock.",
          });
        }
      } else {
        setLowStockProducts([]);
      }
    });

    return () => unsubscribe();
  }, [user]);

  if (authLoading || !user) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center p-6">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="ml-2">Cargando...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6">
        <div className="flex items-center gap-2 mb-6">
          <AlertTriangle className="h-6 w-6 text-destructive" />
          <h1 className="text-2xl font-bold">Productos con Bajo Stock</h1>
        </div>
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
          <p className="text-sm text-muted-foreground">
            No hay productos con bajo stock.
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}

