"use client";

import { useEffect, useState, useMemo } from "react";
import DashboardLayout from "@/components/dashboard-layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { ref, onValue } from "firebase/database";
import { database } from "@/lib/firebase";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Product {
  id: string;
  name?: string;
  brand?: string;
  category?: string;
  model?: string;
  stock?: number;
  [key: string]: any;
}

const INITIAL_THRESHOLD = 5;

export default function LowStockPage() {
  const { user, loading: authLoading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [stockThreshold, setStockThreshold] = useState(INITIAL_THRESHOLD);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

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

        const relevantProducts = productsData.filter(
          (p) =>
            p.category !== "Celulares Nuevos" &&
            p.category !== "Celulares Usados"
        );

        setProducts(relevantProducts);

        const lowStockInitial = relevantProducts.filter(
          (p) => p.stock !== undefined && p.stock <= INITIAL_THRESHOLD
        );

        if (lowStockInitial.length > 0) {
          toast.warning(`${lowStockInitial.length} productos con bajo stock!`, {
            description: "Revisa el inventario de accesorios para reponer stock.",
          });
        }
      } else {
        setProducts([]);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => p.stock !== undefined && p.stock <= stockThreshold)
      .sort((a, b) =>
        sortOrder === "asc"
          ? (a.stock! - b.stock!)
          : (b.stock! - a.stock!)
      );
  }, [products, stockThreshold, sortOrder]);

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
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Label htmlFor="threshold">Stock máximo:</Label>
            <Slider
              id="threshold"
              min={1}
              max={50}
              value={[stockThreshold]}
              onValueChange={(value) => setStockThreshold(value[0])}
              className="w-[150px]"
            />
            <span className="w-6 text-center">{stockThreshold}</span>
          </div>
          <div className="flex items-center gap-2">
            <Label>Ordenar:</Label>
            <Select
              value={sortOrder}
              onValueChange={(value) =>
                setSortOrder(value as "asc" | "desc")
              }
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Menor stock</SelectItem>
                <SelectItem value="desc">Mayor stock</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {filteredProducts.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead className="text-right">Stock Actual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name || "Sin nombre"}</TableCell>
                  <TableCell>{p.brand || "N/A"}</TableCell>
                  <TableCell>{p.category || "N/A"}</TableCell>
                  <TableCell>{p.model || "N/A"}</TableCell>
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

