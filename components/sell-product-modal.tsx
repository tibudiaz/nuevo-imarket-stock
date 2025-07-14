"use client"

import { useState, useEffect } from "react"
import { ref, set, push, get, update } from "firebase/database"
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
import { Loader2, Search, FileText } from "lucide-react"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { generateSaleReceiptPdf } from "@/lib/pdf-generator" // <-- Importa el nuevo generador de PDF

export default function SellProductModal({ isOpen, onClose, product, onProductSold }) {
  const [isLoading, setIsLoading] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [activeTab, setActiveTab] = useState("venta")
  const [customer, setCustomer] = useState({ name: "", dni: "", phone: "", email: "" })
  const [saleDetails, setSaleDetails] = useState({ salePrice: product?.price || 0, paymentMethod: "efectivo" })
  const [reserveDetails, setReserveDetails] = useState({
    downPayment: product ? Math.round(product.price * 0.2 * 100) / 100 : 0,
    paymentMethod: "efectivo",
    expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    notes: "",
  })
  const [isPdfDialogOpen, setIsPdfDialogOpen] = useState(false)
  const [completedSale, setCompletedSale] = useState(null)
  const [receiptNumber, setReceiptNumber] = useState("")
  const [isTradeIn, setIsTradeIn] = useState(false)
  const [tradeInProduct, setTradeInProduct] = useState({ name: "", brand: "", model: "", price: 0, category: "Celulares" })

  useEffect(() => {
    if (isOpen) {
      const date = new Date()
      const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, "0")
      const receiptNum = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, "0")}${date.getDate().toString().padStart(2, "0")}-${randomNum}`
      setReceiptNumber(receiptNum)
      setSaleDetails((prev) => ({ ...prev, salePrice: product?.price || 0 }))
      setReserveDetails((prev) => ({ ...prev, downPayment: product ? Math.round(product.price * 0.2 * 100) / 100 : 0 }))
      setIsTradeIn(false)
      setTradeInProduct({ name: "", brand: "", model: "", price: 0, category: "Celulares" })
    }
  }, [isOpen, product])

  const searchCustomerByDni = async () => {
    if (!customer.dni || customer.dni.length < 7) {
      toast.error("DNI inválido", { description: "Por favor ingrese un DNI válido para buscar" })
      return
    }
    setIsSearching(true)
    try {
      const customersRef = ref(database, "customers")
      const snapshot = await get(customersRef)
      if (snapshot.exists()) {
        let found = false
        snapshot.forEach((childSnapshot) => {
          const customerData = childSnapshot.val()
          if (customerData.dni === customer.dni) {
            setCustomer({ name: customerData.name, dni: customerData.dni, phone: customerData.phone, email: customerData.email || "" })
            found = true
          }
        })
        if (!found) toast.info("Cliente no encontrado")
      } else {
        toast.info("No hay clientes registrados")
      }
    } catch (error) {
      toast.error("Error", { description: "Ocurrió un error al buscar el cliente" })
    } finally {
      setIsSearching(false)
    }
  }

  const handleSellProduct = async () => {
    if (!customer.name || !customer.dni || !customer.phone) {
      toast.error("Datos del cliente incompletos")
      return
    }
    if (!saleDetails.salePrice || saleDetails.salePrice <= 0) {
      toast.error("Precio de venta inválido")
      return
    }

    setIsLoading(true)
    try {
      if (isTradeIn && tradeInProduct.name && tradeInProduct.price > 0) {
        const productsRef = ref(database, "products")
        const newProductRef = push(productsRef)
        await set(newProductRef, { ...tradeInProduct, stock: 1, cost: tradeInProduct.price, price: Math.round(tradeInProduct.price * 1.3), createdAt: new Date().toISOString() })
        toast.success("Producto de parte de pago agregado al inventario")
      }

      const customersRef = ref(database, "customers")
      let customerId = (await get(customersRef)).forEach(c => c.val().dni === customer.dni ? c.key : null) || push(customersRef).key
      if (!customerId) {
          await set(ref(database, `customers/${customerId}`), { ...customer, createdAt: new Date().toISOString() })
      }
      
      const newSaleRef = push(ref(database, "sales"))
      const saleData = {
        id: newSaleRef.key,
        receiptNumber: receiptNumber,
        productId: product.id,
        productName: product.name,
        productImei: product.imei || "",
        customerId: customerId,
        customerName: customer.name,
        customerDni: customer.dni,
        customerPhone: customer.phone,
        salePrice: saleDetails.salePrice,
        paymentMethod: saleDetails.paymentMethod,
        tradeInValue: isTradeIn ? tradeInProduct.price : 0,
        finalAmount: isTradeIn ? saleDetails.salePrice - tradeInProduct.price : saleDetails.salePrice,
        date: new Date().toISOString(),
        status: "completed",
      }
      await set(newSaleRef, saleData)
      await update(ref(database, `products/${product.id}`), { stock: product.stock - 1, lastSold: new Date().toISOString() })
      setCompletedSale(saleData)
      setIsPdfDialogOpen(true)
    } catch (error) {
      toast.error("Error al registrar la venta")
      setIsLoading(false)
    }
  }

  // La lógica para reservar se mantiene igual
  const handleReserveProduct = async () => {
    // ... tu lógica de reserva existente
  }

  const handlePdfDialogClose = (generatePdfOption) => {
    setIsPdfDialogOpen(false)
    setIsLoading(false)
    if (generatePdfOption && completedSale) {
      generateSaleReceiptPdf(completedSale) // <-- Llama a la función del nuevo módulo
    }
    toast.success(completedSale?.downPayment ? "Reserva exitosa" : "Venta exitosa")
    onProductSold()
    onClose()
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Gestión de Producto</DialogTitle>
            <DialogDescription>Complete los datos para {product?.name}.</DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="venta">Venta Directa</TabsTrigger>
              <TabsTrigger value="reserva">Reservar (Señar)</TabsTrigger>
            </TabsList>
            
            <div className="py-4 max-h-[60vh] overflow-y-auto px-1">
              {/* Formulario de Cliente */}
              <div className="space-y-4 mb-6">
                <h3 className="text-lg font-medium border-b pb-2">Datos del Cliente</h3>
                <div className="grid grid-cols-4 items-center gap-2">
                  <Label htmlFor="dni" className="col-span-1">DNI</Label>
                  <div className="col-span-3 flex gap-2">
                    <Input id="dni" value={customer.dni} onChange={(e) => setCustomer({ ...customer, dni: e.target.value })} placeholder="Buscar o ingresar DNI" />
                    <Button variant="outline" size="icon" onClick={searchCustomerByDni} disabled={isSearching}><Search className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-2">
                  <Label htmlFor="name" className="col-span-1">Nombre</Label>
                  <Input id="name" className="col-span-3" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} placeholder="Nombre completo" />
                </div>
                <div className="grid grid-cols-4 items-center gap-2">
                  <Label htmlFor="phone" className="col-span-1">Teléfono</Label>
                  <Input id="phone" className="col-span-3" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} placeholder="Número de teléfono" />
                </div>
              </div>

              {/* Contenido de las Pestañas */}
              <TabsContent value="venta" className="space-y-4 mt-0">
                <h3 className="text-lg font-medium border-b pb-2">Detalles de la Venta</h3>
                <div className="grid grid-cols-4 items-center gap-2">
                  <Label htmlFor="salePrice" className="col-span-1">Precio</Label>
                  <Input id="salePrice" type="number" className="col-span-3" value={saleDetails.salePrice} onChange={(e) => setSaleDetails({ ...saleDetails, salePrice: Number(e.target.value) })} />
                </div>
                <div className="grid grid-cols-4 items-center gap-2">
                  <Label htmlFor="paymentMethod" className="col-span-1">Pago</Label>
                  <Select value={saleDetails.paymentMethod} onValueChange={(value) => setSaleDetails({ ...saleDetails, paymentMethod: value })}><SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="efectivo">Efectivo</SelectItem><SelectItem value="tarjeta">Tarjeta</SelectItem><SelectItem value="transferencia">Transferencia</SelectItem></SelectContent></Select>
                </div>

                <div className="pt-2">
                  <Button type="button" variant="secondary" onClick={() => setIsTradeIn(!isTradeIn)}>
                    {isTradeIn ? "Cancelar Parte de Pago" : "Recibir en Parte de Pago"}
                  </Button>
                </div>
                {isTradeIn && (
                  <div className="p-4 border rounded-md space-y-4 animate-in fade-in-50">
                    <h4 className="font-medium text-center">Datos del Teléfono Recibido</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label htmlFor="tradeIn-name">Nombre</Label><Input id="tradeIn-name" value={tradeInProduct.name} onChange={(e) => setTradeInProduct({ ...tradeInProduct, name: e.target.value })} placeholder="Ej: iPhone 11" /></div>
                      <div className="space-y-2"><Label htmlFor="tradeIn-brand">Marca</Label><Input id="tradeIn-brand" value={tradeInProduct.brand} onChange={(e) => setTradeInProduct({ ...tradeInProduct, brand: e.target.value })} placeholder="Ej: Apple" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label htmlFor="tradeIn-model">Modelo</Label><Input id="tradeIn-model" value={tradeInProduct.model} onChange={(e) => setTradeInProduct({ ...tradeInProduct, model: e.target.value })} placeholder="Ej: A2111" /></div>
                      <div className="space-y-2"><Label htmlFor="tradeIn-price">Valor Toma ($)</Label><Input id="tradeIn-price" type="number" value={tradeInProduct.price} onChange={(e) => setTradeInProduct({ ...tradeInProduct, price: Number(e.target.value) })} /></div>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="reserva" className="space-y-4 mt-0">
                 {/* ... tu formulario de reserva existente ... */}
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            {activeTab === "venta" ? (
              <Button onClick={handleSellProduct} disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Completar Venta</Button>
            ) : (
              <Button onClick={handleReserveProduct} disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Reservar Producto</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isPdfDialogOpen} onOpenChange={setIsPdfDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generar Comprobante</AlertDialogTitle>
            <AlertDialogDescription>La operación se ha completado. ¿Deseas generar el comprobante en PDF?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handlePdfDialogClose(false)}>No, gracias</AlertDialogCancel>
            <AlertDialogAction onClick={() => handlePdfDialogClose(true)}><FileText className="mr-2 h-4 w-4" />Generar PDF</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}