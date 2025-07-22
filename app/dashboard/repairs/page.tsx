"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Eye } from "lucide-react"
import { ref, onValue, push, set, update, get, query, orderByChild, equalTo, runTransaction } from "firebase/database"
import { database } from "@/lib/firebase"
import { toast } from "sonner"
import AddRepairForm from "@/components/add-repair-form"
import RepairDetailModal from "@/components/repair-detail-modal"
import { generateRepairReceiptPdf } from "@/lib/pdf-generator"

// Interfaces
interface Repair {
  id: string
  receiptNumber: string
  customerName: string
  customerPhone: string
  productName: string
  imei?: string
  description: string
  estimatedPrice: number
  status: 'pending' | 'in_progress' | 'completed' | 'delivered' | 'cancelled'
  entryDate: string
  createdAt: number
  customerEmail?: string
  customerId?: string
  deliveredAt?: number
  finalPrice?: number
  notes?: string
  repairCost?: number
  technicianNotes?: string
  [key: string]: any
}

interface CustomerData {
    id?: string;
    name: string;
    dni: string;
    phone: string;
    email: string;
}

// --- NUEVA INTERFAZ PARA LOS DATOS DEL FORMULARIO ---
interface RepairFormData {
  productName: string;
  imei?: string;
  description: string;
  estimatedPrice: number;
}


export default function RepairsPage() {
  const [repairs, setRepairs] = useState<Repair[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedRepair, setSelectedRepair] = useState<Repair | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true);
    const repairsRef = ref(database, "repairs")
    const unsubscribe = onValue(repairsRef, (snapshot) => {
      const repairsData: Repair[] = []
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          repairsData.push({ id: childSnapshot.key!, ...childSnapshot.val() })
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

  // --- CORRECCIÓN EN LA FIRMA Y LÓGICA DE LA FUNCIÓN ---
  const handleAddRepair = useCallback(async (repairData: RepairFormData, customerData: CustomerData) => {
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

      // Objeto construido de forma explícita para evitar errores de tipo
      const finalRepairData: Repair = {
          id: newRepairId,
          receiptNumber: newReceiptNumber,
          customerId,
          customerName: customerData.name,
          customerPhone: customerData.phone,
          customerEmail: customerData.email,
          productName: repairData.productName,
          imei: repairData.imei || "",
          description: repairData.description,
          estimatedPrice: repairData.estimatedPrice,
          entryDate: new Date().toISOString(),
          createdAt: Date.now(),
          status: 'pending',
      };
      
      await set(newRepairRef, finalRepairData);
      
      await generateRepairReceiptPdf(finalRepairData, customerData);

      toast.success("Reparación agregada correctamente.", { description: `Recibo N°: ${newReceiptNumber}` });
      setIsAddModalOpen(false);

    } catch (error) {
      console.error("Error detallado al agregar reparación:", error);
      toast.error("Error al agregar la reparación.", { description: (error as Error).message });
    }
  }, []);

  const handleUpdateRepair = useCallback(async (repairId: string, updatedData: Partial<Repair>) => {
    try {
      const repairRef = ref(database, `repairs/${repairId}`)
      await update(repairRef, updatedData)
      toast.success("Reparación actualizada.")
      setIsDetailModalOpen(false)
    } catch (error) {
      console.error(error)
      toast.error("Error al actualizar la reparación.")
    }
  }, []);

  const handleViewDetails = (repair: Repair) => {
    setSelectedRepair(repair)
    setIsDetailModalOpen(true)
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
    (r.customerName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.productName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.receiptNumber || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Gestión de Reparaciones</h1>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar reparación..."
              className="pl-8 w-[250px]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Reparación
          </Button>
        </div>
      </div>

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
            ) : filteredRepairs.length > 0 ? (
              filteredRepairs.map((repair) => (
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

      <AddRepairForm isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onAddRepair={handleAddRepair} />
      {selectedRepair && (
        <RepairDetailModal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} repair={selectedRepair} onUpdate={handleUpdateRepair} />
      )}
    </DashboardLayout>
  )
}