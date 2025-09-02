"use client";

import { useState } from "react";
import { ref, push } from "firebase/database";
import { database } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/hooks/use-store";
import { toast } from "sonner";

interface CashWithdrawalDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CashWithdrawalDialog({ isOpen, onClose }: CashWithdrawalDialogProps) {
  const { selectedStore } = useStore();
  const [box, setBox] = useState("accessories");
  const [method, setMethod] = useState("cash");
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");

  const reset = () => {
    setBox("accessories");
    setMethod("cash");
    setAmount(0);
    setNote("");
  };

  const handleConfirm = async () => {
    if (selectedStore === "all") {
      toast.error("Seleccione un local", {
        description: "Debe elegir un local antes de registrar extracciones.",
      });
      return;
    }
    if (amount <= 0) {
      toast.error("Ingrese un monto válido");
      return;
    }
    try {
      await push(ref(database, "cashWithdrawals"), {
        box,
        method,
        amount,
        note,
        timestamp: Date.now(),
        store: selectedStore,
      });
      toast.success("Extracción registrada");
      onClose();
      reset();
    } catch (e) {
      console.error("Error recording withdrawal", e);
      toast.error("No se pudo registrar la extracción");
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          reset();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Extracción de dinero</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Select value={box} onValueChange={setBox}>
              <SelectTrigger>
                <SelectValue placeholder="Caja" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="accessories">Caja de Accesorios</SelectItem>
                <SelectItem value="cellphones">Caja de Celulares</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Método" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Efectivo</SelectItem>
                <SelectItem value="transfer">Transferencia</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Input
              type="number"
              placeholder="Monto"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Textarea
              placeholder="Anotaciones"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => { onClose(); reset(); }}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

