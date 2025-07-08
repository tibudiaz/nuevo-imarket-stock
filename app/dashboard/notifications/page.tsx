"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, Mail, Bell, Send, CheckCircle, AlertCircle, Clock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ref, onValue, update, push, set } from "firebase/database"
import { database } from "@/lib/firebase"
import { useToast } from "@/components/ui/use-toast"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import CreateNotificationModal from "@/components/create-notification-modal"

// Definir interfaces para los tipos
interface User {
  username: string
  role: string
}

interface Customer {
  id: string
  name?: string
  email?: string
  [key: string]: any
}

interface Notification {
  id: string
  date: string
  type?: string
  recipient?: string
  subject?: string
  message?: string
  status: string
  sentDate?: string
  resendDate?: string
  [key: string]: any
}

interface NotificationStats {
  total: number
  sent: number
  pending: number
  failed: number
}

interface NotificationData {
  type: string
  recipient: string
  subject: string
  message: string
  [key: string]: any
}

export default function NotificationsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [user, setUser] = useState<User | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("all")
  const [notificationStats, setNotificationStats] = useState<NotificationStats>({
    total: 0,
    sent: 0,
    pending: 0,
    failed: 0,
  })

  useEffect(() => {
    // Verificar autenticación
    const storedUser = localStorage.getItem("user")
    if (!storedUser) {
      router.push("/")
      return
    }

    try {
      setUser(JSON.parse(storedUser))
    } catch (e) {
      localStorage.removeItem("user")
      router.push("/")
    }

    // Cargar notificaciones desde Firebase
    const notificationsRef = ref(database, "notifications")
    const unsubscribeNotifications = onValue(notificationsRef, (snapshot) => {
      if (snapshot.exists()) {
        const notificationsData: Notification[] = []
        snapshot.forEach((childSnapshot) => {
          notificationsData.push({
            id: childSnapshot.key || "",
            ...childSnapshot.val(),
          })
        })

        // Ordenar por fecha (más reciente primero)
        notificationsData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

        setNotifications(notificationsData)
        calculateNotificationStats(notificationsData)
      } else {
        setNotifications([])
        setNotificationStats({
          total: 0,
          sent: 0,
          pending: 0,
          failed: 0,
        })
      }
    })

    // Cargar clientes desde Firebase
    const customersRef = ref(database, "customers")
    const unsubscribeCustomers = onValue(customersRef, (snapshot) => {
      if (snapshot.exists()) {
        const customersData: Customer[] = []
        snapshot.forEach((childSnapshot) => {
          customersData.push({
            id: childSnapshot.key || "",
            ...childSnapshot.val(),
          })
        })
        setCustomers(customersData)
      } else {
        setCustomers([])
      }
    })

    return () => {
      unsubscribeNotifications()
      unsubscribeCustomers()
    }
  }, [router])

  const calculateNotificationStats = (notificationsData: Notification[]) => {
    const sent = notificationsData.filter((notification) => notification.status === "sent").length
    const pending = notificationsData.filter((notification) => notification.status === "pending").length
    const failed = notificationsData.filter((notification) => notification.status === "failed").length

    setNotificationStats({
      total: notificationsData.length,
      sent,
      pending,
      failed,
    })
  }

  const handleResendNotification = async (notification: Notification) => {
    try {
      // Actualizar el estado de la notificación
      const notificationRef = ref(database, `notifications/${notification.id}`)
      await update(notificationRef, {
        status: "pending",
        resendDate: new Date().toISOString(),
      })

      // En una implementación real, aquí se enviaría la notificación
      // Para este ejemplo, simulamos el envío exitoso después de 2 segundos
      setTimeout(async () => {
        await update(notificationRef, {
          status: "sent",
          sentDate: new Date().toISOString(),
        })
      }, 2000)

      toast({
        title: "Notificación reenviada",
        description: "La notificación ha sido reenviada correctamente",
      })
    } catch (error) {
      console.error("Error al reenviar la notificación:", error)
      toast({
        title: "Error",
        description: "Ocurrió un error al reenviar la notificación",
        variant: "destructive",
      })
    }
  }

  const handleCreateNotification = async (notificationData: NotificationData) => {
    try {
      const notificationsRef = ref(database, "notifications")
      const newNotificationRef = push(notificationsRef)

      await set(newNotificationRef, {
        ...notificationData,
        date: new Date().toISOString(),
        status: "pending",
      })

      // En una implementación real, aquí se enviaría la notificación
      // Para este ejemplo, simulamos el envío exitoso después de 2 segundos
      setTimeout(async () => {
        await update(newNotificationRef, {
          status: "sent",
          sentDate: new Date().toISOString(),
        })
      }, 2000)

      toast({
        title: "Notificación creada",
        description: "La notificación ha sido creada y enviada correctamente",
      })

      setIsCreateModalOpen(false)
    } catch (error) {
      console.error("Error al crear la notificación:", error)
      toast({
        title: "Error",
        description: "Ocurrió un error al crear la notificación",
        variant: "destructive",
      })
    }
  }

  const filteredNotifications = notifications.filter((notification) => {
    // Filtrar por término de búsqueda
    const matchesSearch =
      notification.recipient?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notification.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notification.message?.toLowerCase().includes(searchTerm.toLowerCase())

    // Filtrar por pestaña activa
    if (activeTab === "all") return matchesSearch
    if (activeTab === "sent") return matchesSearch && notification.status === "sent"
    if (activeTab === "pending") return matchesSearch && notification.status === "pending"
    if (activeTab === "failed") return matchesSearch && notification.status === "failed"

    return matchesSearch
  })

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Notificaciones</h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar notificaciones..."
                className="pl-8 w-[250px]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Send className="mr-2 h-4 w-4" />
              Nueva Notificación
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Notificaciones</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{notificationStats.total}</div>
              <p className="text-xs text-muted-foreground">Notificaciones enviadas</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Enviadas</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{notificationStats.sent}</div>
              <p className="text-xs text-muted-foreground">Notificaciones entregadas</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{notificationStats.pending}</div>
              <p className="text-xs text-muted-foreground">Notificaciones en proceso</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Fallidas</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{notificationStats.failed}</div>
              <p className="text-xs text-muted-foreground">Notificaciones con error</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="sent">Enviadas</TabsTrigger>
            <TabsTrigger value="pending">Pendientes</TabsTrigger>
            <TabsTrigger value="failed">Fallidas</TabsTrigger>
          </TabsList>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Destinatario</TableHead>
                  <TableHead>Asunto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNotifications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                      No se encontraron notificaciones
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredNotifications.map((notification) => (
                    <TableRow key={notification.id}>
                      <TableCell>{new Date(notification.date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {notification.type === "sale"
                            ? "Venta"
                            : notification.type === "reserve"
                              ? "Reserva"
                              : notification.type === "reminder"
                                ? "Recordatorio"
                                : notification.type === "promotion"
                                  ? "Promoción"
                                  : "General"}
                        </Badge>
                      </TableCell>
                      <TableCell className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {notification.recipient}
                      </TableCell>
                      <TableCell>{notification.subject || "Sin asunto"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            notification.status === "sent"
                              ? "default"
                              : notification.status === "pending"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {notification.status === "sent"
                            ? "Enviada"
                            : notification.status === "pending"
                              ? "Pendiente"
                              : "Fallida"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {notification.status === "failed" && (
                          <Button variant="outline" size="sm" onClick={() => handleResendNotification(notification)}>
                            Reenviar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Tabs>
      </div>

      <CreateNotificationModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        customers={customers}
        onCreateNotification={handleCreateNotification}
      />
    </DashboardLayout>
  )
}
