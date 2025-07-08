"use client"

import { useState, useEffect } from "react"
import { ref, set, push, get, update } from "firebase/database"
import { ref as storageRef, getDownloadURL } from "firebase/storage"
import { database, storage } from "@/lib/firebase"
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
import { useToast } from "@/components/ui/use-toast"
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

export default function SellProductModal({ isOpen, onClose, product, onProductSold }) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [activeTab, setActiveTab] = useState("venta")
  const [customer, setCustomer] = useState({
    name: "",
    dni: "",
    phone: "",
    email: "",
  })
  const [saleDetails, setSaleDetails] = useState({
    salePrice: product?.price || 0,
    paymentMethod: "efectivo",
  })
  const [reserveDetails, setReserveDetails] = useState({
    downPayment: product ? Math.round(product.price * 0.2 * 100) / 100 : 0, // 20% por defecto
    paymentMethod: "efectivo",
    expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 7 días por defecto
    notes: "",
  })
  const [isPdfDialogOpen, setIsPdfDialogOpen] = useState(false)
  const [completedSale, setCompletedSale] = useState(null)
  const [receiptNumber, setReceiptNumber] = useState("")

  useEffect(() => {
    if (isOpen) {
      // Generar un número de recibo único basado en la fecha y un número aleatorio
      const date = new Date()
      const randomNum = Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, "0")
      const receiptNum = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, "0")}${date.getDate().toString().padStart(2, "0")}-${randomNum}`
      setReceiptNumber(receiptNum)

      // Establecer el precio de venta predeterminado al precio del producto
      setSaleDetails((prev) => ({
        ...prev,
        salePrice: product?.price || 0,
      }))

      // Establecer el pago inicial predeterminado al 20% del precio del producto
      setReserveDetails((prev) => ({
        ...prev,
        downPayment: product ? Math.round(product.price * 0.2 * 100) / 100 : 0,
      }))
    }
  }, [isOpen, product])

  const searchCustomerByDni = async () => {
    if (!customer.dni || customer.dni.length < 7) {
      toast({
        title: "DNI inválido",
        description: "Por favor ingrese un DNI válido para buscar",
        variant: "destructive",
      })
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
            setCustomer({
              name: customerData.name,
              dni: customerData.dni,
              phone: customerData.phone,
              email: customerData.email || "",
            })
            found = true
            return
          }
        })

        if (!found) {
          toast({
            title: "Cliente no encontrado",
            description: "No se encontró ningún cliente con ese DNI",
          })
        }
      } else {
        toast({
          title: "No hay clientes",
          description: "No hay clientes registrados en la base de datos",
        })
      }
    } catch (error) {
      console.error("Error al buscar cliente:", error)
      toast({
        title: "Error",
        description: "Ocurrió un error al buscar el cliente",
        variant: "destructive",
      })
    } finally {
      setIsSearching(false)
    }
  }

  const handleSellProduct = async () => {
    if (!customer.name || !customer.dni || !customer.phone) {
      toast({
        title: "Datos incompletos",
        description: "Por favor complete todos los datos del cliente",
        variant: "destructive",
      })
      return
    }

    if (!saleDetails.salePrice || saleDetails.salePrice <= 0) {
      toast({
        title: "Precio inválido",
        description: "Por favor ingrese un precio de venta válido",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      // 1. Guardar o actualizar los datos del cliente
      const customersRef = ref(database, "customers")
      let customerId = null

      // Buscar si el cliente ya existe
      const customerSnapshot = await get(customersRef)
      if (customerSnapshot.exists()) {
        customerSnapshot.forEach((childSnapshot) => {
          const customerData = childSnapshot.val()
          if (customerData.dni === customer.dni) {
            customerId = childSnapshot.key
            return
          }
        })
      }

      // Si no existe, crear uno nuevo
      if (!customerId) {
        const newCustomerRef = push(customersRef)
        customerId = newCustomerRef.key
        await set(ref(database, `customers/${customerId}`), {
          name: customer.name,
          dni: customer.dni,
          phone: customer.phone,
          email: customer.email || "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      }

      // 2. Registrar la venta
      const salesRef = ref(database, "sales")
      const newSaleRef = push(salesRef)
      const saleData = {
        id: newSaleRef.key,
        receiptNumber: receiptNumber,
        productId: product.id,
        productName: product.name,
        productBarcode: product.barcode || "",
        productImei: product.imei || "",
        customerId: customerId,
        customerName: customer.name,
        customerDni: customer.dni,
        customerPhone: customer.phone,
        salePrice: saleDetails.salePrice,
        paymentMethod: saleDetails.paymentMethod,
        date: new Date().toISOString(),
        status: "completed",
      }
      await set(newSaleRef, saleData)

      // 3. Actualizar el inventario (reducir stock)
      const productRef = ref(database, `products/${product.id}`)
      await update(productRef, {
        stock: product.stock > 0 ? product.stock - 1 : 0,
        lastSold: new Date().toISOString(),
      })

      // 4. Guardar la venta completada para posible generación de PDF
      setCompletedSale(saleData)

      // 5. Mostrar diálogo para preguntar si desea generar PDF
      setIsPdfDialogOpen(true)
    } catch (error) {
      console.error("Error al registrar la venta:", error)
      toast({
        title: "Error",
        description: "Ocurrió un error al registrar la venta",
        variant: "destructive",
      })
      setIsLoading(false)
    }
  }

  const handleReserveProduct = async () => {
    if (!customer.name || !customer.dni || !customer.phone) {
      toast({
        title: "Datos incompletos",
        description: "Por favor complete todos los datos del cliente",
        variant: "destructive",
      })
      return
    }

    if (!reserveDetails.downPayment || reserveDetails.downPayment <= 0) {
      toast({
        title: "Seña inválida",
        description: "Por favor ingrese un monto de seña válido",
        variant: "destructive",
      })
      return
    }

    if (reserveDetails.downPayment >= product.price) {
      toast({
        title: "Seña inválida",
        description: "La seña no puede ser mayor o igual al precio total del producto",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      // 1. Guardar o actualizar los datos del cliente
      const customersRef = ref(database, "customers")
      let customerId = null

      // Buscar si el cliente ya existe
      const customerSnapshot = await get(customersRef)
      if (customerSnapshot.exists()) {
        customerSnapshot.forEach((childSnapshot) => {
          const customerData = childSnapshot.val()
          if (customerData.dni === customer.dni) {
            customerId = childSnapshot.key
            return
          }
        })
      }

      // Si no existe, crear uno nuevo
      if (!customerId) {
        const newCustomerRef = push(customersRef)
        customerId = newCustomerRef.key
        await set(ref(database, `customers/${customerId}`), {
          name: customer.name,
          dni: customer.dni,
          phone: customer.phone,
          email: customer.email || "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      }

      // 2. Registrar la reserva
      const reservesRef = ref(database, "reserves")
      const newReserveRef = push(reservesRef)
      const reserveData = {
        id: newReserveRef.key,
        receiptNumber: receiptNumber,
        productId: product.id,
        productName: product.name,
        productBarcode: product.barcode || "",
        productImei: product.imei || "",
        productPrice: product.price,
        customerId: customerId,
        customerName: customer.name,
        customerDni: customer.dni,
        customerPhone: customer.phone,
        downPayment: reserveDetails.downPayment,
        remainingAmount: product.price - reserveDetails.downPayment,
        paymentMethod: reserveDetails.paymentMethod,
        date: new Date().toISOString(),
        expirationDate: reserveDetails.expirationDate,
        notes: reserveDetails.notes,
        status: "reserved",
      }
      await set(newReserveRef, reserveData)

      // 3. Actualizar el inventario (marcar como reservado)
      const productRef = ref(database, `products/${product.id}`)
      await update(productRef, {
        stock: product.stock > 0 ? product.stock - 1 : 0,
        reserved: true,
        reservedBy: customerId,
        reservedUntil: reserveDetails.expirationDate,
        lastUpdated: new Date().toISOString(),
      })

      // 4. Guardar la reserva completada para posible generación de PDF
      setCompletedSale(reserveData)

      // 5. Mostrar diálogo para preguntar si desea generar PDF
      setIsPdfDialogOpen(true)
    } catch (error) {
      console.error("Error al registrar la reserva:", error)
      toast({
        title: "Error",
        description: "Ocurrió un error al registrar la reserva",
        variant: "destructive",
      })
      setIsLoading(false)
    }
  }

  const checkPdfExists = async (path) => {
    try {
      const fileRef = storageRef(storage, path)
      await getDownloadURL(fileRef)
      return true
    } catch (error) {
      console.error(`El archivo ${path} no existe en Firebase Storage:`, error)
      return false
    }
  }

  const generatePDF = async () => {
    try {
      // Mostrar mensaje de carga
      toast({
        title: "Generando PDF",
        description: "Espere mientras se genera el comprobante...",
      })

      // Verificar si el archivo PDF base existe
      const pdfExists = await checkPdfExists("factura.pdf")
      if (!pdfExists) {
        console.warn("El archivo factura.pdf no existe en Firebase Storage")
        toast({
          title: "Aviso",
          description: "La plantilla de factura no existe. Se creará un PDF básico.",
        })
      }

      // Cargar las bibliotecas necesarias
      const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib")

      // Variable para almacenar el documento PDF
      let pdfDoc

      try {
        // 1. Intentar obtener el PDF base desde Firebase Storage con manejo de errores mejorado
        const pdfTemplateRef = storageRef(storage, "factura.pdf")
        console.log("Intentando obtener PDF desde:", pdfTemplateRef.fullPath)

        try {
          // Obtener URL con manejo de errores mejorado
          const pdfTemplateUrl = await getDownloadURL(pdfTemplateRef)
          console.log("URL del PDF base obtenida:", pdfTemplateUrl)

          // Crear un PDF desde cero como alternativa inmediata
          // Esto nos asegura tener un PDF funcional incluso si falla la descarga
          const fallbackPdfDoc = await PDFDocument.create()
          fallbackPdfDoc.addPage([595, 842]) // Tamaño A4

          try {
            // Intentar descargar el PDF con fetch primero (más simple)
            const response = await fetch(pdfTemplateUrl, {
              method: "GET",
              mode: "cors", // Intentar con CORS explícito
              cache: "no-cache",
            })

            if (!response.ok) {
              throw new Error(`Error HTTP: ${response.status} ${response.statusText}`)
            }

            const pdfArrayBuffer = await response.arrayBuffer()
            console.log("PDF base descargado con fetch, tamaño:", pdfArrayBuffer.byteLength)

            // Cargar el PDF existente
            pdfDoc = await PDFDocument.load(pdfArrayBuffer)
            console.log("PDF base cargado correctamente con", pdfDoc.getPageCount(), "páginas")
          } catch (fetchError) {
            console.warn("Error al cargar el PDF con fetch, intentando con XMLHttpRequest:", fetchError.message)

            // Si fetch falla, intentar con XMLHttpRequest como alternativa
            try {
              const xhr = new XMLHttpRequest()
              xhr.open("GET", pdfTemplateUrl, true)
              xhr.responseType = "arraybuffer"

              const pdfArrayBuffer = await new Promise((resolve, reject) => {
                xhr.onload = function () {
                  if (this.status === 200) {
                    resolve(this.response)
                  } else {
                    reject(new Error(`Error HTTP: ${this.status} ${this.statusText}`))
                  }
                }

                xhr.onerror = () => {
                  reject(new Error("Error de red al intentar descargar el PDF"))
                }

                xhr.send()
              })

              console.log("PDF base descargado con XMLHttpRequest, tamaño:", pdfArrayBuffer.byteLength)

              // Cargar el PDF existente
              pdfDoc = await PDFDocument.load(pdfArrayBuffer)
              console.log("PDF base cargado correctamente con", pdfDoc.getPageCount(), "páginas")
            } catch (xhrError) {
              console.error("Error al cargar el PDF con XMLHttpRequest:", xhrError)
              // Usar el PDF de respaldo creado anteriormente
              console.log("Usando PDF de respaldo creado desde cero")
              pdfDoc = fallbackPdfDoc
            }
          }
        } catch (urlError) {
          console.error("Error al obtener la URL de descarga:", urlError)
          throw new Error(`No se pudo obtener la URL del PDF: ${urlError.message}`)
        }
      } catch (error) {
        console.warn("Creando PDF desde cero debido a error:", error.message)
        toast({
          title: "Aviso",
          description: "No se pudo cargar la plantilla. Usando plantilla básica para el PDF.",
        })

        // Crear un PDF desde cero como alternativa
        pdfDoc = await PDFDocument.create()
        // Añadir una página (A4)
        pdfDoc.addPage([595, 842])
      }

      // Configurar la fuente
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

      // Obtener la primera página
      const pages = pdfDoc.getPages()
      const firstPage = pages[0]

      // Si creamos un PDF desde cero, añadir un título y encabezado básico
      if (pages.length === 1 && pdfDoc.getPageCount() === 1) {
        // Obtener dimensiones de la página
        const { width, height } = firstPage.getSize()

        // Dibujar un título
        firstPage.drawText("COMPROBANTE DE VENTA", {
          x: 50,
          y: height - 50,
          size: 24,
          font: helveticaBold,
          color: rgb(0, 0, 0),
        })

        // Dibujar líneas para separar secciones
        firstPage.drawLine({
          start: { x: 50, y: height - 70 },
          end: { x: width - 50, y: height - 70 },
          thickness: 1,
          color: rgb(0, 0, 0),
        })
      }

      // Obtener dimensiones de la página
      const { width, height } = firstPage.getSize()

      // Formatear la fecha actual
      const currentDate = new Date(completedSale.date)
      const formattedDate = `${currentDate.getDate()}/${currentDate.getMonth() + 1}/${currentDate.getFullYear()}`

      // Coordenadas aproximadas para cada campo (ajusta según sea necesario)
      const positions = {
        numeroRecibo: { x: 430, y: 697 },
        fecha: { x: 430, y: 710 },
        nombreCliente: { x: 110, y: 657 },
        dniCliente: { x: 110, y: 643 },
        celCliente: { x: 110, y: 630 },
        productoNombre: { x: 65, y: 548 },
        productoImei: { x: 320, y: 535 },
        precioVenta: { x: 455, y: 548 },
        // Campos adicionales para el producto entregado
        productoEntregadoNombre: { x: 65, y: 505 },
        productoEntregadoImei: { x: 320, y: 498 },
        productoEntregadoImei1: { x: 322, y: 510 },
        precioCompraPesos: { x: 455, y: 505 },
        // Coordenadas para el precio final
        precioFinal: { x: 455, y: 290 },
      }

      // Asegúrate de que todos los valores son cadenas
      const numeroReciboStr = String(completedSale.receiptNumber)
      const nombreClienteStr = String(completedSale.customerName)
      const dniClienteStr = String(completedSale.customerDni)
      const celClienteStr = String(completedSale.customerPhone)
      const productoNombreStr = String(completedSale.productName || "Nombre no disponible")
      const productoImeiStr = String(completedSale.productImei || "IMEI no disponible")

      // Obtener precio según sea venta o reserva
      const precioVentaStr = completedSale.hasOwnProperty("downPayment")
        ? completedSale.productPrice
        : completedSale.salePrice

      // Función para agregar el contenido en una página
      const addContentToPage = (page) => {
        page.drawText(numeroReciboStr, {
          x: positions.numeroRecibo.x,
          y: positions.numeroRecibo.y,
          size: 10,
          font: helveticaFont,
        })

        page.drawText(formattedDate, {
          x: positions.fecha.x,
          y: positions.fecha.y,
          size: 10,
          font: helveticaFont,
        })

        page.drawText(nombreClienteStr, {
          x: positions.nombreCliente.x,
          y: positions.nombreCliente.y,
          size: 10,
          font: helveticaFont,
        })

        page.drawText(dniClienteStr, {
          x: positions.dniCliente.x,
          y: positions.dniCliente.y,
          size: 10,
          font: helveticaFont,
        })

        page.drawText(celClienteStr, {
          x: positions.celCliente.x,
          y: positions.celCliente.y,
          size: 10,
          font: helveticaFont,
        })

        page.drawText(productoNombreStr, {
          x: positions.productoNombre.x,
          y: positions.productoNombre.y,
          size: 12,
          font: helveticaFont,
        })

        page.drawText(productoImeiStr, {
          x: positions.productoImei.x,
          y: positions.productoImei.y,
          size: 10,
          font: helveticaFont,
        })

        page.drawText(`$${precioVentaStr}`, {
          x: positions.precioVenta.x,
          y: positions.precioVenta.y,
          size: 12,
          font: helveticaFont,
        })

        // Si es una reserva, mostrar información adicional
        if (completedSale.hasOwnProperty("downPayment")) {
          page.drawText(`Seña: $${completedSale.downPayment}`, {
            x: positions.productoEntregadoNombre.x,
            y: positions.productoEntregadoNombre.y,
            size: 12,
            font: helveticaFont,
          })

          page.drawText(`Saldo: $${completedSale.remainingAmount}`, {
            x: positions.precioCompraPesos.x,
            y: positions.precioCompraPesos.y,
            size: 12,
            font: helveticaFont,
          })
        }

        // Mostrar el precio final
        page.drawText(`$${precioVentaStr}`, {
          x: positions.precioFinal.x,
          y: positions.precioFinal.y,
          size: 12,
          font: helveticaBold,
        })
      }

      // Agregar el contenido en la primera página
      addContentToPage(firstPage)

      // Si hay una segunda página, hacer lo mismo
      if (pages.length > 1) {
        const secondPage = pages[1]
        addContentToPage(secondPage)
      }

      // Guardar el PDF modificado
      const pdfBytes = await pdfDoc.save()
      console.log("PDF generado correctamente, tamaño:", pdfBytes.length)

      // Convertir a Blob y descargar
      const blob = new Blob([pdfBytes], { type: "application/pdf" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `Recibo-${completedSale.receiptNumber}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: "PDF generado",
        description: "El comprobante ha sido generado correctamente",
      })
    } catch (error) {
      console.error("Error general al generar el PDF:", error)
      toast({
        title: "Error",
        description: `Error en la generación del PDF: ${error.message || "Error desconocido"}`,
        variant: "destructive",
      })
    }
  }

  const handlePdfDialogClose = (generatePdfOption) => {
    setIsPdfDialogOpen(false)
    setIsLoading(false)

    if (generatePdfOption) {
      generatePDF()
    }

    toast({
      title: completedSale.hasOwnProperty("downPayment") ? "Reserva exitosa" : "Venta exitosa",
      description: completedSale.hasOwnProperty("downPayment")
        ? "El producto ha sido señado correctamente"
        : "El producto ha sido vendido correctamente",
    })

    // Notificar que el producto fue vendido/reservado para actualizar la UI
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

            <div className="py-4">
              <div className="space-y-4 mb-4">
                <h3 className="text-lg font-medium">Datos del Cliente</h3>

                <div className="grid grid-cols-4 items-center gap-2">
                  <Label htmlFor="dni" className="col-span-1">
                    DNI
                  </Label>
                  <div className="col-span-3 flex gap-2">
                    <Input
                      id="dni"
                      value={customer.dni}
                      onChange={(e) => setCustomer({ ...customer, dni: e.target.value })}
                      placeholder="Ingrese DNI del cliente"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={searchCustomerByDni}
                      disabled={isSearching}
                      className="shrink-0"
                    >
                      {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-4 items-center gap-2">
                  <Label htmlFor="name" className="col-span-1">
                    Nombre
                  </Label>
                  <Input
                    id="name"
                    className="col-span-3"
                    value={customer.name}
                    onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                    placeholder="Nombre completo"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-2">
                  <Label htmlFor="phone" className="col-span-1">
                    Teléfono
                  </Label>
                  <Input
                    id="phone"
                    className="col-span-3"
                    value={customer.phone}
                    onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                    placeholder="Número de teléfono"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-2">
                  <Label htmlFor="email" className="col-span-1">
                    Email
                  </Label>
                  <Input
                    id="email"
                    className="col-span-3"
                    type="email"
                    value={customer.email}
                    onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                    placeholder="Correo electrónico (opcional)"
                  />
                </div>
              </div>

              <TabsContent value="venta" className="space-y-4 mt-2">
                <h3 className="text-lg font-medium">Detalles de la Venta</h3>

                <div className="grid grid-cols-4 items-center gap-2">
                  <Label htmlFor="receiptNumber" className="col-span-1">
                    Nº Recibo
                  </Label>
                  <Input
                    id="receiptNumber"
                    className="col-span-3"
                    value={receiptNumber}
                    onChange={(e) => setReceiptNumber(e.target.value)}
                    placeholder="Número de recibo"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-2">
                  <Label htmlFor="salePrice" className="col-span-1">
                    Precio
                  </Label>
                  <Input
                    id="salePrice"
                    className="col-span-3"
                    type="number"
                    value={saleDetails.salePrice}
                    onChange={(e) => setSaleDetails({ ...saleDetails, salePrice: Number.parseFloat(e.target.value) })}
                    placeholder="Precio de venta"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-2">
                  <Label htmlFor="paymentMethod" className="col-span-1">
                    Pago
                  </Label>
                  <Select
                    value={saleDetails.paymentMethod}
                    onValueChange={(value) => setSaleDetails({ ...saleDetails, paymentMethod: value })}
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
              </TabsContent>

              <TabsContent value="reserva" className="space-y-4 mt-2">
                <h3 className="text-lg font-medium">Detalles de la Reserva</h3>

                <div className="grid grid-cols-4 items-center gap-2">
                  <Label htmlFor="receiptNumberReserve" className="col-span-1">
                    Nº Recibo
                  </Label>
                  <Input
                    id="receiptNumberReserve"
                    className="col-span-3"
                    value={receiptNumber}
                    onChange={(e) => setReceiptNumber(e.target.value)}
                    placeholder="Número de recibo"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-2">
                  <Label htmlFor="downPayment" className="col-span-1">
                    Seña
                  </Label>
                  <Input
                    id="downPayment"
                    className="col-span-3"
                    type="number"
                    value={reserveDetails.downPayment}
                    onChange={(e) =>
                      setReserveDetails({ ...reserveDetails, downPayment: Number.parseFloat(e.target.value) })
                    }
                    placeholder="Monto de la seña"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-2">
                  <Label htmlFor="reservePaymentMethod" className="col-span-1">
                    Pago
                  </Label>
                  <Select
                    value={reserveDetails.paymentMethod}
                    onValueChange={(value) => setReserveDetails({ ...reserveDetails, paymentMethod: value })}
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

                <div className="grid grid-cols-4 items-center gap-2">
                  <Label htmlFor="expirationDate" className="col-span-1">
                    Vence
                  </Label>
                  <Input
                    id="expirationDate"
                    className="col-span-3"
                    type="date"
                    value={reserveDetails.expirationDate}
                    onChange={(e) => setReserveDetails({ ...reserveDetails, expirationDate: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-2">
                  <Label htmlFor="notes" className="col-span-1">
                    Notas
                  </Label>
                  <Input
                    id="notes"
                    className="col-span-3"
                    value={reserveDetails.notes}
                    onChange={(e) => setReserveDetails({ ...reserveDetails, notes: e.target.value })}
                    placeholder="Notas adicionales"
                  />
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            {activeTab === "venta" ? (
              <Button onClick={handleSellProduct} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Completar Venta
              </Button>
            ) : (
              <Button onClick={handleReserveProduct} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Reservar Producto
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo para preguntar si desea generar PDF */}
      <AlertDialog open={isPdfDialogOpen} onOpenChange={setIsPdfDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generar Comprobante</AlertDialogTitle>
            <AlertDialogDescription>
              La operación se ha completado correctamente. ¿Desea generar un comprobante en PDF?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handlePdfDialogClose(false)}>No, gracias</AlertDialogCancel>
            <AlertDialogAction onClick={() => handlePdfDialogClose(true)}>
              <FileText className="mr-2 h-4 w-4" />
              Generar PDF
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
