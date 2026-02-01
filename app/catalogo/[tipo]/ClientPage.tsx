"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, type FormEvent } from "react"
import { ref, onValue, query, orderByChild, equalTo, get, push, set, update } from "firebase/database"
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Globe,
  IdCard,
  Mail,
  Menu,
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
import { database } from "@/lib/firebase"
import { convertPriceToUSD, formatCurrency, formatUsdCurrency } from "@/lib/price-converter"
import { cn } from "@/lib/utils"

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

const CATEGORY_NEW = "Celulares Nuevos"
const CATEGORY_USED = "Celulares Usados"
const CATALOG_CACHE_TTL_MS = 10 * 60 * 1000
const CATALOG_BLUE_SURCHARGE = 10
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

const formatImeiSuffix = (imei?: string) => {
  if (!imei) return "Sin IMEI"
  const clean = imei.replace(/\s+/g, "")
  const suffix = clean.slice(-4)
  return suffix ? `**** ${suffix}` : "Sin IMEI"
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
  const name = resolveProductName(product)
  const usdPrice = formatUsdPrice(product.price, usdRate)
  const arsPrice = formatArsPriceBlue(product.price, usdRate)
  const imeiSuffix = formatImeiSuffix(product.imei)
  const message = `Hola estoy interesado en el siguiente celular: ${name}. Precio USD: ${usdPrice}. Precio en pesos: ${arsPrice}. IMEI: ${imeiSuffix}.`
  const encodedMessage = encodeURIComponent(message)
  return `https://wa.me/5493584224464?text=${encodedMessage}`
}

