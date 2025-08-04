"use client"

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { generateDeliveryReceiptPdf } from "@/lib/pdf-generator";
import { useStore } from "@/hooks/use-store";

// --- INTERFAZ UNIFICADA Y DEFINITIVA ---
// Usando la misma estructura que la página principal para consistencia.
interface Repair {
  id: string;
  receiptNumber: string;
  customerName: string;
  customerDni?: string;
  customerPhone?: string;
  productName: string;
  entryDate: string;
  description: string;
  technicianNotes?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delivered' | 'cancelled';
  estimatedPrice?: number;
  repairCost?: number;
  finalPrice?: number;
  deliveredAt?: string;
  [key: string]: any;
}

interface RepairDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  repair: Repair | null;
  onUpdate: (id: string, data: Partial<Repair>) => Promise<void>;
}

export default function RepairDetailModal({ isOpen, onClose, repair, onUpdate }: RepairDetailModalProps) {
  const [editableRepair, setEditableRepair] = useState<Repair | null>(repair);
  const { selectedStore } = useStore();

  useEffect(() => {
    if (repair) {
      setEditableRepair({ ...repair });
    }
  }, [repair]);

  if (!repair || !editableRepair) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value, type } = e.target;
    setEditableRepair(prev => prev ? { ...prev, [id]: type === 'number' ? parseFloat(value) || 0 : value } : null);
  }

  const handleStatusChange = (value: Repair['status']) => {
    setEditableRepair(prev => prev ? { ...prev, status: value } : null);
  }

  const handleUpdate = async () => {
    if (!editableRepair) return;
    
    const updatedData = {
        ...editableRepair,
        deliveredAt: editableRepair.status === 'delivered' && !repair.deliveredAt 
            ? new Date().toISOString() 
            : repair.deliveredAt,
    };
    
    await onUpdate(repair.id, updatedData);

    if (updatedData.status === 'delivered' && repair.status !== 'delivered') {
        const pdfDataForGeneration = { ...repair, ...updatedData };
        await generateDeliveryReceiptPdf(pdfDataForGeneration, selectedStore === 'local2' ? 'local2' : 'local1');
    }
    onClose();
  }

  const getStatusVariant = (status: Repair['status']) => {
    switch (status) {
      case 'pending': return 'destructive';
      case 'in_progress': return 'secondary';
      case 'completed': return 'default';
      case 'delivered': return 'outline';
      case 'cancelled': return 'outline';
      default: return 'secondary';
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalle de Reparación: {repair.receiptNumber}</DialogTitle>
          <DialogDescription>
            Cliente: {repair.customerName} | Equipo: {repair.productName}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4 max-h-[70vh] overflow-y-auto pr-4">
          <div>
            <h4 className="font-semibold mb-2">Información General</h4>
            <div className="space-y-2 text-sm">
              <p><span className="font-medium text-muted-foreground">Fecha de Ingreso:</span> {new Date(repair.entryDate).toLocaleString()}</p>
              {repair.deliveredAt && <p><span className="font-medium text-muted-foreground">Fecha de Entrega:</span> {new Date(repair.deliveredAt).toLocaleString()}</p>}
              <p><span className="font-medium text-muted-foreground">Presupuesto:</span> ${repair.estimatedPrice?.toFixed(2) || '0.00'}</p>
              <p><span className="font-medium text-muted-foreground">Costo Reparación:</span> ${repair.repairCost?.toFixed(2) || '0.00'}</p>
              <p><span className="font-medium text-muted-foreground">Precio Final:</span> ${repair.finalPrice?.toFixed(2) || 'No definido'}</p>
              <p className="flex items-center gap-2"><span className="font-medium text-muted-foreground">Estado Actual:</span> <Badge variant={getStatusVariant(repair.status)}>{repair.status.replace(/_/g, ' ')}</Badge></p>
            </div>
            <div className="mt-4">
                <Label htmlFor="description" className="font-semibold">Falla reportada</Label>
                <Textarea id="description" value={editableRepair.description || ''} onChange={handleChange} className="mt-1" />
            </div>
             <div className="mt-4">
                <Label htmlFor="technicianNotes" className="font-semibold">Notas del técnico</Label>
                <Textarea id="technicianNotes" value={editableRepair.technicianNotes || ''} onChange={handleChange} className="mt-1" />
            </div>
          </div>
          <div>
             <h4 className="font-semibold mb-2">Actualizar Información</h4>
             <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="status">Estado</Label>
                    <Select value={editableRepair.status} onValueChange={handleStatusChange}>
                        <SelectTrigger>
                            <SelectValue placeholder="Seleccionar estado" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="pending">Pendiente</SelectItem>
                            <SelectItem value="in_progress">En Progreso</SelectItem>
                            <SelectItem value="completed">Completado</SelectItem>
                            <SelectItem value="delivered">Entregado</SelectItem>
                            <SelectItem value="cancelled">Cancelado</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="finalPrice">Precio Final ($)</Label>
                    <Input id="finalPrice" type="number" value={editableRepair.finalPrice || ''} onChange={handleChange} />
                </div>
             </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
          <Button onClick={handleUpdate}>Guardar Cambios</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}