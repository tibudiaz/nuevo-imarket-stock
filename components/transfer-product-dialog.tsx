"use client";

import { useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Product {
  id: string;
  name?: string;
  stock?: number;
  store?: "local1" | "local2";
  [key: string]: any;
}

interface TransferProductDialogProps {
  product: Product;
  onTransfer: (product: Product, quantity: number) => void;
}

export default function TransferProductDialog({
  product,
  onTransfer,
}: TransferProductDialogProps) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const maxQuantity = product.stock || 0;

  const handleConfirm = () => {
    const qty = Math.max(1, Math.min(quantity, maxQuantity));
    onTransfer(product, qty);
    setOpen(false);
    setQuantity(1);
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setQuantity(1);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Transferir producto">
          <ArrowRightLeft className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar Transferencia</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Estás seguro de que quieres enviar el producto <strong>{product.name}</strong> al{' '}
            <strong>{product.store === 'local1' ? 'Local 2' : 'Local 1'}</strong>? Esta acción actualizará la ubicación del stock.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {maxQuantity > 1 && (
          <div className="mt-4 space-y-2">
            <Label htmlFor="transfer-qty">Cantidad a enviar</Label>
            <Input
              id="transfer-qty"
              type="number"
              min={1}
              max={maxQuantity}
              value={quantity}
              onChange={(e) =>
                setQuantity(
                  Math.max(1, Math.min(parseInt(e.target.value) || 1, maxQuantity))
                )
              }
            />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            Confirmar Envío
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