export default function PublicStockClient({ params }: { params: { tipo: string } }) {
  const catalogType = CATALOG_TYPES[params.tipo as CatalogTypeKey]
  const cacheKey = catalogType ? `catalog-cache-${catalogType.key}` : "catalog-cache"

  const [products, setProducts] = useState<Product[]>([])
  const [usdRate, setUsdRate] = useState(0)
  const [loading, setLoading] = useState(true)
  const [catalogVisibility, setCatalogVisibility] = useState({
    newPhones: true,
    usedPhones: true,
  })
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [purchaseStatus, setPurchaseStatus] = useState<"yes" | "no">("no")
  const [registration, setRegistration] = useState({
    dni: "",
    name: "",
    email: "",
  })
  const [matchedCustomer, setMatchedCustomer] = useState<{ id: string; name: string } | null>(null)
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!catalogType) return
    const cached = readCatalogCache(cacheKey)
    if (!cached) return

    if (Array.isArray(cached.products)) {
      setProducts(cached.products)
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
    if (!catalogType) return
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

        setProducts(nextProducts)
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
    const fetchDolarBlue = async () => {
      try {
        const response = await fetch("/api/dolar-blue")
        if (!response.ok) {
          throw new Error("No se pudo obtener la cotización")
        }
        const data = await response.json()
        const nextRate =
          typeof data.venta === "number" ? data.venta + CATALOG_BLUE_SURCHARGE : 0
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
  }, [cacheKey, catalogType])

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
          publicAccess: true,
          publicAccessUpdatedAt: new Date().toISOString(),
        })
        toast.success("Usuario actualizado.", {
          description: "Ya podés acceder a tu historial de compras.",
        })
      } else {
        const newCustomerRef = push(customersRef)
        if (!newCustomerRef.key) {
          throw new Error("No se pudo generar el nuevo usuario.")
        }

        const payload: Record<string, string | boolean> = {
          name: normalizedName,
          email: normalizedEmail,
          createdAt: new Date().toISOString(),
          publicAccess: true,
          hasPurchased: purchaseStatus === "yes",
        }

        if (normalizedDni) {
          payload.dni = normalizedDni
        }

        await set(newCustomerRef, payload)
        toast.success("Usuario creado correctamente.", {
          description: "Te avisaremos cuando tu cuenta esté lista para usar.",
        })
      }

      setRegistration({ dni: "", name: "", email: "" })
      setMatchedCustomer(null)
      setPurchaseStatus("no")
    } catch (error) {
      console.error("Error al registrar usuario:", error)
      toast.error("No pudimos crear el usuario. Intentá de nuevo.")
    } finally {
      setIsSubmitting(false)
    }
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

  const isSectionVisible = useMemo(() => {
    if (!catalogType) return false
    if (catalogType.key === "nuevos") return catalogVisibility.newPhones
    return catalogVisibility.usedPhones
  }, [catalogType, catalogVisibility])

  const alternateType = catalogType?.key === "nuevos" ? CATALOG_TYPES.usados : CATALOG_TYPES.nuevos

  const registrationPanel = (
    <div className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/20">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Opciones</p>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10">
            <UserPlus className="h-5 w-5 text-emerald-300" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Crear usuario</h2>
            <p className="text-sm text-slate-300">
              Registrate para guardar tu historial y recibir novedades.
            </p>
          </div>
        </div>
      </div>

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
            onChange={(event) => setRegistration((prev) => ({ ...prev, name: event.target.value }))}
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
            onChange={(event) => setRegistration((prev) => ({ ...prev, email: event.target.value }))}
            placeholder="correo@ejemplo.com"
            className="border-white/10 bg-slate-950/60 text-white placeholder:text-slate-500"
            required
          />
          <p className="flex items-center gap-2 text-xs text-slate-400">
            <Mail className="h-4 w-4" />
            Usamos el email para validar tu cuenta.
          </p>
        </div>

        <Button
          type="submit"
          className="w-full rounded-xl bg-emerald-500 text-white hover:bg-emerald-400"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creando usuario..." : "Crear usuario"}
        </Button>
      </form>
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
        <header className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 pb-16 pt-12">
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
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
              <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
                <Globe className="h-4 w-4" />
                Disponible en tiempo real
              </span>
              <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
                <ShieldCheck className="h-4 w-4" />
                Datos protegidos
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 lg:hidden"
                onClick={() => setIsSidebarOpen(true)}
                aria-expanded={isSidebarOpen}
                aria-label="Abrir opciones"
              >
                <Menu className="h-4 w-4" />
                Opciones
              </button>
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
                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                  Últimos 4 dígitos de IMEI
                </span>
              </div>
            </div>
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
          </div>
        </header>
      </div>

      <main className="mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
          <div className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center rounded-3xl border border-white/10 bg-white/5 p-12 text-slate-300">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-400 border-t-transparent" />
                <span className="ml-4">Cargando stock en tiempo real...</span>
              </div>
            ) : !isSectionVisible ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-10 text-center text-slate-400">
                Esta sección no está disponible por el momento.
              </div>
            ) : inStock.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-10 text-center text-slate-400">
                No hay equipos disponibles por el momento.
              </div>
            ) : (
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold">{catalogType.title}</h2>
                    <p className="text-sm text-slate-400">{inStock.length} equipos disponibles</p>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {inStock.map((product) => (
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
                              {resolveProductName(product)}
                            </h3>
                          </div>
                          <div className="rounded-2xl bg-white/10 px-3 py-1 text-xs text-slate-200">
                            Stock: {product.stock ?? 0}
                          </div>
                        </div>

                        <div className="grid gap-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-slate-400">IMEI</p>
                              <p className="text-sm font-medium text-slate-100">
                                {formatImeiSuffix(product.imei)}
                              </p>
                            </div>
                            <div className="text-right">
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
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="hidden w-full max-w-sm flex-shrink-0 lg:block">
            {registrationPanel}
          </aside>
        </div>
      </main>

      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/80"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Cerrar opciones"
          />
          <div className="relative ml-auto h-full w-full max-w-sm overflow-y-auto border-l border-white/10 bg-slate-950 px-6 py-8 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm uppercase tracking-[0.28em] text-slate-400">Opciones</p>
              <button
                type="button"
                className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-200 hover:border-white/20"
                onClick={() => setIsSidebarOpen(false)}
                aria-label="Cerrar menú"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {registrationPanel}
          </div>
        </div>
      )}
    </div>
  )
}
