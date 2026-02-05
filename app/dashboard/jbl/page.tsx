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
import { ref, onValue, push, set, update, get } from "firebase/database";
import { database } from "@/lib/firebase";
import { useStore } from "@/hooks/use-store";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

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
  const [sellQuantity, setSellQuantity] = useState(1);
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);

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
      let linkedProductId: string | undefined;
      if (form.stockMode === "inventory") {
        const productRef = push(ref(database, "products"));
        linkedProductId = productRef.key || undefined;
        await set(productRef, {
          id: linkedProductId,
          name: form.name,
          brand: form.brand,
          model: form.model || "JBL",
          category: "JBL",
          provider: "JBL",
          cost: Number(form.cost || 0),
          price: Number(form.salePrice || 0),
          stock: Number(form.quantity || 0),
          store: selectedStore === "local2" ? "local2" : "local1",
          createdAt: new Date().toISOString(),
          entryDate: new Date().toISOString(),
        });
      }

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
        linkedProductId: linkedProductId || null,
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

  const handleSell = async (product: JblProduct) => {
    if (sellQuantity <= 0 || sellQuantity > product.availableQuantity) {
      toast.error("Cantidad inválida");
      return;
    }

    try {
      if (product.stockMode === "inventory" && product.linkedProductId) {
        const productRef = ref(database, `products/${product.linkedProductId}`);
        const snapshot = await get(productRef);
        if (!snapshot.exists()) {
          toast.error("No existe el producto en inventario para descontar stock.");
          return;
        }
        const currentStock = Number(snapshot.val().stock || 0);
        if (currentStock < sellQuantity) {
          toast.error("Stock insuficiente en inventario.");
          return;
        }
        await update(productRef, { stock: currentStock - sellQuantity });
      }

      const jblRef = ref(database, `jblProducts/${product.id}`);
      await update(jblRef, {
        availableQuantity: Number(product.availableQuantity || 0) - sellQuantity,
        soldQuantity: Number(product.soldQuantity || 0) + sellQuantity,
      });

      const saleRef = push(ref(database, "sales"));
      await set(saleRef, {
        id: saleRef.key,
        date: new Date().toISOString(),
        customerName: "Venta JBL",
        customerDni: "-",
        items: [
          {
            productId: product.linkedProductId || product.id,
            productName: `${product.name} ${product.model || ""}`.trim(),
            quantity: sellQuantity,
            price: Number(product.salePrice || 0),
            category: "JBL",
            cost: Number(product.cost || 0),
            provider: "JBL",
            store: product.store,
          },
        ],
        totalAmount: Number(product.salePrice || 0) * sellQuantity,
        paymentMethod: "efectivo",
        store: product.store,
        status: "completed",
        completedAt: new Date().toISOString(),
      });

      setSellingId(null);
      setSellQuantity(1);
      toast.success("Venta registrada", {
        description:
          "La venta JBL quedó en la lista de ventas y con ganancia calculable por costo.",
      });
    } catch (error) {
      console.error("Error al vender JBL:", error);
      toast.error("No se pudo registrar la venta JBL.");
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
                  <TableHead>Acción</TableHead>
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
                      {sellingId === product.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            max={product.availableQuantity}
                            className="w-20"
                            value={sellQuantity}
                            onChange={(e) => setSellQuantity(Number(e.target.value) || 1)}
                          />
                          <Button size="sm" onClick={() => handleSell(product)}>
                            Confirmar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setSellingId(null)}>
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={product.availableQuantity <= 0}
                          onClick={() => {
                            setSellingId(product.id);
                            setSellQuantity(1);
                          }}
                        >
                          Vender
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
