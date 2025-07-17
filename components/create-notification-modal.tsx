"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { toast } from "sonner" // CORRECCIÓN: Se importa directamente de sonner

interface CreateNotificationModalProps {
  isOpen: boolean
  onClose: () => void
  customers: any[]
  onCreateNotification: (notificationData: any) => void
}

export default function CreateNotificationModal({
  isOpen,
  onClose,
  customers,
  onCreateNotification,
}: CreateNotificationModalProps) {
  // Se elimina la línea: const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [notificationType, setNotificationType] = useState("general")
  const [recipient, setRecipient] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [selectedCustomer, setSelectedCustomer] = useState("")

  const handleCustomerChange = (customerId) => {
    setSelectedCustomer(customerId)
    const customer = customers.find((c) => c.id === customerId)
    if (customer && customer.email) {
      setRecipient(customer.email)
    } else {
      setRecipient("")
      toast.error("Cliente sin email", {
        description: "El cliente seleccionado no tiene un correo electrónico registrado",
      })
    }
  }

  const handleSubmit = () => {
    if (!recipient) {
      toast.error("Destinatario requerido", {
        description: "Por favor ingrese un destinatario válido",
      })
      return
    }

    if (!subject) {
      toast.error("Asunto requerido", {
        description: "Por favor ingrese un asunto para la notificación",
      })
      return
    }

    if (!message) {
      toast.error("Mensaje requerido", {
        description: "Por favor ingrese un mensaje para la notificación",
      })
      return
    }

    setIsLoading(true)
    try {
      const notificationData = {
        type: notificationType,
        recipient,
        subject,
        message,
        customerId: selectedCustomer || null,
      }

      onCreateNotification(notificationData)
    } catch (error) {
      console.error("Error al crear la notificación:", error)
      toast.error("Error", {
        description: "Ocurrió un error al crear la notificación",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Nueva Notificación</DialogTitle>
          <DialogDescription>Cree y envíe una nueva notificación a un cliente.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-2">
            <Label htmlFor="type" className="col-span-1">
              Tipo
            </Label>
            <Select value={notificationType} onValueChange={setNotificationType}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Seleccione un tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="promotion">Promoción</SelectItem>
                <SelectItem value="reminder">Recordatorio</SelectItem>
                <SelectItem value="sale">Venta</SelectItem>
                <SelectItem value="reserve">Reserva</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-4 items-center gap-2">
            <Label htmlFor="customer" className="col-span-1">
              Cliente
            </Label>
            <Select value={selectedCustomer} onValueChange={handleCustomerChange}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Seleccione un cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Seleccionar cliente...</SelectItem>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name} ({customer.dni})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-4 items-center gap-2">
            <Label htmlFor="recipient" className="col-span-1">
              Email
            </Label>
            <Input
              id="recipient"
              className="col-span-3"
              type="email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Correo electrónico del destinatario"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-2">
            <Label htmlFor="subject" className="col-span-1">
              Asunto
            </Label>
            <Input
              id="subject"
              className="col-span-3"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Asunto de la notificación"
            />
          </div>

          <div className="grid grid-cols-4 items-start gap-2">
            <Label htmlFor="message" className="col-span-1 pt-2">
              Mensaje
            </Label>
            <Textarea
              id="message"
              className="col-span-3"
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Contenido de la notificación"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Enviar Notificación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}