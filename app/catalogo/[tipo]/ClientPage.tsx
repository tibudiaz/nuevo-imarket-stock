"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react"
import {
  ref,
  onValue,
  query,
  orderByChild,
  equalTo,
  get,
  push,
  runTransaction,
  set,
  update,
} from "firebase/database"
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Globe,
  IdCard,
  LogIn,
  Mail,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserPlus,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import PublicTopBar from "@/components/public-top-bar"
import { database } from "@/lib/firebase"
import { convertPriceToUSD, formatCurrency, formatUsdCurrency } from "@/lib/price-converter"
import { cn } from "@/lib/utils"
import CatalogAd from "@/components/catalog-ad"
import { normalizeCatalogAdConfig, type CatalogAdConfig } from "@/lib/catalog-ads"

interface Product {
  id: string
  name?: string
  brand?: string
  model?: string
  price?: number
  category?: string
  imei?: string
  stock?: number
  visibleInCatalog?: boolean
  [key: string]: any
}

interface NewCatalogItem {
  id: string
  name: string
  price?: number
  status?: string
  createdAt?: string
}

interface CustomerProfile {
  id: string
  name?: string
  email?: string
  points?: number
  [key: string]: any
}

interface SaleItem {
  productName?: string
  quantity?: number
  [key: string]: any
}

interface Sale {
  id: string
  date?: string
  items?: SaleItem[]
  totalAmount?: number
  customerId?: string
  [key: string]: any
}

const CATEGORY_NEW = "Celulares Nuevos"
const CATEGORY_USED = "Celulares Usados"
const CATALOG_CACHE_TTL_MS = 10 * 60 * 1000
const CATALOG_RATE_REFRESH_MS = 10 * 60 * 1000

const CATALOG_TYPES = {
  nuevos: {
    key: "nuevos",
    title: "Celulares Nuevos",
    category: CATEGORY_NEW,
    accent: "from-sky-500/20 to-blue-500/5",
  },
  usados: {
    key: "usados",
    title: "Celulares Usados",
    category: CATEGORY_USED,
    accent: "from-emerald-500/20 to-green-500/5",
  },
}

type CatalogTypeKey = keyof typeof CATALOG_TYPES

type CatalogCache = {
  products?: Product[]
  newCatalogItems?: NewCatalogItem[]
  usdRate?: number
  catalogVisibility?: { newPhones?: boolean; usedPhones?: boolean }
  updatedAt?: number
}

const readCatalogCache = (key: string): CatalogCache | null => {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CatalogCache
    if (!parsed?.updatedAt || Date.now() - parsed.updatedAt > CATALOG_CACHE_TTL_MS) {
      return null
    }
    return parsed
  } catch (error) {
    console.error("Error al leer cache del catálogo:", error)
    return null
  }
}

const writeCatalogCache = (key: string, partial: CatalogCache) => {
  if (typeof window === "undefined") return
  try {
    const raw = localStorage.getItem(key)
    const existing = raw ? (JSON.parse(raw) as CatalogCache) : {}
    const next = {
      ...existing,
      ...partial,
      updatedAt: Date.now(),
    }
    localStorage.setItem(key, JSON.stringify(next))
  } catch (error) {
    console.error("Error al guardar cache del catálogo:", error)
  }
}

const resolveProductName = (product: Product) => {
  const name = product.name?.trim()
  if (name) return name

  const brand = product.brand?.trim()
  const model = product.model?.trim()
  if (brand && model) return `${brand} ${model}`
  if (brand) return brand
  if (model) return model

  return "Equipo disponible"
}

const ensureIphonePrefix = (name: string) => {
  const trimmed = name.trim()
  if (!trimmed) return "iPhone"
  if (/^iphone\b/i.test(trimmed)) return trimmed
  return `iPhone ${trimmed}`
}

const WARRANTY_REGEX = /\b(gtia|gar|car)\s*(\d{1,2}\/\d{2}(?:\/\d{2})?)\b/i

const stripImeiSuffix = (name: string) => {
  return name.replace(/\bimei\b[:\s-]*\d+\b/gi, "").replace(/\s+/g, " ").trim()
}

const COLOR_PHRASES = [
  "azul medianoche",
  "azul oscuro",
  "azul marino",
  "azul claro",
  "azul",
  "celeste",
  "verde oliva",
  "verde",
  "rojo",
  "amarillo",
  "negro",
  "blanco",
  "gris",
  "grafito",
  "graphito",
  "plata",
  "plateado",
  "rose gold",
  "rose",
  "dorado",
  "oro",
  "rosa",
  "desert",
  "fucsia",
  "morado",
  "violeta",
  "lila",
  "coral",
  "turquesa",
  "cobre",
  "chocolate",
  "midnight",
  "starlight",
  "gold",
  "silver",
  "black",
  "white",
  "blue",
  "green",
  "red",
  "pink",
  "purple",
  "graphite",
  "yellow",
] as const

const findColorPhrase = (tokens: string[]) => {
  const lowerTokens = tokens.map((token) => token.toLowerCase())
  const phrases = COLOR_PHRASES.map((phrase) => phrase.split(" "))

  for (let index = 0; index < lowerTokens.length; index += 1) {
    for (const phraseTokens of phrases) {
      if (phraseTokens.length === 0) continue
      const slice = lowerTokens.slice(index, index + phraseTokens.length)
      if (slice.length !== phraseTokens.length) continue
      if (slice.every((token, sliceIndex) => token === phraseTokens[sliceIndex])) {
        return {
          start: index,
          end: index + phraseTokens.length,
          value: tokens.slice(index, index + phraseTokens.length).join(" "),
        }
      }
    }
  }
  return null
}

