"use client"

import { useState } from "react"
import { ref, update, push, set } from "firebase/database"
import { database } from "@/lib/firebase"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { jsPDF } from "jspdf"

interface CompleteReserveModalProps {
  isOpen: boolean
  onClose: () => void
  reserve: any
  onReserveCompleted: () => void
}

export default function CompleteReserveModal({
  isOpen,
  onClose,
  reserve,
  onReserveCompleted,
}: CompleteReserveModalProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [paymentDetails, setPaymentDetails] = useState({
    remainingAmount: reserve?.remainingAmount || 0,
    paymentMethod: "efectivo",
  })

  const handleCompleteReserve = async () => {
    if (!paymentDetails.remainingAmount || paymentDetails.remainingAmount <= 0) {
      toast({
        title: "Monto inválido",
        description: "Por favor ingrese un monto válido para completar la reserva",
        variant: "destructive",
      })
      return
    }

    if (paymentDetails.remainingAmount !== reserve.remainingAmount) {
      toast({
        title: "Monto incorrecto",
        description: "El monto ingresado no coincide con el saldo pendiente",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      // 1. Actualizar el estado de la reserva
      const reserveRef = ref(database, `reserves/${reserve.id}`)
      await update(reserveRef, {
        status: "completed",
        completedAt: new Date().toISOString(),
        finalPaymentMethod: paymentDetails.paymentMethod,
      })

      // 2. Registrar la venta
      const salesRef = ref(database, "sales")
      const newSaleRef = push(salesRef)
      const saleData = {
        productId: reserve.productId,
        productName: reserve.productName,
        customerId: reserve.customerId,
        customerName: reserve.customerName,
        customerDni: reserve.customerDni,
        customerPhone: reserve.customerPhone,
        salePrice: reserve.productPrice,
        downPayment: reserve.downPayment,
        downPaymentMethod: reserve.paymentMethod,
        finalPayment: reserve.remainingAmount,
        finalPaymentMethod: paymentDetails.paymentMethod,
        date: new Date().toISOString(),
        reserveId: reserve.id,
        status: "completed",
      }
      await set(newSaleRef, saleData)

      // 3. Actualizar el producto
      const productRef = ref(database, `products/${reserve.productId}`)
      await update(productRef, {
        reserved: false,
        reservedBy: null,
        reservedUntil: null,
        lastSold: new Date().toISOString(),
      })

      // 4. Generar PDF
      generateCompletionPDF(reserve, paymentDetails)

      toast({
        title: "Reserva completada",
        description: "La reserva ha sido completada correctamente",
      })

      onReserveCompleted()
    } catch (error) {
      console.error("Error al completar la reserva:", error)
      toast({
        title: "Error",
        description: "Ocurrió un error al completar la reserva",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const generateCompletionPDF = (reserve, paymentDetails) => {
    try {
      const doc = new jsPDF()

      // Título
      doc.setFontSize(20)
      doc.text("iMarket - Comprobante de Venta Final", 105, 20, { align: "center" })

      // Información de la tienda
      doc.setFontSize(12)
      doc.text("iMarket - Tienda de Celulares", 105, 30, { align: "center" })
      doc.text("Dirección: Av. Ejemplo 123", 105, 37, { align: "center" })
      doc.text("Tel: (123) 456-7890", 105, 44, { align: "center" })

      // Línea separadora
      doc.line(20, 50, 190, 50)

      // Datos de la venta
      doc.setFontSize(12)
      doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 20, 60)
      doc.text(`Nro. Comprobante: ${reserve.id.substring(0, 8)}`, 20, 67)
      doc.text(`Reserva realizada el: ${new Date(reserve.date).toLocaleDateString()}`, 20, 74)

      // Datos del cliente
      doc.text("Datos del Cliente:", 20, 90)
      doc.text(`Nombre: ${reserve.customerName}`, 30, 97)
      doc.text(`DNI: ${reserve.customerDni}`, 30, 104)
      doc.text(`Teléfono: ${reserve.customerPhone}`, 30, 111)

      // Detalles del producto
      doc.text("Detalles de la Compra:", 20, 125)
      doc.text("Producto", 30, 135)
      doc.text("Precio Total", 150, 135)

      doc.line(20, 140, 190, 140)

      doc.text(reserve.productName, 30, 150)
      doc.text(`${reserve.productPrice.toFixed(2)}`, 150, 150)

      doc.line(20, 160, 190, 160)

      // Detalles del pago
      doc.text("Seña pagada:", 120, 170)
      doc.text(`${reserve.downPayment.toFixed(2)}`, 150, 170)

      doc.text("Pago final:", 120, 177)
      doc.text(`${reserve.remainingAmount.toFixed(2)}`, 150, 177)

      doc.text("Total pagado:", 120, 184)
      doc.text(`${(Number(reserve.downPayment) + Number(reserve.remainingAmount)).toFixed(2)}`, 150, 184)

      // Formas de pago
      doc.text(`Forma de pago de la seña: ${reserve.paymentMethod}`, 20, 195)
      doc.text(`Forma de pago final: ${paymentDetails.paymentMethod}`, 20, 202)

      // Pie de página
      doc.setFontSize(10)
      doc.text("Gracias por su compra", 105, 220, { align: "center" })
      doc.text("iMarket - Tecnología a tu alcance", 105, 225, { align: "center" })

      // Guardar o abrir el PDF
      doc.save(`venta-final-${reserve.customerDni}-${Date.now()}.pdf`)
    } catch (error) {
      console.error("Error al generar el PDF:", error)
      toast({
        title: "Error",
        description: "Ocurrió un error al generar el PDF",
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Completar Reserva</DialogTitle>
          <DialogDescription>Complete el pago final para finalizar la reserva.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <h3 className="font-medium">Detalles de la Reserva</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">Cliente:</div>
              <div>{reserve.customerName}</div>

              <div className="text-muted-foreground">Producto:</div>
              <div>{reserve.productName}</div>

              <div className="text-muted-foreground">Precio total:</div>
              <div>${Number(reserve.productPrice).toFixed(2)}</div>

              <div className="text-muted-foreground">Seña pagada:</div>
              <div>${Number(reserve.downPayment).toFixed(2)}</div>

              <div className="text-muted-foreground">Saldo pendiente:</div>
              <div className="font-medium">${Number(reserve.remainingAmount).toFixed(2)}</div>
            </div>
          </div>

          <div className="grid gap-2">
            <h3 className="font-medium">Pago Final</h3>

            <div className="grid grid-cols-4 items-center gap-2">
              <Label htmlFor="remainingAmount" className="col-span-1">
                Monto
              </Label>
              <Input
                id="remainingAmount"
                className="col-span-3"
                type="number"
                value={paymentDetails.remainingAmount}
                onChange={(e) =>
                  setPaymentDetails({ ...paymentDetails, remainingAmount: Number.parseFloat(e.target.value) })
                }
                placeholder="Monto a pagar"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-2">
              <Label htmlFor="paymentMethod" className="col-span-1">
                Pago
              </Label>
              <Select
                value={paymentDetails.paymentMethod}
                onValueChange={(value) => setPaymentDetails({ ...paymentDetails, paymentMethod: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Forma de pago" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="tarjeta">Tarjeta de Crédito/Débito</SelectItem>
                  <SelectItem value="transferencia">Transferencia Bancaria</SelectItem>
                  <SelectItem value="mercadopago">Mercado Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleCompleteReserve} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Completar Venta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
