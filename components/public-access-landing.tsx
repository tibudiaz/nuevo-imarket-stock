"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ref, onValue } from "firebase/database"
import {
  ArrowRight,
  BatteryCharging,
  Headphones,
  Rocket,
  Shield,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Speaker,
  Trophy,
  Zap,
} from "lucide-react"

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
  const [gameActive, setGameActive] = useState(false)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [energy, setEnergy] = useState(72)
  const [powerCells, setPowerCells] = useState(0)
  const [misses, setMisses] = useState(0)
  const [turboActive, setTurboActive] = useState(false)
  const [pulsePosition, setPulsePosition] = useState(10)
  const [targetZone, setTargetZone] = useState({ start: 35, end: 55 })
  const [statusMessage, setStatusMessage] = useState("Listo para despegar.")
  const [bestScore, setBestScore] = useState(0)
  const directionRef = useRef(1)
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

  useEffect(() => {
    if (typeof window === "undefined") return
    const storedScore = window.localStorage.getItem("turboPulseBestScore")
    if (!storedScore) return
    const parsed = Number(storedScore)
    if (!Number.isNaN(parsed)) {
      setBestScore(parsed)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (score <= bestScore) return
    setBestScore(score)
    window.localStorage.setItem("turboPulseBestScore", String(score))
  }, [bestScore, score])

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

  const level = useMemo(() => Math.min(5, Math.floor(score / 80) + 1), [score])
  const baseSpeed = useMemo(() => 0.8 + level * 0.6, [level])
  const pulseSpeed = useMemo(() => (turboActive ? baseSpeed * 1.35 : baseSpeed), [baseSpeed, turboActive])
  const isInZone = useMemo(
    () => pulsePosition >= targetZone.start && pulsePosition <= targetZone.end,
    [pulsePosition, targetZone],
  )
  const comboProgress = useMemo(() => Math.min((streak / 6) * 100, 100), [streak])
  const signalStrength = useMemo(() => Math.max(1, Math.min(5, Math.ceil(energy / 20))), [energy])
  const heatLevel = useMemo(() => Math.min(100, misses * 22 + (100 - energy) * 0.4), [misses, energy])
  const deviceMode = useMemo(() => {
    if (turboActive) return "Modo hiper"
    if (streak >= 6) return "Modo brillo"
    if (energy < 25) return "Modo ahorro"
    if (level >= 4) return "Modo ultra"
    return "Modo normal"
  }, [energy, level, streak, turboActive])
  const levelLabel = useMemo(() => {
    if (level >= 5) return "Modo leyenda"
    if (level >= 4) return "Nivel estelar"
    if (level >= 3) return "Nivel turbo"
    if (level >= 2) return "Nivel avanzado"
    return "Nivel inicial"
  }, [level])
  const powerReady = powerCells >= 3

  useEffect(() => {
    if (!gameActive) return

    const interval = window.setInterval(() => {
      setPulsePosition((previous) => {
        let next = previous + pulseSpeed * directionRef.current
        if (next >= 100) {
          next = 100
          directionRef.current = -1
        }
        if (next <= 0) {
          next = 0
          directionRef.current = 1
        }
        return next
      })
    }, 60)

    return () => window.clearInterval(interval)
  }, [gameActive, pulseSpeed])

  useEffect(() => {
    if (!gameActive) return

    const drain = window.setInterval(() => {
      setEnergy((previous) => {
        const next = Math.max(previous - 1, 0)
        if (next === 0) {
          setGameActive(false)
          setStatusMessage("Energía agotada. Reiniciá para volver a jugar.")
        }
        return next
      })
    }, turboActive ? 800 : 1000)

    return () => window.clearInterval(drain)
  }, [gameActive, turboActive])

  useEffect(() => {
    if (!turboActive) return
    const timeout = window.setTimeout(() => {
      setTurboActive(false)
      setStatusMessage("Turbo finalizado. Volvé a cargar células.")
    }, 4000)

    return () => window.clearTimeout(timeout)
  }, [turboActive])

  const resetGame = () => {
    setScore(0)
    setStreak(0)
    setEnergy(72)
    setPowerCells(0)
    setMisses(0)
    setTurboActive(false)
    setPulsePosition(10)
    setTargetZone({ start: 35, end: 55 })
    setStatusMessage("Listo para despegar.")
    directionRef.current = 1
  }

  const startGame = () => {
    resetGame()
    setGameActive(true)
  }

  const handleBoost = () => {
    if (!gameActive) return

    if (isInZone) {
      setScore((previous) => previous + 10 + streak * 2 + level * 3 + (turboActive ? 12 : 0))
      setStreak((previous) => previous + 1)
      setPowerCells((previous) => Math.min(previous + 1, 3))
      setMisses(0)
      setEnergy((previous) => Math.min(previous + 8, 100))
      setStatusMessage("¡Combo perfecto! La batería se carga al máximo.")
    } else {
      setStreak(0)
      setMisses((previous) => previous + 1)
      setPowerCells((previous) => Math.max(previous - 1, 0))
      setEnergy((previous) => Math.max(previous - 12, 0))
      setStatusMessage("Señal inestable. Ajustá el timing para el próximo impulso.")
    }

    const zoneSize = 18 - Math.min(level * 2, 8)
    const zoneStart = Math.floor(Math.random() * (100 - zoneSize))
    setTargetZone({ start: zoneStart, end: zoneStart + zoneSize })
  }

  const handleTurboCharge = () => {
    if (!gameActive || !powerReady) return
    setTurboActive(true)
    setPowerCells(0)
    setEnergy((previous) => Math.min(previous + 18, 100))
    setScore((previous) => previous + 25 + level * 6)
    setStatusMessage("Turbo 5G activado. ¡Doble velocidad y puntos!")
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

          <section className="order-4">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.25),transparent_50%),radial-gradient(circle_at_bottom,_rgba(244,114,182,0.2),transparent_45%)]" />
              <div className="pointer-events-none absolute -left-24 top-10 h-56 w-56 rounded-full bg-sky-500/20 blur-3xl" />
              <div className="pointer-events-none absolute -right-16 bottom-6 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />
              <div className="relative flex flex-col gap-8">
                <div className="flex flex-col gap-3">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Minijuego</p>
                  <h2 className="text-2xl font-semibold text-white">
                    Turbo Pulse: carrera de señal 5G
                  </h2>
                  <p className="max-w-2xl text-sm text-slate-300">
                    Cronometrá el impulso, mantené la energía alta y acumulá combos. Encadená
                    células de carga para activar el turbo 5G y convertir el teléfono en una
                    superpotencia de puntos.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-200">
                    <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">
                      {levelLabel}
                    </span>
                    <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-emerald-100">
                      Bonus +{Math.min(streak * 2, 20)} pts
                    </span>
                    <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-sky-100">
                      Velocidad x{pulseSpeed.toFixed(1)}
                    </span>
                    <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-1 text-fuchsia-100">
                      {deviceMode}
                    </span>
                  </div>
                </div>
                <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
                  <div className="space-y-6 rounded-2xl border border-white/10 bg-slate-950/50 p-6 shadow-[0_0_40px_rgba(56,189,248,0.2)]">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                          Energía
                        </p>
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-40 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-sky-400 to-fuchsia-400 transition-all"
                              style={{ width: `${energy}%` }}
                            />
                          </div>
                          <span className="text-sm text-slate-200">{energy}%</span>
                        </div>
                      </div>
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/20 text-sky-200 ${
                          turboActive ? "animate-pulse shadow-[0_0_20px_rgba(56,189,248,0.7)]" : ""
                        }`}
                      >
                        <Rocket className="h-6 w-6" />
                      </div>
                    </div>
                    <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                          Señal 5G
                        </p>
                        <div className="flex items-end gap-1">
                          {Array.from({ length: 5 }).map((_, index) => (
                            <span
                              key={`signal-${index}`}
                              className={`w-2 rounded-full transition-all ${
                                index < signalStrength
                                  ? "bg-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.7)]"
                                  : "bg-white/10"
                              }`}
                              style={{ height: `${6 + index * 4}px` }}
                            />
                          ))}
                        </div>
                        <p className="text-xs text-slate-300">Conexión lista para el boost.</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                          Temperatura
                        </p>
                        <div className="h-2 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-sky-400 via-amber-300 to-rose-400 transition-all"
                            style={{ width: `${heatLevel}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-300">
                          {heatLevel > 65 ? "Dispositivo exigido. Bajá la presión." : "Zona segura."}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
                        <span>Combo activo</span>
                        <span>{streak}x</span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 via-sky-400 to-emerald-300 transition-all"
                          style={{ width: `${comboProgress}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-slate-300">
                        Sumá 6 combos para encender el modo brillo.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
                        <span>Zona de impulso</span>
                        <span>Nivel {level}</span>
                      </div>
                      <div className="relative h-3 w-full rounded-full bg-white/10">
                        <div
                          className="absolute top-0 h-full rounded-full bg-emerald-400/40 shadow-[0_0_12px_rgba(16,185,129,0.6)]"
                          style={{
                            left: `${targetZone.start}%`,
                            width: `${targetZone.end - targetZone.start}%`,
                          }}
                        />
                        <div
                          className={`absolute -top-1 h-5 w-2 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.7)] transition-transform ${
                            isInZone ? "scale-y-110" : "scale-y-100"
                          }`}
                          style={{ left: `${pulsePosition}%` }}
                        />
                      </div>
                      <p className="text-sm text-slate-300">{statusMessage}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {gameActive ? (
                        <>
                          <button
                            type="button"
                            onClick={handleBoost}
                            className="inline-flex items-center gap-2 rounded-full bg-sky-500/20 px-5 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/30"
                          >
                            <Zap className="h-4 w-4" />
                            Impulsar
                          </button>
                          <button
                            type="button"
                            onClick={handleTurboCharge}
                            disabled={!powerReady}
                            className={`inline-flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-semibold transition ${
                              powerReady
                                ? "border-fuchsia-300/60 bg-fuchsia-500/20 text-fuchsia-100 hover:bg-fuchsia-500/30"
                                : "border-white/10 text-slate-400 opacity-60"
                            }`}
                          >
                            <Sparkles className="h-4 w-4" />
                            Turbo 5G
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setGameActive(false)
                              setStatusMessage("Pausa activa. Tocá reiniciar para volver.")
                            }}
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-2 text-sm text-slate-200 transition hover:border-white/30"
                          >
                            Pausar
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={startGame}
                            className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-5 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/30"
                          >
                            <BatteryCharging className="h-4 w-4" />
                            Iniciar partida
                          </button>
                          <button
                            type="button"
                            onClick={resetGame}
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-2 text-sm text-slate-200 transition hover:border-white/30"
                          >
                            Reiniciar
                          </button>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-xs text-slate-300">
                      <span className="inline-flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-sky-200" />
                        Células cargadas: {powerCells}/3
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <BatteryCharging className="h-4 w-4 text-emerald-200" />
                        {powerReady ? "Turbo listo" : "Cargá para desbloquear turbo"}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
                        Stats del reto
                      </p>
                      <Trophy className="h-5 w-5 text-slate-300" />
                    </div>
                    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-black p-4">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.25),transparent_55%)]" />
                      <div className="relative flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                            Panel del equipo
                          </p>
                          <p className="text-lg font-semibold text-white">{deviceMode}</p>
                          <p className="text-xs text-slate-300">Ajustá el pulso para evitar sobrecalentamiento.</p>
                        </div>
                        <div className="flex h-14 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                          <div className="h-10 w-6 rounded-xl bg-gradient-to-b from-sky-400/60 via-emerald-300/40 to-fuchsia-400/60 shadow-[0_0_20px_rgba(56,189,248,0.4)]" />
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-3">
                      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-sky-500/10 via-white/5 to-transparent p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                            Récord local
                          </p>
                          <Trophy className="h-4 w-4 text-sky-200" />
                        </div>
                        <p className="text-3xl font-semibold text-white">{bestScore}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                            Puntaje
                          </p>
                          <Sparkles className="h-4 w-4 text-sky-200" />
                        </div>
                        <p className="text-3xl font-semibold text-white">{score}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                            Racha
                          </p>
                          <Shield className="h-4 w-4 text-emerald-200" />
                        </div>
                        <p className="text-3xl font-semibold text-white">x{streak}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                            Bonus
                          </p>
                          <Headphones className="h-4 w-4 text-fuchsia-200" />
                        </div>
                        <p className="text-sm text-slate-300">
                          Bonus activo: +{Math.min(streak * 2, 20)} pts por impulso.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                            Turbos 5G
                          </p>
                          <Sparkles className="h-4 w-4 text-fuchsia-200" />
                        </div>
                        <p className="text-sm text-slate-300">
                          {powerReady
                            ? "Turbo listo para disparar. Potenciá el score."
                            : `Cargá ${3 - powerCells} células para desbloquear.`}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-xs text-slate-300">
                      Ajustá el timing para mantener el combo. Cada nivel acelera el pulso y exige
                      más precisión en la señal.
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
