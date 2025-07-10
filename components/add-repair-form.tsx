"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Search } from "lucide-react"
import { toast } from "sonner"
import { ref, get, query, orderByChild, equalTo } from "firebase/database"
import { database } from "@/lib/firebase"

interface AddRepairFormProps {
  isOpen: boolean
  onClose: () => void
  onAddRepair: (repairData: any, customerData: any) => Promise<void>
}

const initialCustomerState = { dni: '', name: '', phone: '', email: '' };
const initialRepairState = { productName: '', imei: '', description: '', estimatedPrice: 0 };

export default function AddRepairForm({ isOpen, onClose, onAddRepair }: AddRepairFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [customerData, setCustomerData] = useState(initialCustomerState);
  const [repairData, setRepairData] = useState(initialRepairState);

  // Resetea el estado del formulario cuando el modal se abre.
  useEffect(() => {
    if (isOpen) {
      setCustomerData(initialCustomerState);
      setRepairData(initialRepairState);
      setIsLoading(false);
      setIsSearching(false);
    }
  }, [isOpen]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const setter = name in customerData ? setCustomerData : setRepairData;
    
    setter(prev => ({
        ...prev,
        [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  }, []);

  const searchCustomerByDni = async () => {
    if (!customerData.dni || customerData.dni.length < 7) {
      toast.error("DNI inválido", { description: "Por favor ingrese un DNI válido para buscar" });
      return;
    }
    setIsSearching(true);
    try {
      const customersRef = ref(database, "customers");
      const q = query(customersRef, orderByChild('dni'), equalTo(customerData.dni));
      const snapshot = await get(q);
      if (snapshot.exists()) {
        const foundCustomer = Object.values(snapshot.val())[0] as any;
        setCustomerData({
            name: foundCustomer.name,
            dni: foundCustomer.dni,
            phone: foundCustomer.phone,
            email: foundCustomer.email || "",
        });
        toast.success("Cliente encontrado", { description: "Los datos del cliente se han cargado." });
      } else {
        toast.info("Cliente no encontrado", { description: "Puede crear uno nuevo completando los campos." });
      }
    } catch (error) {
      console.error("Error al buscar cliente:", error);
      toast.error("Error", { description: "Ocurrió un error al buscar el cliente" });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerData.dni || !customerData.name || !customerData.phone) {
      toast.error("Datos del cliente incompletos");
      return;
    }
    if (!repairData.productName || !repairData.description) {
      toast.error("Los datos del equipo y la falla son obligatorios");
      return;
    }
    setIsLoading(true);
    await onAddRepair(repairData, customerData);
    setIsLoading(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Registrar Nueva Reparación</DialogTitle>
            <DialogDescription>
              Busca un cliente por DNI o registra uno nuevo. Luego, completa los datos de la reparación.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-1">
            
            {/* SECCIÓN CLIENTE */}
            <h3 className="text-lg font-medium border-b pb-2">Datos del Cliente</h3>
            <div className="space-y-2">
              <Label htmlFor="dni">DNI del Cliente</Label>
              <div className="flex gap-2">
                <Input name="dni" id="dni" value={customerData.dni} onChange={handleChange} placeholder="Buscar o ingresar DNI..." />
                <Button variant="outline" size="icon" type="button" onClick={searchCustomerByDni} disabled={isSearching}>
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre Completo</Label>
                <Input name="name" id="name" placeholder="Juan Pérez" required value={customerData.name} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input name="phone" id="phone" placeholder="3584123456" required value={customerData.phone} onChange={handleChange} />
              </div>
            </div>

            {/* SECCIÓN EQUIPO */}
            <h3 className="text-lg font-medium border-b pb-2 mt-4">Datos del Equipo y Reparación</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="productName">Equipo</Label>
                <Input name="productName" id="productName" placeholder="iPhone 13 Pro" required value={repairData.productName} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="imei">IMEI / N° de Serie</Label>
                <Input name="imei" id="imei" placeholder="Opcional" value={repairData.imei} onChange={handleChange} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Falla Reportada</Label>
              <Textarea name="description" id="description" placeholder="Describe el problema del equipo" required value={repairData.description} onChange={handleChange} />
            </div>
             <div className="space-y-2">
                <Label htmlFor="estimatedPrice">Presupuesto Estimado ($)</Label>
                <Input name="estimatedPrice" id="estimatedPrice" type="number" placeholder="0.00" value={repairData.estimatedPrice} onChange={handleChange}/>
              </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
              Guardar Reparación
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}