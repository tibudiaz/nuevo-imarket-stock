"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ref, onValue } from "firebase/database"
import {
  ArrowRight,
  Gamepad2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Speaker,
  Trophy,
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
  const [playerY, setPlayerY] = useState(0)
  const [playerX, setPlayerX] = useState(12)
  const [obstacleX, setObstacleX] = useState(110)
  const [obstacleHeight, setObstacleHeight] = useState(24)
  const [speed, setSpeed] = useState(2.8)
  const [statusMessage, setStatusMessage] = useState(
    "Usá las flechas o tocá los botones para moverte.",
  )
  const [bestScore, setBestScore] = useState(0)
  const velocityRef = useRef(0)
  const playerYRef = useRef(0)
  const playerXRef = useRef(12)
  const directionRef = useRef<0 | -1 | 1>(0)
  const obstacleXRef = useRef(110)
  const obstacleHeightRef = useRef(24)
  const speedRef = useRef(2.8)
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
    const storedScore = window.localStorage.getItem("pixelRunBestScore")
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
    window.localStorage.setItem("pixelRunBestScore", String(score))
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

  const difficultyLabel = useMemo(() => {
    if (score >= 40) return "Turbo pro"
    if (score >= 25) return "Ritmo alto"
    if (score >= 10) return "Modo runner"
    return "Modo casual"
  }, [score])

  useEffect(() => {
    if (!gameActive) return

    const interval = window.setInterval(() => {
      const moveSpeed = 1.8
      const nextPlayerX = Math.min(
        98,
        Math.max(4, playerXRef.current + directionRef.current * moveSpeed),
      )
      playerXRef.current = nextPlayerX
      setPlayerX(nextPlayerX)

      velocityRef.current -= 0.9
      let nextPlayerY = playerYRef.current + velocityRef.current
      if (nextPlayerY < 0) {
        nextPlayerY = 0
        velocityRef.current = 0
      }
      playerYRef.current = nextPlayerY
      setPlayerY(nextPlayerY)

      let nextObstacleX = obstacleXRef.current - speedRef.current
      if (nextObstacleX < -12) {
        nextObstacleX = 110
        const nextHeight = 16 + Math.floor(Math.random() * 28)
        obstacleHeightRef.current = nextHeight
        setObstacleHeight(nextHeight)
        setScore((previous) => previous + 1)
      }
      obstacleXRef.current = nextObstacleX
      setObstacleX(nextObstacleX)

      const playerSize = 10
      const obstacleWidth = 10
      const hit =
        nextObstacleX < playerXRef.current + playerSize &&
        nextObstacleX + obstacleWidth > playerXRef.current &&
        nextPlayerY < obstacleHeightRef.current + 8
      if (hit) {
        setGameActive(false)
        setStatusMessage("¡Oh no! Volvé a intentarlo para rescatar la estrella.")
      }
    }, 45)

    return () => window.clearInterval(interval)
  }, [gameActive])

  useEffect(() => {
    const nextSpeed = Math.min(6, 2.8 + score * 0.08)
    setSpeed(nextSpeed)
    speedRef.current = nextSpeed
  }, [score])

  const resetGame = () => {
    setScore(0)
    setPlayerY(0)
    setPlayerX(12)
    setObstacleX(110)
    setObstacleHeight(24)
    setSpeed(2.8)
    setStatusMessage("Listo. Usá flechas o botones para moverte.")
    velocityRef.current = 0
    playerYRef.current = 0
    playerXRef.current = 12
    directionRef.current = 0
    obstacleXRef.current = 110
    obstacleHeightRef.current = 24
    speedRef.current = 2.8
  }

  const startGame = () => {
    resetGame()
    setGameActive(true)
    setStatusMessage("¡Aventura en marcha! Saltá con ↑ y esquivá con ← →.")
  }

  const handleJump = () => {
    if (!gameActive) return
    velocityRef.current = 12
    setStatusMessage("¡Saltaste como un campeón!")
  }

  const handleDirection = (direction: -1 | 0 | 1) => {
    directionRef.current = direction
  }

  useEffect(() => {
    if (typeof window === "undefined") return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!gameActive) return
      if (event.key === "ArrowLeft") handleDirection(-1)
      if (event.key === "ArrowRight") handleDirection(1)
      if (event.key === "ArrowUp" || event.key === " ") handleJump()
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" && directionRef.current === -1) handleDirection(0)
      if (event.key === "ArrowRight" && directionRef.current === 1) handleDirection(0)
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [gameActive])

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
                    Reino Pixel: aventura estilo Mario
                  </h2>
                  <p className="max-w-2xl text-sm text-slate-300">
                    Inspirado en los clásicos plataformas. Usá ← → para moverte, ↑ para saltar y
                    esquivar los tubos verdes. En celular aparecen los botones para controlar al
                    héroe.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-200">
                    <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">
                      {difficultyLabel}
                    </span>
                    <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-sky-100">
                      Velocidad x{speed.toFixed(1)}
                    </span>
                    <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-emerald-100">
                      Flechas + botones
                    </span>
                  </div>
                </div>
                <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-5 rounded-2xl border border-white/10 bg-slate-950/60 p-6 shadow-[0_0_40px_rgba(56,189,248,0.2)]">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                          Runner móvil
                        </p>
                        <h3 className="text-lg font-semibold text-white">Zona de juego</h3>
                      </div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-200">
                        <Gamepad2 className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="relative mx-auto h-[420px] w-[240px] overflow-hidden rounded-[32px] border border-white/20 bg-slate-900/80 shadow-[0_0_30px_rgba(56,189,248,0.25)]">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.28),transparent_55%),radial-gradient(circle_at_bottom,_rgba(16,185,129,0.25),transparent_45%)]" />
                      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-slate-950 via-slate-900/80 to-transparent" />
                      <div className="absolute left-10 top-10 h-6 w-16 rounded-full bg-white/20 blur-[2px]" />
                      <div className="absolute right-6 top-14 h-5 w-12 rounded-full bg-white/15 blur-[2px]" />
                      <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-slate-200">
                        {gameActive ? "En carrera" : "En espera"}
                      </div>
                      <div className="absolute right-4 top-4 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100">
                        {score} pts
                      </div>
                      <button
                        type="button"
                        onClick={handleJump}
                        className="absolute inset-0 z-10 cursor-pointer"
                        aria-label="Tocar para saltar"
                      />
                      <div
                        className="absolute bottom-10 h-9 w-9 rounded-[10px] bg-gradient-to-br from-fuchsia-400 to-sky-300 shadow-[0_0_18px_rgba(56,189,248,0.6)]"
                        style={{
                          bottom: `${40 + playerY * 2.2}px`,
                          left: `${playerX * 2}px`,
                        }}
                      />
                      <div
                        className="absolute bottom-10 w-10 rounded-xl bg-gradient-to-t from-emerald-300/80 to-emerald-500/80 shadow-[0_0_18px_rgba(16,185,129,0.6)]"
                        style={{
                          left: `${obstacleX * 2}px`,
                          height: `${obstacleHeight * 2.2}px`,
                        }}
                      />
                      <div className="absolute inset-x-4 bottom-4 grid grid-cols-6 gap-1 opacity-80">
                        {Array.from({ length: 12 }).map((_, index) => (
                          <div
                            key={`brick-${index}`}
                            className="h-3 rounded-sm border border-amber-200/30 bg-gradient-to-b from-amber-400/70 via-amber-300/70 to-amber-500/80 shadow-[0_2px_0_rgba(0,0,0,0.3)]"
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-slate-300">{statusMessage}</p>
                    <div className="flex flex-wrap items-center gap-3">
                      {gameActive ? (
                        <button
                          type="button"
                          onClick={handleJump}
                          className="inline-flex items-center gap-2 rounded-full bg-sky-500/20 px-5 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/30"
                        >
                          Saltar (↑)
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={startGame}
                            className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-5 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/30"
                          >
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
                    <div className="grid gap-2 md:hidden">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                        Controles táctiles
                      </p>
                      <div className="flex items-center justify-center gap-4">
                        <button
                          type="button"
                          onPointerDown={() => handleDirection(-1)}
                          onPointerUp={() => handleDirection(0)}
                          onPointerLeave={() => handleDirection(0)}
                          className="h-12 w-12 rounded-2xl border border-white/10 bg-white/10 text-lg font-semibold text-slate-100"
                          aria-label="Mover a la izquierda"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          onClick={handleJump}
                          className="h-12 w-12 rounded-2xl border border-emerald-400/40 bg-emerald-500/20 text-lg font-semibold text-emerald-100"
                          aria-label="Saltar"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onPointerDown={() => handleDirection(1)}
                          onPointerUp={() => handleDirection(0)}
                          onPointerLeave={() => handleDirection(0)}
                          className="h-12 w-12 rounded-2xl border border-white/10 bg-white/10 text-lg font-semibold text-slate-100"
                          aria-label="Mover a la derecha"
                        >
                          →
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
                    <div className="flex items-center justify-between">
                      <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
                        Stats del runner
                      </p>
                      <Trophy className="h-5 w-5 text-slate-300" />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-black p-4">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                        Modo actual
                      </p>
                      <p className="text-lg font-semibold text-white">{difficultyLabel}</p>
                      <p className="text-xs text-slate-300">
                        Cada punto acelera el escenario. Tocá rápido para superar la marca.
                      </p>
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
                            Puntaje actual
                          </p>
                          <Sparkles className="h-4 w-4 text-sky-200" />
                        </div>
                        <p className="text-3xl font-semibold text-white">{score}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                            Velocidad
                          </p>
                          <Smartphone className="h-4 w-4 text-emerald-200" />
                        </div>
                        <p className="text-sm text-slate-300">
                          Velocidad actual x{speed.toFixed(1)}. Saltá antes del obstáculo.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-xs text-slate-300">
                        Tip: usá ← → para moverte y ↑ para saltar. En celular, los botones aparecen
                        debajo del teléfono.
                      </div>
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
