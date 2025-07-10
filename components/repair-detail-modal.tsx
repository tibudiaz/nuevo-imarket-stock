"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "./ui/label"
import { toast } from "sonner"

export default function RepairDetailModal({ isOpen, onClose, repair }) {
  if (!repair) return null

  const [currentStatus, setCurrentStatus] = useState(repair.status)
  
  const handleStatusUpdate = () => {
    // Lógica para actualizar el estado en Firebase
    toast.success(`Estado actualizado a: ${currentStatus.replace('_', ' ')} (simulación)`)
  }

  const getStatusVariant = (status) => {
    switch (status) {
      case 'pending': return 'destructive';
      case 'in_progress': return 'secondary';
      case 'completed': return 'default';
      case 'delivered': return 'outline';
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          <div>
            <h4 className="font-semibold mb-2">Información General</h4>
            <div className="space-y-2 text-sm">
              <p><span className="font-medium text-muted-foreground">Estado Actual:</span> <Badge variant={getStatusVariant(repair.status)}>{repair.status.replace('_', ' ')}</Badge></p>
              <p><span className="font-medium text-muted-foreground">Fecha de Ingreso:</span> {new Date(repair.entryDate).toLocaleDateString()}</p>
              <p><span className="font-medium text-muted-foreground">Presupuesto:</span> ${repair.estimatedPrice.toFixed(2)}</p>
            </div>
          </div>
          <div>
             <h4 className="font-semibold mb-2">Actualizar Estado</h4>
             <div className="flex items-center gap-2">
                <Select value={currentStatus} onValueChange={setCurrentStatus}>
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
                <Button onClick={handleStatusUpdate}>Actualizar</Button>
             </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
