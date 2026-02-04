"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import Image from "next/image"
import { ref, set, push, get, update, onValue, query, orderByChild, equalTo, remove, runTransaction } from "firebase/database"
import { database } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Search, FileText, Trash2, Plus, Minus, DollarSign, User, Phone, Mail, Calendar, Gift, Copy, Smartphone } from "lucide-react"
import { toast } from "sonner"
import { generateSaleReceiptPdf, generateReserveReceiptPdf } from "@/lib/pdf-generator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { convertPrice, convertPriceToUSD, formatCurrency } from "../lib/price-converter"
import { shouldRemoveProductFromInventory } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import QRCode from "qrcode"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useAuth } from "@/hooks/use-auth"
import { getAppBaseUrl } from "@/lib/base-url"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// --- Interfaces para Tipado Fuerte ---
interface CartProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  quantity: number;
  imei?: string;
  barcode?: string;
  category?: string;
  model?: string;
  brand?: string;
  provider?: string;
  store?: "local1" | "local2";
  cost?: number;
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

interface Sale {
    id: string;
    receiptNumber: string;
    date: string;
    customerId: string | null;
    customerName: string;
    customerDni: string;
    customerPhone: string;
    items: any[]; // Se mantiene flexible para los items de la venta
    paymentMethod: string;
    cashAmount?: number;
    cashUsdAmount?: number;
    transferAmount?: number;
    cardAmount?: number;
    totalAmount: number;
    tradeIn: any;
    usdRate: number;
    usdtAmount?: number;
    pointsUsed?: number;
    pointsEarned?: number;
    pointsAccumulated?: number;
    pointsPaused?: boolean;
    store: "local1" | "local2";
    reserveId?: string;
    reserveReceiptNumber?: string;
    reserveDownPayment?: number;
    reserveProductId?: string;
    reserveQuantity?: number;
    status?: "pending_signature" | "completed" | "cancelled";
    signature?: {
      url: string;
      path?: string;
      signedAt?: string;
      sessionId?: string;
      signerName?: string;
      signerDni?: string;
    } | null;
}

// Interfaz para los datos de la reserva
export interface Reserve {
    id: string;
    receiptNumber: string;
    date: string;
    expirationDate: string;
    customerId: string;
    customerName: string;
    customerDni: string;
    customerPhone: string;
    productName: string;
    productId: string;
    quantity: number;
    productPrice: number;
    downPayment: number;
    remainingAmount: number;
    status: 'reserved' | 'completed' | 'cancelled';
    store: "local1" | "local2";
    productData?: any;
    usdRate?: number;
    productPriceArs?: number;
    downPaymentArs?: number;
    remainingAmountArs?: number;
    tradeIn?: {
        name: string;
        price: number;
        priceArs?: number;
        imei?: string;
        serialNumber?: string;
    } | null;
}

const DEFAULT_POINT_EARN_RATE = 50000;
const DEFAULT_POINT_VALUE = 50000;

interface SellProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: CartProduct | null;
  onProductSold: () => void;
  reserveToComplete?: Reserve | null;
  onReserveCompletion?: (reserve: Reserve, sale: Sale) => void;
}

