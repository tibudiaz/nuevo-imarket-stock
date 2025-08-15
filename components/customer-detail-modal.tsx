"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Download, Mail, Phone, User, Calendar, CreditCard, ShoppingBag, Star } from "lucide-react"
import { jsPDF } from "jspdf"

interface CustomerDetailModalProps {
  isOpen: boolean
  onClose: () => void
  customer: any
}

export default function CustomerDetailModal({ isOpen, onClose, customer }: CustomerDetailModalProps) {
  const [activeTab, setActiveTab] = useState("overview")

  const downloadCustomerHistory = () => {
    try {
      const doc = new jsPDF()

      // Título
      doc.setFontSize(20)
      doc.text("iMarket - Historial de Cliente", 105, 20, { align: "center" })

      // Información del cliente
      doc.setFontSize(14)
      doc.text(`Cliente: ${customer.name}`, 20, 40)
      doc.text(`DNI: ${customer.dni}`, 20, 50)
      doc.text(`Teléfono: ${customer.phone}`, 20, 60)
      doc.text(`Total gastado: $${customer.totalSpent.toFixed(2)}`, 20, 70)
      doc.text(`Cantidad de compras: ${customer.purchases.length}`, 20, 80)
      doc.text(`Puntos: ${customer.points || 0}`, 20, 90)

      // Línea separadora
      doc.line(20, 100, 190, 100)

      // Historial de compras
      doc.setFontSize(16)
      doc.text("Historial de Compras", 105, 110, { align: "center" })

      // Encabezados de tabla
      doc.setFontSize(12)
      doc.text("Fecha", 20, 120)
      doc.text("Producto", 70, 120)
      doc.text("Precio", 150, 120)
      doc.text("Método de Pago", 180, 120)

      // Línea separadora
      doc.line(20, 125, 190, 125)

      // Datos de compras
      let y = 135
      customer.purchases.forEach((purchase, index) => {
        const date = new Date(purchase.date).toLocaleDateString()
        doc.text(date, 20, y)
        doc.text(purchase.productName, 70, y)
        doc.text(`$${Number(purchase.salePrice).toFixed(2)}`, 150, y)
        const pm = purchase.paymentMethod === 'multiple' ? 'multiple' : purchase.paymentMethod
        doc.text(pm, 180, y)
        y += 10

        // Si llegamos al final de la página, crear una nueva
        if (y > 270) {
          doc.addPage()
          y = 20
          // Encabezados en la nueva página
          doc.text("Fecha", 20, y)
          doc.text("Producto", 70, y)
          doc.text("Precio", 150, y)
          doc.text("Método de Pago", 180, y)
          doc.line(20, y + 5, 190, y + 5)
          y += 15
        }
      })

      // Guardar PDF
      doc.save(`historial-${customer.dni}.pdf`)
    } catch (error) {
      console.error("Error al generar el PDF:", error)
    }
  }

  if (!customer) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Detalle del Cliente</DialogTitle>
          <DialogDescription>Información detallada y historial de compras del cliente.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Resumen</TabsTrigger>
            <TabsTrigger value="purchases">Historial de Compras</TabsTrigger>
            <TabsTrigger value="stats">Estadísticas</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <Card className="flex-1">
                <CardHeader>
                  <CardTitle>Información Personal</CardTitle>
                  <CardDescription>Datos de contacto del cliente</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Nombre:</span> {customer.name}
                  </div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">DNI:</span> {customer.dni}
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Teléfono:</span> {customer.phone}
                  </div>
                  {customer.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Email:</span> {customer.email}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="flex-1">
                <CardHeader>
                  <CardTitle>Resumen de Compras</CardTitle>
                  <CardDescription>Actividad del cliente</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Total de compras:</span> {customer.purchases.length}
                  </div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Total gastado:</span> ${customer.totalSpent.toFixed(2)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Puntos acumulados:</span> {customer.points || 0}
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Última compra:</span>{" "}
                    {customer.lastPurchase ? customer.lastPurchase.toLocaleDateString() : "Sin compras"}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-end">
              <Button onClick={downloadCustomerHistory}>
                <Download className="mr-2 h-4 w-4" />
                Descargar Historial
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="purchases">
            <Card>
              <CardHeader>
                <CardTitle>Historial de Compras</CardTitle>
                <CardDescription>Todas las compras realizadas por el cliente</CardDescription>
              </CardHeader>
              <CardContent>
                {customer.purchases.length === 0 ? (
                  <p className="text-center py-4 text-muted-foreground">Este cliente no ha realizado compras aún</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead>Precio</TableHead>
                        <TableHead>Método de Pago</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customer.purchases.map((purchase) => (
                        <TableRow key={purchase.id}>
                          <TableCell>{new Date(purchase.date).toLocaleDateString()}</TableCell>
                          <TableCell>{purchase.productName}</TableCell>
                          <TableCell>${Number(purchase.salePrice).toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {purchase.paymentMethod === "efectivo"
                                ? "Efectivo"
                                : purchase.paymentMethod === "tarjeta"
                                  ? "Tarjeta"
                                  : purchase.paymentMethod === "transferencia"
                                    ? "Transferencia"
                                    : purchase.paymentMethod === "mercadopago"
                                      ? "Mercado Pago"
                                      : purchase.paymentMethod === "multiple"
                                        ? "Múltiple"
                                        : purchase.paymentMethod}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats">
            <Card>
              <CardHeader>
                <CardTitle>Estadísticas del Cliente</CardTitle>
                <CardDescription>Análisis de comportamiento de compra</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Productos Preferidos</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {customer.purchases.length === 0 ? (
                        <p className="text-center py-4 text-muted-foreground">Sin datos disponibles</p>
                      ) : (
                        <div className="space-y-2">
                          {/* Aquí iría un gráfico real, pero para el ejemplo usamos texto */}
                          <div className="flex justify-between items-center">
                            <span>iPhone 13</span>
                            <Badge>3 compras</Badge>
                          </div>
                          <div className="flex justify-between items-center">
                            <span>AirPods Pro</span>
                            <Badge>1 compra</Badge>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Métodos de Pago Preferidos</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {customer.purchases.length === 0 ? (
                        <p className="text-center py-4 text-muted-foreground">Sin datos disponibles</p>
                      ) : (
                        <div className="space-y-2">
                          {/* Aquí iría un gráfico real, pero para el ejemplo usamos texto */}
                          <div className="flex justify-between items-center">
                            <span>Efectivo</span>
                            <Badge>60%</Badge>
                          </div>
                          <div className="flex justify-between items-center">
                            <span>Tarjeta</span>
                            <Badge>40%</Badge>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="md:col-span-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Historial de Gastos</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[200px] flex items-center justify-center bg-muted/20">
                      <span className="text-muted-foreground">Gráfico de gastos por mes</span>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
