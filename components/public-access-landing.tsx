"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ref, onValue } from "firebase/database"
import { ArrowRight, ShieldCheck, Smartphone, Sparkles, Speaker } from "lucide-react"

import PublicTopBar from "@/components/public-top-bar"
import { database } from "@/lib/firebase"
import { fetchPublicRealtimeValue } from "@/lib/public-realtime"
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
  {
    title: "Gaming y audio",
    description: "Descubrí parlantes, auriculares y accesorios JBL listos para entrega.",
    href: "/catalogo/gaming-audio",
    accent: "from-fuchsia-500/20 via-purple-400/5 to-transparent",
    icon: Speaker,
  },
]

export default function PublicAccessLanding() {
  const [offers, setOffers] = useState<string[]>([])
  const [catalogAd, setCatalogAd] = useState<CatalogAdConfig | null>(null)
  const [catalogBottomAd, setCatalogBottomAd] = useState<CatalogAdConfig | null>(null)
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
    let isMounted = true

    const bindCatalogAd = (
      adPath: string,
      onSync: (config: CatalogAdConfig | null) => void,
    ) => {
      const syncAd = (value: unknown) => {
        if (!isMounted) return
        if (!value) {
          onSync(null)
          return
        }
        onSync(normalizeCatalogAdConfig(value))
      }

      fetchPublicRealtimeValue<unknown>(adPath).then(syncAd)

      const adRef = ref(database, adPath)
      return onValue(
        adRef,
        (snapshot) => {
          syncAd(snapshot.val())
        },
        () => {
          fetchPublicRealtimeValue<unknown>(adPath).then(syncAd)
        },
      )
    }

    const unsubscribeTopAd = bindCatalogAd("config/catalogAds/landing", setCatalogAd)
    const unsubscribeBottomAd = bindCatalogAd("config/catalogAds/landingBottom", setCatalogBottomAd)

    return () => {
      isMounted = false
      unsubscribeTopAd()
      unsubscribeBottomAd()
    }
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
            <div className="ml-auto flex flex-nowrap items-center gap-3 whitespace-nowrap text-sm text-slate-300">
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
                <h1 className="text-4xl font-semibold">Catálogo de iMarket</h1>
              </div>
            </div>
            <div className="max-w-2xl space-y-4 text-lg text-slate-200">
              <p>
                Elegí la tecnología que va con vos. 📱🔊 Te damos la bienvenida a nuestro catálogo
                digital. Aquí vas a encontrar celulares y accesorios JBL con stock actualizado.
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

          <section className="grid items-center gap-10 rounded-3xl border border-white/10 bg-white/5 p-8 md:grid-cols-[1.1fr,0.9fr]">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Experiencia minimalista
              </p>
              <h2 className="text-3xl font-semibold text-white">
                Animaciones suaves para destacar lo esencial.
              </h2>
              <p className="text-sm text-slate-300">
                Un toque dinámico para que el catálogo se sienta vivo: microinteracciones, brillo
                sutil y un gesto clásico de “enchufar y cargar” que mantiene la estética limpia.
              </p>
              <div className="flex flex-wrap gap-3 text-xs text-slate-300">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  Movimiento sutil
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  Sin ruido visual
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  Claridad y foco
                </span>
              </div>
            </div>
            <div className="relative mx-auto flex h-64 w-full max-w-sm items-center justify-center">
              <div className="absolute inset-0 rounded-[32px] bg-[radial-gradient(circle_at_center,_rgba(56,189,248,0.18),transparent_65%)]" />
              <div className="relative h-56 w-56">
                <div className="absolute left-10 top-3 h-44 w-24 rounded-[28px] border border-white/15 bg-slate-900/70 shadow-[0_10px_30px_rgba(15,23,42,0.5)] animate-phone-float">
                  <div className="absolute left-2 top-2 h-3 w-8 rounded-full bg-white/10" />
                  <div className="absolute inset-3 rounded-[22px] bg-gradient-to-br from-slate-800 via-slate-900 to-black/80 animate-charge-pulse" />
                  <div className="absolute bottom-3 left-7 h-2 w-10 rounded-full bg-emerald-300/40" />
                </div>
                <div className="absolute left-0 bottom-6 h-1.5 w-28 rounded-full bg-white/20 animate-cable-pulse" />
                <div className="absolute -left-4 bottom-2 h-12 w-16 rounded-2xl border border-white/20 bg-slate-900/80 animate-plug-in">
                  <div className="absolute inset-3 rounded-xl bg-slate-800/80" />
                  <div className="absolute right-3 top-4 h-4 w-1 rounded-full bg-emerald-300/70" />
                  <div className="absolute right-6 top-4 h-4 w-1 rounded-full bg-emerald-300/70" />
                </div>
                <div className="absolute left-24 top-1 h-3 w-3 rounded-full bg-sky-300/60 blur-[0.5px] animate-spark" />
                <div className="absolute left-4 top-14 h-2 w-2 rounded-full bg-emerald-300/50 blur-[0.5px] animate-spark [animation-delay:0.6s]" />
                <div className="absolute right-6 top-10 h-2.5 w-2.5 rounded-full bg-white/40 blur-[0.5px] animate-spark [animation-delay:1.2s]" />
              </div>
            </div>
          </section>

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

          <section className="order-3">
            <Link
              href="/cuidado-iphone"
              className="group relative flex flex-col gap-6 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-8 transition hover:-translate-y-1 hover:border-emerald-300/60 md:flex-row md:items-center md:justify-between"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.25),transparent_45%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="relative flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-200">
                  <ShieldCheck className="h-7 w-7" />
                </div>
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/80">
                    Guía recomendada
                  </p>
                  <h2 className="text-2xl font-semibold text-white">
                    Cómo cuidar tu iPhone en el día a día
                  </h2>
                  <p className="max-w-2xl text-sm text-slate-300">
                    Consejos claros sobre batería, limpieza, accesorios y seguridad para mantener
                    tu equipo como nuevo.
                  </p>
                </div>
              </div>
              <span className="relative inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">
                Ver recomendaciones
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </Link>
          </section>
        </div>
        <CatalogAd config={catalogBottomAd} className="mt-2" />

        <footer className="mt-16 text-center text-xs text-slate-400">
          sitio creado por Grupo iMarket. Todos los derechos reservados
        </footer>
      </div>
    </div>
  )
}
