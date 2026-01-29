"use client"

import { useEffect, useMemo, useState } from "react"
import { ref, onValue } from "firebase/database"
import { Smartphone, Sparkles, ShieldCheck, Globe } from "lucide-react"

import { database } from "@/lib/firebase"
import { convertPriceToUSD, formatUsdCurrency } from "@/lib/price-converter"
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
  [key: string]: any
}

const CATEGORY_NEW = "Celulares Nuevos"
const CATEGORY_USED = "Celulares Usados"

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

export default function PublicStockPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [usdRate, setUsdRate] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const productsRef = ref(database, "products")
    const usdRateRef = ref(database, "config/usdRate")

    const unsubscribeProducts = onValue(
      productsRef,
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
      },
      () => {
        setLoading(false)
      },
    )

    const unsubscribeRate = onValue(usdRateRef, (snapshot) => {
      const value = snapshot.val()
      setUsdRate(typeof value === "number" ? value : 0)
    })

    return () => {
      unsubscribeProducts()
      unsubscribeRate()
    }
  }, [])

  const { newPhones, usedPhones } = useMemo(() => {
    const inStock = products.filter((product) => (product.stock ?? 0) > 0)
    return {
      newPhones: inStock.filter((product) => product.category === CATEGORY_NEW),
      usedPhones: inStock.filter((product) => product.category === CATEGORY_USED),
    }
  }, [products])

  const sections = [
    { title: "Celulares Nuevos", data: newPhones, accent: "from-sky-500/20 to-blue-500/5" },
    { title: "Celulares Usados", data: usedPhones, accent: "from-emerald-500/20 to-green-500/5" },
  ]

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
                <h1 className="text-3xl font-semibold">Catálogo de celulares</h1>
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
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="max-w-2xl space-y-4">
              <p className="text-lg text-slate-200">
                Consultá precios actualizados en USD y disponibilidad de equipos nuevos y usados. Solo
                mostramos información esencial para resguardar la privacidad de cada dispositivo.
              </p>
              <div className="flex flex-wrap gap-3 text-sm text-slate-300">
                <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
                  <Sparkles className="h-4 w-4 text-sky-300" />
                  Precios en USD
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                  Últimos 4 dígitos de IMEI
                </span>
              </div>
            </div>
          </div>
        </header>
      </div>

      <main className="mx-auto w-full max-w-6xl px-6 pb-20">
        {loading ? (
          <div className="flex items-center justify-center rounded-3xl border border-white/10 bg-white/5 p-12 text-slate-300">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-400 border-t-transparent" />
            <span className="ml-4">Cargando stock en tiempo real...</span>
          </div>
        ) : (
          <div className="space-y-12">
            {sections.map((section) => (
              <section key={section.title} className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold">{section.title}</h2>
                    <p className="text-sm text-slate-400">
                      {section.data.length} equipos disponibles
                    </p>
                  </div>
                </div>

                {section.data.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-10 text-center text-slate-400">
                    No hay equipos disponibles por el momento.
                  </div>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {section.data.map((product) => (
                      <div
                        key={product.id}
                        className={cn(
                          "group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/20 transition-all duration-300 hover:-translate-y-1 hover:border-white/20",
                          "before:absolute before:inset-0 before:bg-gradient-to-br before:opacity-0 before:transition-opacity before:duration-300 group-hover:before:opacity-100",
                          `before:${section.accent}`,
                        )}
                      >
                        <div className="relative space-y-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                                {section.title}
                              </p>
                              <h3 className="text-lg font-semibold text-white">
                                {resolveProductName(product)}
                              </h3>
                            </div>
                            <div className="rounded-2xl bg-white/10 px-3 py-1 text-xs text-slate-200">
                              Stock: {product.stock ?? 0}
                            </div>
                          </div>

                          <div className="flex items-end justify-between">
                            <div>
                              <p className="text-xs text-slate-400">IMEI</p>
                              <p className="text-sm font-medium text-slate-100">
                                {formatImeiSuffix(product.imei)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-slate-400">Precio</p>
                              <p className="text-lg font-semibold text-sky-200">
                                {formatUsdPrice(product.price, usdRate)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
