"use client";

import { useEffect, useMemo, useState } from "react";
import { ref, onValue, set } from "firebase/database";
import { Search, SlidersHorizontal, Smartphone } from "lucide-react";

import { database } from "@/lib/firebase";
import { formatCurrency } from "@/lib/price-converter";
import { useAuth } from "@/hooks/use-auth";
import { useStore } from "@/hooks/use-store";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Product {
  id: string;
  name?: string;
  brand?: string;
  model?: string;
  price?: number;
  category?: string;
  store?: "local1" | "local2";
  visibleInCatalog?: boolean;
  [key: string]: any;
}

const USED_PHONES_CATEGORY = "Celulares Usados";
const storeLabels: Record<NonNullable<Product["store"]>, string> = {
  local1: "Local 1",
  local2: "Local 2",
};
const nameCollator = new Intl.Collator("es", {
  numeric: true,
  sensitivity: "base",
});

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

const ensureIphonePrefix = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) return "iPhone";
  if (/^iphone\b/i.test(trimmed)) return trimmed;
  return `iPhone ${trimmed}`;
};


const normalizePhoneNameCasing = (name: string) => {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index, allWords) => {
      if (/^iphone$/i.test(word)) return "iPhone";
      if (/^se$/i.test(word) && /^iphone$/i.test(allWords[index - 1] ?? "")) {
        return "SE";
      }
      if (/^\d+$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
};

export default function UsedPhonesList() {
  const { user, loading: authLoading } = useAuth();
  const { selectedStore } = useStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [catalogVisibility, setCatalogVisibility] = useState({
    newPhones: true,
    usedPhones: true,
  });
  const [visibleColumns, setVisibleColumns] = useState({
    price: true,
    store: false,
  });

  const canManageVisibility =
    user?.role === "admin" || user?.role === "moderator";

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

  useEffect(() => {
    if (authLoading || !user) return;

    const visibilityRef = ref(database, "catalogVisibility");
    const unsubscribeVisibility = onValue(visibilityRef, (snapshot) => {
      if (!snapshot.exists()) {
        setCatalogVisibility({ newPhones: true, usedPhones: true });
        return;
      }

      const data = snapshot.val() || {};
      setCatalogVisibility({
        newPhones: data.newPhones !== false,
        usedPhones: data.usedPhones !== false,
      });
    });

    return () => unsubscribeVisibility();
  }, [authLoading, user]);

  const handleCatalogVisibilityChange = async (
    checked: boolean | "indeterminate",
  ) => {
    const nextValue = checked === true;
    const previous = catalogVisibility;
    const nextState = {
      ...catalogVisibility,
      usedPhones: nextValue,
    };
    setCatalogVisibility(nextState);

    try {
      await set(ref(database, "catalogVisibility"), nextState);
    } catch (error) {
      console.error("Error al actualizar visibilidad del catálogo:", error);
      setCatalogVisibility(previous);
      toast.error("No se pudo actualizar la visibilidad del catálogo.");
    }
  };

  const filteredProducts = useMemo(() => {
    const terms = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
    return products
      .filter((product) => {
        const storeMatch =
          selectedStore === "all" || product.store === selectedStore;
        const searchable =
          `${product.name || ""} ${product.brand || ""} ${product.model || ""}`.toLowerCase();
        const searchMatch = terms.length
          ? terms.every((term) => searchable.includes(term))
          : true;
        return storeMatch && searchMatch;
      })
      .sort((a, b) =>
        nameCollator.compare(
          normalizePhoneNameCasing(ensureIphonePrefix(resolveProductName(a))),
          normalizePhoneNameCasing(ensureIphonePrefix(resolveProductName(b))),
        ),
      );
  }, [products, searchTerm, selectedStore]);

  const colSpan =
    1 + Number(visibleColumns.price) + Number(visibleColumns.store);

  if (authLoading || !user) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <span className="ml-2">Cargando...</span>
      </div>
    );
  }

  return (
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Opciones
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Mostrar información</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={visibleColumns.price}
              onCheckedChange={(checked) =>
                setVisibleColumns((prev) => ({
                  ...prev,
                  price: Boolean(checked),
                }))
              }
            >
              Precio de venta
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={visibleColumns.store}
              onCheckedChange={(checked) =>
                setVisibleColumns((prev) => ({
                  ...prev,
                  store: Boolean(checked),
                }))
              }
            >
              Local
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex items-center gap-3 rounded-md border bg-white px-3 py-2 text-sm">
          <Checkbox
            id="catalog-used-phones"
            className="h-5 w-5 border-2"
            checked={catalogVisibility.usedPhones}
            onCheckedChange={handleCatalogVisibilityChange}
            disabled={!canManageVisibility}
          />
          <label htmlFor="catalog-used-phones" className="cursor-pointer font-medium">
            Mostrar celulares usados en catálogo
          </label>
        </div>
      </div>
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              {visibleColumns.price && (
                <TableHead className="text-right">Precio de venta</TableHead>
              )}
              {visibleColumns.store && <TableHead>Local</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-center text-sm">
                  Cargando celulares usados...
                </TableCell>
              </TableRow>
            ) : filteredProducts.length > 0 ? (
              filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">
                    {normalizePhoneNameCasing(ensureIphonePrefix(resolveProductName(product)))}
                  </TableCell>
                  {visibleColumns.price && (
                    <TableCell className="text-right">
                      {typeof product.price === "number"
                        ? formatCurrency(product.price)
                        : "N/A"}
                    </TableCell>
                  )}
                  {visibleColumns.store && (
                    <TableCell>
                      {product.store ? storeLabels[product.store] : "Sin local"}
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-center text-sm">
                  No hay celulares usados registrados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
