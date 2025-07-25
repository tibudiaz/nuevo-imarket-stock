"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, Calendar, User, Clock, AlertTriangle, CheckCircle, Download } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ref, onValue, update } from "firebase/database"
import { database } from "@/lib/firebase"
import { toast } from "sonner"
import CompleteReserveModal, { Reserve } from "@/components/complete-reserve-modal"
import { useAuth } from "@/hooks/use-auth"

interface ReserveStats {
  active: number
  expired: number
  completed: number
  total: number
}

export default function ReservesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [reserves, setReserves] = useState<Reserve[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedReserve, setSelectedReserve] = useState<Reserve | null>(null)
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false)
  const [reserveStats, setReserveStats] = useState<ReserveStats>({
    active: 0,
    expired: 0,
    completed: 0,
    total: 0,
  })

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push("/")
      return
    }

    const reservesRef = ref(database, "reserves")
    const unsubscribe = onValue(reservesRef, (snapshot) => {
      if (snapshot.exists()) {
        const reservesData: Reserve[] = []
        snapshot.forEach((childSnapshot) => {
          reservesData.push({
            id: childSnapshot.key || "",
            ...childSnapshot.val(),
          })
        })

        reservesData.sort((a, b) => {
            const dateA = a.date ? new Date(a.date).getTime() : 0;
            const dateB = b.date ? new Date(b.date).getTime() : 0;
            return dateB - dateA;
        });

        setReserves(reservesData)
        calculateReserveStats(reservesData)
      } else {
        setReserves([])
        setReserveStats({
          active: 0,
          expired: 0,
          completed: 0,
          total: 0,
        })
      }
    })

    return () => {
      unsubscribe()
    }
  }, [router, user, authLoading])

  const calculateReserveStats = (reservesData: Reserve[]) => {
    const now = new Date()
    const active = reservesData.filter(
      (reserve) => reserve.status === "reserved" && reserve.expirationDate && new Date(reserve.expirationDate) > now,
    ).length
    const expired = reservesData.filter(
      (reserve) => reserve.status === "reserved" && reserve.expirationDate && new Date(reserve.expirationDate) <= now,
    ).length
    const completed = reservesData.filter((reserve) => reserve.status === "completed").length
    setReserveStats({ active, expired, completed, total: reservesData.length })
  }

  const isReserveExpired = (reserve: Reserve): boolean => {
    if (!reserve.expirationDate) return false;
    return new Date(reserve.expirationDate) <= new Date() && reserve.status === "reserved"
  }

  const handleCancelReserve = async (reserve: Reserve) => {
    try {
      const reserveRef = ref(database, `reserves/${reserve.id}`)
      await update(reserveRef, {
        status: "cancelled",
        cancelledAt: new Date().toISOString(),
      })

      const productRef = ref(database, `products/${reserve.productId}`)
      await update(productRef, {
        reserved: false,
        stock: reserve.productStock || 0,
      })
      toast.success("Reserva cancelada correctamente")
    } catch (error) {
      console.error("Error al cancelar la reserva:", error)
      toast.error("Error al cancelar la reserva")
    }
  }

  const handleCompleteReserve = (reserve: Reserve) => {
    setSelectedReserve(reserve)
    setIsCompleteModalOpen(true)
  }

  const handleReserveCompleted = () => {
    setIsCompleteModalOpen(false)
    toast.success("Venta completada con éxito.")
  }

  const filteredReserves = reserves.filter(
    (reserve) =>
      (reserve.customerName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (reserve.customerDni || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (reserve.productName || "").toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Productos Reservados (Señados)</h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar reservas..."
                className="pl-8 w-[250px]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Reservas Activas</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reserveStats.active}</div>
              <p className="text-xs text-muted-foreground">Productos señados vigentes</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Reservas Vencidas</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reserveStats.expired}</div>
              <p className="text-xs text-muted-foreground">Productos con señas vencidas</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Reservas Completadas</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reserveStats.completed}</div>
              <p className="text-xs text-muted-foreground">Reservas finalizadas con venta</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Reservas</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{reserveStats.total}</div>
              <p className="text-xs text-muted-foreground">Histórico de reservas</p>
            </CardContent>
          </Card>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Precio Total</TableHead>
                <TableHead>Seña Pagada</TableHead>
                <TableHead>Saldo</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReserves.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-6 text-muted-foreground">
                    No se encontraron reservas
                  </TableCell>
                </TableRow>
              ) : (
                filteredReserves.map((reserve) => (
                  <TableRow key={reserve.id} className={isReserveExpired(reserve) ? "bg-red-50" : ""}>
                    <TableCell>{reserve.date ? new Date(reserve.date).toLocaleDateString() : 'N/A'}</TableCell>
                    <TableCell className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {reserve.customerName}
                    </TableCell>
                    <TableCell>{reserve.productName}</TableCell>
                    <TableCell>${Number(reserve.productPrice || 0).toFixed(2)}</TableCell>
                    <TableCell>${Number(reserve.downPayment || 0).toFixed(2)}</TableCell>
                    <TableCell>${Number(reserve.remainingAmount || 0).toFixed(2)}</TableCell>
                    <TableCell className={isReserveExpired(reserve) ? "text-red-500 font-medium" : ""}>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {reserve.expirationDate ? new Date(reserve.expirationDate).toLocaleDateString() : 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          reserve.status === "completed"
                            ? "default"
                            : isReserveExpired(reserve)
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {reserve.status === "completed"
                          ? "Completada"
                          : isReserveExpired(reserve)
                            ? "Vencida"
                            : "Activa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {reserve.status === "reserved" && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => handleCompleteReserve(reserve)}>
                              Completar
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleCancelReserve(reserve)}>
                              Cancelar
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" size="icon">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {selectedReserve && (
        <CompleteReserveModal
          isOpen={isCompleteModalOpen}
          onClose={() => setIsCompleteModalOpen(false)}
          reserve={selectedReserve}
          onReserveCompleted={handleReserveCompleted}
        />
      )}
    </DashboardLayout>
  )
}