"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/dashboard-layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search, Smartphone } from "lucide-react";
import { ref, onValue } from "firebase/database";
import { database } from "@/lib/firebase";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useStore } from "@/hooks/use-store";
import { formatCurrency } from "@/lib/price-converter";

interface Product {
  id: string;
  name?: string;
  brand?: string;
  model?: string;
  price?: number;
  category?: string;
  store?: "local1" | "local2";
  [key: string]: any;
}

const USED_PHONES_CATEGORY = "Celulares Usados";

const resolveProductName = (product: Product) => {
  const name = product.name?.trim();
  if (name) return name;

  const brand = product.brand?.trim();
  const model = product.model?.trim();
  if (brand && model) return `${brand} ${model}`;
  if (brand) return brand;
  if (model) return model;

  return "Sin nombre";
};

export default function UsedPhonesPage() {
  const { user, loading: authLoading } = useAuth();
  const { selectedStore } = useStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;

    const productsRef = ref(database, "products");
    const unsubscribe = onValue(
      productsRef,
      (snapshot) => {
        setIsLoading(false);
        if (!snapshot.exists()) {
          setProducts([]);
          return;
        }

        const usedPhones: Product[] = [];
        snapshot.forEach((childSnapshot) => {
          if (typeof childSnapshot.val() === "object" && childSnapshot.key) {
            const product = {
              id: childSnapshot.key,
              ...childSnapshot.val(),
            } as Product;

            if (product.category === USED_PHONES_CATEGORY) {
              usedPhones.push(product);
            }
          }
        });

        setProducts(usedPhones);
      },
      (error) => {
        console.error("Error al cargar celulares usados:", error);
        setIsLoading(false);
        toast.error("Error de conexión", {
          description: "No se pudieron cargar los celulares usados.",
        });
      },
    );

    return () => unsubscribe();
  }, [authLoading, user]);

  const filteredProducts = useMemo(() => {
    const terms = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
    return products.filter((product) => {
      const storeMatch =
        selectedStore === "all" || product.store === selectedStore;
      const searchable = `${product.name || ""} ${product.brand || ""} ${product.model || ""}`.toLowerCase();
      const searchMatch = terms.length
        ? terms.every((term) => searchable.includes(term))
        : true;
      return storeMatch && searchMatch;
    });
  }, [products, searchTerm, selectedStore]);

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
          <Smartphone className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Listado de Celulares Usados</h1>
            <p className="text-sm text-muted-foreground">
              {USED_PHONES_CATEGORY} ({filteredProducts.length})
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o modelo..."
              className="pl-8 w-[240px]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="text-right">Precio de venta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-sm">
                    Cargando celulares usados...
                  </TableCell>
                </TableRow>
              ) : filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">
                      {resolveProductName(product)}
                    </TableCell>
                    <TableCell className="text-right">
                      {typeof product.price === "number"
                        ? formatCurrency(product.price)
                        : "N/A"}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-sm">
                    No hay celulares usados registrados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
}
