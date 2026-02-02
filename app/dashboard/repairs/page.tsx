"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Search, Eye, Zap } from "lucide-react"
import { ref, onValue, push, set, update, get, query, orderByChild, equalTo, runTransaction } from "firebase/database"
import { database } from "@/lib/firebase"
import { toast } from "sonner"
import AddRepairForm from "@/components/add-repair-form"
import AddQuickRepairForm from "@/components/add-quick-repair-form"
import RepairDetailModal from "@/components/repair-detail-modal"
import { useStore } from "@/hooks/use-store"
import type { RepairPhoto } from "@/types/repair"

// --- INTERFAZ UNIFICADA Y DEFINITIVA ---
// Esta es la estructura de datos consistente que se usará en ambos componentes.
interface Repair {
  id: string;
  receiptNumber: string;
  customerId: string;
  customerName: string;
  customerDni: string;
  customerPhone: string;
  customerEmail?: string;
  productName: string;
  imei?: string;
  description: string;
  estimatedPrice: number;
  status: 'pending' | 'in_progress' | 'completed' | 'delivered' | 'cancelled';
  entryDate: string;
  createdAt: number;
  deliveredAt?: string;
  deliveryReceiptNumber?: string;
  finalPrice?: number;
  technicianNotes?: string;
  store?: string;
  photos?: RepairPhoto[];
  uploadSessionId?: string;
  quickRepair?: boolean;
  signature?: {
    url: string;
    path?: string;
    signedAt?: string;
    sessionId?: string;
    signerName?: string;
    signerDni?: string;
  } | null;
  [key: string]: any;
}

interface CustomerData {
    id?: string;
    name: string;
    dni: string;
    phone: string;
    email: string;
}

interface RepairFormData {
  productName: string;
  imei?: string;
  description: string;
  estimatedPrice: number;
}

interface QuickRepairFormData {
  productName: string;
  imei: string;
  customerName: string;
}

