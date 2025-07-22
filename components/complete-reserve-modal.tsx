"use client"

import { useState } from "react"
import { ref, set, push, update } from "firebase/database"
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
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

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
  downPayment?: number;
  remainingAmount?: number;
  status: string;
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

  const handleCompleteSale = async () => {
    if (!reserve) return;

    setIsLoading(true);
    try {
      // 1. Crear una nueva venta con el saldo restante
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
          quantity: 1,
          price: reserve.productPrice,
        }],
        paymentMethod,
        totalAmount: reserve.remainingAmount, // Se registra el pago del saldo
        notes: `Venta completada desde reserva #${reserve.id}`,
      };
      await set(newSaleRef, saleData);

      // 2. Actualizar el estado de la reserva a "completada"
      const reserveRef = ref(database, `reserves/${reserve.id}`);
      await update(reserveRef, {
        status: "completed",
        completedAt: new Date().toISOString(),
      });

      // 3. Notificar al componente padre que la operación fue exitosa
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
            <p className="font-bold text-base mt-2">Saldo a pagar: ${Number(reserve.remainingAmount || 0).toFixed(2)}</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="payment-method">Método de Pago del Saldo</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger id="payment-method">
                <SelectValue placeholder="Seleccionar método" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="tarjeta">Tarjeta</SelectItem>
                <SelectItem value="transferencia">Transferencia</SelectItem>
              </SelectContent>
            </Select>
          </div>
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