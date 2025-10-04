"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  Edit,
  Trash,
  ShoppingCart,
  Barcode,
  User,
  Wallet,
} from "lucide-react";
import { ref, onValue, set, push, remove, update } from "firebase/database";
import { database } from "@/lib/firebase";
import { toast } from "sonner";
import SellProductModal from "@/components/sell-product-modal";
import TransferProductDialog from "@/components/transfer-product-dialog";
import QuickSaleDialog from "@/components/quick-sale-dialog";
import { shouldRemoveProductFromInventory } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMobile } from "@/hooks/use-mobile";
import { useStore } from "@/hooks/use-store";
import { useAuth } from "@/hooks/use-auth";

// --- Interfaces ---
interface User {
  username: string;
  role: string;
}
interface Product {
  id: string;
  name?: string;
  brand?: string;
  model?: string;
  price?: number;
  cost?: number;
  stock?: number;
  category?: string;
  barcode?: string;
  imei?: string;
  provider?: string;
  store?: "local1" | "local2";
  lastTransfer?: string;
  entryDate?: string;
  createdAt?: string;
  [key: string]: any;
}
interface NewProduct {
  name: string;
  brand: string;
  model: string;
  price: number;
  cost: number;
  stock: number;
  category: string;
  barcode: string;
  imei: string;
  provider: string;
  entryDate: string;
  store: "local1" | "local2";
}
interface Category {
  id: string;
  name: string;
}

const NEW_PRODUCT_STORAGE_KEY = "inventory-new-product";
const NEW_PRODUCT_DIALOG_OPEN_KEY = "inventory-new-product-open";

const getStoreFromSelection = (
  store: "all" | "local1" | "local2",
): "local1" | "local2" => (store === "local2" ? "local2" : "local1");

const createEmptyNewProduct = (
  store: "all" | "local1" | "local2",
): NewProduct => ({
  name: "",
  brand: "",
  model: "",
  price: 0,
  cost: 0,
  stock: 0,
  category: "",
  barcode: "",
  imei: "",
  provider: "",
  entryDate: new Date().toISOString().split("T")[0],
  store: getStoreFromSelection(store),
});