export default function RepairsPage() {
  const [repairs, setRepairs] = useState<Repair[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedRepair, setSelectedRepair] = useState<Repair | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { selectedStore } = useStore();

  useEffect(() => {
    setIsLoading(true);
    const repairsRef = ref(database, "repairs")
    const unsubscribe = onValue(repairsRef, (snapshot) => {
      const repairsData: Repair[] = []
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const rawValue = childSnapshot.val() || {}
          const photosObject = rawValue.photos || null
          const photos: RepairPhoto[] = photosObject
            ? Object.entries(photosObject).map(([photoId, value]) => ({
                id: photoId,
                ...(value as Omit<RepairPhoto, "id">),
              }))
            : []
          repairsData.push({ id: childSnapshot.key!, ...rawValue, photos })
        })
        setRepairs(repairsData.sort((a, b) => b.createdAt - a.createdAt))
      } else {
        setRepairs([])
      }
      setIsLoading(false)
    }, (error) => {
      console.error(error)
      toast.error("Error al cargar las reparaciones.")
      setIsLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const handleAddRepair = useCallback(async (
    repairData: RepairFormData,
    customerData: CustomerData,
    options?: { photos?: RepairPhoto[]; sessionId?: string }
  ): Promise<Repair> => {
    try {
      const customersRef = ref(database, "customers");
      const q = query(customersRef, orderByChild('dni'), equalTo(customerData.dni));
      const customerSnapshot = await get(q);

      let customerId: string;
      if (customerSnapshot.exists()) {
          const snapshotVal = customerSnapshot.val();
          customerId = Object.keys(snapshotVal)[0];
      } else {
          const newCustomerRef = push(customersRef);
          customerId = newCustomerRef.key!;
          await set(newCustomerRef, { ...customerData, createdAt: new Date().toISOString() });
          toast.info("Nuevo cliente creado.", { description: `Cliente ${customerData.name} ha sido guardado.` });
      }

      if (!customerId) throw new Error("No se pudo obtener el ID del cliente.");

      const counterRef = ref(database, 'counters/repairNumber');
      const transactionResult = await runTransaction(counterRef, (currentData) => {
        if (currentData === null) {
          return { value: 1, prefix: "R-", lastUpdated: new Date().toISOString() };
        }
        currentData.value++;
        currentData.lastUpdated = new Date().toISOString();
        return currentData;
      });

      if (!transactionResult.committed || !transactionResult.snapshot.exists()) {
        throw new Error("No se pudo confirmar la transacción del contador de recibos.");
      }

      const newCounterData = transactionResult.snapshot.val();
      const newReceiptNumber = `${newCounterData.prefix}${String(newCounterData.value).padStart(5, '0')}`;
      
      const newRepairRef = push(ref(database, "repairs"));
      const newRepairId = newRepairRef.key;
      if (!newRepairId) throw new Error("No se pudo generar el ID para la reparación.");

      const photosRecord = options?.photos?.length
        ? options.photos.reduce((acc, photo) => {
            const { id: photoId, ...photoData } = photo
            acc[photoId] = photoData
            return acc
          }, {} as Record<string, Omit<RepairPhoto, "id">>)
        : undefined

      const finalRepairData = {
          id: newRepairId,
          receiptNumber: newReceiptNumber,
          customerId,
          customerName: customerData.name,
          customerDni: customerData.dni,
          customerPhone: customerData.phone,
          customerEmail: customerData.email,
          productName: repairData.productName,
          imei: repairData.imei || "",
          description: repairData.description,
          estimatedPrice: repairData.estimatedPrice,
          entryDate: new Date().toISOString(),
          createdAt: Date.now(),
          status: 'pending' as const,
          store: selectedStore === 'all' ? 'local1' : selectedStore,
          ...(photosRecord ? { photos: photosRecord } : {}),
          ...(options?.sessionId ? { uploadSessionId: options.sessionId } : {}),
      };

      await set(newRepairRef, finalRepairData);

      if (options?.sessionId) {
        const sessionRef = ref(database, `repairUploadSessions/${options.sessionId}`)
        await update(sessionRef, {
          status: "linked",
          repairId: newRepairId,
          linkedAt: new Date().toISOString(),
        })
      }

      toast.success("Reparación agregada correctamente.", { description: `Recibo N°: ${newReceiptNumber}` });
      return finalRepairData;
    } catch (error) {
      console.error("Error detallado al agregar reparación:", error);
      toast.error("Error al agregar la reparación.", { description: (error as Error).message });
      throw error;
    }
  }, [selectedStore]);

  const handleAddQuickRepair = useCallback(async (quickRepairData: QuickRepairFormData): Promise<Repair> => {
    try {
      const counterRef = ref(database, 'counters/quickRepairNumber');
      const transactionResult = await runTransaction(counterRef, (currentData) => {
        if (currentData === null) {
          return { value: 1, prefix: "QR-", lastUpdated: new Date().toISOString() };
        }
        currentData.value++;
        currentData.lastUpdated = new Date().toISOString();
        return currentData;
      });

      if (!transactionResult.committed || !transactionResult.snapshot.exists()) {
        throw new Error("No se pudo confirmar la transacción del contador de reparaciones rápidas.");
      }

      const newCounterData = transactionResult.snapshot.val();
      const newReceiptNumber = `${newCounterData.prefix}${String(newCounterData.value).padStart(5, '0')}`;

      const newRepairRef = push(ref(database, "repairs"));
      const newRepairId = newRepairRef.key;
      if (!newRepairId) throw new Error("No se pudo generar el ID para la reparación rápida.");

      const finalRepairData = {
        id: newRepairId,
        receiptNumber: newReceiptNumber,
        customerId: "",
        customerName: quickRepairData.customerName,
        customerDni: "",
        customerPhone: "",
        customerEmail: "",
        productName: quickRepairData.productName,
        imei: quickRepairData.imei,
        description: "",
        estimatedPrice: 0,
        entryDate: new Date().toISOString(),
        createdAt: Date.now(),
        status: 'pending' as const,
        store: selectedStore === 'all' ? 'local1' : selectedStore,
        quickRepair: true,
      };

      await set(newRepairRef, finalRepairData);
      toast.success("Reparación rápida creada.", { description: `Registro N°: ${newReceiptNumber}` });
      return finalRepairData;
    } catch (error) {
      console.error("Error al agregar reparación rápida:", error);
      toast.error("Error al agregar la reparación rápida.", { description: (error as Error).message });
      throw error;
    }
  }, [selectedStore]);

  const handleUpdateRepair = useCallback(async (repairId: string, updatedData: Partial<Repair>) => {
    try {
      const repairRef = ref(database, `repairs/${repairId}`)
      await update(repairRef, updatedData)
      toast.success("Reparación actualizada.")
    } catch (error) {
      console.error(error)
      toast.error("Error al actualizar la reparación.")
    }
  }, []);

  const handleViewDetails = (repair: Repair) => {
    setSelectedRepair(repair)
    setIsDetailModalOpen(true)
  }

  const handleQuickDelivery = async (repair: Repair) => {
    if (repair.status === "delivered") {
      toast.info("La reparación ya fue entregada.")
      return
    }

    await handleUpdateRepair(repair.id, {
      status: "delivered",
      deliveredAt: repair.deliveredAt || new Date().toISOString(),
    })
  }

  const getStatusVariant = (status: Repair['status']) => {
    switch (status) {
      case 'pending': return 'destructive';
      case 'in_progress': return 'secondary';
      case 'completed': return 'default';
      case 'delivered': return 'outline';
      case 'cancelled': return 'outline'
      default: return 'secondary';
    }
  }

  const filteredRepairs = repairs.filter(r =>
    (selectedStore === 'all' || r.store === selectedStore) && (
      (r.customerName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.productName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.receiptNumber || "").toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const quickRepairs = filteredRepairs.filter((repair) => repair.quickRepair);
  const standardRepairs = filteredRepairs.filter((repair) => !repair.quickRepair);

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold">Gestión de Reparaciones</h1>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar reparación..."
                className="w-full pl-8 sm:w-[250px]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button onClick={() => setIsAddModalOpen(true)} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Nueva Reparación
            </Button>
            <Button variant="secondary" onClick={() => setIsQuickAddModalOpen(true)} className="w-full sm:w-auto">
              <Zap className="mr-2 h-4 w-4" />
              Carga rápida
            </Button>
          </div>
        </div>

        <Tabs defaultValue="todas" className="space-y-4">
          <TabsList>
            <TabsTrigger value="todas">Todas</TabsTrigger>
            <TabsTrigger value="rapidas">Rápidas</TabsTrigger>
          </TabsList>

          <TabsContent value="todas">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Recibo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Equipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha de Ingreso</TableHead>
                    <TableHead>Precio Estimado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                      Cargando reparaciones...
                    </TableCell>
                  </TableRow>
                ) : standardRepairs.length > 0 ? (
                  standardRepairs.map((repair) => (
                    <TableRow key={repair.id}>
                      <TableCell className="font-medium">{repair.receiptNumber || 'N/A'}</TableCell>
                      <TableCell>{repair.customerName}</TableCell>
                      <TableCell>{repair.productName}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(repair.status)}>{(repair.status || 'desconocido').replace(/_/g, ' ')}</Badge>
                      </TableCell>
                      <TableCell>{repair.entryDate ? new Date(repair.entryDate).toLocaleDateString() : 'N/A'}</TableCell>
                      <TableCell>${repair.estimatedPrice?.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleViewDetails(repair)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                      No se encontraron reparaciones.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="rapidas">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Recibo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Equipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Ingreso</TableHead>
                    <TableHead>Egreso</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                        Cargando reparaciones rápidas...
                      </TableCell>
                    </TableRow>
                  ) : quickRepairs.length > 0 ? (
                    quickRepairs.map((repair) => (
                      <TableRow key={repair.id}>
                        <TableCell className="font-medium">{repair.receiptNumber || 'N/A'}</TableCell>
                        <TableCell>{repair.customerName}</TableCell>
                        <TableCell>{repair.productName}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(repair.status)}>{(repair.status || 'desconocido').replace(/_/g, ' ')}</Badge>
                        </TableCell>
                        <TableCell>{repair.entryDate ? new Date(repair.entryDate).toLocaleString() : 'N/A'}</TableCell>
                        <TableCell>{repair.deliveredAt ? new Date(repair.deliveredAt).toLocaleString() : 'Pendiente'}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuickDelivery(repair)}
                            disabled={repair.status === "delivered"}
                          >
                            Marcar entregado
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleViewDetails(repair)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                        No se encontraron reparaciones rápidas.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

        <AddRepairForm isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onAddRepair={handleAddRepair} />
        <AddQuickRepairForm
          isOpen={isQuickAddModalOpen}
          onClose={() => setIsQuickAddModalOpen(false)}
          onAddQuickRepair={handleAddQuickRepair}
        />
        {selectedRepair && (
          <RepairDetailModal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} repair={selectedRepair} onUpdate={handleUpdateRepair} />
        )}
      </div>
    </DashboardLayout>
  )
}