export default function SellProductModal({ isOpen, onClose, product, onProductSold, reserveToComplete, onReserveCompletion }: SellProductModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [customer, setCustomer] = useState({ name: "", dni: "", phone: "", email: "" })
  const [paymentMethod, setPaymentMethod] = useState("efectivo")
  const [cashAmount, setCashAmount] = useState(0)
  const [cashUsdAmount, setCashUsdAmount] = useState(0)
  const [transferAmount, setTransferAmount] = useState(0)
  const [cardAmount, setCardAmount] = useState(0)
  const [completedSale, setCompletedSale] = useState<Sale | null>(null)
  const [completedReserve, setCompletedReserve] = useState<Reserve | null>(null)
  const [isPdfDialogOpen, setIsPdfDialogOpen] = useState(false)
  const [isReservePdfDialogOpen, setIsReservePdfDialogOpen] = useState(false)
  const [isReserveDialogOpen, setIsReserveDialogOpen] = useState(false)
  const [reserveAmount, setReserveAmount] = useState(0)
  const [reserveExpirationDate, setReserveExpirationDate] = useState("")
  const [receiptNumber, setReceiptNumber] = useState("")
  const [reservePdfCurrency, setReservePdfCurrency] = useState<"USD" | "ARS">("USD")
  const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false)
  const [signatureSessionId, setSignatureSessionId] = useState<string | null>(null)
  const [signatureQrDataUrl, setSignatureQrDataUrl] = useState<string>("")
  const [signatureLink, setSignatureLink] = useState<string>("")
  const [signatureStatus, setSignatureStatus] = useState<string>("pending")
  const [signatureData, setSignatureData] = useState<Sale["signature"]>(null)
  const [signatureOrigin, setSignatureOrigin] = useState<string>("")
  const [signatureSessionRefPath, setSignatureSessionRefPath] = useState<string>("")
  const [signatureSessionError, setSignatureSessionError] = useState<string | null>(null)
  const [isFinalizingSale, setIsFinalizingSale] = useState(false)
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false)
  const [hasCancelRequest, setHasCancelRequest] = useState(false)

  const [cart, setCart] = useState<CartProduct[]>([])
  const [allProducts, setAllProducts] = useState<CartProduct[]>([])
  const [productSearchTerm, setProductSearchTerm] = useState("")
  const [usdRate, setUsdRate] = useState(0)
  const [isTradeIn, setIsTradeIn] = useState(false);
  const [tradeInProduct, setTradeInProduct] = useState({ name: "", imei: "", price: 0, serialNumber: "" });
  const [bundles, setBundles] = useState<BundleRule[]>([]);

  const [initialProductProcessed, setInitialProductProcessed] = useState(false);
  const [availablePoints, setAvailablePoints] = useState(0);
  const [usePoints, setUsePoints] = useState(false);
  const [pointEarnRate, setPointEarnRate] = useState(DEFAULT_POINT_EARN_RATE);
  const [pointValue, setPointValue] = useState(DEFAULT_POINT_VALUE);
  const [pointsPaused, setPointsPaused] = useState(false);
  const [saleStore, setSaleStore] = useState<"local1" | "local2" | null>(null);
  const reservePrefilledId = useRef<string | null>(null);
  const pdfChoiceRef = useRef(false);
  const closingPdfDialogRef = useRef(false);
  const isFinalizingSaleRef = useRef(false)
  const { user } = useAuth()

  const isCompletingReserve = !!reserveToComplete;

  const generateSignatureSessionId = () => {
    if (
      typeof globalThis !== "undefined" &&
      typeof globalThis.crypto !== "undefined" &&
      typeof globalThis.crypto.randomUUID === "function"
    ) {
      return globalThis.crypto.randomUUID();
    }

    return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const normalizeCategory = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ")

  const resolveDisclaimerType = (items: Array<{ category?: string | null }> = []) => {
    const normalizedCategories = items
      .map((item) => normalizeCategory(item.category || ""))
      .filter(Boolean)

    const hasUsedCellphones = normalizedCategories.some((label) => label.includes("usad"))
    if (hasUsedCellphones) {
      return "used" as const
    }

    const hasNewCellphones = normalizedCategories.some((label) => label.includes("nuevo"))
    return hasNewCellphones ? ("new" as const) : ("used" as const)
  }

  useEffect(() => {
    if (paymentMethod !== "multiple") {
      setCashAmount(0)
      setCashUsdAmount(0)
      setTransferAmount(0)
      setCardAmount(0)
    }
  }, [paymentMethod])

  useEffect(() => {
    if (isOpen) {
      setInitialProductProcessed(false);
      
      const productsRef = ref(database, "products")
      const unsubscribeProducts = onValue(productsRef, (snapshot) => {
        const data = snapshot.val() ? Object.entries(snapshot.val()).map(([id, value]) => ({ id, ...(value as object) })) : [];
        setAllProducts(data as CartProduct[]);
      })

      const currencyRef = ref(database, 'config/usdRate')
      const unsubscribeCurrency = onValue(currencyRef, (snapshot) => {
        if (snapshot.exists()) setUsdRate(snapshot.val());
      })

      const bundlesRef = ref(database, 'config/accessoryBundles');
      const unsubscribeBundles = onValue(bundlesRef, (snapshot) => {
        const data = snapshot.val();
        const bundleList: BundleRule[] = data ? Object.values(data) : [];
        setBundles(bundleList);
      });

      const pointsRef = ref(database, 'config/points');
      const unsubscribePoints = onValue(pointsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setPointEarnRate(data.earnRate ?? DEFAULT_POINT_EARN_RATE);
          setPointValue(data.value ?? DEFAULT_POINT_VALUE);
          setPointsPaused(!!data.paused);
        }
      });
      
      return () => {
        unsubscribeProducts();
        unsubscribeCurrency();
        unsubscribeBundles();
        unsubscribePoints();
      }
    } else {
      setCart([])
      setIsTradeIn(false)
      setProductSearchTerm("")
      setCustomer({ name: "", dni: "", phone: "", email: "" })
        setTradeInProduct({ name: "", imei: "", price: 0, serialNumber: "" });
        setReceiptNumber("");
        setAvailablePoints(0);
      setUsePoints(false);
      setPointsPaused(false);
      setSaleStore(null);
      setReserveAmount(0);
      setReserveExpirationDate("");
      setIsReserveDialogOpen(false);
      setCompletedSale(null);
      setIsPdfDialogOpen(false);
      pdfChoiceRef.current = false;
      closingPdfDialogRef.current = false;
      setCompletedReserve(null);
      setIsReservePdfDialogOpen(false);
      setReservePdfCurrency("USD");
      setPaymentMethod("efectivo");
      setCashAmount(0);
      setCashUsdAmount(0);
      setTransferAmount(0);
      setCardAmount(0);
      reservePrefilledId.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setIsSignatureDialogOpen(false)
      setSignatureSessionId(null)
      setSignatureQrDataUrl("")
      setSignatureLink("")
      setSignatureStatus("pending")
      setSignatureData(null)
      setSignatureSessionRefPath("")
      setSignatureSessionError(null)
    }
  }, [isOpen])

  useEffect(() => {
    const resolvedOrigin = getAppBaseUrl()
    setSignatureOrigin(resolvedOrigin)
  }, [])

  useEffect(() => {
    if (!signatureSessionId) {
      setSignatureQrDataUrl("")
      setSignatureLink("")
      return
    }

    const resolvedOrigin =
      signatureOrigin ||
      getAppBaseUrl() ||
      (typeof window !== "undefined" ? window.location.origin : "")
    if (!resolvedOrigin) {
      setSignatureQrDataUrl("")
      setSignatureLink("")
      return
    }

    const link = `${resolvedOrigin}/sales/mobile-signature?sessionId=${signatureSessionId}`
    setSignatureLink(link)
    QRCode.toDataURL(link, { width: 300 })
      .then(setSignatureQrDataUrl)
      .catch((error) => {
        console.error("No se pudo generar el código QR de firma", error)
      })
  }, [signatureOrigin, signatureSessionId])

  useEffect(() => {
    if (!signatureLink || !saleStore) return
    const mostrador = saleStore === "local2" ? "mostrador2" : "mostrador1"
    const mostradorRef = ref(database, `mostradores/${mostrador}/qr_link`)
    set(mostradorRef, signatureLink).catch(() => null)
  }, [saleStore, signatureLink])

  useEffect(() => {
    if (!signatureSessionRefPath) return

    const sessionRef = ref(database, signatureSessionRefPath)
    const unsubscribe = onValue(sessionRef, (snapshot) => {
      if (!snapshot.exists()) {
        setSignatureStatus("pending")
        setSignatureData(null)
        return
      }
      const sessionData = snapshot.val()
      const nextStatus = sessionData.status || "pending"
      setSignatureStatus(nextStatus)
      if (nextStatus === "cancel_requested" && !hasCancelRequest) {
        setHasCancelRequest(true)
        setIsCancelDialogOpen(true)
      }
      if (sessionData.signature?.url) {
        const signaturePayload = {
          url: sessionData.signature.url as string,
          path: sessionData.signature.path as string | undefined,
          signedAt: sessionData.signature.signedAt as string | undefined,
          sessionId: signatureSessionId,
          signerName: sessionData.signature.signerName as string | undefined,
          signerDni: sessionData.signature.signerDni as string | undefined,
        }
        setSignatureData(signaturePayload)
        setCompletedSale((prev) => (prev ? { ...prev, signature: signaturePayload } : prev))
      }
    })

    return () => unsubscribe()
  }, [hasCancelRequest, signatureSessionId, signatureSessionRefPath])

  useEffect(() => {
    if (!isOpen || !reserveToComplete) {
      return;
    }

    if (reservePrefilledId.current === reserveToComplete.id) {
      return;
    }

    const reservedQuantity = reserveToComplete.quantity || 1;
    const productFromInventory = allProducts.find((p) => p.id === reserveToComplete.productId);
    const productSource = productFromInventory || (reserveToComplete.productData as CartProduct | undefined);

    const fallbackUnitPrice = reservedQuantity > 0
      ? reserveToComplete.productPrice / reservedQuantity
      : reserveToComplete.productPrice;

    const cartItem: CartProduct = {
      id: reserveToComplete.productId,
      name: reserveToComplete.productName || productSource?.name || "Producto reservado",
      price: productSource?.price ?? fallbackUnitPrice,
      stock: productSource?.stock ?? reservedQuantity,
      quantity: reservedQuantity,
      imei: (productSource as any)?.imei,
      barcode: (productSource as any)?.barcode,
      category: productSource?.category,
      model: (productSource as any)?.model,
      brand: (productSource as any)?.brand,
      provider: (productSource as any)?.provider,
      store: productSource?.store,
      cost: (productSource as any)?.cost,
    };

    setCart([cartItem]);
    setInitialProductProcessed(true);
    setSaleStore((productSource?.store as "local1" | "local2" | undefined) ?? reserveToComplete.store ?? null);
    setCustomer({
      name: reserveToComplete.customerName || "",
      dni: reserveToComplete.customerDni || "",
      phone: reserveToComplete.customerPhone || "",
      email: "",
    });
    setProductSearchTerm("");
    if (reserveToComplete.tradeIn) {
      setIsTradeIn(true);
      setTradeInProduct({
        name: reserveToComplete.tradeIn.name || "",
        imei: reserveToComplete.tradeIn.imei || "",
        serialNumber: reserveToComplete.tradeIn.serialNumber || "",
        price: reserveToComplete.tradeIn.price || 0,
      });
    } else {
      setIsTradeIn(false);
      setTradeInProduct({ name: "", imei: "", price: 0, serialNumber: "" });
    }
    setUsePoints(false);
    setPaymentMethod("efectivo");
    setCashAmount(0);
    setCashUsdAmount(0);
    setTransferAmount(0);
    setCardAmount(0);
    reservePrefilledId.current = reserveToComplete.id;
  }, [isOpen, reserveToComplete, allProducts]);

  useEffect(() => {
    const fetchCustomerPoints = async () => {
      if (!isOpen || !reserveToComplete?.customerId) {
        return;
      }
      try {
        const customerRef = ref(database, `customers/${reserveToComplete.customerId}`);
        const customerSnapshot = await get(customerRef);
        if (customerSnapshot.exists()) {
          const customerData = customerSnapshot.val();
          setAvailablePoints(Number(customerData.points ?? 0));
        }
      } catch (error) {
        console.error("Error al cargar los puntos del cliente reservado:", error);
      }
    };

    fetchCustomerPoints();
  }, [isOpen, reserveToComplete]);

  const searchCustomerByDni = async () => {
    if (!customer.dni) {
      toast.error("Por favor, ingrese un DNI para buscar.");
      return;
    }
    
    setIsSearching(true);
    try {
      const customersRef = ref(database, "customers");
      const q = query(customersRef, orderByChild('dni'), equalTo(customer.dni.replace(/\./g, "")));
      const snapshot = await get(q);

      if (snapshot.exists()) {
          const customerData = Object.values(snapshot.val())[0] as any;
          setCustomer({ name: customerData.name, dni: customerData.dni, phone: customerData.phone || "", email: customerData.email || "" });
          setAvailablePoints(customerData.points || 0);
          toast.success("Cliente encontrado");
      } else {
          setAvailablePoints(0);
          toast.info("Cliente no encontrado, puede registrarlo.");
      }
    } catch (error) {
        toast.error("Error al buscar cliente.");
    } finally {
        setIsSearching(false);
    }
  };
  
  const handleAddProductToCart = useCallback((productToAdd: CartProduct, isInitialProduct = false) => {
      if (!saleStore && productToAdd.store) {
          setSaleStore(productToAdd.store);
      } else if (saleStore && productToAdd.store && productToAdd.store !== saleStore) {
          toast.error(`El producto pertenece a ${productToAdd.store === 'local1' ? 'Local 1' : 'Local 2'}`);
          return;
      }
      setCart(prevCart => {
          let newCart = [...prevCart];
          const accessoriesToAdd: CartProduct[] = [];

          const existingProductInCart = newCart.find(item => item.id === productToAdd.id);
          if (existingProductInCart) {
              newCart = newCart.map(item => item.id === productToAdd.id ? { ...item, quantity: item.quantity + 1 } : item);
          } else {
              newCart.push({ ...productToAdd, quantity: 1 });
          }

          if (!isInitialProduct) {
              setProductSearchTerm("");
          }

          const parseModelNumber = (value?: string | null) => {
            if (!value) return null;
            const digits = value.replace(/[^0-9]/g, '');
            return digits ? parseInt(digits, 10) : null;
          };

          const productCategory = productToAdd.category || "";
          const normalizedCategory = productCategory.trim().toLowerCase();
          const eligiblePhoneCategories = ["celulares nuevos", "celulares usados"];
          const isPhoneCategory = eligiblePhoneCategories.includes(normalizedCategory);

          if (!isPhoneCategory) {
            return [...newCart];
          }

          const productModelNumber = parseModelNumber(productToAdd.model || productToAdd.name || "");

          const matchedRules = bundles.filter(rule => {
            const { start, end, category } = rule.conditions;

            if (rule.type === 'category') {
              return !!category && productCategory.toLowerCase() === category.toLowerCase();
            }

            if (rule.type === 'model_range') {
              const startNumber = parseModelNumber(start || "");
              const endNumber = parseModelNumber(end || "");
              return (
                productModelNumber !== null &&
                startNumber !== null &&
                endNumber !== null &&
                productModelNumber >= startNumber &&
                productModelNumber <= endNumber
              );
            }

            if (rule.type === 'model_start') {
              const startNumber = parseModelNumber(start || "");
              return (
                productModelNumber !== null &&
                startNumber !== null &&
                productModelNumber >= startNumber
              );
            }

            return false;
          });

          if (matchedRules.length > 0) {
            const targetStore = productToAdd.store ?? saleStore ?? null;
            const appliedRuleNames = new Set<string>();

            matchedRules.forEach(rule => {
              let ruleApplied = false;

              rule.accessories.forEach(acc => {
                const accessoryProduct = allProducts.find(p => p.id === acc.id);

                if (accessoryProduct) {
                  const belongsToStore = !targetStore || !accessoryProduct.store || accessoryProduct.store === targetStore;

                  if (!belongsToStore) {
                    const storeLabel = targetStore === 'local2' ? 'Local 2' : 'Local 1';
                    toast.error(`Accesorio no disponible en ${storeLabel}`, {
                      description: `El producto "${accessoryProduct.name}" configurado en el combo pertenece a otro local.`,
                    });
                    return;
                  }

                  const alreadyInCart = newCart.find(item => item.id === accessoryProduct.id);
                  const alreadyQueued = accessoriesToAdd.find(item => item.id === accessoryProduct.id);

                  if (accessoryProduct.stock > 0 && !alreadyInCart && !alreadyQueued) {
                    accessoriesToAdd.push({ ...accessoryProduct, quantity: 1, price: 0 });
                    ruleApplied = true;
                  } else if (accessoryProduct.stock <= 0) {
                    toast.warning(`Sin stock`, { description: `"${accessoryProduct.name}" no tiene stock.` });
                  }
                } else {
                  toast.error(`Accesorio no encontrado`, {
                    description: `No se encontró el producto "${acc.name}" configurado en el combo.`,
                  });
                }
              });

              if (ruleApplied) {
                appliedRuleNames.add(rule.name);
              }
            });

            if (accessoriesToAdd.length > 0 && appliedRuleNames.size > 0) {
              const comboList = Array.from(appliedRuleNames).join(", ");
              toast.info(
                appliedRuleNames.size === 1 ? `Combo "${comboList}" aplicado` : `Combos aplicados`,
                {
                  description:
                    appliedRuleNames.size === 1
                      ? `Se agregaron ${accessoriesToAdd.length} accesorios de regalo.`
                      : `Se agregaron ${accessoriesToAdd.length} accesorios de regalo de los combos ${comboList}.`,
                }
              );
            }
          }
          return [...newCart, ...accessoriesToAdd];
      });
  }, [allProducts, bundles, saleStore]);

  useEffect(() => {
    if (isOpen && product && !initialProductProcessed && allProducts.length > 0) {
      handleAddProductToCart(product, true);
      setInitialProductProcessed(true);
    }
  }, [isOpen, product, allProducts, bundles, initialProductProcessed, handleAddProductToCart]);


  const handleRemoveProductFromCart = (productId: string) => setCart(cart.filter(item => item.id !== productId));
  const handleQuantityChange = (productId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      handleRemoveProductFromCart(productId);
      return;
    }
    setCart(cart.map(item => item.id === productId ? { ...item, quantity: newQuantity } : item));
  };
  const handlePriceChange = (productId: string, newPrice: number) => {
    setCart(cart.map(item => item.id === productId ? { ...item, price: newPrice } : item));
  };
  const searchedProducts = useMemo(() => {
    if (!productSearchTerm) return [];
    const terms = productSearchTerm.toLowerCase().split(/\s+/).filter(Boolean);
    return allProducts.filter(
      (p) => {
        const searchable = `${(p.name || "")} ${(p.brand || "")} ${(p.model || "")} ${(p.barcode || "")}`.toLowerCase();
        return (
          terms.every(t => searchable.includes(t)) &&
          p.stock > 0 &&
          (!saleStore || !p.store || p.store === saleStore)
        );
      }
    );
  }, [productSearchTerm, allProducts, saleStore]);
  
  const totalAmountInARS = useMemo(() => {
    const cartTotal = cart.reduce((sum, item) => sum + (convertPrice(item.price, usdRate) * item.quantity), 0);
    const tradeInValueInARS = isTradeIn ? tradeInProduct.price * usdRate : 0;
    return cartTotal - tradeInValueInARS;
  }, [cart, usdRate, isTradeIn, tradeInProduct.price]);

  const discount = useMemo(() => {
    if (!usePoints || pointsPaused) return 0;
    const maxUsablePoints = Math.min(availablePoints, Math.floor(totalAmountInARS / pointValue));
    return maxUsablePoints * pointValue;
  }, [usePoints, pointsPaused, availablePoints, totalAmountInARS, pointValue]);

  const pointsToUse = useMemo(() => (pointsPaused ? 0 : discount / pointValue), [discount, pointValue, pointsPaused]);
  const finalTotal = useMemo(() => totalAmountInARS - discount, [totalAmountInARS, discount]);
  const pointsEarned = useMemo(() => (pointsPaused ? 0 : Math.floor(finalTotal / pointEarnRate)), [finalTotal, pointEarnRate, pointsPaused]);

  const startSignatureSession = useCallback(async (sale: Sale) => {
    setSignatureSessionError(null)
    setSignatureSessionId(null)
    setSignatureQrDataUrl("")
    setSignatureLink("")
    setSignatureSessionRefPath("")
    setHasCancelRequest(false)
    setIsCancelDialogOpen(false)

    const sessionPayload = {
      createdAt: new Date().toISOString(),
      status: "pending",
      saleId: sale.id,
      receiptNumber: sale.receiptNumber,
      store: sale.store ?? null,
      createdBy: user?.username ?? null,
      pendingSignature: true,
      disclaimerType: resolveDisclaimerType(sale.items),
    }

    const newSessionId = generateSignatureSessionId()
    try {
      const sessionRef = ref(database, `saleSignatureSessions/${newSessionId}`)
      await set(sessionRef, sessionPayload)
      setSignatureSessionId(newSessionId)
      setSignatureSessionRefPath(`saleSignatureSessions/${newSessionId}`)
      setIsSignatureDialogOpen(true)
      return
    } catch (error) {
      console.error("Error al crear la sesión de firma:", error)
    }

    try {
      const saleRef = ref(database, `sales/${sale.id}`)
      await update(saleRef, { signatureSession: sessionPayload })
      setSignatureSessionId(sale.id)
      setSignatureSessionRefPath(`sales/${sale.id}/signatureSession`)
      setIsSignatureDialogOpen(true)
    } catch (error) {
      console.error("Error al crear la sesión de firma en la venta:", error)
      setSignatureSessionError("No se pudo iniciar la sesión de firma. Revisá la conexión e intentá nuevamente.")
      throw error
    }
  }, [generateSignatureSessionId, user?.username])

  const handleSellProduct = async () => {
    if (!customer.name || !customer.dni || !customer.phone) {
        toast.error("Faltan datos del cliente", { description: "Por favor, complete nombre, DNI y teléfono." });
        return;
    }
    if (cart.length === 0) {
        toast.error("El carrito está vacío.");
        return;
    }
    if (!saleStore) {
        toast.error("No se detectó el local");
        return;
    }
    if (paymentMethod === "multiple") {
        const sum =
            cashAmount +
            transferAmount +
            cardAmount +
            cashUsdAmount * usdRate;
        if (Math.abs(sum - finalTotal) > 0.01) {
            toast.error("La suma de los montos no coincide con el total");
            return;
        }
    }
    setIsLoading(true);

    try {
        const customersRef = ref(database, "customers");
        const q = query(customersRef, orderByChild('dni'), equalTo(customer.dni));
        const customerSnapshot = await get(q);
        let customerId: string | null = null;

        if (customerSnapshot.exists()) {
            customerId = Object.keys(customerSnapshot.val())[0];
            const customerRef = ref(database, `customers/${customerId}`);
            await update(customerRef, { ...customer });
        } else {
            const newCustomerRef = push(customersRef);
            customerId = newCustomerRef.key;
            await set(newCustomerRef, { ...customer, createdAt: new Date().toISOString(), id: customerId, points: 0 });
        }

        const counterRef = ref(database, 'counters/receiptNumber');
        const transactionResult = await runTransaction(counterRef, (currentData) => {
            if (currentData === null) {
                return { value: 1, prefix: 'V-', lastUpdated: new Date().toISOString() };
            }
            currentData.value++;
            currentData.lastUpdated = new Date().toISOString();
            return currentData;
        });
        if (!transactionResult.committed || !transactionResult.snapshot.exists()) {
            throw new Error('No se pudo confirmar la transacción del contador de recibos.');
        }
        const newCounterData = transactionResult.snapshot.val();
        const newReceiptNumber = `${newCounterData.prefix}${String(newCounterData.value).padStart(5, '0')}`;
        setReceiptNumber(newReceiptNumber);

        const newSaleRef = push(ref(database, "sales"));
        let updatedPoints = availablePoints;
        if (!pointsPaused) {
            updatedPoints = availablePoints - pointsToUse + pointsEarned;
        }
        const saleData: Sale = {
            id: newSaleRef.key!,
            receiptNumber: newReceiptNumber,
            date: new Date().toISOString(),
            customerId,
            customerName: customer.name,
            customerDni: customer.dni,
            customerPhone: customer.phone,
            items: cart.map(item => ({
                productId: item.id,
                productName: item.name,
                quantity: item.quantity,
                price: item.price,
                imei: item.imei || null,
                barcode: item.barcode || null,
                provider: item.provider || null,
                category: item.category || null,
                cost: item.cost ?? 0,
                brand: item.brand || null,
                model: item.model || null,
                store: item.store || saleStore,
            })),
            paymentMethod,
            ...(paymentMethod === "multiple"
                ? { cashAmount, cashUsdAmount, transferAmount, cardAmount }
                : paymentMethod === "transferencia_usdt"
                  ? { usdtAmount: finalTotal / usdRate }
                  : {}),
            totalAmount: finalTotal,
            tradeIn: isTradeIn ? tradeInProduct : null,
            usdRate,
            pointsPaused,
            store: saleStore,
            status: "pending_signature",
            ...(pointsPaused
                ? {}
                : {
                    pointsUsed: pointsToUse,
                    pointsEarned,
                    pointsAccumulated: updatedPoints,
                }),
            ...(reserveToComplete
                ? {
                    reserveId: reserveToComplete.id,
                    reserveReceiptNumber: reserveToComplete.receiptNumber,
                    reserveDownPayment: reserveToComplete.downPayment,
                    reserveProductId: reserveToComplete.productId,
                    reserveQuantity: reserveToComplete.quantity ?? 0,
                }
                : {}),
        };
        await set(newSaleRef, saleData);

        setCompletedSale(saleData);
        setSignatureData(null);
        setSignatureStatus("pending");
        toast.info("Venta pendiente de firma.");
        try {
          await startSignatureSession(saleData);
        } catch (error) {
          console.error("No se pudo iniciar la sesión de firma:", error);
          toast.error("No se pudo iniciar la firma", {
            description: "Se continuará sin captura de firma.",
          });
          setSignatureSessionError("No se pudo iniciar la sesión de firma. Revisá la conexión e intentá nuevamente.");
          setIsSignatureDialogOpen(true);
        }

    } catch (error) {
        toast.error("Error al completar la venta", { description: (error as Error).message });
    } finally {
        setIsLoading(false);
    }
  };

  const finalizeSale = useCallback(async (sale: Sale) => {
    if (isFinalizingSaleRef.current || !sale) return;
    if (sale.status === "completed") return;
    isFinalizingSaleRef.current = true;
    setIsFinalizingSale(true);

    try {
      const reservedProductId = sale.reserveProductId || reserveToComplete?.productId;
      const reservedQuantity = sale.reserveQuantity ?? reserveToComplete?.quantity ?? 0;

      for (const item of sale.items || []) {
        let quantityToDeduct = item.quantity;
        if (reservedProductId && item.productId === reservedProductId) {
          quantityToDeduct = Math.max(item.quantity - reservedQuantity, 0);
        }

        if (quantityToDeduct <= 0) {
          continue;
        }

        const productRef = ref(database, `products/${item.productId}`);
        const productSnapshot = await get(productRef);
        if (productSnapshot.exists()) {
          const productData = productSnapshot.val();
          const currentStock = productData.stock || 0;
          const newStock = currentStock - quantityToDeduct;

          if (newStock < 0) {
            throw new Error(`Stock insuficiente para ${item.productName}.`);
          }

          if (newStock <= 0) {
            const category = productData.category as string | undefined;
            if (shouldRemoveProductFromInventory(category)) {
              await remove(productRef);
            } else {
              await update(productRef, { stock: 0 });
            }
          } else {
            await update(productRef, { stock: newStock });
          }
        }
      }

      if (sale.tradeIn?.name && sale.tradeIn?.price > 0) {
        const newProductRef = push(ref(database, 'products'));
        const newProductData = {
          id: newProductRef.key,
          name: sale.tradeIn.name,
          imei: sale.tradeIn.imei,
          barcode: sale.tradeIn.serialNumber,
          brand: "Apple",
          model: "Celular",
          category: "Celulares Usados",
          cost: sale.tradeIn.price,
          price: sale.tradeIn.price + 50,
          stock: 1,
          provider: sale.customerName,
          createdAt: new Date().toISOString(),
          store: sale.store,
        };
        await set(newProductRef, newProductData);
        toast.info("Equipo recibido en parte de pago", { description: `Se agregó ${sale.tradeIn.name} al inventario.` });
      }

      if (sale.customerId && !sale.pointsPaused) {
        const customerRef = ref(database, `customers/${sale.customerId}`);
        const nextPoints = sale.pointsAccumulated ?? 0;
        await update(customerRef, { points: nextPoints, lastPurchase: new Date().toISOString() });
        setAvailablePoints(nextPoints);
      }

      if (sale.reserveId) {
        try {
          const reserveRef = ref(database, `reserves/${sale.reserveId}`);
          await update(reserveRef, {
            status: "completed",
            completedAt: new Date().toISOString(),
            saleId: sale.id,
            saleReceiptNumber: sale.receiptNumber,
            remainingAmount: 0,
          });

          if (reservedProductId) {
            const productRef = ref(database, `products/${reservedProductId}`);
            await update(productRef, { reserved: false });
          }

          if (reserveToComplete) {
            onReserveCompletion?.(reserveToComplete, sale);
          }
        } catch (error) {
          console.error("Error al actualizar la reserva después de la venta:", error);
        }
      }

      const saleRef = ref(database, `sales/${sale.id}`);
      const signaturePayload = signatureData?.url ? signatureData : sale.signature ?? null;
      await update(saleRef, {
        status: "completed",
        completedAt: new Date().toISOString(),
        signature: signaturePayload,
      });

      setCompletedSale((prev) => (prev ? { ...prev, status: "completed", signature: signaturePayload ?? prev.signature } : prev));
      toast.success("Venta completada con éxito.");
    } catch (error) {
      console.error("Error al finalizar la venta:", error);
      toast.error("No se pudo finalizar la venta", {
        description: (error as Error).message,
      });
      throw error;
    } finally {
      setIsFinalizingSale(false);
      isFinalizingSaleRef.current = false;
    }
  }, [onReserveCompletion, reserveToComplete, signatureData]);

  const handleReserveProduct = async () => {
    if (!customer.name || !customer.dni || !customer.phone) {
        toast.error("Faltan datos del cliente", { description: "Por favor, complete nombre, DNI y teléfono." });
        return;
    }
    if (cart.length === 0) {
        toast.error("El carrito está vacío.");
        return;
    }
    if (!reserveExpirationDate) {
        toast.error("Seleccione fecha límite de retiro");
        return;
    }
    if (reserveAmount <= 0) {
        toast.error("Monto de seña inválido");
        return;
    }
    if (!saleStore) {
        toast.error("No se detectó el local");
        return;
    }
    if (usdRate <= 0) {
        toast.error("Cotización de dólar inválida");
        return;
    }

    setIsLoading(true);
    try {
        const customersRef = ref(database, "customers");
        const q = query(customersRef, orderByChild('dni'), equalTo(customer.dni.replace(/\./g, "")));
        const customerSnapshot = await get(q);
        let customerId: string | null = null;

        if (customerSnapshot.exists()) {
            customerId = Object.keys(customerSnapshot.val())[0];
            const customerRef = ref(database, `customers/${customerId}`);
            await update(customerRef, { ...customer, lastPurchase: new Date().toISOString() });
        } else {
            const newCustomerRef = push(customersRef);
            customerId = newCustomerRef.key;
            await set(newCustomerRef, { ...customer, createdAt: new Date().toISOString(), id: customerId });
        }

        const item = cart[0];
        const productRef = ref(database, `products/${item.id}`);
        const productSnapshot = await get(productRef);
        if (!productSnapshot.exists()) throw new Error('Producto no encontrado');
        
        const productData = productSnapshot.val();
        const currentStock = productData.stock || 0;
        const reservedQuantity = item.quantity;

        if (currentStock < reservedQuantity) {
            throw new Error('Stock insuficiente para reservar.');
        }

        const newStock = currentStock - reservedQuantity;
        if (newStock <= 0) {
            const category = productData.category as string | undefined;
            if (shouldRemoveProductFromInventory(category)) {
                await remove(productRef);
            } else {
                await update(productRef, { stock: 0 });
            }
        } else {
            await update(productRef, { stock: newStock });
        }

        const counterRef = ref(database, 'counters/reserveNumber');
        const transactionResult = await runTransaction(counterRef, (currentData) => {
            if (currentData === null) {
                return { value: 1, prefix: 'V-', lastUpdated: new Date().toISOString() };
            }
            currentData.value++;
            currentData.lastUpdated = new Date().toISOString();
            return currentData;
        });
        if (!transactionResult.committed || !transactionResult.snapshot.exists()) {
            throw new Error('No se pudo confirmar la transacción del contador de recibos.');
        }
        const newCounterData = transactionResult.snapshot.val();
        const newReceiptNumber = `${newCounterData.prefix}${String(newCounterData.value).padStart(5, '0')}`;
        setReceiptNumber(newReceiptNumber);

        const newReserveRef = push(ref(database, 'reserves'));
        const productPriceUSD = convertPriceToUSD(item.price, usdRate) * item.quantity;
        const downPaymentUSD = reserveAmount / usdRate;
        const tradeInValueUSD = isTradeIn ? Math.max(tradeInProduct.price, 0) : 0;
        const productPriceARS = convertPrice(item.price, usdRate) * item.quantity;
        const downPaymentARS = reserveAmount;
        const tradeInValueARS = tradeInValueUSD * usdRate;
        const remainingAmountUSD = Math.max(productPriceUSD - downPaymentUSD - tradeInValueUSD, 0);
        const remainingAmountARS = Math.max(productPriceARS - downPaymentARS - tradeInValueARS, 0);
        const tradeInData = isTradeIn && tradeInProduct.name
          ? {
              name: tradeInProduct.name,
              imei: tradeInProduct.imei || undefined,
              serialNumber: tradeInProduct.serialNumber || undefined,
              price: tradeInProduct.price,
              priceArs: tradeInValueARS,
            }
          : null;
        const reserveData: Reserve = {
            id: newReserveRef.key!,
            receiptNumber: newReceiptNumber,
            date: new Date().toISOString(),
            expirationDate: reserveExpirationDate,
            customerId: customerId!,
            customerName: customer.name,
            customerDni: customer.dni,
            customerPhone: customer.phone,
            productName: item.name,
            productId: item.id,
            quantity: reservedQuantity,
            productPrice: productPriceUSD,
            downPayment: downPaymentUSD,
            remainingAmount: remainingAmountUSD,
            status: 'reserved',
            store: saleStore,
            productData: productSnapshot.val(),
            usdRate,
            productPriceArs: productPriceARS,
            downPaymentArs: downPaymentARS,
            remainingAmountArs: remainingAmountARS,
            tradeIn: tradeInData,
        };
        await set(newReserveRef, reserveData);
        
        setCompletedReserve(reserveData);

        toast.success('Producto reservado correctamente');
        setIsReserveDialogOpen(false);
        setIsReservePdfDialogOpen(true);
    } catch (error) {
        toast.error('Error al reservar', { description: (error as Error).message });
    } finally {
        setIsLoading(false);
    }
  };

  const finalizePdfDialogClose = useCallback(async () => {
    const shouldGenerate = pdfChoiceRef.current;
    pdfChoiceRef.current = false;

    try {
        if (shouldGenerate && completedSale) {
            await generateSaleReceiptPdf(completedSale);
        }
    } catch (error) {
        console.error("Error al generar el comprobante:", error);
    } finally {
        closingPdfDialogRef.current = false;
        onProductSold();
        onClose();
    }
  }, [completedSale, onClose, onProductSold]);

  const handlePdfDialogClose = (generatePdfOption: boolean) => {
    pdfChoiceRef.current = generatePdfOption;
    closingPdfDialogRef.current = true;
    setIsPdfDialogOpen(false);
    void finalizePdfDialogClose();
  };
  
  const handleReservePdfDialogClose = async (generatePdfOption: boolean, currency: "USD" | "ARS" = "USD") => {
    setIsReservePdfDialogOpen(false);
    if (generatePdfOption && completedReserve) {
      await generateReserveReceiptPdf(completedReserve, currency);
    }
    onProductSold();
    onClose();
  };

  const handleCloseSignatureDialog = async (goToPdf: boolean) => {
    if (signatureSessionRefPath) {
      const sessionRef = ref(database, signatureSessionRefPath)
      await update(sessionRef, {
        status: "closed",
        closedAt: new Date().toISOString(),
      }).catch(() => null)
    }
    if (completedSale) {
      try {
        await finalizeSale(completedSale)
      } catch (error) {
        return
      }
    }
    setIsSignatureDialogOpen(false)
    if (goToPdf) {
      setIsPdfDialogOpen(true)
    }
  }

  const handleCopySignatureLink = async () => {
    if (!signatureLink) return
    try {
      await navigator.clipboard.writeText(signatureLink)
      toast.success("Enlace copiado")
    } catch (error) {
      console.error("No se pudo copiar el enlace", error)
      toast.error("No se pudo copiar el enlace")
    }
  }

  const handleRetrySignatureSession = async () => {
    if (!completedSale) return
    try {
      await startSignatureSession(completedSale)
    } catch (error) {
      console.error("No se pudo iniciar la sesión de firma:", error)
      setSignatureSessionError("No se pudo iniciar la sesión de firma. Revisá la conexión e intentá nuevamente.")
    }
  }

  const resolveCancelRequest = async (resolution: "continue" | "cancel") => {
    if (!signatureSessionRefPath) return
    const sessionRef = ref(database, signatureSessionRefPath)
    await update(sessionRef, {
      status: resolution === "cancel" ? "cancelled" : "closed",
      cancelResolvedAt: new Date().toISOString(),
      cancelResolution: resolution,
    }).catch(() => null)
  }

  const restoreInventoryForSale = async (sale: Sale) => {
    const reserveProductId = reserveToComplete?.productId
    const reservedQuantity = reserveToComplete?.quantity || 0

    for (const item of sale.items || []) {
      const quantityToRestore =
        reserveToComplete && item.productId === reserveProductId
          ? Math.max(item.quantity - reservedQuantity, 0)
          : item.quantity

      if (quantityToRestore <= 0) continue

      const productRef = ref(database, `products/${item.productId}`)
      const productSnapshot = await get(productRef)
      if (productSnapshot.exists()) {
        const productData = productSnapshot.val()
        const currentStock = Number(productData.stock || 0)
        await update(productRef, { stock: currentStock + quantityToRestore })
      } else {
        await set(productRef, {
          id: item.productId,
          name: item.productName,
          price: item.price,
          stock: quantityToRestore,
          imei: item.imei || null,
          barcode: item.barcode || null,
          provider: item.provider || null,
          category: item.category || null,
          cost: item.cost ?? 0,
          brand: item.brand || null,
          model: item.model || null,
          store: item.store || sale.store || null,
          createdAt: new Date().toISOString(),
          restoredFromSale: sale.id,
        })
      }
    }
  }

  const handleContinueAfterCancelRequest = async () => {
    if (!completedSale) return
    setIsCancelDialogOpen(false)
    setHasCancelRequest(false)
    await resolveCancelRequest("continue")
    await startSignatureSession(completedSale)
  }

  const handleConfirmCancelSale = async () => {
    if (!completedSale) return
    setIsLoading(true)
    try {
      await resolveCancelRequest("cancel")
      if (completedSale.status === "completed") {
        await restoreInventoryForSale(completedSale)
        if (completedSale.customerId && !completedSale.pointsPaused) {
          const previousPoints =
            (completedSale.pointsAccumulated ?? 0) +
            (completedSale.pointsUsed ?? 0) -
            (completedSale.pointsEarned ?? 0)
          const customerRef = ref(database, `customers/${completedSale.customerId}`)
          await update(customerRef, { points: previousPoints })
        }
      }
      const saleRef = ref(database, `sales/${completedSale.id}`)
      await remove(saleRef)
      setIsCancelDialogOpen(false)
      setHasCancelRequest(false)
      setIsSignatureDialogOpen(false)
      toast.success("La venta fue cancelada correctamente.")
    } catch (error) {
      console.error("No se pudo cancelar la venta:", error)
      toast.error("No se pudo cancelar la venta", {
        description: (error as Error).message,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-5xl h-[95vh] flex flex-col">
          <DialogHeader><DialogTitle>Registrar Venta</DialogTitle></DialogHeader>
          <div className="grid md:grid-cols-2 gap-x-8 flex-grow min-h-0">
            <ScrollArea className="pr-4 -mr-4">
              <div className="space-y-4">
                {/* Carrito y Búsqueda */}
                <div>
                  <h3 className="text-lg font-medium">Carrito de Compra</h3>
                  <Separator className="my-2"/>
                  <ScrollArea className="h-48 pr-4 border rounded-md">
                    {cart.length === 0 ? <p className="text-center text-muted-foreground py-10">Agregue productos</p> : cart.map(item => (
                        <div key={item.id} className="flex items-center justify-between p-2 mb-2 bg-muted/50 rounded-md">
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Input
                                type="number"
                                className="h-6 w-20"
                                value={item.price}
                                onChange={(e) => handlePriceChange(item.id, Number(e.target.value))}
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => handlePriceChange(item.id, 0)}
                              >
                                <Gift className="h-4 w-4" />
                              </Button>
                              {item.price === 0 ? (
                                <span className="font-bold text-green-600">Regalo</span>
                              ) : (
                                <span>
                                  {formatCurrency(convertPrice(item.price, usdRate) * item.quantity)}
                                  {item.price < 3500 && item.price > 0 && (
                                    <span className="text-xs text-blue-500"> ({item.quantity} x ${item.price} USD)</span>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleQuantityChange(item.id, item.quantity - 1)}><Minus className="h-4 w-4"/></Button>
                            <span>{item.quantity}</span>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleQuantityChange(item.id, item.quantity + 1)}><Plus className="h-4 w-4"/></Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => handleRemoveProductFromCart(item.id)}><Trash2 className="h-4 w-4"/></Button>
                          </div>
                        </div>
                    ))}
                  </ScrollArea>
                </div>
                <div>
                  <Label htmlFor="productSearch">Agregar Producto al Carrito</Label>
                  <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input id="productSearch" placeholder="Buscar para agregar..." className="pl-8" value={productSearchTerm} onChange={(e) => setProductSearchTerm(e.target.value)}/></div>
                  <ScrollArea className="h-32 border rounded-md mt-2">
                    {searchedProducts.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-2 hover:bg-accent cursor-pointer" onClick={() => handleAddProductToCart(p)}>
                            <div>
                              <p className="font-medium">
                                {[p.name, p.brand, p.model].filter(Boolean).join(" ")}
                              </p>
                              <p className="text-xs text-muted-foreground">Stock: {p.stock}</p>
                            </div>
                            <span className="text-sm font-semibold">{formatCurrency(convertPrice(p.price, usdRate))}</span>
                        </div>
                    ))}
                  </ScrollArea>
                </div>
              </div>
            </ScrollArea>

            <ScrollArea className="pr-4 -mr-4">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Datos de la Venta</h3>
                <Separator className="my-2"/>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="sale-store">Local</Label>
                    <Input
                      id="sale-store"
                      value={
                        saleStore
                          ? saleStore === "local2"
                            ? "Local 2"
                            : "Local 1"
                          : ""
                      }
                      disabled
                    />
                  </div>
                  <div className="space-y-2"><Label htmlFor="usdRate" className="flex items-center gap-1.5"><DollarSign className="h-4 w-4"/> Cotización Dólar</Label><Input id="usdRate" type="number" value={usdRate} onChange={(e) => setUsdRate(Number(e.target.value) || 0)}/></div>
                  <div className="space-y-2"><Label htmlFor="customerDni" className="flex items-center gap-1.5"><User className="h-4 w-4"/>DNI Cliente</Label><div className="flex gap-2"><Input id="customerDni" value={customer.dni} onChange={(e) => setCustomer({...customer, dni: e.target.value})} /><Button variant="outline" size="icon" onClick={searchCustomerByDni} disabled={isSearching}>{isSearching ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="h-4 w-4"/>}</Button></div></div>
                  <div className="space-y-2"><Label htmlFor="customerName">Nombre Cliente</Label><Input id="customerName" value={customer.name} onChange={(e) => setCustomer({...customer, name: e.target.value})}/></div>
                  <div className="space-y-2"><Label htmlFor="customerPhone" className="flex items-center gap-1.5"><Phone className="h-4 w-4"/>Teléfono</Label><Input id="customerPhone" value={customer.phone} onChange={(e) => setCustomer({...customer, phone: e.target.value})}/></div>
                  <div className="space-y-2"><Label htmlFor="customerEmail" className="flex items-center gap-1.5"><Mail className="h-4 w-4"/>Email (Opcional)</Label><Input id="customerEmail" value={customer.email} onChange={(e) => setCustomer({...customer, email: e.target.value})}/></div>
                  <div className="space-y-2"><Label>Método de Pago</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="efectivo">Efectivo</SelectItem>
                        <SelectItem value="efectivo_usd">Efectivo USD</SelectItem>
                        <SelectItem value="tarjeta">Tarjeta</SelectItem>
                        <SelectItem value="transferencia">Transferencia</SelectItem>
                        <SelectItem value="transferencia_usdt">Transferencia USDT</SelectItem>
                        <SelectItem value="multiple">Pago Múltiple</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {paymentMethod === "multiple" && (
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <Label>Monto Efectivo</Label>
                        <Input type="number" value={cashAmount} onChange={(e) => setCashAmount(Number(e.target.value) || 0)} />
                      </div>
                      <div className="space-y-1">
                        <Label>Monto Efectivo USD</Label>
                        <Input type="number" value={cashUsdAmount} onChange={(e) => setCashUsdAmount(Number(e.target.value) || 0)} />
                      </div>
                      <div className="space-y-1">
                        <Label>Monto Transferencia</Label>
                        <Input type="number" value={transferAmount} onChange={(e) => setTransferAmount(Number(e.target.value) || 0)} />
                      </div>
                      <div className="space-y-1">
                        <Label>Monto Tarjeta</Label>
                        <Input type="number" value={cardAmount} onChange={(e) => setCardAmount(Number(e.target.value) || 0)} />
                      </div>
                    </div>
                  )}
                  {!pointsPaused && availablePoints > 0 && (
                    <div className="flex items-center space-x-2">
                      <Checkbox id="use-points" checked={usePoints} onCheckedChange={(checked) => setUsePoints(!!checked)} />
                      <Label htmlFor="use-points">
                        Usar {availablePoints} puntos
                        {usePoints && discount > 0 && ` (Descuento: ${formatCurrency(discount)})`}
                      </Label>
                    </div>
                  )}
                  <div><Button type="button" variant="secondary" onClick={() => setIsTradeIn(!isTradeIn)} className="w-full">{isTradeIn ? "Cancelar Parte de Pago" : "Recibir en Parte de Pago"}</Button></div>
                  {isTradeIn && <div className="p-4 border rounded-md space-y-3"><h4 className="font-medium text-center text-sm">Equipo Recibido (Apple)</h4>
                    <div className="space-y-1"><Label htmlFor="tradeIn-name" className="text-xs">Modelo</Label><Input id="tradeIn-name" placeholder="Ej: iPhone 13 Pro" value={tradeInProduct.name} onChange={(e) => setTradeInProduct({ ...tradeInProduct, name: e.target.value })} /></div>
                    <div className="space-y-1"><Label htmlFor="tradeIn-serial" className="text-xs">Número de Serie</Label><Input id="tradeIn-serial" value={tradeInProduct.serialNumber} onChange={(e) => setTradeInProduct({ ...tradeInProduct, serialNumber: e.target.value })} /></div>
                    <div className="space-y-1"><Label htmlFor="tradeIn-imei" className="text-xs">IMEI</Label><Input id="tradeIn-imei" value={tradeInProduct.imei} onChange={(e) => setTradeInProduct({ ...tradeInProduct, imei: e.target.value })} /></div>
                    <div className="space-y-1"><Label htmlFor="tradeIn-price" className="text-xs">Valor Toma (USD)</Label><Input id="tradeIn-price" type="number" value={tradeInProduct.price} onChange={(e) => setTradeInProduct({ ...tradeInProduct, price: Number(e.target.value) })} /></div>
                  </div>}
                </div>
              </div>
            </ScrollArea>
          </div>
          
          <DialogFooter className="mt-auto pt-4 border-t">
            <div className="w-full flex justify-between items-center">
              <div>
                {usePoints && discount > 0 && (
                  <p className="text-sm text-muted-foreground">Descuento: {formatCurrency(discount)}</p>
                )}
                {!pointsPaused && (
                  <p className="text-sm text-muted-foreground">Puntos que suma: {pointsEarned}</p>
                )}
                <div className="text-2xl font-bold">
                  Total: {formatCurrency(finalTotal)}
                </div>
              </div>
              <div className="flex gap-2">
                  <Button variant="outline" onClick={onClose}>Cancelar</Button>
                  {!isCompletingReserve && (
                    <Button variant="secondary" onClick={() => setIsReserveDialogOpen(true)} disabled={cart.length === 0 || !saleStore}>Reservar</Button>
                  )}
                  <Button onClick={handleSellProduct} disabled={isLoading || cart.length === 0 || !saleStore}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Completar Venta</Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {completedSale && (
        <Dialog
          open={isSignatureDialogOpen}
          onOpenChange={(open) => {
            if (!open) return;
            setIsSignatureDialogOpen(true);
          }}
        >
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Firma del cliente</DialogTitle>
              <DialogDescription>
                Antes de generar el PDF podés solicitar la firma desde otra tablet o celular.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {signatureSessionError && (
                <Alert variant="destructive">
                  <AlertTitle>No se pudo iniciar la firma</AlertTitle>
                  <AlertDescription className="space-y-3">
                    <p>{signatureSessionError}</p>
                    <Button type="button" variant="outline" onClick={handleRetrySignatureSession}>
                      Reintentar generar QR
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              <Alert>
                <Smartphone className="h-4 w-4" />
                <AlertTitle>Conectá el dispositivo</AlertTitle>
                <AlertDescription>
                  Escaneá el QR o abrí el enlace para dibujar la firma del cliente.
                </AlertDescription>
              </Alert>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-40 w-40 items-center justify-center rounded-md border bg-muted">
                  {signatureQrDataUrl ? (
                    <Image
                      src={signatureQrDataUrl}
                      alt="Código QR para firma"
                      width={160}
                      height={160}
                      className="h-36 w-36"
                    />
                  ) : (
                    <span className="text-sm text-muted-foreground">Generando QR...</span>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <Label>Enlace para firmar</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={signatureLink || "Generando enlace..."} />
                    <Button type="button" variant="outline" size="icon" onClick={handleCopySignatureLink} disabled={!signatureLink}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Compartí este enlace con la tablet o celular del cliente.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Estado de la firma</Label>
                <div className="rounded-md border p-3">
                  {signatureData?.url ? (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-green-600">Firma recibida.</p>
                      <div className="rounded-md border bg-white p-2">
                        <Image
                          src={signatureData.url}
                          alt="Firma del cliente"
                          width={320}
                          height={160}
                          className="h-28 w-full object-contain"
                        />
                      </div>
                      {signatureData.signedAt && (
                        <p className="text-xs text-muted-foreground">
                          Firmado el {new Date(signatureData.signedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {signatureStatus === "cancel_requested"
                        ? "El cliente solicitó cancelar la operación."
                        : signatureStatus === "closed"
                          ? "La sesión de firma fue cerrada."
                          : signatureStatus === "cancelled"
                            ? "La venta fue cancelada."
                            : "Esperando la firma del cliente..."}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleCloseSignatureDialog(true)} disabled={isFinalizingSale}>
                Omitir firma
              </Button>
              <Button onClick={() => handleCloseSignatureDialog(true)} disabled={!signatureData?.url || isFinalizingSale}>
                Continuar al PDF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={isCancelDialogOpen} onOpenChange={(open) => setIsCancelDialogOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Solicitud de cancelación</AlertDialogTitle>
            <AlertDialogDescription>
              El cliente solicitó cancelar la operación. Confirmá si querés cancelar la venta o
              continuar con la operación.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleContinueAfterCancelRequest} disabled={isLoading}>
              Seguir con la venta
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCancelSale} disabled={isLoading}>
              Cancelar venta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {completedSale && (
        <Dialog
          open={isPdfDialogOpen}
          onOpenChange={(open) => {
            if (open) {
              setIsPdfDialogOpen(true);
              return;
            }

            setIsPdfDialogOpen(false);

            if (closingPdfDialogRef.current) {
              return;
            }

            pdfChoiceRef.current = false;
            void finalizePdfDialogClose();
          }}
        >
          <DialogContent><DialogHeader><DialogTitle>Venta Completada</DialogTitle><DialogDescription>¿Deseas generar el comprobante de la venta en PDF?</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => handlePdfDialogClose(false)}>No, gracias</Button><Button onClick={() => handlePdfDialogClose(true)}><FileText className="mr-2 h-4 w-4" />Generar PDF</Button></DialogFooter></DialogContent>
        </Dialog>
      )}

      {completedReserve && (
        <Dialog open={isReservePdfDialogOpen} onOpenChange={() => setIsReservePdfDialogOpen(false)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Reserva Completada</DialogTitle>
                    <DialogDescription>¿Deseas generar el comprobante de la reserva en PDF?</DialogDescription>
                </DialogHeader>
                <div className="py-2 space-y-3">
                  <Label className="text-sm font-medium">Moneda del comprobante</Label>
                  <RadioGroup
                    className="flex flex-col gap-2"
                    value={reservePdfCurrency}
                    onValueChange={(value) => setReservePdfCurrency(value as "USD" | "ARS")}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem id="reserve-currency-usd" value="USD" />
                      <Label htmlFor="reserve-currency-usd" className="font-normal">Dólares estadounidenses</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem id="reserve-currency-ars" value="ARS" />
                      <Label htmlFor="reserve-currency-ars" className="font-normal">Pesos argentinos</Label>
                    </div>
                  </RadioGroup>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => handleReservePdfDialogClose(false)}>No, gracias</Button>
                    <Button onClick={() => handleReservePdfDialogClose(true, reservePdfCurrency)}><FileText className="mr-2 h-4 w-4" />Generar PDF</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}

      {!isCompletingReserve && (
        <Dialog open={isReserveDialogOpen} onOpenChange={setIsReserveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reservar Producto</DialogTitle>
              <DialogDescription>Ingrese monto de seña y fecha límite para retirar.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reserve-amount">Monto de Seña (ARS)</Label>
                <Input id="reserve-amount" type="number" value={reserveAmount} onChange={(e) => setReserveAmount(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reserve-date" className="flex items-center gap-1.5"><Calendar className="h-4 w-4"/>Fecha Límite</Label>
                <Input id="reserve-date" type="date" value={reserveExpirationDate} onChange={(e) => setReserveExpirationDate(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsReserveDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleReserveProduct} disabled={isLoading || reserveAmount <= 0 || !reserveExpirationDate}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar Reserva</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
