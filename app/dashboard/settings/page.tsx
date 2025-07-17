"use client"

import { useState, useEffect } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Check, ChevronsUpDown, PlusCircle, Trash, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { ref, onValue, set, push, remove } from "firebase/database"
import { database } from "@/lib/firebase"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Product {
  id: string;
  name: string;
  category?: string;
  stock?: number;
}

interface BundleRule {
  id: string; // El ID de la regla (key de Firebase)
  name: string;
  type: 'model_range' | 'model_start' | 'category';
  conditions: {
    start?: string;
    end?: string;
    category?: string;
  };
  accessories: { id: string; name: string; category: string }[]; // Los accesorios guardan su categoría
}

export default function SettingsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [bundles, setBundles] = useState<BundleRule[]>([]);
  
  const [ruleName, setRuleName] = useState("");
  const [ruleType, setRuleType] = useState<'model_range' | 'model_start' | 'category'>('model_range');
  
  const [startModel, setStartModel] = useState("");
  const [endModel, setEndModel] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  const [selectedAccessories, setSelectedAccessories] = useState<Product[]>([]);
  const [openAccessory, setOpenAccessory] = useState(false);
  const [openMain, setOpenMain] = useState(false); // Estado para el popover de producto principal

  useEffect(() => {
    const productsRef = ref(database, 'products');
    onValue(productsRef, (snapshot) => {
      const data = snapshot.val();
      const productList: Product[] = data ? Object.entries(data).map(([id, value]: [string, any]) => ({ id, ...value })) : [];
      setProducts(productList);
      
      const uniqueCategories = [...new Set(productList.map(p => p.category).filter(Boolean))] as string[];
      setCategories(uniqueCategories);
    });

    const bundlesRef = ref(database, 'config/accessoryBundles');
    onValue(bundlesRef, (snapshot) => {
      const data = snapshot.val();
      const bundleList: BundleRule[] = data ? Object.entries(data).map(([id, value]: [string, any]) => ({ id, ...value })) : [];
      setBundles(bundleList);
    });
  }, []);

  const resetForm = () => {
    setRuleName("");
    setStartModel("");
    setEndModel("");
    setSelectedCategory("");
    setSelectedAccessories([]);
  };

  const handleSaveBundle = async () => {
    let conditions = {};
    if (!ruleName || selectedAccessories.length === 0) {
      toast.error("Datos incompletos", { description: "Debe asignar un nombre a la regla y seleccionar accesorios." });
      return;
    }

    if (ruleType === 'model_range' && (!startModel || !endModel)) {
      toast.error("Datos incompletos", { description: "Para un rango, debe especificar un modelo de inicio y de fin." });
      return;
    }
    if (ruleType === 'model_start' && !startModel) {
      toast.error("Datos incompletos", { description: "Debe especificar un modelo de inicio." });
      return;
    }
    if (ruleType === 'category' && !selectedCategory) {
      toast.error("Datos incompletos", { description: "Debe seleccionar una categoría." });
      return;
    }

    if(ruleType === 'model_range') conditions = { start: startModel, end: endModel };
    if(ruleType === 'model_start') conditions = { start: startModel };
    if(ruleType === 'category') conditions = { category: selectedCategory };

    const newBundleRef = push(ref(database, 'config/accessoryBundles'));
    try {
      await set(newBundleRef, {
        id: newBundleRef.key,
        name: ruleName,
        type: ruleType,
        conditions,
        // **CORRECCIÓN CLAVE:** Guardamos el ID, nombre y categoría del accesorio.
        accessories: selectedAccessories.map(a => ({ id: a.id, name: a.name, category: a.category })),
      });
      toast.success("Regla de combo guardada exitosamente.");
      resetForm();
    } catch (error) {
      toast.error("Error al guardar la regla.");
    }
  };
  
  const handleDeleteBundle = async (bundleId: string) => {
    if (!window.confirm("¿Estás seguro de que quieres eliminar esta regla de combo?")) return;
    
    const bundleRef = ref(database, `config/accessoryBundles/${bundleId}`);
    try {
        await remove(bundleRef);
        toast.success("Regla eliminada.");
    } catch (error) {
        toast.error("No se pudo eliminar la regla.");
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-8">
        <h1 className="text-3xl font-bold">Configuración de Combos Automáticos</h1>
        
        <div className="grid md:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Crear Nueva Regla de Combo</CardTitle>
              <CardDescription>Define reglas para agregar accesorios automáticamente a las ventas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2"><Label htmlFor="rule-name">Nombre de la Regla</Label><Input id="rule-name" placeholder="Ej: Combo iPhones 11-14" value={ruleName} onChange={(e) => setRuleName(e.target.value)} /></div>
              <div className="space-y-2"><Label>Tipo de Regla</Label><Select value={ruleType} onValueChange={(v: any) => setRuleType(v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="model_range">Por Rango de Modelos</SelectItem><SelectItem value="model_start">A Partir de un Modelo</SelectItem><SelectItem value="category">Por Categoría</SelectItem></SelectContent></Select></div>
              
              {ruleType === 'model_range' && (<div className="grid grid-cols-2 gap-4"><div><Label>Desde Modelo</Label><Input placeholder="Ej: 11" value={startModel} onChange={(e) => setStartModel(e.target.value)} /></div><div><Label>Hasta Modelo</Label><Input placeholder="Ej: 14 Pro Max" value={endModel} onChange={(e) => setEndModel(e.target.value)} /></div></div>)}
              {ruleType === 'model_start' && (<div><Label>A Partir del Modelo</Label><Input placeholder="Ej: 15" value={startModel} onChange={(e) => setStartModel(e.target.value)} /></div>)}
              {ruleType === 'category' && (<div><Label>Categoría</Label><Select value={selectedCategory} onValueChange={setSelectedCategory}><SelectTrigger><SelectValue placeholder="Seleccionar categoría..." /></SelectTrigger><SelectContent>{categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent></Select></div>)}

              <div className="space-y-2">
                <Label>Accesorios del Combo</Label>
                <Popover open={openAccessory} onOpenChange={setOpenAccessory}>
                  <PopoverTrigger asChild><Button variant="outline" role="combobox" className="w-full justify-between">Agregar accesorio...<PlusCircle className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command><CommandInput placeholder="Buscar accesorio..." /><CommandList>{products.map((product) => (<CommandItem key={product.id} onSelect={() => setSelectedAccessories(prev => [...prev, product])}>{product.name}</CommandItem>))}</CommandList></Command>
                  </PopoverContent>
                </Popover>
                <div className="space-y-2 pt-2">
                  {selectedAccessories.map(acc => (<div key={acc.id} className="flex items-center justify-between p-2 bg-muted rounded-md"><span>{acc.name}</span><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedAccessories(prev => prev.filter(p => p.id !== acc.id))}><X className="h-4 w-4" /></Button></div>))}
                </div>
              </div>
              <Button onClick={handleSaveBundle} disabled={!ruleName || selectedAccessories.length === 0}>
                Guardar Regla
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Reglas Existentes</CardTitle><CardDescription>Lista de combos configurados.</CardDescription></CardHeader>
            <CardContent>
                <ScrollArea className="h-[50vh]">
                    {bundles.length > 0 ? bundles.map(bundle => (
                        <div key={bundle.id} className="mb-4 p-4 border rounded-lg relative">
                          <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => handleDeleteBundle(bundle.id)}><Trash className="h-4 w-4"/></Button>
                          <h4 className="font-semibold pr-10">{bundle.name}</h4>
                          <div className="text-sm text-muted-foreground">
                            {bundle.type === 'category' && `Aplica a la categoría: "${bundle.conditions.category}"`}
                            {bundle.type === 'model_range' && `Aplica desde ${bundle.conditions.start} hasta ${bundle.conditions.end}`}
                            {bundle.type === 'model_start' && `Aplica desde ${bundle.conditions.start} en adelante`}
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">{bundle.accessories.map(acc => (<Badge key={acc.id} variant="secondary">{acc.name}</Badge>))}</div>
                        </div>)) : <p className="text-sm text-muted-foreground text-center py-10">No hay reglas de combos configuradas.</p>}
                </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}