export default function InventoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categorySearch = searchParams.get("category");
  const isMobile = useMobile();
  const { selectedStore } = useStore();

  const { user, loading: authLoading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSellDialogOpen, setIsSellDialogOpen] = useState(false);
  const [isQuickSaleOpen, setIsQuickSaleOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newProduct, setNewProduct] = useState<NewProduct>(() =>
    createEmptyNewProduct(selectedStore),
  );
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const hasRestoredNewProduct = useRef(false);

  const isCellphoneCategory =
    newProduct.category === "Celulares" ||
    newProduct.category === "Celulares Usados" ||
    newProduct.category === "Celulares Nuevos";
  const isCellphoneWithoutModelCategory =
    newProduct.category === "Celulares Usados" ||
    newProduct.category === "Celulares Nuevos";

  const isEditingCellphoneCategory =
    editingProduct?.category === "Celulares" ||
    editingProduct?.category === "Celulares Usados" ||
    editingProduct?.category === "Celulares Nuevos";
  const isEditingCellphoneWithoutModelCategory =
    editingProduct?.category === "Celulares Usados" ||
    editingProduct?.category === "Celulares Nuevos";

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storeValue = getStoreFromSelection(selectedStore);

    if (!hasRestoredNewProduct.current) {
      hasRestoredNewProduct.current = true;

      try {
        const savedProduct = window.localStorage.getItem(
          NEW_PRODUCT_STORAGE_KEY,
        );

        if (savedProduct) {
          const parsedProduct = JSON.parse(savedProduct) as Partial<NewProduct>;

          setNewProduct((prev) => ({
            ...prev,
            ...parsedProduct,
            entryDate:
              parsedProduct?.entryDate ||
              prev.entryDate ||
              new Date().toISOString().split("T")[0],
            store: storeValue,
          }));
        } else {
          setNewProduct((prev) =>
            prev.store === storeValue
              ? prev
              : { ...prev, store: storeValue },
          );
        }

        const shouldReopen =
          window.localStorage.getItem(NEW_PRODUCT_DIALOG_OPEN_KEY) === "true";

        if (shouldReopen) {
          setIsAddDialogOpen(true);
        }
      } catch (error) {
        console.error("Error al restaurar el producto en edición:", error);
        window.localStorage.removeItem(NEW_PRODUCT_STORAGE_KEY);
        window.localStorage.removeItem(NEW_PRODUCT_DIALOG_OPEN_KEY);
        setNewProduct((prev) =>
          prev.store === storeValue ? prev : { ...prev, store: storeValue },
        );
      }

      return;
    }

    setNewProduct((prev) =>
      prev.store === storeValue ? prev : { ...prev, store: storeValue },
    );
  }, [selectedStore]);

  useEffect(() => {
    if (!isAddDialogOpen) return;

    setNewProduct((prev) => ({
      ...prev,
      store: getStoreFromSelection(selectedStore),
      entryDate:
        prev.entryDate && prev.entryDate.trim() !== ""
          ? prev.entryDate
          : new Date().toISOString().split("T")[0],
    }));
  }, [isAddDialogOpen, selectedStore]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isAddDialogOpen) {
      window.localStorage.setItem(NEW_PRODUCT_DIALOG_OPEN_KEY, "true");
    } else {
      window.localStorage.removeItem(NEW_PRODUCT_DIALOG_OPEN_KEY);
    }
  }, [isAddDialogOpen]);

  useEffect(() => {
    if (!isAddDialogOpen || typeof window === "undefined") return;

    window.localStorage.setItem(
      NEW_PRODUCT_STORAGE_KEY,
      JSON.stringify(newProduct),
    );
  }, [newProduct, isAddDialogOpen]);

  useEffect(() => {
    if (authLoading || !user) return;

    const productsRef = ref(database, "products");
    const unsubscribeProducts = onValue(
      productsRef,
      (snapshot) => {
        setIsLoading(false);
        if (snapshot.exists()) {
          const productsData: Product[] = [];
          snapshot.forEach((childSnapshot) => {
            if (typeof childSnapshot.val() === "object" && childSnapshot.key) {
              productsData.push({
                id: childSnapshot.key,
                ...childSnapshot.val(),
              });
            }
          });
          setProducts(productsData);
        } else {
          setProducts([]);
        }
      },
      (error) => {
        console.error("Error al cargar productos:", error);
        setIsLoading(false);
        toast.error("Error de conexión", {
          description: "No se pudieron cargar los productos.",
        });
      },
    );

    const categoriesRef = ref(database, "categories");
    const unsubscribeCategories = onValue(categoriesRef, (snapshot) => {
      const data = snapshot.val();
      const categoryList: Category[] = data
        ? Object.entries(data).map(([id, value]: [string, any]) => ({
            id,
            name: value.name,
          }))
        : [];
      setCategories(categoryList);
    });

    return () => {
      unsubscribeProducts();
      unsubscribeCategories();
    };
  }, [authLoading, user]);

  // --- CORRECCIÓN CLAVE DE RENDIMIENTO ---
  // Se usa `useMemo` para evitar que el filtrado se ejecute en cada renderizado.
  // Esto optimiza drásticamente el rendimiento en listas grandes.
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (!product) return false;

      const storeMatch =
        selectedStore === "all" || product.store === selectedStore;
      const categoryMatch = categorySearch
        ? product.category === categorySearch
        : true;

      const terms = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
      const searchable = `${(product.name || "")} ${(product.brand || "")} ${(product.model || "")} ${(product.category || "")} ${(product.barcode || "")} ${(product.imei || "")}`.toLowerCase();
      const searchMatch = terms.every((t) => searchable.includes(t));

      return storeMatch && categoryMatch && searchMatch;
    });
  }, [products, selectedStore, categorySearch, searchTerm]);

  const handleAddProduct = async () => {
    if (selectedStore === "all") {
      toast.error("Seleccione un local", {
        description: "Debe elegir un local antes de agregar productos.",
      });
      return;
    }
    if (
      !newProduct.name ||
      !newProduct.brand ||
      (!newProduct.model && !isCellphoneWithoutModelCategory) ||
      !newProduct.category
    ) {
      toast.error("Campos incompletos", {
        description: "Por favor complete todos los campos requeridos.",
      });
      return;
    }
    if (newProduct.price <= 0) {
      toast.error("Precio inválido", {
        description: "El precio debe ser mayor que cero.",
      });
      return;
    }

    try {
      const productsRef = ref(database, "products");
      const newProductRef = push(productsRef);
      await set(newProductRef, {
        ...newProduct,
        store: selectedStore === "local2" ? "local2" : "local1",
        entryDate: newProduct.entryDate
          ? new Date(newProduct.entryDate).toISOString()
          : new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
      setNewProduct(createEmptyNewProduct(selectedStore));
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(NEW_PRODUCT_STORAGE_KEY);
        window.localStorage.removeItem(NEW_PRODUCT_DIALOG_OPEN_KEY);
      }
      setIsAddDialogOpen(false);
      toast.success("Producto agregado", {
        description: "El producto ha sido agregado correctamente.",
      });
    } catch (error) {
      console.error("Error al agregar producto:", error);
      toast.error("Error", {
        description: "Ocurrió un error al agregar el producto.",
      });
    }
  };

  const handleEditProduct = (product: Product) => {
    const entryDate = (product.entryDate || product.createdAt || new Date().toISOString()).split("T")[0];
    setEditingProduct({ ...product, entryDate });
    setIsEditDialogOpen(true);
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct) return;
    try {
      const productRef = ref(database, `products/${editingProduct.id}`);
      const updatedProduct = {
        ...editingProduct,
        entryDate: editingProduct.entryDate
          ? new Date(editingProduct.entryDate).toISOString()
          : editingProduct.entryDate,
      };
      await update(productRef, updatedProduct);
      setIsEditDialogOpen(false);
      setEditingProduct(null);
      toast.success("Producto actualizado", {
        description: "El producto ha sido actualizado correctamente.",
      });
    } catch (error) {
      console.error("Error al actualizar producto:", error);
      toast.error("Error", {
        description: "Ocurrió un error al actualizar el producto.",
      });
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (
      window.confirm("¿Estás seguro de que quieres eliminar este producto?")
    ) {
      try {
        const productRef = ref(database, `products/${id}`);
        await remove(productRef);
        toast.success("Producto eliminado", {
          description: "El producto ha sido eliminado correctamente.",
        });
      } catch (error) {
        console.error("Error al eliminar producto:", error);
        toast.error("Error", {
          description: "Ocurrió un error al eliminar el producto.",
        });
      }
    }
  };

  const handleSellProduct = (product: Product) => {
    setSelectedProduct(product);
    setIsSellDialogOpen(true);
  };

  const handleProductSold = () => {
    setIsSellDialogOpen(false);
  };

  const handleCategoryChange = (value: string) => {
    const isUsed = value === "Celulares Usados";
    const isNew = value === "Celulares Nuevos";
    const withoutModel = isUsed || isNew;
    const isCellphone = value === "Celulares" || withoutModel;

    setNewProduct((prev) => ({
      ...prev,
      category: value,
      stock: isCellphone ? 1 : prev.stock,
      model: withoutModel ? "Celular" : prev.model,
    }));
  };

  const handleTransferProduct = async (product: Product, quantity: number) => {
    const targetStore = product.store === "local1" ? "local2" : "local1";
    const currentStock = product.stock || 0;

    try {
      const productRef = ref(database, `products/${product.id}`);
      const existing = products.find(
        (p) =>
          p.store === targetStore &&
          p.name === product.name &&
          p.brand === product.brand &&
          p.model === product.model &&
          p.category === product.category
      );

      const shouldDeleteRecord = shouldRemoveProductFromInventory(
        product.category,
      );

      if (existing) {
        const existingRef = ref(database, `products/${existing.id}`);
        await update(existingRef, {
          stock: (existing.stock || 0) + quantity,
          lastTransfer: new Date().toISOString(),
        });

        if (quantity >= currentStock) {
          if (shouldDeleteRecord) {
            await remove(productRef);
          } else {
            await update(productRef, {
              stock: 0,
              lastTransfer: new Date().toISOString(),
            });
          }
        } else {
          await update(productRef, {
            stock: currentStock - quantity,
            lastTransfer: new Date().toISOString(),
          });
        }
      } else {
        if (quantity >= currentStock) {
          await update(productRef, {
            store: targetStore,
            lastTransfer: new Date().toISOString(),
          });
        } else {
          await update(productRef, {
            stock: currentStock - quantity,
            lastTransfer: new Date().toISOString(),
          });
          const { id, ...rest } = product;
          const newProductRef = push(ref(database, "products"));
          await set(newProductRef, {
            ...rest,
            stock: quantity,
            store: targetStore,
            lastTransfer: new Date().toISOString(),
          });
        }
      }

      toast.success("Producto transferido", {
        description: `${product.name} ha sido enviado al ${
          targetStore === "local1" ? "Local 1" : "Local 2"
        }.`,
      });
    } catch (error) {
      console.error("Error al transferir producto:", error);
      toast.error("Error", {
        description: "No se pudo completar la transferencia.",
      });
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center p-6">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <span className="ml-2">Cargando productos...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold">Inventario</h1>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar productos..."
                className="w-full pl-8 sm:w-[250px]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button
              onClick={() => {
                if (selectedStore === "all") {
                  toast.error("Seleccione un local", {
                    description:
                      "Debe elegir un local antes de registrar ventas.",
                  });
                  return;
                }
                setIsQuickSaleOpen(true);
              }}
              className="w-full sm:w-auto"
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              Venta Rápida
            </Button>
            {user?.role === "moderator" && (
              <>
                <Button
                  onClick={() => router.push("/dashboard/caja")}
                  className="w-full sm:w-auto"
                  variant="secondary"
                >
                  <Wallet className="mr-2 h-4 w-4" />
                  Cerrar Caja
                </Button>
              </>
            )}
            {user?.role === "admin" && (
              <>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full sm:w-auto">
                      <Plus className="mr-2 h-4 w-4" />
                      Agregar Producto
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Agregar Nuevo Producto</DialogTitle>
                      <DialogDescription>
                        Complete los detalles del nuevo producto a agregar al
                        inventario.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <Label>Local</Label>
                        <Input
                          value={
                            selectedStore === "local2" ? "Local 2" : "Local 1"
                          }
                          disabled
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nombre</Label>
                        <Input
                          id="name"
                          value={newProduct.name}
                          onChange={(e) =>
                            setNewProduct({
                              ...newProduct,
                              name: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="brand">Marca</Label>
                        <Input
                          id="brand"
                          value={newProduct.brand}
                          onChange={(e) =>
                            setNewProduct({
                              ...newProduct,
                              brand: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="category">Categoría</Label>
                        <Select
                          value={newProduct.category}
                          onValueChange={handleCategoryChange}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar categoría" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.name}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {!isCellphoneWithoutModelCategory && (
                        <div className="space-y-2">
                          <Label htmlFor="model">Modelo</Label>
                          <Input
                            id="model"
                            value={newProduct.model}
                            onChange={(e) =>
                              setNewProduct({
                                ...newProduct,
                                model: e.target.value,
                              })
                            }
                          />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="provider">Proveedor</Label>
                      <Input
                        id="provider"
                        value={newProduct.provider}
                        onChange={(e) =>
                          setNewProduct({
                            ...newProduct,
                            provider: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="entryDate">Fecha de Ingreso</Label>
                      <Input
                        id="entryDate"
                        type="date"
                        value={newProduct.entryDate}
                        onChange={(e) =>
                          setNewProduct({
                            ...newProduct,
                            entryDate: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {isCellphoneCategory ? (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="imei">IMEI</Label>
                            <Input
                              id="imei"
                              value={newProduct.imei}
                              onChange={(e) =>
                                setNewProduct({
                                  ...newProduct,
                                  imei: e.target.value,
                                })
                              }
                            />
                            {isMobile && (
                              <p className="text-xs text-muted-foreground pt-1">
                                Mantén presionado para &quot;Escanear texto&quot; con la cámara.
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="barcode">Número de Serie</Label>
                            <Input
                              id="barcode"
                              value={newProduct.barcode}
                              onChange={(e) =>
                                setNewProduct({
                                  ...newProduct,
                                  barcode: e.target.value,
                                })
                              }
                            />
                          </div>
                        </>
                      ) : (
                        <div className="space-y-2 col-span-2">
                          <Label htmlFor="barcode">Código de Barras</Label>
                          <Input
                            id="barcode"
                            value={newProduct.barcode}
                            onChange={(e) =>
                              setNewProduct({
                                ...newProduct,
                                barcode: e.target.value,
                              })
                            }
                          />
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="price">Precio Venta</Label>
                        <Input
                          id="price"
                          type="number"
                          value={newProduct.price}
                          onChange={(e) =>
                            setNewProduct({
                              ...newProduct,
                              price: Number.parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cost">Precio Costo</Label>
                        <Input
                          id="cost"
                          type="number"
                          value={newProduct.cost}
                          onChange={(e) =>
                            setNewProduct({
                              ...newProduct,
                              cost: Number.parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="stock">Stock</Label>
                        <Input
                          id="stock"
                          type="number"
                          value={isCellphoneCategory ? 1 : newProduct.stock}
                          disabled={isCellphoneCategory}
                          onChange={(e) => {
                            if (!isCellphoneCategory) {
                              setNewProduct({
                                ...newProduct,
                                stock: Number.parseInt(e.target.value) || 0,
                              });
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsAddDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button onClick={handleAddProduct}>Guardar</Button>
                  </DialogFooter>
                </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Ingreso</TableHead>
                {user?.role === "admin" && <TableHead>Proveedor</TableHead>}
                <TableHead>Código/IMEI</TableHead>
                <TableHead>Precio</TableHead>
                {user?.role === "admin" && <TableHead>Costo</TableHead>}
                <TableHead>Stock</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={user?.role === "admin" ? 12 : 10}
                    className="text-center py-6 text-muted-foreground"
                  >
                    No se encontraron productos
                  </TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">
                      {product.name || "Sin nombre"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          product.store === "local1" ? "default" : "secondary"
                        }
                      >
                        {product.store === "local1"
                          ? "Local 1"
                          : product.store === "local2"
                            ? "Local 2"
                            : "N/A"}
                      </Badge>
                    </TableCell>
                    <TableCell>{product.brand || "N/A"}</TableCell>
                    <TableCell>{product.model || "N/A"}</TableCell>
                    <TableCell>{product.category || "N/A"}</TableCell>
                    <TableCell>
                      {(() => {
                        const date = product.entryDate || product.createdAt;
                        return date
                          ? new Date(date).toLocaleDateString()
                          : "N/A";
                      })()}
                    </TableCell>
                    {user?.role === "admin" && (
                      <TableCell>
                        {product.provider && (
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3 text-muted-foreground" />
                            {product.provider}
                          </div>
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      {product.barcode && (
                        <div className="flex items-center gap-1">
                          <Barcode className="h-3 w-3" />
                          {product.barcode}
                        </div>
                      )}
                      {product.imei && (
                        <div className="text-xs text-muted-foreground mt-1">
                          IMEI: {product.imei}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      ${Number(product.price || 0).toFixed(2)}
                    </TableCell>
                    {user?.role === "admin" && (
                      <TableCell>
                        ${Number(product.cost || 0).toFixed(2)}
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge
                        variant={
                          (product.stock || 0) > 0 ? "default" : "destructive"
                        }
                      >
                        {product.stock || 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {(user?.role === "admin" ||
                          user?.role === "moderator") && (
                          <TransferProductDialog
                            product={product}
                            onTransfer={handleTransferProduct}
                          />
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSellProduct(product)}
                          disabled={!product.stock || product.stock === 0}
                        >
                          <ShoppingCart className="h-4 w-4" />
                        </Button>
                        {user?.role === "admin" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditProduct(product)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteProduct(product.id)}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {selectedProduct && (
        <SellProductModal
          isOpen={isSellDialogOpen}
          onClose={() => setIsSellDialogOpen(false)}
          product={selectedProduct}
          onProductSold={handleProductSold}
        />
      )}

      <QuickSaleDialog
        isOpen={isQuickSaleOpen}
        onClose={() => setIsQuickSaleOpen(false)}
        store={selectedStore}
      />

      {editingProduct && user?.role === "admin" && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Producto</DialogTitle>
              <DialogDescription>
                Actualice los detalles del producto.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Local</Label>
                <Input
                  value={
                    editingProduct.store === "local2" ? "Local 2" : "Local 1"
                  }
                  disabled
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Nombre</Label>
                  <Input
                    id="edit-name"
                    value={editingProduct.name}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        name: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-brand">Marca</Label>
                  <Input
                    id="edit-brand"
                    value={editingProduct.brand}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        brand: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div
                className={`grid gap-4 ${
                  isEditingCellphoneWithoutModelCategory ? "grid-cols-1" : "grid-cols-2"
                }`}
              >
                {!isEditingCellphoneWithoutModelCategory && (
                  <div className="space-y-2">
                    <Label htmlFor="model">Modelo</Label>
                    <Input
                      id="model"
                      value={editingProduct.model}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          model: e.target.value,
                        })
                      }
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="category">Categoría</Label>
                  <Select
                    value={editingProduct.category}
                    onValueChange={(value) =>
                      setEditingProduct({ ...editingProduct, category: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-entryDate">Fecha de Ingreso</Label>
            <Input
              id="edit-entryDate"
              type="date"
              value={
                editingProduct.entryDate
                  ? new Date(editingProduct.entryDate).toISOString().split("T")[0]
                  : ""
              }
              onChange={(e) =>
                setEditingProduct({
                  ...editingProduct,
                  entryDate: e.target.value,
                })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {isEditingCellphoneCategory ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-imei">IMEI</Label>
                      <Input
                        id="edit-imei"
                        value={editingProduct.imei}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            imei: e.target.value,
                          })
                        }
                      />
                      {isMobile && (
                        <p className="text-xs text-muted-foreground pt-1">
                          Mantén presionado para &quot;Escanear texto&quot; con la cámara.
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-barcode">Número de Serie</Label>
                      <Input
                        id="edit-barcode"
                        value={editingProduct.barcode}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            barcode: e.target.value,
                          })
                        }
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="edit-barcode">Código de Barras</Label>
                    <Input
                      id="edit-barcode"
                      value={editingProduct.barcode}
                      onChange={(e) =>
                        setEditingProduct({
                          ...editingProduct,
                          barcode: e.target.value,
                        })
                      }
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-price">Precio Venta</Label>
                  <Input
                    id="edit-price"
                    type="number"
                    value={editingProduct.price}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        price: Number.parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cost">Precio Costo</Label>
                  <Input
                    id="cost"
                    type="number"
                    value={editingProduct.cost}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        cost: Number.parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-stock">Stock</Label>
                  <Input
                    id="edit-stock"
                    type="number"
                    value={editingProduct.stock}
                    disabled={isEditingCellphoneCategory}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        stock: Number.parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button onClick={handleUpdateProduct}>Actualizar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}