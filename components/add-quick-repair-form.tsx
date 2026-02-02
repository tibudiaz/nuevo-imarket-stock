"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"

interface QuickRepairData {
  customerName: string
  productName: string
  imei: string
}

interface AddQuickRepairFormProps {
  isOpen: boolean
  onClose: () => void
  onAddQuickRepair: (repairData: QuickRepairData) => Promise<void>
}

const initialQuickRepairState: QuickRepairData = {
  customerName: "",
  productName: "",
  imei: "",
}

export default function AddQuickRepairForm({
  isOpen,
  onClose,
  onAddQuickRepair,
}: AddQuickRepairFormProps) {
  const [formData, setFormData] = useState(initialQuickRepairState)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setFormData(initialQuickRepairState)
      setIsLoading(false)
    }
  }, [isOpen])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target
    setFormData((prev) => ({ ...prev, [id]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.customerName || !formData.productName || !formData.imei) {
      toast.error("Completá el IMEI, el equipo y el cliente.")
      return
    }
    setIsLoading(true)
    try {
      await onAddQuickRepair(formData)
      onClose()
    } catch (error) {
      console.error("Error al crear la reparación rápida:", error)
      toast.error("No se pudo crear la reparación rápida.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Carga rápida de reparaciones</DialogTitle>
          <DialogDescription>
            Registrá un trabajo rápido sin recibo ni firma.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="imei">IMEI del equipo</Label>
            <Input id="imei" value={formData.imei} onChange={handleChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="productName">Nombre del equipo</Label>
            <Input id="productName" value={formData.productName} onChange={handleChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerName">Nombre del cliente</Label>
            <Input id="customerName" value={formData.customerName} onChange={handleChange} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
