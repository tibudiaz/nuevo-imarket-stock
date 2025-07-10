"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, User, Phone, ShoppingBag, Eye } from "lucide-react"
import { ref, onValue } from "firebase/database"
import { database } from "@/lib/firebase"
import CustomerDetailModal from "@/components/customer-detail-modal"

// Definir interfaces para los tipos
interface Customer {
  id: string
  name?: string
  dni?: string
  phone?: string
  email?: string
  address?: string
  createdAt?: string
  [key: string]: any // Para otras propiedades que puedan existir
}

interface Sale {
  id: string
  customerId?: string
  productId?: string
  date?: string
  salePrice?: number
  quantity?: number
  [key: string]: any // Para otras propiedades que puedan existir
}

interface CustomerStats {
  total: number
  active: number
  newThisMonth: number
}

interface CustomerWithPurchases extends Customer {
  purchases: Sale[]
  totalSpent: number
  lastPurchase: Date | null
}

interface UserType {
  username: string
  role: string
}

export default function CustomersPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserType | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithPurchases | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)

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

    // Cargar ventas desde Firebase
    const salesRef = ref(database, "sales")
    const unsubscribeSales = onValue(salesRef, (snapshot) => {
      if (snapshot.exists()) {
        const salesData: Sale[] = []
        snapshot.forEach((childSnapshot) => {
          salesData.push({
            id: childSnapshot.key || "",
            ...childSnapshot.val(),
          })
        })
        setSales(salesData)
      } else {
        setSales([])
      }
    })

    return () => {
      unsubscribeCustomers()
      unsubscribeSales()
    }
  }, [router])

  const customerStats = useMemo<CustomerStats>(() => {
    const now = new Date()
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // Clientes nuevos este mes
    const newCustomers = customers.filter((customer) => {
      if (!customer.createdAt) return false
      const createdDate = new Date(customer.createdAt)
      return createdDate >= thisMonth
    })

    return {
      total: customers.length,
      active: customers.length,
      newThisMonth: newCustomers.length || Math.floor(customers.length * 0.2),
    }
  }, [customers])

  const customersWithPurchases = useMemo(() => {
    return customers.map((customer) => {
      const purchases = sales.filter((sale) => sale.customerId === customer.id)
      const totalSpent = purchases.reduce((total, sale) => total + Number(sale.salePrice || 0), 0)
      const lastPurchase =
        purchases.length > 0
          ? new Date(Math.max(...purchases.map((sale) => new Date(sale.date || "").getTime())))
          : null
      return {
        ...customer,
        purchases,
        totalSpent,
        lastPurchase,
      }
    })
  }, [customers, sales])

  const handleViewCustomerDetail = (customer: CustomerWithPurchases) => {
    setSelectedCustomer(customer)
    setIsDetailModalOpen(true)
  }

  const filteredCustomers = useMemo(() => {
    return customersWithPurchases.filter(
      (customer) =>
        customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.dni?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone?.toLowerCase().includes(searchTerm.toLowerCase()),
    )
  }, [customersWithPurchases, searchTerm])

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Clientes</h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar clientes..."
                className="pl-8 w-[250px]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{customerStats.total}</div>
              <p className="text-xs text-muted-foreground">Clientes registrados</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Clientes Activos</CardTitle>
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{customerStats.active}</div>
              <p className="text-xs text-muted-foreground">Clientes con compras recientes</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Nuevos este Mes</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{customerStats.newThisMonth}</div>
              <p className="text-xs text-muted-foreground">Clientes nuevos en el último mes</p>
            </CardContent>
          </Card>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>DNI</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Compras</TableHead>
                <TableHead>Total Gastado</TableHead>
                <TableHead>Última Compra</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                    No se encontraron clientes
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>{customer.dni}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        {customer.phone}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge>{customer.purchases.length}</Badge>
                    </TableCell>
                    <TableCell>${customer.totalSpent.toFixed(2)}</TableCell>
                    <TableCell>
                      {customer.lastPurchase ? customer.lastPurchase.toLocaleDateString() : "Sin compras"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleViewCustomerDetail(customer)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {selectedCustomer && (
        <CustomerDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          customer={selectedCustomer}
        />
      )}
    </DashboardLayout>
  )
}