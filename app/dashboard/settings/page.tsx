"use client"

import { useState, useEffect } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Check, ChevronsUpDown, Loader2, PlusCircle, Trash, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { ref, onValue, set, push, remove, get, update } from "firebase/database"
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth"
import { database, storage } from "@/lib/firebase"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator" // Importación añadida
import { deleteObject, ref as storageRef } from "firebase/storage"
import type { RepairPhoto } from "@/types/repair"

// ... (Interfaces sin cambios)
interface Product {
  id: string;
  name: string;
  category?: string;
  stock?: number;
  store?: "local1" | "local2";
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

interface AppUser {
  id: string;
  email: string;
  username: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

interface FinancingInstallment {
  interest: number;
  commerceCost?: number;
  label?: string;
}

interface FinancingCard {
  name: string;
  installments: Record<string, FinancingInstallment>;
}

interface FinancingConfig {
  preSystemFee: number;
  systemFee: number;
  vat: number;
  grossIncome: number;
  cards: Record<string, FinancingCard>;
}

type StoredRepairPhoto = Omit<RepairPhoto, "id">;

const getStoragePathFromUrl = (url: string): string | null => {
  try {
    const [, pathWithParams] = url.split("/o/");
    if (!pathWithParams) return null;
    const [encodedPath] = pathWithParams.split("?");
    if (!encodedPath) return null;
    return decodeURIComponent(encodedPath);
  } catch (error) {
    console.error("No se pudo extraer la ruta del storage:", error);
    return null;
  }
};

const parseNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const parseOptionalNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

const createDefaultFinancingConfig = (): FinancingConfig => ({
  preSystemFee: 0,
  systemFee: 4.9,
  vat: 21,
  grossIncome: 0,
  cards: {
    general: {
      name: "General",
      installments: {
        "3": { interest: 7 },
        "6": { interest: 14.5 },
      },
    },
  },
});

const normalizeFinancingConfig = (data: any): FinancingConfig => {
  if (data?.cards) {
    const cards: Record<string, FinancingCard> = {};
    Object.entries(data.cards).forEach(([cardId, cardValue]) => {
      const value = cardValue as Partial<FinancingCard> & {
        installments?: Record<string, FinancingInstallment>;
      };
      cards[cardId] = {
        name: value.name ?? "",
        installments: Object.entries(value.installments ?? {}).reduce(
          (acc, [count, inst]) => {
            const installment = inst as FinancingInstallment;
            acc[count] = {
              interest: parseNumber(installment.interest, 0),
              commerceCost: parseOptionalNumber(installment.commerceCost),
              label: installment.label,
            };
            return acc;
          },
          {} as Record<string, FinancingInstallment>
        ),
      };
    });
    return {
      preSystemFee: parseNumber(data.preSystemFee, 0),
      systemFee: parseNumber(data.systemFee, 0),
      vat: parseNumber(data.vat, 0),
      grossIncome: parseNumber(data.grossIncome, 0),
      cards,
    };
  }

  return {
    preSystemFee: parseNumber(data?.preSystemFee, 0),
    systemFee: parseNumber(data?.systemFee, 0),
    vat: parseNumber(data?.vat, 0),
    grossIncome: parseNumber(data?.grossIncome, 0),
    cards: {
      general: {
        name: "General",
        installments: Object.entries(data?.installments ?? {}).reduce(
          (acc, [count, inst]) => {
            const installment = inst as FinancingInstallment;
            acc[count] = {
              interest: parseNumber(installment.interest, 0),
              commerceCost: parseOptionalNumber(installment.commerceCost),
              label: installment.label,
            };
            return acc;
          },
          {} as Record<string, FinancingInstallment>
        ),
      },
    },
  };
};

const sanitizeFinancingConfig = (
  config: FinancingConfig
): FinancingConfig => {
  const sanitizedCards = Object.entries(config.cards).reduce(
    (acc, [cardId, card]) => {
      const sanitizedInstallments = Object.entries(card.installments).reduce(
        (installmentsAcc, [count, installment]) => {
          const sanitizedInstallment: FinancingInstallment = {
            interest: parseNumber(installment.interest, 0),
          };

          const commerceCost = parseOptionalNumber(installment.commerceCost);
          if (typeof commerceCost !== "undefined") {
            sanitizedInstallment.commerceCost = commerceCost;
          }

          if (typeof installment.label !== "undefined") {
            sanitizedInstallment.label = installment.label;
          }

          installmentsAcc[count] = sanitizedInstallment;
          return installmentsAcc;
        },
        {} as Record<string, FinancingInstallment>
      );

      acc[cardId] = {
        name: card.name,
        installments: sanitizedInstallments,
      };

      return acc;
    },
    {} as Record<string, FinancingCard>
  );

  return {
    preSystemFee: parseNumber(config.preSystemFee, 0),
    systemFee: parseNumber(config.systemFee, 0),
    vat: parseNumber(config.vat, 0),
    grossIncome: parseNumber(config.grossIncome, 0),
    cards: sanitizedCards,
  };
};

export default function SettingsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bundles, setBundles] = useState<BundleRule[]>([]);

