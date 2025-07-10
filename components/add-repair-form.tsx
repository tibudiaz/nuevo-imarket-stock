"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

interface AddRepairFormProps {
  isOpen: boolean
  onClose: () => void
}

export default function AddRepairForm({ isOpen, onClose }: AddRepairFormProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Lógica para guardar la reparación se agregará aquí
    toast.success("Reparación agregada (simulación).")
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Registrar Nueva Reparación</DialogTitle>
            <DialogDescription>
              Complete los datos para registrar un nuevo equipo para reparar.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <h3 className="text-lg font-medium border-b pb-2">Datos del Cliente</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerName">Nombre del Cliente</Label>
                <Input id="customerName" placeholder="Juan Pérez" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerPhone">Teléfono</Label>
                <Input id="customerPhone" placeholder="3584123456" required />
              </div>
            </div>

            <h3 className="text-lg font-medium border-b pb-2 mt-4">Datos del Equipo</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="productName">Equipo</Label>
                <Input id="productName" placeholder="iPhone 13 Pro" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="imei">IMEI / N° de Serie</Label>
                <Input id="imei" placeholder="Opcional" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Falla Reportada</Label>
              <Textarea id="description" placeholder="Describe el problema del equipo" required />
            </div>
             <div className="space-y-2">
                <Label htmlFor="estimatedPrice">Presupuesto Estimado ($)</Label>
                <Input id="estimatedPrice" type="number" placeholder="0.00" />
              </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Guardando..." : "Guardar Reparación"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
