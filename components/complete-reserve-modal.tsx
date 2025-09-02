"use client"

import { useState, useEffect } from "react"
import { ref, set, push, update, get } from "firebase/database"
import { database } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { formatUsdCurrency } from "@/lib/price-converter"

export interface Reserve {
  id: string;
  date: string;
  expirationDate: string;
  customerName?: string;
  customerDni?: string;
  productName?: string;
  productPrice?: number;
  productId?: string;
  productStock?: number;
  quantity?: number;
  downPayment?: number;
  remainingAmount?: number;
  status: string;
  productData?: any;
  [key: string]: any;
}

interface CompleteReserveModalProps {
  isOpen: boolean;
  onClose: () => void;
  reserve: Reserve | null;
  onReserveCompleted: () => void;
}

export default function CompleteReserveModal({ isOpen, onClose, reserve, onReserveCompleted }: CompleteReserveModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [cashAmount, setCashAmount] = useState(0);
  const [transferAmount, setTransferAmount] = useState(0);
  const [cardAmount, setCardAmount] = useState(0);

  useEffect(() => {
    if (paymentMethod !== "multiple") {
      setCashAmount(0);
      setTransferAmount(0);
      setCardAmount(0);
    }
  }, [paymentMethod]);

  const handleCompleteSale = async () => {
    if (!reserve) return;

    setIsLoading(true);
    try {
      // 1. Crear una nueva venta con el saldo restante
      const usdRateSnapshot = await get(ref(database, 'config/usdRate'));
      const usdRate = usdRateSnapshot.exists() ? usdRateSnapshot.val() : 0;
      const totalARS = (reserve.remainingAmount || 0) * usdRate;
      if (paymentMethod === "multiple") {
        const sum = cashAmount + transferAmount + cardAmount;
        if (Math.abs(sum - totalARS) > 0.01) {
          toast.error("La suma de los montos no coincide con el total");
          setIsLoading(false);
          return;
        }
      }

      const newSaleRef = push(ref(database, "sales"));
      const saleData = {
        id: newSaleRef.key,
        date: new Date().toISOString(),
        customerId: reserve.customerId,
        customerName: reserve.customerName,
        customerDni: reserve.customerDni,
        items: [{
          productId: reserve.productId,
          productName: reserve.productName,
          quantity: reserve.quantity || 1,
          price: (reserve.productPrice || 0) * usdRate,
          cost: Number(reserve.productData?.cost || 0),
          provider: reserve.productData?.provider || null,
        }],
        paymentMethod,
        ...(paymentMethod === "multiple" ? { cashAmount, transferAmount, cardAmount } : {}),
        totalAmount: totalARS, // Se registra el pago del saldo
        usdRate,
        notes: `Venta completada desde reserva #${reserve.id}`,
      };
      await set(newSaleRef, saleData);

      // 2. Actualizar el estado de la reserva a "completada"
      const reserveRef = ref(database, `reserves/${reserve.id}`);
      await update(reserveRef, {
        status: "completed",
        completedAt: new Date().toISOString(),
      });

      // 3. Liberar el producto reservado
      if (reserve.productId) {
        const productRef = ref(database, `products/${reserve.productId}`);
        await update(productRef, { reserved: false });
      }

      // 4. Notificar al componente padre que la operación fue exitosa
      onReserveCompleted();

    } catch (error) {
      console.error("Error al completar la reserva:", error);
      toast.error("Error al completar la venta.");
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!reserve) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Completar Venta de Reserva</DialogTitle>
          <DialogDescription>
            Confirma el pago del saldo restante para finalizar la venta.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="text-sm space-y-1">
            <p><strong>Cliente:</strong> {reserve.customerName}</p>
            <p><strong>Producto:</strong> {reserve.productName}</p>
            <p className="font-bold text-base mt-2">Saldo a pagar: {formatUsdCurrency(reserve.remainingAmount || 0)}</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="payment-method">Método de Pago del Saldo</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger id="payment-method">
                <SelectValue placeholder="Seleccionar método" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="efectivo_usd">Efectivo USD</SelectItem>
                <SelectItem value="tarjeta">Tarjeta</SelectItem>
                <SelectItem value="transferencia">Transferencia</SelectItem>
                <SelectItem value="multiple">Pago Múltiple</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {paymentMethod === "multiple" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label>Monto Efectivo</Label>
                <Input type="number" value={cashAmount} onChange={(e) => setCashAmount(Number(e.target.value) || 0)} />
              </div>
              <div className="space-y-1">
                <Label>Monto Transferencia</Label>
                <Input type="number" value={transferAmount} onChange={(e) => setTransferAmount(Number(e.target.value) || 0)} />
              </div>
              <div className="space-y-1">
                <Label>Monto Tarjeta</Label>
                <Input type="number" value={cardAmount} onChange={(e) => setCardAmount(Number(e.target.value) || 0)} />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleCompleteSale} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Completar Venta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}