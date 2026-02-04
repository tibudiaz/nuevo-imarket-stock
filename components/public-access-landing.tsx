"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ref, onValue } from "firebase/database"
import { ArrowRight, Smartphone, Sparkles } from "lucide-react"

import PublicTopBar from "@/components/public-top-bar"
import { database } from "@/lib/firebase"
import CatalogAd from "@/components/catalog-ad"
import { normalizeCatalogAdConfig, type CatalogAdConfig } from "@/lib/catalog-ads"

const landingOptions = [
  {
    title: "Celulares nuevos",
    description: "Explorá los últimos modelos con garantía oficial y stock actualizado.",
    href: "/catalogo/nuevos",
    accent: "from-emerald-400/20 via-emerald-300/5 to-transparent",
    icon: Sparkles,
  },
  {
    title: "Celulares usados",
    description: "Revisá el stock de equipos usados certificados y listos para entrega.",
    href: "/catalogo/usados",
    accent: "from-sky-500/20 via-sky-400/5 to-transparent",
    icon: Smartphone,
  },
]

export default function PublicAccessLanding() {
  const [offers, setOffers] = useState<string[]>([])
  const [catalogAd, setCatalogAd] = useState<CatalogAdConfig | null>(null)
  const [secretClickCount, setSecretClickCount] = useState(0)
  const router = useRouter()

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
    const adRef = ref(database, "config/catalogAds/landing")
    const unsubscribe = onValue(adRef, (snapshot) => {
      const data = snapshot.val()
      if (!data) {
        setCatalogAd(null)
        return
      }
      setCatalogAd(normalizeCatalogAdConfig(data))
    })

    return () => unsubscribe()
  }, [])

  const marqueeItems = offers.length
    ? offers
    : ["Promociones en tienda, cuotas y bonificaciones especiales."]

  const handleSecretDashboardAccess = () => {
    setSecretClickCount((previous) => {
      const next = previous + 1
      if (next >= 5) {
        router.push("/dashboard")
        return 0
      }
      return next
    })
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.22),transparent_45%),radial-gradient(circle_at_bottom,_rgba(16,185,129,0.18),transparent_40%)]" />
      <div className="absolute inset-0 opacity-40 [background:linear-gradient(120deg,_rgba(15,23,42,0.65)_0%,_rgba(2,6,23,0.9)_100%)]" />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 pb-20 pt-10">
        <PublicTopBar
          marqueeItems={marqueeItems}
          desktopContent={
            <>
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
                  <Sparkles className="h-4 w-4 text-sky-300" />
                  Stock actualizado
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                  Información segura y resumida
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                <Link
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 transition hover:border-white/20"
                  href="/catalogo/contacto"
                >
                  Contacto
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-slate-100 transition hover:border-emerald-300/60"
                  href="/catalogo/nuevos?auth=login"
                >
                  Iniciar sesión / Registrarse
                </Link>
              </div>
            </>
          }
          mobileContent={
            <div className="space-y-4">
              <div className="space-y-2 text-sm text-slate-200">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Accesos</p>
                <div className="grid gap-2">
                  <Link
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                    href="/catalogo/contacto"
                  >
                    Contacto
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
              <div className="space-y-2 text-sm text-slate-300">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Beneficios</p>
                <div className="grid gap-2">
                  <span className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                    Stock actualizado y precios en USD/ARS
                  </span>
                  <span className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                    Información segura y resumida
                  </span>
                </div>
              </div>
              <div className="space-y-2 text-sm text-slate-200">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Cuenta</p>
                <div className="grid gap-2">
                  <Link
                    className="flex items-center justify-between rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-slate-100"
                    href="/catalogo/nuevos?auth=login"
                  >
                    Iniciar sesión / Registrarse
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          }
        />
        <div className="flex flex-col gap-12">
          <header className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <button
                type="button"
                className="flex h-14 w-14 cursor-default items-center justify-center rounded-2xl bg-white/10"
                onClick={handleSecretDashboardAccess}
                aria-label="Acceso rápido al dashboard"
              >
                <Smartphone className="h-7 w-7 text-sky-300" />
              </button>
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">iMarket</p>
                <h1 className="text-4xl font-semibold">Catálogo de celulares</h1>
              </div>
            </div>
            <div className="max-w-2xl space-y-4 text-lg text-slate-200">
              <p>
                Elegí el equipo que va con vos. 📱 Te damos la bienvenida a nuestro catálogo digital.
                Aquí vas a encontrar la mejor tecnología, ya sea que busques el último modelo o una
                oportunidad seleccionada.
              </p>
              <p>¿Qué estás buscando hoy?</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
              <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
                <Sparkles className="h-4 w-4 text-sky-300" />
                Precios actualizados en USD y ARS
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                Información segura y resumida
              </span>
            </div>
          </header>

          <CatalogAd config={catalogAd} className="order-last md:order-3" />

          <section className="order-2 grid gap-6 md:order-2 md:grid-cols-2">
            {landingOptions.map((option) => {
              const Icon = option.icon
              return (
                <Link
                  key={option.title}
                  href={option.href}
                  className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 transition-all duration-300 hover:-translate-y-1 hover:border-white/20"
                >
                  <div
                    className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${option.accent} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
                  />
                  <div className="relative flex h-full flex-col gap-6">
                    <div className="flex items-center justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <span className="flex items-center gap-2 text-sm text-slate-300">
                        Ver catálogo
                        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                      </span>
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-2xl font-semibold text-white">{option.title}</h2>
                      <p className="text-sm text-slate-300">{option.description}</p>
                    </div>
                    <div className="mt-auto rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-xs text-slate-300">
                      Acceso rápido y datos en tiempo real.
                    </div>
                  </div>
                </Link>
              )
            })}
          </section>
        </div>
        <footer className="mt-16 text-center text-xs text-slate-400">
          sitio creado por Grupo iMarket. Todos los derechos reservados
        </footer>
      </div>
    </div>
  )
}