  const [pointRate, setPointRate] = useState(0);
  const [pointValue, setPointValue] = useState(0);
  const [pointsPaused, setPointsPaused] = useState(false);

  const [financingConfig, setFinancingConfig] = useState<FinancingConfig>(
    createDefaultFinancingConfig
  );
  const [selectedFinancingCard, setSelectedFinancingCard] = useState<string>("");
  
  const [ruleName, setRuleName] = useState("");
  const [ruleType, setRuleType] = useState<'model_range' | 'model_start' | 'category'>('model_range');
  
  const [startModel, setStartModel] = useState("");
  const [endModel, setEndModel] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  const [selectedAccessories, setSelectedAccessories] = useState<Product[]>([]);
  const [openAccessory, setOpenAccessory] = useState(false);

  // Estado para la nueva categoría
  const [newCategoryName, setNewCategoryName] = useState("");

  const [users, setUsers] = useState<AppUser[]>([]);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserUsername, setNewUserUsername] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "moderator">("moderator");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [photoCleanupDate, setPhotoCleanupDate] = useState("");
  const [isCleaningRepairPhotos, setIsCleaningRepairPhotos] = useState(false);

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

    const pointsRef = ref(database, 'config/points');
    onValue(pointsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setPointRate(data.earnRate || 0);
        setPointValue(data.value || 0);
        setPointsPaused(data.paused || false);
      }
    });

    const usersRef = ref(database, 'users');
    onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      const userList: AppUser[] = data
        ? Object.entries(data).map(([id, value]: [string, any]) => ({ id, ...value }))
        : [];
      setUsers(userList);
    });
  }, []);

  useEffect(() => {
    const financingRef = ref(database, 'config/financing');
    const unsubscribe = onValue(financingRef, (snapshot) => {
      const data = snapshot.val();
      const normalized = data
        ? normalizeFinancingConfig(data)
        : createDefaultFinancingConfig();
      setFinancingConfig(normalized);
      setSelectedFinancingCard((prev) => {
        if (prev && normalized.cards[prev]) return prev;
        const [firstCard] = Object.keys(normalized.cards);
        return firstCard ?? "";
      });
    });

    return () => unsubscribe();
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

  const handleCreateUser = async () => {
    if (!newUserEmail.trim() || !newUserUsername.trim() || !newUserPassword.trim()) {
      toast.error("Datos incompletos", { description: "Email, usuario y contraseña son obligatorios." });
      return;
    }
    const auth = getAuth();
    const now = new Date().toISOString();
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        newUserEmail.trim(),
        newUserPassword.trim()
      );
      const uid = userCredential.user.uid;
      await set(ref(database, `users/${uid}`), {
        id: uid,
        email: newUserEmail.trim(),
        username: newUserUsername.trim(),
        role: newUserRole,
        createdAt: now,
        updatedAt: now,
      });
      toast.success("Usuario creado.");
      setNewUserEmail("");
      setNewUserUsername("");
      setNewUserPassword("");
      setNewUserRole("moderator");
    } catch (error) {
      console.error("Error al crear el usuario:", error);
      toast.error("Error al crear el usuario.");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("¿Estás seguro de que quieres eliminar este usuario?")) return;
    const userRef = ref(database, `users/${userId}`);
    try {
      await remove(userRef);
      toast.success("Usuario eliminado.");
    } catch (error) {
      toast.error("Error al eliminar el usuario.");
    }
  };

  const handleFinancingChange = (
    field: "preSystemFee" | "systemFee" | "vat" | "grossIncome",
    value: number
  ) => {
    setFinancingConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleCardNameChange = (cardId: string, name: string) => {
    setFinancingConfig((prev) => {
      const card = prev.cards[cardId];
      if (!card) return prev;
      return {
        ...prev,
        cards: {
          ...prev.cards,
          [cardId]: {
            ...card,
            name,
          },
        },
      };
    });
  };

  const handleAddCard = () => {
    const name = window.prompt("Nombre de la tarjeta");
    if (!name) return;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `card-${Date.now()}`;
    setFinancingConfig((prev) => ({
      ...prev,
      cards: {
        ...prev.cards,
        [id]: { name, installments: {} },
      },
    }));
    setSelectedFinancingCard(id);
  };

  const handleRemoveCard = (cardId: string) => {
    if (!window.confirm("¿Estás seguro de que quieres eliminar esta tarjeta?"))
      return;
    let nextSelected = selectedFinancingCard;
    setFinancingConfig((prev) => {
      const newCards = { ...prev.cards };
      delete newCards[cardId];
      const remainingIds = Object.keys(newCards);
      if (!remainingIds.includes(nextSelected)) {
        nextSelected = remainingIds[0] ?? "";
      }
      return { ...prev, cards: newCards };
    });
    setSelectedFinancingCard(nextSelected);
  };

  const updateInstallment = (
    cardId: string,
    count: string,
    changes: Partial<FinancingInstallment>
  ) => {
    setFinancingConfig((prev) => {
      const card = prev.cards[cardId];
      if (!card) return prev;
      const current = card.installments[count] ?? { interest: 0 };
      return {
        ...prev,
        cards: {
          ...prev.cards,
          [cardId]: {
            ...card,
            installments: {
              ...card.installments,
              [count]: { ...current, ...changes },
            },
          },
        },
      };
    });
  };

  const handleAddInstallment = (cardId: string) => {
    if (!cardId) {
      toast.error("Selecciona una tarjeta para agregar cuotas.");
      return;
    }
    const count = window.prompt("Cantidad de cuotas");
    if (!count) return;
    updateInstallment(cardId, count, { interest: 0, label: "" });
  };

  const handleRemoveInstallment = (cardId: string, count: string) => {
    setFinancingConfig((prev) => {
      const card = prev.cards[cardId];
      if (!card) return prev;
      const updatedInstallments = { ...card.installments };
      delete updatedInstallments[count];
      return {
        ...prev,
        cards: {
          ...prev.cards,
          [cardId]: {
            ...card,
            installments: updatedInstallments,
          },
        },
      };
    });
  };

  const saveFinancingConfig = async () => {
    const financingRef = ref(database, 'config/financing');
    try {
      const sanitizedConfig = sanitizeFinancingConfig(financingConfig);
      await set(financingRef, sanitizedConfig);
      toast.success('Configuración guardada');
    } catch (error) {
      console.error('Error al guardar la configuración de financiación:', error);
      toast.error('No se pudo guardar la configuración de cuotas.');
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

  const handleSavePoints = async () => {
    try {
      await set(ref(database, 'config/points'), {
        earnRate: pointRate,
        value: pointValue,
        paused: pointsPaused,
      });
      toast.success('Configuración de puntos actualizada.');
    } catch (error) {
      toast.error('No se pudo guardar la configuración de puntos.');
    }
  };

  const handleResetData = async () => {
    const password = window.prompt('Ingrese la contraseña');
    if (password !== 'Emachines 16') {
      toast.error('Contraseña incorrecta');
      return;
    }
    try {
      await Promise.all([
        remove(ref(database, 'sales')),
        remove(ref(database, 'products')),
        remove(ref(database, 'customers')),
        remove(ref(database, 'inventory')),
        remove(ref(database, 'reserves')),
        remove(ref(database, 'repairs')),
        set(ref(database, 'finances'), 0),
      ]);
      toast.success('Datos del sistema eliminados.');
    } catch (error) {
      toast.error('Error al eliminar los datos.');
    }
  };

  const handleCleanupRepairPhotos = async () => {
    if (!photoCleanupDate) {
      toast.error('Selecciona una fecha para continuar.');
      return;
    }

    const cutoffDate = new Date(photoCleanupDate);
    if (Number.isNaN(cutoffDate.getTime())) {
      toast.error('La fecha seleccionada no es válida.');
      return;
    }
    cutoffDate.setHours(23, 59, 59, 999);

    setIsCleaningRepairPhotos(true);
    try {
      const repairsSnapshot = await get(ref(database, 'repairs'));
      if (!repairsSnapshot.exists()) {
        toast.info('No hay reparaciones registradas.');
        return;
      }

      const photosToDelete: { storagePath: string; dbPath: string }[] = [];

      repairsSnapshot.forEach((childSnapshot) => {
        const repairData = childSnapshot.val() as {
          status?: string;
          photos?: Record<string, StoredRepairPhoto>;
          deliveredAt?: string;
          updatedAt?: string;
          entryDate?: string;
        };

        if (!repairData?.photos) return;
        if (repairData.status !== 'delivered' && repairData.status !== 'completed') {
          return;
        }

        const referenceDateString = repairData.deliveredAt || repairData.updatedAt || repairData.entryDate;
        if (!referenceDateString) return;
        const referenceDate = new Date(referenceDateString);
        if (Number.isNaN(referenceDate.getTime())) return;
        if (referenceDate > cutoffDate) return;

        Object.entries(repairData.photos).forEach(([photoId, photoValue]) => {
          const storagePath = photoValue.path ?? getStoragePathFromUrl(photoValue.url);
          if (!storagePath) {
            return;
          }
          photosToDelete.push({
            storagePath,
            dbPath: `repairs/${childSnapshot.key}/photos/${photoId}`,
          });
        });
      });

      if (!photosToDelete.length) {
        toast.info('No se encontraron fotos que coincidan con los filtros seleccionados.');
        return;
      }

      const updatesPayload: Record<string, null> = {};
      let deletedCount = 0;

      for (const target of photosToDelete) {
        try {
          await deleteObject(storageRef(storage, target.storagePath));
          updatesPayload[target.dbPath] = null;
          deletedCount++;
        } catch (error) {
          console.error('No se pudo eliminar la foto del storage:', target.storagePath, error);
        }
      }

      if (!deletedCount) {
        toast.error('No se pudo eliminar ninguna foto.');
        return;
      }

      await update(ref(database), updatesPayload);

      toast.success(`Se eliminaron ${deletedCount} foto${deletedCount === 1 ? '' : 's'} de reparaciones finalizadas.`);
    } catch (error) {
      console.error('Error al eliminar las fotos de reparaciones:', error);
      toast.error('No se pudieron eliminar las fotos seleccionadas.');
    } finally {
      setIsCleaningRepairPhotos(false);
    }
  };

  const currentFinancingCard = selectedFinancingCard
    ? financingConfig.cards[selectedFinancingCard]
    : undefined;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-8">
        <h1 className="text-3xl font-bold">Configuración</h1>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">

          <Card className="md:col-span-2 lg:col-span-3">
            <CardHeader>
              <CardTitle>Simulador de Costos</CardTitle>
              <CardDescription>Configura tasas e intereses.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label>Nuevo costo de uso de sistema (%)</Label>
                  <Input
                    type="number"
                    value={financingConfig.preSystemFee}
                    onChange={(e) =>
                      handleFinancingChange("preSystemFee", Number(e.target.value))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tasa del sistema (%)</Label>
                  <Input
                    type="number"
                    value={financingConfig.systemFee}
                    onChange={(e) =>
                      handleFinancingChange("systemFee", Number(e.target.value))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>IVA (%)</Label>
                  <Input
                    type="number"
                    value={financingConfig.vat}
                    onChange={(e) =>
                      handleFinancingChange("vat", Number(e.target.value))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ingresos Brutos (%)</Label>
                  <Input
                    type="number"
                    value={financingConfig.grossIncome}
                    onChange={(e) =>
                      handleFinancingChange("grossIncome", Number(e.target.value))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tarjeta</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Select
                    value={selectedFinancingCard}
                    onValueChange={setSelectedFinancingCard}
                  >
                    <SelectTrigger className="sm:w-64">
                      <SelectValue placeholder="Selecciona una tarjeta" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(financingConfig.cards).map(
                        ([cardId, card]) => (
                          <SelectItem key={cardId} value={cardId}>
                            {card.name || "Sin nombre"}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={handleAddCard}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Agregar tarjeta
                  </Button>
                </div>
              </div>
              {currentFinancingCard ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nombre de la tarjeta</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={currentFinancingCard.name}
                        onChange={(e) =>
                          handleCardNameChange(
                            selectedFinancingCard,
                            e.target.value
                          )
                        }
                        placeholder="Ej. Visa"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveCard(selectedFinancingCard)}
                        disabled={Object.keys(financingConfig.cards).length <= 1}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(currentFinancingCard.installments).length ? (
                      Object.entries(currentFinancingCard.installments).map(
                        ([count, data]) => (
                          <div
                            key={count}
                            className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center"
                          >
                            <span className="font-medium sm:w-24">
                              {count} cuotas
                            </span>
                            <Input
                              className="sm:flex-1"
                              placeholder="Nombre de las cuotas"
                              value={data.label ?? ""}
                              onChange={(e) =>
                                updateInstallment(selectedFinancingCard, count, {
                                  label: e.target.value,
                                })
                              }
                            />
                            <Input
                              type="number"
                              className="sm:w-28"
                              value={data.interest}
                              onChange={(e) =>
                                updateInstallment(selectedFinancingCard, count, {
                                  interest: Number(e.target.value),
                                })
                              }
                              placeholder="Interés %"
                            />
                            <Input
                              type="number"
                              className="sm:w-32"
                              value={data.commerceCost ?? ""}
                              onChange={(e) => {
                                const value = e.target.value;
                                updateInstallment(selectedFinancingCard, count, {
                                  commerceCost:
                                    value === "" ? undefined : Number(value),
                                });
                              }}
                              placeholder="Costo comercio %"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                handleRemoveInstallment(
                                  selectedFinancingCard,
                                  count
                                )
                              }
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        )
                      )
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No hay cuotas configuradas para esta tarjeta.
                      </p>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => handleAddInstallment(selectedFinancingCard)}
                    >
                      Agregar cuotas
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Agrega una tarjeta para configurar sus cuotas.
                </p>
              )}
              <Button onClick={saveFinancingConfig}>Guardar</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Configuración de Puntos</CardTitle>
              <CardDescription>Define cómo se obtienen y su valor.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="point-rate">Monto para sumar un punto</Label>
                <Input id="point-rate" type="number" value={pointRate} onChange={(e) => setPointRate(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="point-value">Valor de cada punto</Label>
                <Input id="point-value" type="number" value={pointValue} onChange={(e) => setPointValue(Number(e.target.value))} />
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="points-paused" checked={pointsPaused} onCheckedChange={setPointsPaused} />
                <Label htmlFor="points-paused">Pausar sistema de puntos</Label>
              </div>
              <Button onClick={handleSavePoints}>Guardar</Button>
            </CardContent>
          </Card>

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

          <Card>
            <CardHeader>
              <CardTitle>Gestionar Usuarios</CardTitle>
              <CardDescription>Crea y elimina usuarios del sistema.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="user-email">Email</Label>
                <Input id="user-email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-username">Usuario</Label>
                <Input id="user-username" value={newUserUsername} onChange={(e) => setNewUserUsername(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-password">Contraseña</Label>
                <Input
                  id="user-password"
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select value={newUserRole} onValueChange={(v: any) => setNewUserRole(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="moderator">Moderador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreateUser}>Crear Usuario</Button>
              <Separator />
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {users.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
                      <div>
                        <p className="font-medium">{user.username}</p>
                        <p className="text-xs text-muted-foreground">{user.role}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleDeleteUser(user.id)}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
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
          <Card className="md:col-span-2 lg:col-span-3">
            <CardHeader>
              <CardTitle>Limpieza de fotos de reparaciones</CardTitle>
              <CardDescription>
                Elimina definitivamente las imágenes de reparaciones entregadas o terminadas antes de una fecha.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Eliminar fotos cargadas hasta</Label>
                <Input
                  type="date"
                  value={photoCleanupDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(event) => setPhotoCleanupDate(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Solo se eliminarán fotos de reparaciones con estado Completado o Entregado. Esta acción no se puede deshacer.
                </p>
              </div>
              <Button
                variant="destructive"
                disabled={isCleaningRepairPhotos}
                onClick={handleCleanupRepairPhotos}
              >
                {isCleaningRepairPhotos && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Eliminar fotos antiguas
              </Button>
            </CardContent>
          </Card>
          <Card className="md:col-span-2 lg:col-span-3">
            <CardHeader>
              <CardTitle>Restablecer Datos</CardTitle>
              <CardDescription>Borra ventas, productos, clientes e inventario y reinicia las finanzas.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={handleResetData}>Borrar Todo</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}