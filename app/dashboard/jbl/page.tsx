"use client";

import { useMemo, useState, useEffect } from "react";
import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ref, onValue, push, set, update, get, remove } from "firebase/database";
import { database } from "@/lib/firebase";
import { useStore } from "@/hooks/use-store";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import SellProductModal from "@/components/sell-product-modal";
import { Edit, Trash2 } from "lucide-react";

interface JblProduct {
  id: string;
  name: string;
  brand: string;
  model: string;
  category: string;
  salePrice: number;
  cost: number;
  quantityLoaded: number;
  availableQuantity: number;
  soldQuantity: number;
  stockMode: "inventory" | "consignment";
  linkedProductId?: string;
  store: "local1" | "local2";
  createdAt: string;
}

const createInitialForm = () => ({
  name: "",
  brand: "JBL",
  model: "",
  category: "Audio",
  salePrice: 0,
  cost: 0,
  quantity: 1,
  stockMode: "inventory" as "inventory" | "consignment",
});

export default function JBLPage() {
  const { selectedStore } = useStore();
  const { user } = useAuth();
  const [products, setProducts] = useState<JblProduct[]>([]);
  const [form, setForm] = useState(createInitialForm());
  const [sellingId, setSellingId] = useState<string | null>(null);
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);
  const [isSellDialogOpen, setIsSellDialogOpen] = useState(false);
  const [selectedSellProduct, setSelectedSellProduct] = useState<any | null>(null);
  const [editingProduct, setEditingProduct] = useState<JblProduct | null>(null);

  const showCost = user?.role === "admin";

  useEffect(() => {
    const jblRef = ref(database, "jblProducts");
    const unsubscribe = onValue(jblRef, (snapshot) => {
      if (!snapshot.exists()) {
        setProducts([]);
        return;
      }
      const data: JblProduct[] = [];
      snapshot.forEach((child) => {
        data.push({ id: child.key || "", ...child.val() });
      });
      data.sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
      );
      setProducts(data);
    });

    return () => unsubscribe();
  }, []);

  const filteredProducts = useMemo(
    () =>
      products.filter((product) =>
        selectedStore === "all" ? true : product.store === selectedStore,
      ),
    [products, selectedStore],
  );

  const handleAdd = async () => {
    if (selectedStore === "all") {
      toast.error("Seleccione un local", {
        description: "Debe elegir Local 1 o Local 2 antes de cargar JBL.",
      });
      return;
    }
    if (!form.name || !form.model.trim() || form.salePrice <= 0 || form.quantity <= 0) {
      toast.error("Datos incompletos", {
        description: "Completá nombre, número de serie o modelo, precio de venta y cantidad.",
      });
      return;
    }

    try {
      const productRef = push(ref(database, "products"));
      const linkedProductId = productRef.key || undefined;
      await set(productRef, {
        id: linkedProductId,
        name: form.name,
        brand: form.brand,
        model: form.model || "JBL",
        category: "JBL",
        provider: form.stockMode === "consignment" ? "JBL (Consignación)" : "JBL",
        cost: Number(form.cost || 0),
        price: Number(form.salePrice || 0),
        stock: Number(form.quantity || 0),
        store: selectedStore === "local2" ? "local2" : "local1",
        createdAt: new Date().toISOString(),
        entryDate: new Date().toISOString(),
        stockMode: form.stockMode,
      });

      const jblRef = push(ref(database, "jblProducts"));
      await set(jblRef, {
        name: form.name,
        brand: form.brand,
        model: form.model,
        category: form.category,
        salePrice: Number(form.salePrice || 0),
        cost: Number(form.cost || 0),
        quantityLoaded: Number(form.quantity || 0),
        availableQuantity: Number(form.quantity || 0),
        soldQuantity: 0,
        stockMode: form.stockMode,
        linkedProductId: linkedProductId ?? null,
        store: selectedStore === "local2" ? "local2" : "local1",
        createdAt: new Date().toISOString(),
      });

      setForm(createInitialForm());
      setIsLoadDialogOpen(false);
      toast.success("Producto JBL cargado", {
        description:
          form.stockMode === "consignment"
            ? "Se cargó como consignación: no impacta stock ni dinero invertido."
            : "Se cargó como inventario y ya impacta stock/costo.",
      });
    } catch (error) {
      console.error("Error al cargar JBL:", error);
      toast.error("No se pudo cargar el producto JBL.");
    }
  };

  const syncJblStockFromLinkedProduct = async (jblProductId: string) => {
    const jblRef = ref(database, `jblProducts/${jblProductId}`);
    const jblSnapshot = await get(jblRef);
    if (!jblSnapshot.exists()) return;
    const jblProduct = jblSnapshot.val() as JblProduct;
    if (!jblProduct.linkedProductId) return;

    const productRef = ref(database, `products/${jblProduct.linkedProductId}`);
    const productSnapshot = await get(productRef);
    const linkedStock = productSnapshot.exists() ? Number(productSnapshot.val().stock || 0) : 0;
    const sold = Math.max(Number(jblProduct.quantityLoaded || 0) - linkedStock, 0);

    await update(jblRef, {
      availableQuantity: linkedStock,
      soldQuantity: sold,
    });
  };

  const ensureLinkedProduct = async (product: JblProduct) => {
    if (product.linkedProductId) {
      const existingRef = ref(database, `products/${product.linkedProductId}`);
      const existingSnapshot = await get(existingRef);
      if (existingSnapshot.exists()) {
        return product.linkedProductId;
      }
    }

    const productRef = push(ref(database, "products"));
    const linkedProductId = productRef.key || "";
    await set(productRef, {
      id: linkedProductId,
      name: product.name,
      brand: product.brand || "JBL",
      model: product.model || "JBL",
      category: "JBL",
      provider: product.stockMode === "consignment" ? "JBL (Consignación)" : "JBL",
      cost: Number(product.cost || 0),
      price: Number(product.salePrice || 0),
      stock: Number(product.availableQuantity || 0),
      stockMode: product.stockMode,
      store: product.store,
      createdAt: new Date().toISOString(),
      entryDate: new Date().toISOString(),
    });

    await update(ref(database, `jblProducts/${product.id}`), {
      linkedProductId,
    });
    return linkedProductId;
  };

  const handleOpenSellModal = async (product: JblProduct) => {
    if (product.availableQuantity <= 0) {
      toast.error("Sin stock disponible");
      return;
    }
    try {
      const linkedProductId = await ensureLinkedProduct(product);
      setSellingId(product.id);
      setSelectedSellProduct({
        id: linkedProductId,
        name: `${product.name} ${product.model || ""}`.trim(),
        price: Number(product.salePrice || 0),
        stock: Number(product.availableQuantity || 0),
        category: "JBL",
        model: product.model,
        brand: product.brand,
        provider: product.stockMode === "consignment" ? "JBL (Consignación)" : "JBL",
        store: product.store,
        cost: Number(product.cost || 0),
      });
      setIsSellDialogOpen(true);
    } catch (error) {
      console.error("Error al preparar venta JBL:", error);
      toast.error("No se pudo abrir la venta JBL.");
    }
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct) return;
    try {
      await update(ref(database, `jblProducts/${editingProduct.id}`), {
        name: editingProduct.name,
        model: editingProduct.model,
        category: editingProduct.category,
        salePrice: Number(editingProduct.salePrice || 0),
        cost: Number(editingProduct.cost || 0),
      });

      if (editingProduct.linkedProductId) {
        await update(ref(database, `products/${editingProduct.linkedProductId}`), {
          name: editingProduct.name,
          model: editingProduct.model,
          price: Number(editingProduct.salePrice || 0),
          cost: Number(editingProduct.cost || 0),
          provider: editingProduct.stockMode === "consignment" ? "JBL (Consignación)" : "JBL",
        });
      }

      toast.success("Producto JBL actualizado");
      setEditingProduct(null);
    } catch (error) {
      console.error("Error al actualizar JBL:", error);
      toast.error("No se pudo actualizar el producto JBL.");
    }
  };

  const handleDeleteProduct = async (product: JblProduct) => {
    const confirmed = window.confirm("¿Seguro que desea eliminar este producto JBL?");
    if (!confirmed) return;
    try {
      await remove(ref(database, `jblProducts/${product.id}`));
      if (product.linkedProductId) {
        await remove(ref(database, `products/${product.linkedProductId}`));
      }
      toast.success("Producto JBL eliminado");
    } catch (error) {
      console.error("Error al eliminar JBL:", error);
      toast.error("No se pudo eliminar el producto JBL.");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold">JBL</h1>
          <p className="text-sm text-muted-foreground">
            Cargá productos JBL como inventario o consignación. Los de consignación no impactan
            stock general ni dinero invertido hasta venderse.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Nuevo producto JBL</CardTitle>
            <CardDescription>
              Usá el botón para abrir la carga en un modal y registrar por número de serie o modelo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={isLoadDialogOpen} onOpenChange={setIsLoadDialogOpen}>
              <DialogTrigger asChild>
                <Button>Cargar producto JBL</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Cargar producto JBL</DialogTitle>
                  <DialogDescription>
                    Completá los datos del equipo. Debés indicar número de serie o modelo.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2 md:grid-cols-2">
                  <div>
                    <Label>Nombre</Label>
                    <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Número de serie o modelo</Label>
                    <Input
                      value={form.model}
                      onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))}
                      placeholder="Ej: JBLCHG5BLK o Charge 5"
                    />
                  </div>
                  <div>
                    <Label>Categoría</Label>
                    <Input value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Precio venta</Label>
                    <Input type="number" value={form.salePrice} onChange={(e) => setForm((p) => ({ ...p, salePrice: Number(e.target.value) || 0 }))} />
                  </div>
                  {showCost && (
                    <div>
                      <Label>Costo unitario (ganancia)</Label>
                      <Input type="number" value={form.cost} onChange={(e) => setForm((p) => ({ ...p, cost: Number(e.target.value) || 0 }))} />
                    </div>
                  )}
                  <div>
                    <Label>Cantidad</Label>
                    <Input type="number" min={1} value={form.quantity} onChange={(e) => setForm((p) => ({ ...p, quantity: Number(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <Label>Tipo de ingreso</Label>
                    <Select
                      value={form.stockMode}
                      onValueChange={(value: "inventory" | "consignment") =>
                        setForm((p) => ({ ...p, stockMode: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inventory">Inventario propio</SelectItem>
                        <SelectItem value="consignment">Consignación</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsLoadDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleAdd}>Guardar carga</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Listado JBL</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Precio</TableHead>
                  {showCost && <TableHead>Costo</TableHead>}
                  <TableHead>Disponible</TableHead>
                  <TableHead>Vendidos</TableHead>
                    <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>{`${product.name} ${product.model || ""}`.trim()}</TableCell>
                    <TableCell>
                      <Badge variant={product.stockMode === "consignment" ? "secondary" : "default"}>
                        {product.stockMode === "consignment" ? "Consignación" : "Inventario"}
                      </Badge>
                    </TableCell>
                    <TableCell>${Number(product.salePrice || 0).toFixed(2)}</TableCell>
                    {showCost && <TableCell>${Number(product.cost || 0).toFixed(2)}</TableCell>}
                    <TableCell>{product.availableQuantity}</TableCell>
                    <TableCell>{product.soldQuantity}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={product.availableQuantity <= 0}
                          onClick={() => handleOpenSellModal(product)}
                        >
                          Vender
                        </Button>
                        {user?.role === "admin" && (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => setEditingProduct(product)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDeleteProduct(product)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {selectedSellProduct && (
          <SellProductModal
            isOpen={isSellDialogOpen}
            onClose={() => {
              setIsSellDialogOpen(false);
              setSelectedSellProduct(null);
              setSellingId(null);
            }}
            product={selectedSellProduct}
            onProductSold={async () => {
              if (sellingId) {
                await syncJblStockFromLinkedProduct(sellingId);
              }
            }}
          />
        )}

        <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modificar producto JBL</DialogTitle>
              <DialogDescription>Actualice los datos principales del producto.</DialogDescription>
            </DialogHeader>
            {editingProduct && (
              <div className="grid gap-4 py-2">
                <div>
                  <Label>Nombre</Label>
                  <Input value={editingProduct.name} onChange={(e) => setEditingProduct((p) => (p ? { ...p, name: e.target.value } : p))} />
                </div>
                <div>
                  <Label>Modelo o serie</Label>
                  <Input value={editingProduct.model} onChange={(e) => setEditingProduct((p) => (p ? { ...p, model: e.target.value } : p))} />
                </div>
                <div>
                  <Label>Categoría</Label>
                  <Input value={editingProduct.category} onChange={(e) => setEditingProduct((p) => (p ? { ...p, category: e.target.value } : p))} />
                </div>
                <div>
                  <Label>Precio venta</Label>
                  <Input type="number" value={editingProduct.salePrice} onChange={(e) => setEditingProduct((p) => (p ? { ...p, salePrice: Number(e.target.value) || 0 } : p))} />
                </div>
                {showCost && (
                  <div>
                    <Label>Costo</Label>
                    <Input type="number" value={editingProduct.cost} onChange={(e) => setEditingProduct((p) => (p ? { ...p, cost: Number(e.target.value) || 0 } : p))} />
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingProduct(null)}>
                Cancelar
              </Button>
              <Button onClick={handleUpdateProduct}>Guardar cambios</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
