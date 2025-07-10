"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Eye, MoreHorizontal } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import AddRepairForm from "@/components/add-repair-form"
import RepairDetailModal from "@/components/repair-detail-modal"

// Interfaz para definir la estructura de una reparación
interface Repair {
  id: string
  receiptNumber: string
  customerName: string
  productName: string
  status: 'pending' | 'in_progress' | 'completed' | 'delivered' | 'cancelled'
  entryDate: string
  estimatedPrice: number
  [key: string]: any
}

// Datos de ejemplo
const mockRepairs: Repair[] = [
  { id: '1', receiptNumber: 'R-001', customerName: 'Ana García', productName: 'iPhone 12', status: 'in_progress', entryDate: new Date().toISOString(), estimatedPrice: 150 },
  { id: '2', receiptNumber: 'R-002', customerName: 'Carlos Martinez', productName: 'Samsung S21', status: 'pending', entryDate: new Date().toISOString(), estimatedPrice: 200 },
  { id: '3', receiptNumber: 'R-003', customerName: 'Laura Fernandez', productName: 'Xiaomi Note 10', status: 'completed', entryDate: new Date().toISOString(), estimatedPrice: 80 },
  { id: '4', receiptNumber: 'R-004', customerName: 'Juan Perez', productName: 'Motorola G30', status: 'delivered', entryDate: new Date().toISOString(), estimatedPrice: 120 },
];

export default function RepairsPage() {
  const [repairs, setRepairs] = useState<Repair[]>(mockRepairs)
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedRepair, setSelectedRepair] = useState<Repair | null>(null)

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
      default: return 'secondary';
    }
  }

  const filteredRepairs = repairs.filter(r => 
    r.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase())
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
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRepairs.length > 0 ? (
              filteredRepairs.map((repair) => (
                <TableRow key={repair.id}>
                  <TableCell className="font-medium">{repair.receiptNumber}</TableCell>
                  <TableCell>{repair.customerName}</TableCell>
                  <TableCell>{repair.productName}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(repair.status)}>{repair.status.replace('_', ' ')}</Badge>
                  </TableCell>
                  <TableCell>{new Date(repair.entryDate).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleViewDetails(repair)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                  No se encontraron reparaciones.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AddRepairForm isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
      {selectedRepair && (
        <RepairDetailModal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} repair={selectedRepair} />
      )}
    </DashboardLayout>
  )
}