const parseUsedPhoneDetails = (name: string) => {
  const imeiTrimmed = stripImeiSuffix(name)
  const warrantyMatch = imeiTrimmed.match(WARRANTY_REGEX)
  const warranty = warrantyMatch?.[2] ?? null
  const warrantyTrimmed = imeiTrimmed.replace(WARRANTY_REGEX, "").replace(/\s+/g, " ").trim()

  const tokens = warrantyTrimmed.split(/\s+/).filter(Boolean)
  const batteryIndex = tokens.findIndex((token) => /(\d+)%/.test(token))
  const memoryIndex = tokens.findIndex((token) => /(\d+)\s*gb/i.test(token))
  const colorMatch = findColorPhrase(tokens)

  const batteryConditionMatch =
    batteryIndex >= 0 ? tokens[batteryIndex].match(/(\d+)%/) : null
  const batteryCondition = batteryConditionMatch ? batteryConditionMatch[0] : null

  const memoryMatch = memoryIndex >= 0 ? tokens[memoryIndex].match(/(\d+)\s*gb/i) : null
  const memory = memoryMatch ? memoryMatch[0].replace(/\s+/g, "").toUpperCase() : null

  const color = colorMatch?.value ?? null

  const displayTokens = tokens.filter((_, index) => {
    if (index === batteryIndex || index === memoryIndex) return false
    if (colorMatch && index >= colorMatch.start && index < colorMatch.end) return false
    return true
  })
  const displayName = displayTokens.join(" ").trim() || warrantyTrimmed

  return {
    displayName,
    batteryCondition,
    color,
    memory,
    warranty,
  }
}

const resolveNewCatalogName = (item: NewCatalogItem) => {
  const name = item.name?.trim()
  return name || "Equipo nuevo"
}

const resolveNewCatalogStatus = (item: NewCatalogItem) => {
  const status = item.status?.trim()
  return status || "Consultar disponibilidad"
}

const formatUsdPrice = (price: number | undefined, usdRate: number) => {
  if (typeof price !== "number" || Number.isNaN(price)) return "Consultar"
  if (usdRate > 0) {
    return formatUsdCurrency(convertPriceToUSD(price, usdRate))
  }
  return formatUsdCurrency(price)
}

const formatArsPriceBlue = (price: number | undefined, usdRate: number) => {
  if (typeof price !== "number" || Number.isNaN(price)) return "Consultar"
  if (usdRate <= 0) return "Consultar"
  const usdValue = convertPriceToUSD(price, usdRate)
  return formatCurrency(usdValue * usdRate)
}

const buildWhatsAppLink = (product: Product, usdRate: number) => {
  const name = ensureIphonePrefix(resolveProductName(product))
  const usdPrice = formatUsdPrice(product.price, usdRate)
  const arsPrice = formatArsPriceBlue(product.price, usdRate)
  const message = `Hola estoy interesado en el siguiente celular: ${name}. Precio USD: ${usdPrice}. Precio en pesos: ${arsPrice}.`
  const encodedMessage = encodeURIComponent(message)
  return `https://wa.me/5493584224464?text=${encodedMessage}`
}

const buildWhatsAppLinkForNewCatalog = (item: NewCatalogItem, usdRate: number) => {
  const name = resolveNewCatalogName(item)
  const usdPrice = formatUsdPrice(item.price, usdRate)
  const arsPrice = formatArsPriceBlue(item.price, usdRate)
  const status = resolveNewCatalogStatus(item)
  const messageParts = [
    `Hola! Estoy interesado en el siguiente celular nuevo: ${name}.`,
    `Precio USD: ${usdPrice}.`,
    `Precio en pesos: ${arsPrice}.`,
    item.status?.trim() ? `Estado: ${status}.` : null,
  ].filter(Boolean)
  const encodedMessage = encodeURIComponent(messageParts.join(" "))
  return `https://wa.me/5493584224464?text=${encodedMessage}`
}

