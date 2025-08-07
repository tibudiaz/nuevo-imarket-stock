"use client";

import { useState, useEffect, useMemo } from "react";
import { ref, onValue, update, remove, get, push, set } from "firebase/database";
import { database } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Search, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Product {
  id: string;
  name?: string;
  price?: number;
  stock?: number;
  store?: "local1" | "local2";
  [key: string]: any;
}

interface CartItem extends Product {
  quantity: number;
}

interface QuickSaleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  store: "local1" | "local2" | "all";
}

export default function QuickSaleDialog({ isOpen, onClose, store }: QuickSaleDialogProps) {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const productsRef = ref(database, "products");
    const unsubscribe = onValue(productsRef, (snapshot) => {
      const data: Product[] = [];
      snapshot.forEach((child) => {
        data.push({ id: child.key!, ...child.val() });
      });
      setAllProducts(data);
    });
    return () => unsubscribe();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
      setCart([]);
      setPaymentMethod("efectivo");
    }
  }, [isOpen]);

  const filteredProducts = useMemo(() => {
    const terms = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);

    return allProducts.filter((p) => {
      if ((p.stock || 0) <= 0) return false;
      if (store !== "all" && p.store !== store) return false;

      const searchable = `${(p.name || "")} ${(p.brand || "")} ${(p.model || "")} ${(p.category || "")} ${(p.barcode || "")}`.toLowerCase();

      return terms.every((t) => searchable.includes(t));
    });
  }, [allProducts, searchTerm, store]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: Math.min((item.quantity || 0) + 1, product.stock || 1) }
            : item
        );
      }
      return [...prev, { ...product, price: product.price || 0, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, qty: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, quantity: Math.max(1, Math.min(qty, item.stock || 1)) }
          : item
      )
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const updatePrice = (id: string, price: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, price: Math.max(0, price) }
          : item
      )
    );
  };

  const totalAmount = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
  }, [cart]);

  const handleConfirm = async () => {
    if (cart.length === 0) {
      toast.error("El carrito está vacío");
      return;
    }
    setIsLoading(true);
    try {
      // Update stock
      for (const item of cart) {
        const productRef = ref(database, `products/${item.id}`);
        const snap = await get(productRef);
        if (!snap.exists()) continue;
        const currentStock = snap.val().stock || 0;
        const newStock = currentStock - item.quantity;
        if (newStock <= 0) {
          await remove(productRef);
        } else {
          await update(productRef, { stock: newStock });
        }
      }

      // Create sale
      const saleRef = push(ref(database, "sales"));
      const saleData = {
        id: saleRef.key,
        date: new Date().toISOString(),
        customerName: "Público",
        customerDni: "",
        items: cart.map((item) => ({
          productId: item.id,
          productName: item.name,
          quantity: item.quantity,
          price: item.price || 0,
          currency: "ARS",
        })),
        totalAmount,
        paymentMethod,
        store: store === "local2" ? "local2" : "local1",
      };
      await set(saleRef, saleData);

      toast.success("Venta registrada");
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("Error al registrar la venta");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Venta Rápida</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar productos..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="max-h-48 overflow-y-auto rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead className="text-right">Añadir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                      No se encontraron productos
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{p.stock}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => addToCart(p)}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        <div>
          <h3 className="mb-2 text-sm font-medium">Carrito</h3>
          <div className="max-h-48 overflow-y-auto rounded border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Cant.</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cart.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      No hay productos en el carrito
                    </TableCell>
                  </TableRow>
                ) : (
                  cart.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.quantity}
                          min={1}
                          max={item.stock}
                          className="w-16"
                          onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.price ?? 0}
                          min={0}
                          className="w-24"
                          onChange={(e) => updatePrice(item.id, parseFloat(e.target.value) || 0)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        ${((item.price || 0) * item.quantity).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          </div>
          <div className="space-y-2">
            <Label>Método de pago</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="transferencia">Transferencia</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-between font-medium">
            <span>Total</span>
            <span>${totalAmount.toFixed(2)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading || cart.length === 0}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

