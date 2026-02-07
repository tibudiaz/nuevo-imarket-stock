"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ref, onValue, push } from "firebase/database"
import { database } from "@/lib/firebase"
import { toast } from "sonner"
import { useAuth } from "@/hooks/use-auth"

interface Provider {
  id: string
  name: string
  createdAt?: string
}

interface ProviderTransaction {
  id: string
  type: "debt" | "payment"
  amount: number
  detail?: string
  createdAt: string
}

interface ProviderFormState {
  debtAmount: string
  debtDetail: string
  paymentAmount: string
  paymentDetail: string
}

const defaultFormState: ProviderFormState = {
  debtAmount: "",
  debtDetail: "",
  paymentAmount: "",
  paymentDetail: "",
}

export default function ProveedoresPagosPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [providers, setProviders] = useState<Provider[]>([])
  const [transactions, setTransactions] = useState<Record<string, ProviderTransaction[]>>({})
  const [activeProviderId, setActiveProviderId] = useState<string>("")
  const [newProviderName, setNewProviderName] = useState("")
  const [formsByProvider, setFormsByProvider] = useState<Record<string, ProviderFormState>>({})

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push("/")
      return
    }
    if (user.role !== "admin") {
      toast.error("Acceso denegado", { description: "No tienes permiso para ver esta página." })
      router.push("/dashboard")
      return
    }

    const providersRef = ref(database, "providers")
    const unsubscribeProviders = onValue(providersRef, (snapshot) => {
      const nextProviders: Provider[] = []
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          nextProviders.push({ id: child.key!, ...child.val() })
        })
      }
      nextProviders.sort((a, b) => (a.name || "").localeCompare(b.name || ""))
      setProviders(nextProviders)
    })

    const transactionsRef = ref(database, "providerTransactions")
    const unsubscribeTransactions = onValue(transactionsRef, (snapshot) => {
      const nextTransactions: Record<string, ProviderTransaction[]> = {}
      if (snapshot.exists()) {
        snapshot.forEach((providerSnapshot) => {
          const providerId = providerSnapshot.key as string
          const providerTransactions: ProviderTransaction[] = []
          providerSnapshot.forEach((transactionSnapshot) => {
            providerTransactions.push({
              id: transactionSnapshot.key!,
              ...transactionSnapshot.val(),
            })
          })
          nextTransactions[providerId] = providerTransactions
        })
      }
      setTransactions(nextTransactions)
    })

    return () => {
      unsubscribeProviders()
      unsubscribeTransactions()
    }
  }, [authLoading, router, user])

  useEffect(() => {
    if (!activeProviderId && providers.length > 0) {
      setActiveProviderId(providers[0].id)
    }
  }, [activeProviderId, providers])

  const handleProviderInputChange = (providerId: string, field: keyof ProviderFormState, value: string) => {
    setFormsByProvider((prev) => ({
      ...prev,
      [providerId]: {
        ...defaultFormState,
        ...prev[providerId],
        [field]: value,
      },
    }))
  }

  const handleAddProvider = async () => {
    const trimmedName = newProviderName.trim()
    if (!trimmedName) {
      toast.error("Nombre inválido", { description: "Ingresa el nombre del proveedor." })
      return
    }

    try {
      await push(ref(database, "providers"), {
        name: trimmedName,
        createdAt: new Date().toISOString(),
      })
      setNewProviderName("")
      toast.success("Proveedor creado", { description: "El proveedor fue agregado correctamente." })
    } catch (error) {
      console.error("Error al crear proveedor:", error)
      toast.error("Error", { description: "No se pudo crear el proveedor." })
    }
  }

  const handleAddTransaction = async (providerId: string, type: "debt" | "payment") => {
    const formState = formsByProvider[providerId] ?? defaultFormState
    const amountValue = type === "debt" ? formState.debtAmount : formState.paymentAmount
    const detailValue = type === "debt" ? formState.debtDetail : formState.paymentDetail
    const numericAmount = Number(amountValue)

    if (!numericAmount || numericAmount <= 0) {
      toast.error("Monto inválido", { description: "Ingresa un monto válido." })
      return
    }

    if (type === "debt" && !detailValue.trim()) {
      toast.error("Detalle requerido", { description: "Describe en qué se gastó este dinero." })
      return
    }

    try {
      await push(ref(database, `providerTransactions/${providerId}`), {
        type,
        amount: numericAmount,
        detail: detailValue.trim() || null,
        createdAt: new Date().toISOString(),
      })

      setFormsByProvider((prev) => ({
        ...prev,
        [providerId]: {
          ...defaultFormState,
          ...prev[providerId],
          debtAmount: type === "debt" ? "" : prev[providerId]?.debtAmount ?? "",
          debtDetail: type === "debt" ? "" : prev[providerId]?.debtDetail ?? "",
          paymentAmount: type === "payment" ? "" : prev[providerId]?.paymentAmount ?? "",
          paymentDetail: type === "payment" ? "" : prev[providerId]?.paymentDetail ?? "",
        },
      }))

      toast.success(type === "debt" ? "Deuda registrada" : "Pago registrado")
    } catch (error) {
      console.error("Error al registrar movimiento:", error)
      toast.error("Error", { description: "No se pudo registrar el movimiento." })
    }
  }

  const providerTransactions = useMemo(() => {
    const normalized: Record<string, ProviderTransaction[]> = {}
    Object.entries(transactions).forEach(([providerId, providerTransactions]) => {
      normalized[providerId] = [...providerTransactions].sort((a, b) =>
        (b.createdAt || "").localeCompare(a.createdAt || "")
      )
    })
    return normalized
  }, [transactions])

  const renderProviderTab = (provider: Provider) => {
    const providerForm = formsByProvider[provider.id] ?? defaultFormState
    const providerMovements = providerTransactions[provider.id] ?? []
    const totals = providerMovements.reduce(
      (acc, movement) => {
        if (movement.type === "debt") {
          acc.debts += movement.amount
        } else {
          acc.payments += movement.amount
        }
        return acc
      },
      { debts: 0, payments: 0 }
    )
    const balance = totals.debts - totals.payments

    return (
      <TabsContent key={provider.id} value={provider.id} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total de compras</CardTitle>
              <CardDescription>Deudas registradas</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">${totals.debts.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Pagos realizados</CardTitle>
              <CardDescription>Pagos a proveedores</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">${totals.payments.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Saldo pendiente</CardTitle>
              <CardDescription>Lo que todavía se debe</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">${balance.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Registrar compra / deuda</CardTitle>
              <CardDescription>Detalla en qué se gastó y suma la deuda.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`debt-amount-${provider.id}`}>Monto</Label>
                <Input
                  id={`debt-amount-${provider.id}`}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={providerForm.debtAmount}
                  onChange={(event) =>
                    handleProviderInputChange(provider.id, "debtAmount", event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`debt-detail-${provider.id}`}>Detalle del gasto</Label>
                <Textarea
                  id={`debt-detail-${provider.id}`}
                  placeholder="Ej. Repuestos, mercadería, fletes..."
                  value={providerForm.debtDetail}
                  onChange={(event) =>
                    handleProviderInputChange(provider.id, "debtDetail", event.target.value)
                  }
                />
              </div>
              <Button onClick={() => handleAddTransaction(provider.id, "debt")}>Agregar deuda</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Registrar pago</CardTitle>
              <CardDescription>Anota pagos realizados al proveedor.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`payment-amount-${provider.id}`}>Monto</Label>
                <Input
                  id={`payment-amount-${provider.id}`}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={providerForm.paymentAmount}
                  onChange={(event) =>
                    handleProviderInputChange(provider.id, "paymentAmount", event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`payment-detail-${provider.id}`}>Detalle (opcional)</Label>
                <Textarea
                  id={`payment-detail-${provider.id}`}
                  placeholder="Ej. Transferencia, efectivo..."
                  value={providerForm.paymentDetail}
                  onChange={(event) =>
                    handleProviderInputChange(provider.id, "paymentDetail", event.target.value)
                  }
                />
              </div>
              <Button variant="secondary" onClick={() => handleAddTransaction(provider.id, "payment")}>
                Agregar pago
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Listado de compras y pagos</CardTitle>
            <CardDescription>Historial completo del proveedor.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providerMovements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No hay movimientos registrados.
                    </TableCell>
                  </TableRow>
                ) : (
                  providerMovements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell>
                        {new Date(movement.createdAt).toLocaleDateString("es-AR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className={movement.type === "debt" ? "text-red-600" : "text-emerald-600"}>
                        {movement.type === "debt" ? "Deuda" : "Pago"}
                      </TableCell>
                      <TableCell>{movement.detail || "-"}</TableCell>
                      <TableCell className="text-right font-medium">
                        ${movement.amount.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold">Proveedores - Pagos</h1>
          <p className="text-muted-foreground">
            Gestiona compras, pagos y saldos pendientes por proveedor.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Nuevo proveedor</CardTitle>
            <CardDescription>Agrega proveedores para gestionar sus compras y pagos.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="provider-name">Nombre del proveedor</Label>
              <Input
                id="provider-name"
                placeholder="Ej. Distribuidora Centro"
                value={newProviderName}
                onChange={(event) => setNewProviderName(event.target.value)}
              />
            </div>
            <Button onClick={handleAddProvider}>Crear proveedor</Button>
          </CardContent>
        </Card>

        {providers.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Aún no hay proveedores. Crea uno para empezar.
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activeProviderId} onValueChange={setActiveProviderId}>
            <TabsList className="flex flex-wrap gap-2">
              {providers.map((provider) => (
                <TabsTrigger key={provider.id} value={provider.id}>
                  {provider.name}
                </TabsTrigger>
              ))}
            </TabsList>
            {providers.map(renderProviderTab)}
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  )
}
