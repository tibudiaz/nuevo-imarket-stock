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
import { Separator } from "@/components/ui/separator" // Importación añadida

// ... (Interfaces sin cambios)
interface Product {
  id: string;
  name: string;
  category?: string;
  stock?: number;
}

interface BundleRule {
  id: string; 
  name: string;
  type: 'model_range' | 'model_start' | 'category';
  conditions: {
    start?: string;
    end?: string;
    category?: string;
  };
  accessories: { id: string; name: string; category: string }[];
}

interface Category {
  id: string;
  name: string;
}

export default function SettingsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bundles, setBundles] = useState<BundleRule[]>([]);
  
  const [ruleName, setRuleName] = useState("");
  const [ruleType, setRuleType] = useState<'model_range' | 'model_start' | 'category'>('model_range');
  
  const [startModel, setStartModel] = useState("");
  const [endModel, setEndModel] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  const [selectedAccessories, setSelectedAccessories] = useState<Product[]>([]);
  const [openAccessory, setOpenAccessory] = useState(false);

  // Estado para la nueva categoría
  const [newCategoryName, setNewCategoryName] = useState("");

  useEffect(() => {
    const productsRef = ref(database, 'products');
    onValue(productsRef, (snapshot) => {
      const data = snapshot.val();
      const productList: Product[] = data ? Object.entries(data).map(([id, value]: [string, any]) => ({ id, ...value })) : [];
      setProducts(productList);
    });

    // Cargar categorías
    const categoriesRef = ref(database, 'categories');
    onValue(categoriesRef, (snapshot) => {
        const data = snapshot.val();
        const categoryList: Category[] = data ? Object.entries(data).map(([id, value]: [string, any]) => ({ id, name: value.name })) : [];
        setCategories(categoryList);
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

  const handleSaveCategory = async () => {
    if (!newCategoryName.trim()) {
        toast.error("El nombre de la categoría no puede estar vacío.");
        return;
    }
    const newCategoryRef = push(ref(database, 'categories'));
    try {
        await set(newCategoryRef, { name: newCategoryName.trim() });
        toast.success(`Categoría "${newCategoryName.trim()}" creada.`);
        setNewCategoryName(""); // Limpiar input
    } catch (error) {
        toast.error("Error al crear la categoría.");
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
      if (!window.confirm("¿Estás seguro de que quieres eliminar esta categoría?")) return;
      const categoryRef = ref(database, `categories/${categoryId}`);
      try {
          await remove(categoryRef);
          toast.success("Categoría eliminada.");
      } catch (error) {
          toast.error("Error al eliminar la categoría.");
      }
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
        <h1 className="text-3xl font-bold">Configuración</h1>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          
          <Card>
            <CardHeader>
              <CardTitle>Gestionar Categorías</CardTitle>
              <CardDescription>Añade o elimina categorías de productos.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input 
                    placeholder="Nombre de la nueva categoría" 
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                  />
                  <Button onClick={handleSaveCategory}><PlusCircle className="h-4 w-4"/></Button>
                </div>
                <Separator />
                <ScrollArea className="h-64">
                    <div className="space-y-2">
                        {categories.map(cat => (
                            <div key={cat.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
                                <span>{cat.name}</span>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteCategory(cat.id)}>
                                    <Trash className="h-4 w-4"/>
                                </Button>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Reglas de Combos Automáticos</CardTitle>
              <CardDescription>Define reglas para agregar accesorios automáticamente a las ventas.</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
               <div>
                  <div className="space-y-6">
              <div className="space-y-2"><Label htmlFor="rule-name">Nombre de la Regla</Label><Input id="rule-name" placeholder="Ej: Combo iPhones 11-14" value={ruleName} onChange={(e) => setRuleName(e.target.value)} /></div>
              <div className="space-y-2"><Label>Tipo de Regla</Label><Select value={ruleType} onValueChange={(v: any) => setRuleType(v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="model_range">Por Rango de Modelos</SelectItem><SelectItem value="model_start">A Partir de un Modelo</SelectItem><SelectItem value="category">Por Categoría</SelectItem></SelectContent></Select></div>
              
              {ruleType === 'model_range' && (<div className="grid grid-cols-2 gap-4"><div><Label>Desde Modelo</Label><Input placeholder="Ej: 11" value={startModel} onChange={(e) => setStartModel(e.target.value)} /></div><div><Label>Hasta Modelo</Label><Input placeholder="Ej: 14 Pro Max" value={endModel} onChange={(e) => setEndModel(e.target.value)} /></div></div>)}
              {ruleType === 'model_start' && (<div><Label>A Partir del Modelo</Label><Input placeholder="Ej: 15" value={startModel} onChange={(e) => setStartModel(e.target.value)} /></div>)}
              {ruleType === 'category' && (<div><Label>Categoría</Label><Select value={selectedCategory} onValueChange={setSelectedCategory}><SelectTrigger><SelectValue placeholder="Seleccionar categoría..." /></SelectTrigger><SelectContent>{categories.map(cat => <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>)}</SelectContent></Select></div>)}

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
            </div>
               </div>
               <div>
                  <ScrollArea className="h-[60vh]">
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
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}