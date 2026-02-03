"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Check, ChevronsUpDown, Copy, Loader2, PlusCircle, Smartphone, Trash, UploadCloud, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { ref, onValue, set, push, remove, get, update } from "firebase/database"
import { getAuth, createUserWithEmailAndPassword, updatePassword } from "firebase/auth"
import { database, storage } from "@/lib/firebase"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator" // Importación añadida
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import QRCode from "qrcode"
import type { RepairPhoto } from "@/types/repair"
import { normalizeCatalogAdConfig, type CatalogAdAsset, type CatalogAdConfig, type CatalogAdType } from "@/lib/catalog-ads"
import { getAppBaseUrl } from "@/lib/base-url"

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

interface OfferItem {
  id: string;
  text: string;
  createdAt?: string;
}

interface NewCatalogItem {
  id: string;
  name: string;
  price?: number;
  status?: string;
  createdAt?: string;
}

interface Customer {
  id: string;
  name?: string;
  email?: string;
  password?: string;
  [key: string]: any;
}

interface SystemChangeEntry {
  id: string;
  user?: string;
  username?: string;
  action?: string;
  field?: string;
  productName?: string;
  product?: string;
  before?: number | string;
  after?: number | string;
  description?: string;
  createdAt?: string | number;
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

const generateUploadSessionId = () => {
  if (
    typeof globalThis !== "undefined" &&
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const mergeCatalogAdAssets = (
  current: CatalogAdAsset[],
  incoming: CatalogAdAsset[]
): CatalogAdAsset[] => {
  const map = new Map<string, CatalogAdAsset>();
  current.forEach((asset) => {
    map.set(asset.path || asset.url, asset);
  });
  incoming.forEach((asset) => {
    const key = asset.path || asset.url;
    if (!map.has(key)) {
      map.set(key, asset);
    }
  });
  return Array.from(map.values());
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
  const [systemHistory, setSystemHistory] = useState<SystemChangeEntry[]>([]);

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
  const [offers, setOffers] = useState<OfferItem[]>([]);
  const [newOfferText, setNewOfferText] = useState("");
  const [newCatalogItems, setNewCatalogItems] = useState<NewCatalogItem[]>([]);
  const [newCatalogName, setNewCatalogName] = useState("");
  const [newCatalogPrice, setNewCatalogPrice] = useState("");
  const [newCatalogStatus, setNewCatalogStatus] = useState("");
  const [catalogVisitCount, setCatalogVisitCount] = useState(0);
  const [usdRateAdjustment, setUsdRateAdjustment] = useState(0);
  const [catalogAds, setCatalogAds] = useState<Record<string, CatalogAdConfig>>({});
  const [selectedCatalogAdPage, setSelectedCatalogAdPage] = useState<"landing" | "nuevos" | "usados">("landing");
  const [catalogAdEnabled, setCatalogAdEnabled] = useState(false);
  const [catalogAdType, setCatalogAdType] = useState<CatalogAdType>("image");
  const [catalogAdTitle, setCatalogAdTitle] = useState("");
  const [catalogAdAssets, setCatalogAdAssets] = useState<CatalogAdAsset[]>([]);
  const [isCatalogAdUploadOpen, setIsCatalogAdUploadOpen] = useState(false);
  const [catalogAdUploadSessionId, setCatalogAdUploadSessionId] = useState<string | null>(null);
  const [catalogAdUploadQr, setCatalogAdUploadQr] = useState("");
  const [catalogAdUploadOrigin, setCatalogAdUploadOrigin] = useState("");
  const [catalogAdUploadTargetPage, setCatalogAdUploadTargetPage] = useState<"landing" | "nuevos" | "usados">("landing");
  const [isCatalogAdUploading, setIsCatalogAdUploading] = useState(false);

  const [users, setUsers] = useState<AppUser[]>([]);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserUsername, setNewUserUsername] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "moderator">("moderator");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [photoCleanupDate, setPhotoCleanupDate] = useState("");
  const [isCleaningRepairPhotos, setIsCleaningRepairPhotos] = useState(false);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerDniSearch, setCustomerDniSearch] = useState("");
  const [customerPassword, setCustomerPassword] = useState("");
  const [customerPasswordConfirm, setCustomerPasswordConfirm] = useState("");
  const [isUpdatingCustomerPassword, setIsUpdatingCustomerPassword] = useState(false);

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

    const usdAdjustmentRef = ref(database, "config/usdRateAdjustment");
    onValue(usdAdjustmentRef, (snapshot) => {
      const value = snapshot.val();
      setUsdRateAdjustment(
        typeof value === "number" && Number.isFinite(value) ? value : 0,
      );
    });

    const offersRef = ref(database, 'config/offers');
    onValue(offersRef, (snapshot) => {
      const data = snapshot.val();
      const offerList: OfferItem[] = data
        ? Object.entries(data).map(([id, value]: [string, any]) => ({
            id,
            text: value?.text ?? "",
            createdAt: value?.createdAt,
          }))
        : [];
      setOffers(offerList.filter((offer) => offer.text.trim() !== ""));
    });

    const catalogAdsRef = ref(database, "config/catalogAds");
    onValue(catalogAdsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setCatalogAds({});
        return;
      }
      const normalized = Object.entries(data).reduce(
        (acc, [key, value]) => {
          acc[key] = normalizeCatalogAdConfig(value);
          return acc;
        },
        {} as Record<string, CatalogAdConfig>
      );
      setCatalogAds(normalized);
    });

    const newCatalogRef = ref(database, "config/newPhones");
    const unsubscribeNewCatalog = onValue(newCatalogRef, (snapshot) => {
      const data = snapshot.val();
      const catalogList: NewCatalogItem[] = data
        ? Object.entries(data).map(([id, value]: [string, any]) => ({
            id,
            name: String(value?.name ?? ""),
            price: typeof value?.price === "number" ? value.price : undefined,
            status: value?.status ? String(value.status) : undefined,
            createdAt: value?.createdAt,
          }))
        : [];
      catalogList.sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));
      setNewCatalogItems(catalogList);
    });

    const usersRef = ref(database, 'users');
    onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      const userList: AppUser[] = data
        ? Object.entries(data).map(([id, value]: [string, any]) => ({ id, ...value }))
        : [];
      setUsers(userList);
    });

    const customersRef = ref(database, 'customers');
    onValue(customersRef, (snapshot) => {
      const data = snapshot.val();
      const customerList: Customer[] = data
        ? Object.entries(data).map(([id, value]: [string, any]) => ({ id, ...value }))
        : [];
      customerList.sort((a, b) => {
        const dniA = (a.dni || '').toString();
        const dniB = (b.dni || '').toString();
        return dniA.localeCompare(dniB, 'es');
      });
      setCustomers(customerList);
    });

    const catalogVisitsRef = ref(database, "metrics/catalogVisits/total");
    onValue(catalogVisitsRef, (snapshot) => {
      const data = snapshot.val();
      setCatalogVisitCount(parseNumber(data, 0));
    });

    return () => {
      unsubscribeNewCatalog();
    };
  }, []);

  useEffect(() => {
    const current = catalogAds[selectedCatalogAdPage];
    if (!current) {
      setCatalogAdEnabled(false);
      setCatalogAdType("image");
      setCatalogAdTitle("");
      setCatalogAdAssets([]);
      return;
    }
    setCatalogAdEnabled(current.enabled);
    setCatalogAdType(current.type);
    setCatalogAdTitle(current.title ?? "");
    if (current.assets && current.assets.length > 0) {
      setCatalogAdAssets(current.assets);
    } else {
      setCatalogAdAssets(current.urls.map((url) => ({ url })));
    }
  }, [catalogAds, selectedCatalogAdPage]);

  useEffect(() => {
    const historyRef = ref(database, 'systemChangeHistory');
    const unsubscribe = onValue(historyRef, (snapshot) => {
      const data = snapshot.val();
      const historyList: SystemChangeEntry[] = data
        ? Object.entries(data).map(([id, value]: [string, any]) => ({ id, ...value }))
        : [];
      historyList.sort((a, b) => getEntryTimestamp(b) - getEntryTimestamp(a));
      setSystemHistory(historyList);
    });

    return () => unsubscribe();
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

  useEffect(() => {
    const resolvedOrigin = getAppBaseUrl();
    setCatalogAdUploadOrigin(resolvedOrigin);
  }, []);

  useEffect(() => {
    if (!isCatalogAdUploadOpen) {
      setCatalogAdUploadSessionId(null);
      setCatalogAdUploadQr("");
      return;
    }
    const newSession = generateUploadSessionId();
    setCatalogAdUploadSessionId(newSession);
  }, [isCatalogAdUploadOpen]);

  useEffect(() => {
    if (isCatalogAdUploadOpen) {
      setCatalogAdUploadTargetPage(selectedCatalogAdPage);
    }
  }, [isCatalogAdUploadOpen, selectedCatalogAdPage]);

  useEffect(() => {
    if (!catalogAdUploadSessionId) return;
    const sessionRef = ref(database, `catalogAdUploadSessions/${catalogAdUploadSessionId}`);
    set(sessionRef, {
      createdAt: new Date().toISOString(),
      page: catalogAdUploadTargetPage,
      type: catalogAdType,
      status: "pending",
    }).catch((error) => {
      console.error("Error al crear la sesión de carga de publicidad:", error);
    });

    const filesRef = ref(database, `catalogAdUploadSessions/${catalogAdUploadSessionId}/files`);
    const unsubscribe = onValue(filesRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const assets = Object.values(snapshot.val()).map((value) => {
        const payload = value as Record<string, unknown>;
        return {
          url: String(payload.url ?? ""),
          path: typeof payload.path === "string" ? payload.path : undefined,
          name: typeof payload.name === "string" ? payload.name : undefined,
          type: typeof payload.type === "string" ? payload.type : undefined,
        } satisfies CatalogAdAsset;
      }).filter((asset) => asset.url.length > 0);
      setCatalogAdAssets((prev) => mergeCatalogAdAssets(prev, assets));
    });

    return () => unsubscribe();
  }, [catalogAdUploadSessionId, catalogAdUploadTargetPage, catalogAdType]);

  useEffect(() => {
    if (!catalogAdUploadSessionId) {
      setCatalogAdUploadQr("");
      return;
    }
    const resolvedOrigin =
      catalogAdUploadOrigin ||
      getAppBaseUrl() ||
      (typeof window !== "undefined" ? window.location.origin : "");
    if (!resolvedOrigin) {
      setCatalogAdUploadQr("");
      return;
    }
    const url = `${resolvedOrigin}/catalog-ads/mobile-upload?sessionId=${catalogAdUploadSessionId}&page=${catalogAdUploadTargetPage}&type=${catalogAdType}`;
    QRCode.toDataURL(url, { width: 300 })
      .then(setCatalogAdUploadQr)
      .catch((error) => {
        console.error("No se pudo generar el código QR de publicidad", error);
      });
  }, [catalogAdUploadOrigin, catalogAdUploadSessionId]);

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

  const handleAddOffer = async () => {
    const trimmed = newOfferText.trim();
    if (!trimmed) {
      toast.error("La oferta no puede estar vacía.");
      return;
    }
    const offerRef = push(ref(database, "config/offers"));
    try {
      await set(offerRef, {
        text: trimmed,
        createdAt: new Date().toISOString(),
      });
      setNewOfferText("");
      toast.success("Oferta agregada.");
    } catch (error) {
      console.error("Error al guardar la oferta:", error);
      toast.error("No se pudo guardar la oferta.");
    }
  };

  const handleRemoveOffer = async (offerId: string) => {
    try {
      await remove(ref(database, `config/offers/${offerId}`));
      toast.success("Oferta eliminada.");
    } catch (error) {
      console.error("Error al eliminar la oferta:", error);
      toast.error("No se pudo eliminar la oferta.");
    }
  };

  const handleCatalogAdFilesUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) return;
    const files = Array.from(event.target.files);
    setIsCatalogAdUploading(true);
    try {
      if (catalogAdType === "video" && catalogAdAssets.length > 0) {
        await Promise.all(
          catalogAdAssets.map((asset) =>
            asset.path ? deleteObject(storageRef(storage, asset.path)) : Promise.resolve()
          )
        );
        setCatalogAdAssets([]);
      }

      for (const file of files) {
        const storagePath = `catalog-ads/${selectedCatalogAdPage}/${Date.now()}-${file.name}`;
        const fileRef = storageRef(storage, storagePath);
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);
        const newAsset: CatalogAdAsset = {
          url,
          path: storagePath,
          name: file.name,
          type: file.type,
        };
        setCatalogAdAssets((prev) => mergeCatalogAdAssets(prev, [newAsset]));
      }
      toast.success("Archivos cargados correctamente.");
    } catch (error) {
      console.error("Error al subir archivos de publicidad:", error);
      toast.error("No se pudieron subir los archivos.");
    } finally {
      event.target.value = "";
      setIsCatalogAdUploading(false);
    }
  };

  const handleRemoveCatalogAdAsset = async (asset: CatalogAdAsset) => {
    try {
      if (asset.path) {
        await deleteObject(storageRef(storage, asset.path));
      }
      setCatalogAdAssets((prev) =>
        prev.filter((item) => (item.path || item.url) !== (asset.path || asset.url))
      );
      toast.success("Archivo eliminado.");
    } catch (error) {
      console.error("Error al eliminar el archivo del storage:", error);
      toast.error("No se pudo eliminar el archivo.");
    }
  };

  const handleSaveCatalogAd = async () => {
    const cleanedAssets = catalogAdAssets.filter((asset) => asset.url.trim().length > 0);
    const normalizedAssets =
      catalogAdType === "video" ? cleanedAssets.slice(0, 1) : cleanedAssets;
    const urls = normalizedAssets.map((asset) => asset.url);
    if (catalogAdEnabled && urls.length === 0) {
      toast.error("Agregá al menos un archivo para mostrar la publicidad.");
      return;
    }
    try {
      await set(ref(database, `config/catalogAds/${selectedCatalogAdPage}`), {
        enabled: catalogAdEnabled,
        type: catalogAdType,
        title: catalogAdTitle.trim(),
        urls,
        assets: normalizedAssets,
      });
      toast.success("Publicidad del catálogo guardada.");
    } catch (error) {
      console.error("Error al guardar la publicidad del catálogo:", error);
      toast.error("No se pudo guardar la publicidad.");
    }
  };

  const handleSaveUsdRateAdjustment = async () => {
    try {
      await set(ref(database, "config/usdRateAdjustment"), usdRateAdjustment);
      toast.success("Ajuste de cotización guardado.");
    } catch (error) {
      console.error("Error al guardar el ajuste de cotización:", error);
      toast.error("No se pudo guardar el ajuste.");
    }
  };

  const handleAddNewCatalogItem = async () => {
    const trimmedName = newCatalogName.trim();
    const trimmedStatus = newCatalogStatus.trim();
    if (!trimmedName) {
      toast.error("El nombre del equipo es obligatorio.");
      return;
    }

    const trimmedPrice = newCatalogPrice.trim();
    const price =
      trimmedPrice.length > 0 ? Number(trimmedPrice.replace(",", ".")) : undefined;
    if (trimmedPrice.length > 0 && !Number.isFinite(price)) {
      toast.error("Ingresá un precio válido.");
      return;
    }

    if (!trimmedStatus && typeof price === "undefined") {
      toast.error("Cargá un precio o una descripción para el ingreso.");
      return;
    }

    const catalogRef = push(ref(database, "config/newPhones"));
    try {
      const payload: Record<string, string | number> = {
        name: trimmedName,
        createdAt: new Date().toISOString(),
      };
      if (typeof price === "number") {
        payload.price = price;
      }
      if (trimmedStatus) {
        payload.status = trimmedStatus;
      }
      await set(catalogRef, payload);
      setNewCatalogName("");
      setNewCatalogPrice("");
      setNewCatalogStatus("");
      toast.success("Equipo agregado al catálogo de nuevos.");
    } catch (error) {
      console.error("Error al agregar equipo nuevo:", error);
      toast.error("No se pudo agregar el equipo.");
    }
  };

  const handleRemoveNewCatalogItem = async (itemId: string) => {
    try {
      await remove(ref(database, `config/newPhones/${itemId}`));
      toast.success("Equipo eliminado.");
    } catch (error) {
      console.error("Error al eliminar equipo nuevo:", error);
      toast.error("No se pudo eliminar el equipo.");
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

  const handleUpdateCustomerPassword = async () => {
    const normalizedDni = customerDniSearch.replace(/\D/g, "");
    if (!normalizedDni) {
      toast.error("Ingresá el DNI del cliente para continuar.");
      return;
    }
    const trimmedPassword = customerPassword.trim();
    const trimmedConfirm = customerPasswordConfirm.trim();
    if (!trimmedPassword || !trimmedConfirm) {
      toast.error("Ingresá y confirmá la nueva contraseña.");
      return;
    }
    if (trimmedPassword !== trimmedConfirm) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }

    const selectedCustomer = customers.find((customer) => {
      const customerDni = String(customer.dni || "").replace(/\D/g, "");
      return customerDni === normalizedDni;
    });
    if (!selectedCustomer) {
      toast.error("No encontramos un cliente con ese DNI.");
      return;
    }

    setIsUpdatingCustomerPassword(true);
    try {
      await update(ref(database, `customers/${selectedCustomer.id}`), {
        password: trimmedPassword,
        passwordUpdatedAt: new Date().toISOString(),
      });

      if (selectedCustomer.email) {
        try {
          const auth = getAuth();
          const authUser = auth.currentUser;
          if (authUser && authUser.email === selectedCustomer.email) {
            await updatePassword(authUser, trimmedPassword);
          }
        } catch (authError) {
          console.error("Error al actualizar contraseña en Auth:", authError);
        }
      }

      toast.success("Contraseña de cliente actualizada.");
      setCustomerDniSearch("");
      setCustomerPassword("");
      setCustomerPasswordConfirm("");
    } catch (error) {
      console.error("Error al actualizar la contraseña del cliente:", error);
      toast.error("No se pudo actualizar la contraseña.");
    } finally {
      setIsUpdatingCustomerPassword(false);
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

  const getEntryTimestamp = (entry: SystemChangeEntry) => {
    if (typeof entry.createdAt === "number") return entry.createdAt;
    if (typeof entry.createdAt === "string") {
      const parsed = Date.parse(entry.createdAt);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return 0;
  };

  const formatEntryDate = (entry: SystemChangeEntry) => {
    const timestamp = getEntryTimestamp(entry);
    if (!timestamp) return "Sin fecha";
    return new Date(timestamp).toLocaleString("es-AR");
  };

  const formatEntryValue = (value?: string | number, entry?: SystemChangeEntry) => {
    if (typeof value === "undefined" || value === null) return "—";
    const field = entry?.field?.toLowerCase() ?? "";
    const action = entry?.action?.toLowerCase() ?? "";
    const isPrice = field.includes("precio") || field.includes("price") || action.includes("precio") || action.includes("price");
    const numericValue =
      typeof value === "number"
        ? value
        : typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))
          ? Number(value)
          : null;
    if (isPrice && numericValue !== null) {
      return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
      }).format(numericValue);
    }
    return String(value);
  };

  const buildHistorySummary = (entry: SystemChangeEntry) => {
    const user = entry.user || entry.username || "Usuario";
    if (entry.description) {
      return `${user} ${entry.description}`;
    }
    const productName = entry.productName || entry.product || "producto";
    const field = entry.field?.toLowerCase() ?? "";
    const action = entry.action?.toLowerCase() ?? "";
    if (field.includes("stock") || action.includes("stock")) {
      return `${user} cambió el stock de ${productName} de ${formatEntryValue(entry.before, entry)} a ${formatEntryValue(entry.after, entry)}.`;
    }
    if (field.includes("precio") || field.includes("price") || action.includes("precio") || action.includes("price")) {
      return `${user} actualizó el precio de ${productName} de ${formatEntryValue(entry.before, entry)} a ${formatEntryValue(entry.after, entry)}.`;
    }
    if (entry.action) {
      return `${user} ${entry.action}${productName ? ` en ${productName}` : ""}.`;
    }
    return `${user} realizó una modificación en el sistema.`;
  };

  const catalogAdFileAccept = catalogAdType === "video" ? "video/*" : "image/*";
  const catalogAdAllowMultiple = catalogAdType !== "video";
  const catalogAdResolvedOrigin =
    catalogAdUploadOrigin || (typeof window !== "undefined" ? window.location.origin : "");
  const catalogAdUploadLink =
    catalogAdUploadSessionId && catalogAdResolvedOrigin
      ? `${catalogAdResolvedOrigin}/catalog-ads/mobile-upload?sessionId=${catalogAdUploadSessionId}&page=${catalogAdUploadTargetPage}&type=${catalogAdType}`
      : "";

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
              <CardTitle>Ajuste de cotización USD</CardTitle>
              <CardDescription>
                Sumá o restá un valor fijo al dólar que recibe el sistema.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="usd-rate-adjustment">Ajuste en pesos</Label>
                <Input
                  id="usd-rate-adjustment"
                  type="number"
                  value={usdRateAdjustment}
                  onChange={(e) => setUsdRateAdjustment(Number(e.target.value))}
                  placeholder="Ej. 15 o -10"
                />
              </div>
              <Button onClick={handleSaveUsdRateAdjustment}>Guardar</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Visitas al catálogo</CardTitle>
              <CardDescription>Seguimiento del rendimiento del catálogo público.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-slate-200/10 bg-slate-950/40 px-4 py-3">
                <div>
                  <p className="text-sm text-slate-400">Total acumulado</p>
                  <p className="text-xs text-slate-500">Se actualiza cada vez que un cliente abre un catálogo.</p>
                </div>
                <span className="text-3xl font-semibold text-slate-100">
                  {new Intl.NumberFormat("es-AR").format(catalogVisitCount)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Promociones del catálogo</CardTitle>
              <CardDescription>Administra el texto que se muestra en la barra superior.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="offer-text">Texto de oferta</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="offer-text"
                    value={newOfferText}
                    onChange={(e) => setNewOfferText(e.target.value)}
                    placeholder="Ej. 20% OFF en accesorios seleccionados"
                  />
                  <Button onClick={handleAddOffer} className="sm:w-40">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Agregar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Este texto se mostrará como un aviso pasante en el catálogo público.
                </p>
              </div>
              <Separator />
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {offers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No hay ofertas cargadas.
                    </p>
                  ) : (
                    offers.map((offer) => (
                      <div
                        key={offer.id}
                        className="flex items-center justify-between gap-2 rounded-md border p-2"
                      >
                        <span className="text-sm">{offer.text}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleRemoveOffer(offer.id)}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Publicidad del catálogo</CardTitle>
              <CardDescription>
                Cargá imágenes o videos para mostrarlos al final del catálogo y en la selección de
                nuevos/usados.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Ubicación</Label>
                  <Select
                    value={selectedCatalogAdPage}
                    onValueChange={(value) =>
                      setSelectedCatalogAdPage(value as "landing" | "nuevos" | "usados")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Elegí la sección" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="landing">Selección de catálogo</SelectItem>
                      <SelectItem value="nuevos">Catálogo de nuevos</SelectItem>
                      <SelectItem value="usados">Catálogo de usados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo de contenido</Label>
                  <Select
                    value={catalogAdType}
                    onValueChange={(value) => setCatalogAdType(value as CatalogAdType)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Elegí el formato" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="image">Imagen</SelectItem>
                      <SelectItem value="carousel">Carrusel</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="catalog-ad-enabled"
                  checked={catalogAdEnabled}
                  onCheckedChange={setCatalogAdEnabled}
                />
                <Label htmlFor="catalog-ad-enabled">Mostrar publicidad en esta sección</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="catalog-ad-title">Título</Label>
                <Input
                  id="catalog-ad-title"
                  value={catalogAdTitle}
                  onChange={(event) => setCatalogAdTitle(event.target.value)}
                  placeholder="Ej. Accesorios destacados de la semana"
                />
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>Archivos cargados</Label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCatalogAdUploadOpen(true)}
                  >
                    <UploadCloud className="mr-2 h-4 w-4" />
                    Subir archivos
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Podés subir imágenes o videos desde esta PC o desde tu celular.{" "}
                  {catalogAdType === "video"
                    ? "Para video se utilizará el primer archivo cargado."
                    : "Para carrusel se muestran todas las imágenes cargadas."}
                </p>
                <div className="space-y-2">
                  {catalogAdAssets.length === 0 ? (
                    <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                      No hay archivos cargados.
                    </p>
                  ) : (
                    catalogAdAssets.map((asset, index) => {
                      const isVideo = asset.type?.startsWith("video") || catalogAdType === "video";
                      return (
                        <div
                          key={`${asset.path || asset.url}-${index}`}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-2"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <Badge variant="secondary">{isVideo ? "Video" : "Imagen"}</Badge>
                            <span className="min-w-0 truncate text-sm">
                              {asset.name || asset.url}
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleRemoveCatalogAdAsset(asset)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              <Button onClick={handleSaveCatalogAd}>Guardar publicidad</Button>
            </CardContent>
          </Card>

          <Dialog open={isCatalogAdUploadOpen} onOpenChange={setIsCatalogAdUploadOpen}>
            <DialogContent className="sm:max-w-[720px]">
              <DialogHeader>
                <DialogTitle>Subir archivos de publicidad</DialogTitle>
                <DialogDescription>
                  Elegí si querés cargar las imágenes o videos desde esta PC o desde tu celular.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Subir desde esta PC</h4>
                  <div className="space-y-2">
                    <Label htmlFor="catalog-ad-files">Seleccioná archivos</Label>
                    <Input
                      id="catalog-ad-files"
                      type="file"
                      accept={catalogAdFileAccept}
                      multiple={catalogAdAllowMultiple}
                      onChange={handleCatalogAdFilesUpload}
                      disabled={isCatalogAdUploading}
                    />
                    {isCatalogAdUploading && (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Subiendo archivos...
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Subir desde el celular</h4>
                  <div className="flex flex-col items-center gap-2 rounded-md border p-4">
                    {catalogAdUploadQr ? (
                      <Image
                        src={catalogAdUploadQr}
                        alt="Código QR para subir publicidad"
                        width={160}
                        height={160}
                        className="h-40 w-40"
                      />
                    ) : (
                      <div className="flex h-40 w-40 items-center justify-center text-sm text-muted-foreground">
                        Generando QR...
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground">Escanealo con tu celular</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (!catalogAdUploadLink) {
                          toast.error("El enlace todavía no está disponible.");
                          return;
                        }
                        if (navigator.clipboard?.writeText) {
                          navigator.clipboard
                            .writeText(catalogAdUploadLink)
                            .then(() => toast.success("Enlace copiado al portapapeles"))
                            .catch(() => toast.error("No se pudo copiar el enlace"));
                        } else {
                          toast.error("No se pudo copiar el enlace.");
                        }
                      }}
                      disabled={!catalogAdUploadLink}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar enlace
                    </Button>
                    <a
                      href={catalogAdUploadLink || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                        catalogAdUploadLink
                          ? "hover:bg-muted"
                          : "cursor-not-allowed text-muted-foreground"
                      )}
                    >
                      <Smartphone className="h-4 w-4" />
                      Abrir en el celular
                    </a>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCatalogAdUploadOpen(false)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Card>
            <CardHeader>
              <CardTitle>Catálogo de equipos nuevos</CardTitle>
              <CardDescription>
                Cargá modelos nuevos que no se descuentan del stock. Podés incluir precio y/o una
                nota para equipos por ingresar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="new-catalog-name">Nombre del equipo</Label>
                  <Input
                    id="new-catalog-name"
                    value={newCatalogName}
                    onChange={(e) => setNewCatalogName(e.target.value)}
                    placeholder="Ej. iPhone 15 Pro"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-catalog-price">Precio</Label>
                  <Input
                    id="new-catalog-price"
                    type="number"
                    value={newCatalogPrice}
                    onChange={(e) => setNewCatalogPrice(e.target.value)}
                    placeholder="Ej. 1200"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-catalog-status">Estado / ingreso</Label>
                  <Input
                    id="new-catalog-status"
                    value={newCatalogStatus}
                    onChange={(e) => setNewCatalogStatus(e.target.value)}
                    placeholder="Ej. Ingresan la semana próxima"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleAddNewCatalogItem}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Agregar equipo nuevo
                </Button>
              </div>
              <Separator />
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {newCatalogItems.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No hay equipos nuevos cargados.
                    </p>
                  ) : (
                    newCatalogItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <div className="text-xs text-muted-foreground">
                            {typeof item.price === "number"
                              ? `Precio: ${item.price}`
                              : "Precio: sin definir"}
                            {item.status ? ` · ${item.status}` : ""}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleRemoveNewCatalogItem(item.id)}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
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

          <Card>
            <CardHeader>
              <CardTitle>Restablecer contraseña de clientes</CardTitle>
              <CardDescription>
                Actualiza manualmente la contraseña de un cliente desde el dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customer-dni-search">DNI del cliente</Label>
                <Input
                  id="customer-dni-search"
                  value={customerDniSearch}
                  onChange={(e) => setCustomerDniSearch(e.target.value)}
                  placeholder="Ingresá el DNI para buscar al cliente"
                />
                <p className="text-xs text-muted-foreground">
                  Usá el DNI para identificar rápidamente al cliente.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-password">Nueva contraseña</Label>
                <Input
                  id="customer-password"
                  type="password"
                  value={customerPassword}
                  onChange={(e) => setCustomerPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-password-confirm">Repetir contraseña</Label>
                <Input
                  id="customer-password-confirm"
                  type="password"
                  value={customerPasswordConfirm}
                  onChange={(e) => setCustomerPasswordConfirm(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Indicar al cliente que el restablecimiento se realiza en el local.
                </p>
              </div>
              <Button
                onClick={handleUpdateCustomerPassword}
                disabled={isUpdatingCustomerPassword}
              >
                {isUpdatingCustomerPassword ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Actualizando...
                  </>
                ) : (
                  "Guardar contraseña"
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="md:col-span-2 lg:col-span-3">
            <CardHeader>
              <CardTitle>Historial de modificaciones</CardTitle>
              <CardDescription>
                Registra quién realizó cambios en stock y precios para mantener el control.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {systemHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay modificaciones registradas todavía.
                </p>
              ) : (
                <ScrollArea className="h-72">
                  <div className="space-y-3">
                    {systemHistory.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex flex-col gap-1 rounded-md border p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">{buildHistorySummary(entry)}</p>
                          <span className="text-xs text-muted-foreground">
                            {formatEntryDate(entry)}
                          </span>
                        </div>
                        {(entry.field || entry.action) && (
                          <div className="flex flex-wrap gap-2">
                            {entry.field && (
                              <Badge variant="secondary">{entry.field}</Badge>
                            )}
                            {entry.action && (
                              <Badge variant="outline">{entry.action}</Badge>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
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