export default function PublicStockClient({ params }: { params: { tipo: string } }) {
  const catalogType = CATALOG_TYPES[params.tipo as CatalogTypeKey]
  const cacheKey = catalogType ? `catalog-cache-${catalogType.key}` : "catalog-cache"
  const searchParams = useSearchParams()

  const [products, setProducts] = useState<Product[]>([])
  const [newCatalogItems, setNewCatalogItems] = useState<NewCatalogItem[]>([])
  const [usdRate, setUsdRate] = useState(0)
  const [usdRateAdjustment, setUsdRateAdjustment] = useState(0)
  const [loading, setLoading] = useState(true)
  const [catalogVisibility, setCatalogVisibility] = useState({
    newPhones: true,
    usedPhones: true,
  })
  const [offers, setOffers] = useState<string[]>([])
  const [catalogAd, setCatalogAd] = useState<CatalogAdConfig | null>(null)
  const [isAuthPanelOpen, setIsAuthPanelOpen] = useState(false)
  const [authStep, setAuthStep] = useState<"choice" | "login" | "register">("choice")
  const [currentCustomer, setCurrentCustomer] = useState<CustomerProfile | null>(null)
  const [customerSales, setCustomerSales] = useState<Sale[]>([])
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [pointsPaused, setPointsPaused] = useState(false)
  const [purchaseStatus, setPurchaseStatus] = useState<"yes" | "no">("no")
  const [registration, setRegistration] = useState({
    dni: "",
    name: "",
    email: "",
  })

  useEffect(() => {
    const authParam = searchParams?.get("auth")
    if (!authParam) return
    if (authParam === "login" || authParam === "register") {
      setAuthStep(authParam)
    } else {
      setAuthStep("choice")
    }
    setIsAuthPanelOpen(true)
  }, [searchParams])
  const [registrationPassword, setRegistrationPassword] = useState("")
  const [registrationPasswordConfirm, setRegistrationPasswordConfirm] = useState("")
  const [matchedCustomer, setMatchedCustomer] = useState<{ id: string; name: string } | null>(null)
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [isLoginSubmitting, setIsLoginSubmitting] = useState(false)
  const [, startTransition] = useTransition()
  useEffect(() => {
    if (!catalogType) return
    const cached = readCatalogCache(cacheKey)
    if (!cached) return

    if (Array.isArray(cached.products)) {
      startTransition(() => {
        setProducts(cached.products)
      })
    }
    if (Array.isArray(cached.newCatalogItems)) {
      startTransition(() => {
        setNewCatalogItems(cached.newCatalogItems)
      })
    }
    if (typeof cached.usdRate === "number") {
      setUsdRate(cached.usdRate)
    }
    if (cached.catalogVisibility) {
      setCatalogVisibility({
        newPhones: cached.catalogVisibility.newPhones !== false,
        usedPhones: cached.catalogVisibility.usedPhones !== false,
      })
    }
    setLoading(false)
  }, [cacheKey, catalogType])

  useEffect(() => {
    const offersRef = ref(database, "config/offers")
    const unsubscribe = onValue(offersRef, (snapshot) => {
      const data = snapshot.val()
      if (!data) {
        setOffers([])
        return
      }
      const items = Object.values(data)
        .map((value) => {
          if (typeof value === "string") return value
          if (value && typeof value === "object" && "text" in value) {
            return String((value as { text?: string }).text ?? "")
          }
          return ""
        })
        .filter((text) => text.trim().length > 0)
      setOffers(items)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!catalogType?.key) return
    const adRef = ref(database, `config/catalogAds/${catalogType.key}`)
    const unsubscribe = onValue(adRef, (snapshot) => {
      const data = snapshot.val()
      if (!data) {
        setCatalogAd(null)
        return
      }
      setCatalogAd(normalizeCatalogAdConfig(data))
    })

    return () => unsubscribe()
  }, [catalogType?.key])

  useEffect(() => {
    if (!catalogType) return
    const visitsRef = ref(database, "metrics/catalogVisits/total")
    runTransaction(visitsRef, (current) => (typeof current === "number" ? current + 1 : 1)).catch(
      (error) => {
        console.error("Error al registrar visita al catálogo:", error)
      },
    )
  }, [catalogType])

  useEffect(() => {
    const pointsRef = ref(database, "config/points")
    const unsubscribe = onValue(pointsRef, (snapshot) => {
      const data = snapshot.val()
      setPointsPaused(Boolean(data?.paused))
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!currentCustomer?.id) {
      setCustomerSales([])
      return
    }

    const salesQuery = query(
      ref(database, "sales"),
      orderByChild("customerId"),
      equalTo(currentCustomer.id),
    )
    const unsubscribe = onValue(salesQuery, (snapshot) => {
      if (!snapshot.exists()) {
        setCustomerSales([])
        return
      }

      const nextSales: Sale[] = []
      snapshot.forEach((childSnapshot) => {
        const data = childSnapshot.val() || {}
        nextSales.push({
          id: childSnapshot.key || "",
          ...data,
        })
      })

      nextSales.sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0
        const dateB = b.date ? new Date(b.date).getTime() : 0
        return dateB - dateA
      })

      startTransition(() => {
        setCustomerSales(nextSales)
      })
    })

    return () => unsubscribe()
  }, [currentCustomer?.id])

  useEffect(() => {
    if (!catalogType) return
    if (catalogType.key === "nuevos") return
    const productsRef = ref(database, "products")
    const productsQuery = query(
      productsRef,
      orderByChild("category"),
      equalTo(catalogType.category),
    )

    const unsubscribeProducts = onValue(
      productsQuery,
      (snapshot) => {
        setLoading(false)
        if (!snapshot.exists()) {
          setProducts([])
          return
        }

        const nextProducts: Product[] = []
        snapshot.forEach((childSnapshot) => {
          if (typeof childSnapshot.val() === "object" && childSnapshot.key) {
            nextProducts.push({
              id: childSnapshot.key,
              ...childSnapshot.val(),
            })
          }
        })

        startTransition(() => {
          setProducts(nextProducts)
        })
        writeCatalogCache(cacheKey, { products: nextProducts })
      },
      () => {
        setLoading(false)
      },
    )

    return () => {
      unsubscribeProducts()
    }
  }, [cacheKey, catalogType])

  useEffect(() => {
    if (!catalogType || catalogType.key !== "nuevos") return
    const newCatalogRef = ref(database, "config/newPhones")
    const unsubscribeNewCatalog = onValue(
      newCatalogRef,
      (snapshot) => {
        setLoading(false)
        if (!snapshot.exists()) {
          setNewCatalogItems([])
          return
        }

        const items: NewCatalogItem[] = []
        snapshot.forEach((childSnapshot) => {
          const value = childSnapshot.val()
          if (value && typeof value === "object" && childSnapshot.key) {
            items.push({
              id: childSnapshot.key,
              name: String(value.name ?? "").trim(),
              price: typeof value.price === "number" ? value.price : undefined,
              status: value.status ? String(value.status) : undefined,
              createdAt: value.createdAt,
            })
          }
        })

        startTransition(() => {
          setNewCatalogItems(items)
        })
        writeCatalogCache(cacheKey, { newCatalogItems: items })
      },
      () => {
        setLoading(false)
      },
    )

    return () => {
      unsubscribeNewCatalog()
    }
  }, [cacheKey, catalogType])

  useEffect(() => {
    const visibilityRef = ref(database, "catalogVisibility")
    const unsubscribeVisibility = onValue(visibilityRef, (snapshot) => {
      if (!snapshot.exists()) {
        setCatalogVisibility({ newPhones: true, usedPhones: true })
        return
      }

      const data = snapshot.val() || {}
      setCatalogVisibility({
        newPhones: data.newPhones !== false,
        usedPhones: data.usedPhones !== false,
      })
      if (catalogType) {
        writeCatalogCache(cacheKey, {
          catalogVisibility: {
            newPhones: data.newPhones !== false,
            usedPhones: data.usedPhones !== false,
          },
        })
      }
    })

    return () => unsubscribeVisibility()
  }, [cacheKey, catalogType])

  useEffect(() => {
    const adjustmentRef = ref(database, "config/usdRateAdjustment")
    const unsubscribeAdjustment = onValue(adjustmentRef, (snapshot) => {
      const value = snapshot.val()
      setUsdRateAdjustment(typeof value === "number" && Number.isFinite(value) ? value : 0)
    })

    return () => unsubscribeAdjustment()
  }, [])

  useEffect(() => {
    const fetchDolarBlue = async () => {
      try {
        const response = await fetch("/api/dolar-blue")
        if (!response.ok) {
          throw new Error("No se pudo obtener la cotización")
        }
        const data = await response.json()
        const nextRate =
          typeof data.venta === "number" ? data.venta + usdRateAdjustment : 0
        setUsdRate(nextRate)
        if (catalogType) {
          writeCatalogCache(cacheKey, { usdRate: nextRate })
        }
      } catch (error) {
        console.error("Error al obtener dólar blue:", error)
        setUsdRate(0)
      }
    }

    fetchDolarBlue()
    const intervalId = setInterval(fetchDolarBlue, CATALOG_RATE_REFRESH_MS)

    return () => clearInterval(intervalId)
  }, [cacheKey, catalogType, usdRateAdjustment])

  const handlePurchaseStatusChange = (status: "yes" | "no") => {
    setPurchaseStatus(status)
    if (status === "no") {
      setMatchedCustomer(null)
      setRegistration((prev) => ({ ...prev, dni: "" }))
    }
  }

  const handleSearchCustomer = async () => {
    const normalizedDni = registration.dni.replace(/\D/g, "")
    if (!normalizedDni) {
      toast.error("Ingresá el DNI para buscar tu historial.")
      return
    }

    setIsSearchingCustomer(true)
    try {
      const customersRef = ref(database, "customers")
      const customerQuery = query(customersRef, orderByChild("dni"), equalTo(normalizedDni))
      const snapshot = await get(customerQuery)

      if (snapshot.exists()) {
        const entries = Object.entries(snapshot.val())
        const [customerId, customerData] = entries[0] as [string, any]
        const customerName = String(customerData?.name ?? "").trim()
        setMatchedCustomer({ id: customerId, name: customerName })
        setRegistration((prev) => ({
          ...prev,
          dni: normalizedDni,
          name: customerName,
        }))
        toast.success("Cliente encontrado. Cargamos tus datos.")
      } else {
        setMatchedCustomer(null)
        setRegistration((prev) => ({
          ...prev,
          name: "",
        }))
        toast.info("No encontramos tu DNI. Completá tus datos para registrarte.")
      }
    } catch (error) {
      console.error("Error al buscar cliente:", error)
      toast.error("No pudimos buscar el DNI. Intentá nuevamente.")
    } finally {
      setIsSearchingCustomer(false)
    }
  }

  const handleRegisterCustomer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return

    const normalizedDni = registration.dni.replace(/\D/g, "")
    const normalizedName = registration.name.trim()
    const normalizedEmail = registration.email.trim().toLowerCase()

    if (purchaseStatus === "yes" && !normalizedDni) {
      toast.error("Necesitamos tu DNI para buscar tu historial.")
      return
    }

    if (!normalizedName) {
      toast.error("Ingresá tu nombre y apellido para registrarte.")
      return
    }

    if (!normalizedEmail) {
      toast.error("El email es obligatorio para crear el usuario.")
      return
    }

    const trimmedPassword = registrationPassword.trim()
    const trimmedPasswordConfirm = registrationPasswordConfirm.trim()
    if (!trimmedPassword || !trimmedPasswordConfirm) {
      toast.error("Ingresá y confirmá tu contraseña para continuar.")
      return
    }
    if (trimmedPassword !== trimmedPasswordConfirm) {
      toast.error("Las contraseñas no coinciden. Revisalas e intentá de nuevo.")
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalizedEmail)) {
      toast.error("Ingresá un email válido para continuar.")
      return
    }

    setIsSubmitting(true)
    try {
      const customersRef = ref(database, "customers")
      const emailQuery = query(customersRef, orderByChild("email"), equalTo(normalizedEmail))
      const emailSnapshot = await get(emailQuery)

      if (emailSnapshot.exists()) {
        const existingIds = Object.keys(emailSnapshot.val())
        const isSameCustomer = matchedCustomer ? existingIds.includes(matchedCustomer.id) : false
        if (!isSameCustomer) {
          toast.error("Ese email ya está registrado. Probá con otro.")
          return
        }
      }

      if (matchedCustomer) {
        await update(ref(database, `customers/${matchedCustomer.id}`), {
          email: normalizedEmail,
          password: trimmedPassword,
          passwordUpdatedAt: new Date().toISOString(),
          publicAccess: true,
          publicAccessUpdatedAt: new Date().toISOString(),
        })
        toast.success("Usuario actualizado.", {
          description: "Ya podés acceder a tu historial con tu contraseña.",
        })
      } else {
        const newCustomerRef = push(customersRef)
        if (!newCustomerRef.key) {
          throw new Error("No se pudo generar el nuevo usuario.")
        }

        const payload: Record<string, string | boolean> = {
          name: normalizedName,
          email: normalizedEmail,
          password: trimmedPassword,
          createdAt: new Date().toISOString(),
          passwordUpdatedAt: new Date().toISOString(),
          publicAccess: true,
          hasPurchased: purchaseStatus === "yes",
        }

        if (normalizedDni) {
          payload.dni = normalizedDni
        }

        await set(newCustomerRef, payload)
        toast.success("Usuario creado correctamente.", {
          description: "Tu contraseña quedó guardada. Ya podés iniciar sesión.",
        })
      }

      setRegistration({ dni: "", name: "", email: "" })
      setRegistrationPassword("")
      setRegistrationPasswordConfirm("")
      setMatchedCustomer(null)
      setPurchaseStatus("no")
    } catch (error) {
      console.error("Error al registrar usuario:", error)
      toast.error("No pudimos crear el usuario. Intentá de nuevo.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLoginCustomer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedEmail = loginEmail.trim().toLowerCase()
    const trimmedPassword = loginPassword.trim()
    if (!normalizedEmail) {
      toast.error("Ingresá tu email para continuar.")
      return
    }
    if (!trimmedPassword) {
      toast.error("Ingresá tu contraseña para continuar.")
      return
    }
    setIsLoginSubmitting(true)
    try {
      const customersRef = ref(database, "customers")
      const emailQuery = query(customersRef, orderByChild("email"), equalTo(normalizedEmail))
      const emailSnapshot = await get(emailQuery)
      if (emailSnapshot.exists()) {
        const entries = Object.entries(emailSnapshot.val())
        const [customerId, customerData] = entries[0] as [string, any]
        if (!customerData?.password) {
          toast.error("Tu cuenta aún no tiene contraseña.", {
            description: "Visitá nuestro local para restablecer o crearla.",
          })
          return
        }
        if (String(customerData.password) !== trimmedPassword) {
          toast.error("Contraseña incorrecta.")
          return
        }
        setCurrentCustomer({
          id: customerId,
          ...customerData,
        })
        setLoginEmail("")
        setLoginPassword("")
        setIsAuthPanelOpen(false)
        setAuthStep("choice")
        toast.success("Cuenta encontrada.", {
          description: "Accediste a tu historial de compras.",
        })
      } else {
        toast.error("No encontramos ese email.", {
          description: "Probá registrarte para crear tu cuenta.",
        })
      }
    } catch (error) {
      console.error("Error al iniciar sesión:", error)
      toast.error("No pudimos validar tu cuenta. Intentá de nuevo.")
    } finally {
      setIsLoginSubmitting(false)
    }
  }

  const toggleAuthPanel = () => {
    setIsAuthPanelOpen((prev) => {
      if (!prev) {
        setAuthStep("choice")
      }
      return !prev
    })
  }

  const inStock = useMemo(() => {
    return products
      .filter((product) => (product.stock ?? 0) > 0 && product.visibleInCatalog !== false)
      .sort((a, b) =>
        resolveProductName(a).localeCompare(resolveProductName(b), "es", {
          sensitivity: "base",
        }),
      )
  }, [products])

  const newCatalogSorted = useMemo(() => {
    return [...newCatalogItems].sort((a, b) =>
      resolveNewCatalogName(a).localeCompare(resolveNewCatalogName(b), "es", {
        sensitivity: "base",
      }),
    )
  }, [newCatalogItems])

  const isSectionVisible = useMemo(() => {
    if (!catalogType) return false
    if (catalogType.key === "nuevos") return catalogVisibility.newPhones
    return catalogVisibility.usedPhones
  }, [catalogType, catalogVisibility])

  const alternateType = catalogType?.key === "nuevos" ? CATALOG_TYPES.usados : CATALOG_TYPES.nuevos

  const marqueeItems = offers.length
    ? offers
    : ["Promociones en tienda, cuotas y bonificaciones especiales."]

  const isNewCatalog = catalogType?.key === "nuevos"
  const catalogItemsCount = isNewCatalog ? newCatalogSorted.length : inStock.length

  const topBarDesktopContent = (
    <>
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
        <Link
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 transition hover:border-white/20"
          href="/"
        >
          <ArrowLeft className="h-4 w-4" />
          Elegir otra categoría
        </Link>
        <Link
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 transition hover:border-white/20"
          href={`/catalogo/${alternateType.key}`}
        >
          {alternateType.title}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
        <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
          <Globe className="h-4 w-4" />
          Disponible en tiempo real
        </span>
        <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
          <ShieldCheck className="h-4 w-4" />
          Datos protegidos
        </span>
        {currentCustomer ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100">
              {currentCustomer.name || currentCustomer.email || "Cliente"}
            </span>
            <Button
              type="button"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/10"
              onClick={() => setIsProfileOpen(true)}
            >
              Mi perfil
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/10"
            onClick={toggleAuthPanel}
            aria-expanded={isAuthPanelOpen}
          >
            Iniciar sesión / Registrarse
          </Button>
        )}
      </div>
    </>
  )

  const topBarMobileContent = (
    <div className="space-y-6">
      <div className="space-y-2 text-sm text-slate-200">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Navegación</p>
        <div className="grid gap-2">
          <Link
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"
            href="/"
          >
            Elegir otra categoría
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Link
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"
            href={`/catalogo/${alternateType.key}`}
          >
            {alternateType.title}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
      <div className="space-y-2 text-sm text-slate-300">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Estado</p>
        <div className="grid gap-2">
          <span className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            Disponible en tiempo real
          </span>
          <span className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            Datos protegidos
          </span>
        </div>
      </div>
      <div className="space-y-2 text-sm text-slate-300">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Cuenta</p>
        <div className="grid gap-2">
          {currentCustomer ? (
            <>
              <span className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100">
                {currentCustomer.name || currentCustomer.email || "Cliente"}
              </span>
              <Button
                type="button"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 hover:border-white/20 hover:bg-white/10"
                onClick={() => setIsProfileOpen(true)}
              >
                Mi perfil
              </Button>
            </>
          ) : (
            <Button
              type="button"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 hover:border-white/20 hover:bg-white/10"
              onClick={toggleAuthPanel}
              aria-expanded={isAuthPanelOpen}
            >
              Iniciar sesión / Registrarse
            </Button>
          )}
        </div>
      </div>
    </div>
  )

  const formatSaleDate = (date?: string) => {
    if (!date) return "Fecha pendiente"
    const parsed = new Date(date)
    if (Number.isNaN(parsed.getTime())) return "Fecha pendiente"
    return new Intl.DateTimeFormat("es-AR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(parsed)
  }

  const authPanel = (
    <div className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/20">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Cuenta</p>
          <h2 className="text-lg font-semibold text-white">
            {authStep === "choice" && "Acceso a tu cuenta"}
            {authStep === "login" && "Iniciar sesión"}
            {authStep === "register" && "Registrarse"}
          </h2>
          <p className="text-sm text-slate-300">
            {authStep === "choice" &&
              "Elegí cómo querés ingresar para ver tu historial o recibir novedades."}
            {authStep === "login" && "Validá tu email para entrar a tu historial."}
            {authStep === "register" &&
              "Completá el formulario para crear tu usuario y recibir promociones."}
          </p>
        </div>
        <button
          type="button"
          className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-200 hover:border-white/20"
          onClick={() => setIsAuthPanelOpen(false)}
          aria-label="Cerrar panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {authStep === "choice" && (
        <div className="grid gap-3">
          <button
            type="button"
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-slate-200 transition hover:border-white/20"
            onClick={() => setAuthStep("login")}
          >
            <span className="flex items-center gap-2">
              <LogIn className="h-4 w-4 text-sky-300" />
              Iniciar sesión
            </span>
            <span className="text-xs text-slate-400">Entrar</span>
          </button>
          <button
            type="button"
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-slate-200 transition hover:border-white/20"
            onClick={() => setAuthStep("register")}
          >
            <span className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-emerald-300" />
              Registrarse
            </span>
            <span className="text-xs text-slate-400">Crear cuenta</span>
          </button>
        </div>
      )}

      {authStep === "login" && (
        <form className="space-y-5" onSubmit={handleLoginCustomer}>
          <div className="space-y-2">
            <Label htmlFor="login-email" className="text-sm text-slate-200">
              Email
            </Label>
            <Input
              id="login-email"
              type="email"
              value={loginEmail}
              onChange={(event) => setLoginEmail(event.target.value)}
              placeholder="correo@ejemplo.com"
              className="border-white/10 bg-slate-950/60 text-white placeholder:text-slate-500"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-password" className="text-sm text-slate-200">
              Contraseña
            </Label>
            <Input
              id="login-password"
              type="password"
              value={loginPassword}
              onChange={(event) => setLoginPassword(event.target.value)}
              placeholder="Ingresá tu contraseña"
              className="border-white/10 bg-slate-950/60 text-white placeholder:text-slate-500"
              required
            />
          </div>
          <div className="space-y-2">
            <Button
              type="submit"
              className="w-full rounded-xl bg-sky-500 text-white hover:bg-sky-400"
              disabled={isLoginSubmitting}
            >
              {isLoginSubmitting ? "Validando..." : "Ingresar"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-slate-300 hover:text-white"
              onClick={() => setAuthStep("choice")}
            >
              Volver
            </Button>
          </div>
        </form>
      )}

      {authStep === "register" && (
        <>
          <form className="space-y-5" onSubmit={handleRegisterCustomer}>
            <div className="space-y-3">
              <Label className="text-sm text-slate-200">¿Ya compraste en iMarket?</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm font-medium transition",
                    purchaseStatus === "yes"
                      ? "border-sky-400/60 bg-sky-500/20 text-sky-100"
                      : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20",
                  )}
                  onClick={() => handlePurchaseStatusChange("yes")}
                >
                  Sí, ya compré
                </button>
                <button
                  type="button"
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm font-medium transition",
                    purchaseStatus === "no"
                      ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-100"
                      : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20",
                  )}
                  onClick={() => handlePurchaseStatusChange("no")}
                >
                  Soy nuevo
                </button>
              </div>
            </div>

            {purchaseStatus === "yes" && (
              <div className="space-y-2">
                <Label htmlFor="public-dni" className="text-sm text-slate-200">
                  DNI
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="public-dni"
                    value={registration.dni}
                    onChange={(event) =>
                      setRegistration((prev) => ({ ...prev, dni: event.target.value }))
                    }
                    placeholder="Ingresá tu DNI"
                    className="border-white/10 bg-slate-950/60 text-white placeholder:text-slate-500"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10"
                    onClick={handleSearchCustomer}
                    disabled={isSearchingCustomer}
                  >
                    <IdCard className="h-4 w-4" />
                    {isSearchingCustomer ? "Buscando..." : "Buscar"}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="public-name" className="text-sm text-slate-200">
                Nombre y apellido
              </Label>
              <Input
                id="public-name"
                value={registration.name}
                onChange={(event) =>
                  setRegistration((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Ingresá tu nombre completo"
                className="border-white/10 bg-slate-950/60 text-white placeholder:text-slate-500"
                readOnly={Boolean(matchedCustomer)}
              />
              {matchedCustomer && (
                <p className="flex items-center gap-2 text-xs text-emerald-200">
                  <BadgeCheck className="h-4 w-4" />
                  Datos cargados desde tu historial.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="public-email" className="text-sm text-slate-200">
                Email
              </Label>
              <Input
                id="public-email"
                type="email"
                value={registration.email}
                onChange={(event) =>
                  setRegistration((prev) => ({ ...prev, email: event.target.value }))
                }
                placeholder="correo@ejemplo.com"
                className="border-white/10 bg-slate-950/60 text-white placeholder:text-slate-500"
                required
              />
              <p className="flex items-center gap-2 text-xs text-slate-400">
                <Mail className="h-4 w-4" />
                Usamos el email para validar tu cuenta.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="public-password" className="text-sm text-slate-200">
                Contraseña
              </Label>
              <Input
                id="public-password"
                type="password"
                value={registrationPassword}
                onChange={(event) => setRegistrationPassword(event.target.value)}
                placeholder="Creá una contraseña"
                className="border-white/10 bg-slate-950/60 text-white placeholder:text-slate-500"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="public-password-confirm" className="text-sm text-slate-200">
                Repetir contraseña
              </Label>
              <Input
                id="public-password-confirm"
                type="password"
                value={registrationPasswordConfirm}
                onChange={(event) => setRegistrationPasswordConfirm(event.target.value)}
                placeholder="Repetí tu contraseña"
                className="border-white/10 bg-slate-950/60 text-white placeholder:text-slate-500"
                required
              />
              <p className="text-xs text-amber-200">
                Para restablecer tu contraseña debés visitarnos en nuestro local.
              </p>
            </div>

            <div className="space-y-2">
              <Button
                type="submit"
                className="w-full rounded-xl bg-emerald-500 text-white hover:bg-emerald-400"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creando usuario..." : "Crear usuario"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-slate-300 hover:text-white"
                onClick={() => setAuthStep("choice")}
              >
                Volver
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  )

  if (!catalogType) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 py-20 text-white">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 rounded-3xl border border-white/10 bg-white/5 p-10 text-center">
          <h1 className="text-2xl font-semibold">Catálogo no disponible</h1>
          <p className="text-slate-300">
            La sección solicitada no existe. Elegí una categoría para continuar.
          </p>
          <Link
            className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm"
            href="/"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-sky-500/20 blur-[120px]" />
          <div className="absolute top-40 left-10 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-[140px]" />
          <div className="absolute -top-10 right-10 h-64 w-64 rounded-full bg-emerald-400/20 blur-[130px]" />
        </div>
        <header className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-16 pt-10">
          <div className="flex flex-col gap-6">
            <PublicTopBar
              marqueeItems={marqueeItems}
              desktopContent={topBarDesktopContent}
              mobileContent={topBarMobileContent}
            />

            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                  <Smartphone className="h-6 w-6 text-sky-300" />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.25em] text-slate-400">iMarket</p>
                  <h1 className="text-3xl font-semibold">{catalogType.title}</h1>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="max-w-2xl space-y-4">
                <p className="text-lg text-slate-200">
                  Consultá precios actualizados en USD y en pesos al tipo de cambio Blue Río Cuarto
                  (venta).
                  Solo mostramos información esencial para resguardar la privacidad de cada dispositivo.
                </p>
                <div className="flex flex-wrap gap-3 text-sm text-slate-300">
                  <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
                    <Sparkles className="h-4 w-4 text-sky-300" />
                    Precios en USD y ARS
                  </span>
                  {!isNewCatalog && (
                    <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                      Información protegida y resumida
                    </span>
                  )}
                  {isNewCatalog && (
                    <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                      Modelos seleccionados
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>
      </div>

      <main className="mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="flex flex-col gap-12">
          <CatalogAd config={catalogAd} className="order-1 md:order-2 md:mt-12" />
          <div className="order-2 md:order-1">
            {loading ? (
              <div className="flex items-center justify-center rounded-3xl border border-white/10 bg-white/5 p-12 text-slate-300">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-400 border-t-transparent" />
                <span className="ml-4">
                  {isNewCatalog ? "Cargando catálogo de equipos nuevos..." : "Cargando stock en tiempo real..."}
                </span>
              </div>
            ) : !isSectionVisible ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-10 text-center text-slate-400">
                Esta sección no está disponible por el momento.
              </div>
            ) : catalogItemsCount === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-10 text-center text-slate-400">
                No hay equipos disponibles por el momento.
              </div>
            ) : (
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold">{catalogType.title}</h2>
                    <p className="text-sm text-slate-400">
                      {catalogItemsCount} equipos disponibles
                    </p>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {isNewCatalog
                    ? newCatalogSorted.map((item) => (
                        <div
                          key={item.id}
                          className={cn(
                            "group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/20 transition-all duration-300 hover:-translate-y-1 hover:border-white/20",
                            "before:absolute before:inset-0 before:bg-gradient-to-br before:opacity-0 before:transition-opacity before:duration-300 group-hover:before:opacity-100",
                            `before:${catalogType.accent}`,
                          )}
                        >
                          <div className="relative space-y-4">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                                  {catalogType.title}
                                </p>
                                <h3 className="text-lg font-semibold text-white">
                                  {resolveNewCatalogName(item)}
                                </h3>
                              </div>
                              <div className="rounded-2xl bg-white/10 px-3 py-1 text-xs text-slate-200">
                                Nuevo
                              </div>
                            </div>

                            <div className="grid gap-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-xs text-slate-400">Disponibilidad</p>
                                  <p className="text-sm font-medium text-slate-100">
                                    {resolveNewCatalogStatus(item)}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-slate-400">Precio USD</p>
                                  <p className="text-lg font-semibold text-sky-200">
                                    {formatUsdPrice(item.price, usdRate)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between border-t border-white/10 pt-3 text-sm text-slate-200">
                                <span className="text-xs text-slate-400">Precio en pesos actual</span>
                                <span className="font-semibold text-emerald-200">
                                  {formatArsPriceBlue(item.price, usdRate)}
                                </span>
                              </div>
                            </div>
                            <a
                              className="inline-flex items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-200/60 hover:bg-emerald-400/20"
                              href={buildWhatsAppLinkForNewCatalog(item, usdRate)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Consultar por WhatsApp
                            </a>
                          </div>
                        </div>
                      ))
                    : inStock.map((product) => {
                        const usedDetails = parseUsedPhoneDetails(
                          ensureIphonePrefix(resolveProductName(product)),
                        )
                        return (
                          <div
                            key={product.id}
                            className={cn(
                              "group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/20 transition-all duration-300 hover:-translate-y-1 hover:border-white/20",
                              "before:absolute before:inset-0 before:bg-gradient-to-br before:opacity-0 before:transition-opacity before:duration-300 group-hover:before:opacity-100",
                              `before:${catalogType.accent}`,
                            )}
                          >
                            <div className="relative space-y-4">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                                    {catalogType.title}
                                  </p>
                                  <h3 className="text-lg font-semibold text-white">
                                    {usedDetails.displayName}
                                  </h3>
                                  {(usedDetails.batteryCondition ||
                                    usedDetails.color ||
                                    usedDetails.memory ||
                                    usedDetails.warranty) && (
                                    <div className="mt-3 grid gap-2 text-sm text-slate-300">
                                      {usedDetails.batteryCondition && (
                                        <div className="flex items-center justify-between gap-3">
                                          <span className="text-xs text-slate-400">
                                            Condición de batería
                                          </span>
                                          <span className="font-medium text-slate-100">
                                            {usedDetails.batteryCondition}
                                          </span>
                                        </div>
                                      )}
                                      {usedDetails.color && (
                                        <div className="flex items-center justify-between gap-3">
                                          <span className="text-xs text-slate-400">Color</span>
                                          <span className="font-medium text-slate-100">
                                            {usedDetails.color}
                                          </span>
                                        </div>
                                      )}
                                      {usedDetails.memory && (
                                        <div className="flex items-center justify-between gap-3">
                                          <span className="text-xs text-slate-400">Memoria</span>
                                          <span className="font-medium text-slate-100">
                                            {usedDetails.memory}
                                          </span>
                                        </div>
                                      )}
                                      {usedDetails.warranty && (
                                        <div className="flex items-center justify-between gap-3">
                                          <span className="text-xs text-slate-400">
                                            Garantía oficial hasta:
                                          </span>
                                          <span className="font-medium text-slate-100">
                                            {usedDetails.warranty}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="rounded-2xl bg-white/10 px-3 py-1 text-xs text-slate-200">
                                  Stock: {product.stock ?? 0}
                                </div>
                              </div>

                              <div className="grid gap-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-xs text-slate-400">Precio USD</p>
                                    <p className="text-lg font-semibold text-sky-200">
                                      {formatUsdPrice(product.price, usdRate)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between border-t border-white/10 pt-3 text-sm text-slate-200">
                                  <span className="text-xs text-slate-400">Precio en pesos actual</span>
                                  <span className="font-semibold text-emerald-200">
                                    {formatArsPriceBlue(product.price, usdRate)}
                                  </span>
                                </div>
                              </div>
                              <a
                                className="inline-flex items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-200/60 hover:bg-emerald-400/20"
                                href={buildWhatsAppLink(product, usdRate)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Consultar por WhatsApp
                              </a>
                            </div>
                          </div>
                        )
                      })}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>

      {isAuthPanelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/80"
            onClick={() => setIsAuthPanelOpen(false)}
            aria-label="Cerrar panel"
          />
          <div className="relative w-full max-w-md">
            {authPanel}
          </div>
        </div>
      )}

      {isProfileOpen && currentCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/80"
            onClick={() => setIsProfileOpen(false)}
            aria-label="Cerrar perfil"
          />
          <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-slate-950/90 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Mi perfil</p>
                <h2 className="text-xl font-semibold text-white">
                  {currentCustomer.name || currentCustomer.email || "Cliente"}
                </h2>
                <p className="text-sm text-slate-300">{currentCustomer.email}</p>
              </div>
              <button
                type="button"
                className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-200 hover:border-white/20"
                onClick={() => setIsProfileOpen(false)}
                aria-label="Cerrar perfil"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[70vh] space-y-6 overflow-y-auto px-6 py-6">
              {!pointsPaused && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                    Puntos disponibles
                  </p>
                  <p className="text-2xl font-semibold text-emerald-200">
                    {currentCustomer.points ?? 0} puntos
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Historial de compras</h3>
                  <span className="text-sm text-slate-400">
                    {customerSales.length} operaciones
                  </span>
                </div>
                {customerSales.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center text-sm text-slate-400">
                    Todavía no registramos compras asociadas a tu cuenta.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {customerSales.map((sale) => (
                      <div
                        key={sale.id}
                        className="rounded-2xl border border-white/10 bg-white/5 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-white">
                            Compra #{sale.id.slice(-6)}
                          </p>
                          <p className="text-xs text-slate-400">{formatSaleDate(sale.date)}</p>
                        </div>
                        <div className="mt-3 space-y-2 text-sm text-slate-300">
                          {(sale.items ?? []).length > 0 ? (
                            <ul className="space-y-1">
                              {sale.items?.map((item, index) => (
                                <li key={`${sale.id}-${index}`} className="flex justify-between">
                                  <span>{item.productName || "Producto"}</span>
                                  <span className="text-slate-400">x{item.quantity ?? 1}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-slate-400">Sin detalle de productos.</p>
                          )}
                        </div>
                        <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-sm">
                          <span className="text-slate-400">Total</span>
                          <span className="font-semibold text-emerald-200">
                            {formatCurrency(Number(sale.totalAmount ?? 0))}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
