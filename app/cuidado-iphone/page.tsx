import Link from "next/link"
import {
  ArrowRight,
  BatteryCharging,
  Droplets,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  Sun,
  ThermometerSnowflake,
  Wifi,
} from "lucide-react"

import PublicTopBar from "@/components/public-top-bar"

const quickTips = [
  {
    title: "Usá carga inteligente",
    description:
      "Activá la carga optimizada para cuidar la vida útil de la batería y evitá descargas completas.",
    icon: BatteryCharging,
  },
  {
    title: "Protegé la pantalla",
    description:
      "Sumá un protector de vidrio y una funda de bordes elevados para amortiguar impactos.",
    icon: ShieldCheck,
  },
  {
    title: "Limpieza suave",
    description:
      "Pasá un paño de microfibra apenas humedecido y evitá productos abrasivos o alcohol puro.",
    icon: Droplets,
  },
  {
    title: "Temperatura ideal",
    description:
      "No lo expongas a calor extremo ni al frío intenso. Usalo entre 0 °C y 35 °C.",
    icon: ThermometerSnowflake,
  },
]

const careSections = [
  {
    title: "Batería que dura más",
    icon: BatteryCharging,
    accent: "from-emerald-400/20 via-transparent to-transparent",
    dot: "bg-emerald-300",
    pulse: "bg-emerald-300/50",
    items: [
      "Activá la carga optimizada y evitá dejarlo enchufado toda la noche en ambientes calurosos.",
      "Usá cargadores certificados (MFi o equivalentes) y cables en buen estado.",
      "El porcentaje de salud de batería es un estimativo: puede variar por malas cargas o cargadores de baja calidad.",
      "Si vas a guardar el equipo por mucho tiempo, dejalo con 50% de batería.",
    ],
  },
  {
    title: "Pantalla y estructura",
    icon: ShieldCheck,
    accent: "from-sky-400/20 via-transparent to-transparent",
    dot: "bg-sky-300",
    pulse: "bg-sky-300/50",
    items: [
      "Elegí fundas con bordes elevados y materiales que absorban impactos.",
      "Evitá apoyar el teléfono boca abajo sobre superficies rugosas.",
      "Si lo llevás en la mochila, usá un compartimento separado de llaves o monedas.",
    ],
  },
  {
    title: "Limpieza sin riesgos",
    icon: Droplets,
    accent: "from-amber-300/20 via-transparent to-transparent",
    dot: "bg-amber-200",
    pulse: "bg-amber-200/50",
    items: [
      "Usá paños de microfibra y agua apenas humedecida, sin rociar directo al equipo.",
      "No uses aerosoles, limpiavidrios o solventes agresivos.",
      "Secalo antes de volver a conectarlo a cargadores o accesorios.",
    ],
  },
  {
    title: "Conectividad y seguridad",
    icon: Wifi,
    accent: "from-indigo-400/20 via-transparent to-transparent",
    dot: "bg-indigo-300",
    pulse: "bg-indigo-300/50",
    items: [
      "Mantené iOS actualizado para tener los últimos parches de seguridad.",
      "Activá Face ID/Touch ID y el código de desbloqueo para proteger tu información.",
      "Usá copias de seguridad en iCloud o en tu computadora al menos una vez al mes.",
    ],
  },
]

const avoidList = [
  {
    title: "Golpes sin protección",
    description:
      "Los impactos son la principal causa de roturas. Una buena funda reduce el riesgo.",
    icon: ShieldOff,
  },
  {
    title: "Calor extremo",
    description:
      "No lo dejes bajo el sol directo o dentro del auto. El calor acelera el desgaste.",
    icon: Sun,
  },
  {
    title: "Agua y químicos",
    description:
      "Aunque tenga resistencia al agua, evitá el contacto con líquidos y vapor.",
    icon: Droplets,
  },
]

export default function IphoneCarePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(45,212,191,0.22),transparent_45%),radial-gradient(circle_at_bottom,_rgba(56,189,248,0.18),transparent_45%)]" />
      <div className="absolute inset-0 opacity-50 [background:linear-gradient(120deg,_rgba(15,23,42,0.6)_0%,_rgba(2,6,23,0.95)_100%)]" />
      <div className="pointer-events-none absolute -left-20 top-24 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl animate-pulse" />
      <div className="pointer-events-none absolute -right-24 bottom-10 h-80 w-80 rounded-full bg-sky-400/10 blur-3xl animate-pulse" />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 pb-20 pt-10">
        <PublicTopBar
          marqueeItems={[
            "Cuidados simples para que tu iPhone rinda más.",
            "Tips claros para batería, limpieza y seguridad.",
            "Protegé tu equipo con hábitos que suman.",
          ]}
          desktopContent={
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 transition hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/10"
              >
                Volver al inicio
                <ArrowRight className="h-4 w-4" />
              </Link>
              <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-emerald-200/90">
                Guía de cuidado
              </span>
            </div>
          }
          mobileContent={
            <div className="space-y-3 text-sm text-slate-200">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Accesos</p>
              <Link
                href="/"
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"
              >
                Volver al inicio
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          }
        />

        <header className="flex flex-col gap-6">
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold md:text-5xl">
              Recomendaciones para cuidar tu iPhone
            </h1>
            <p className="max-w-3xl text-lg text-slate-200">
              Una guía clara, visual y fácil de seguir para que tu iPhone se mantenga protegido,
              rápido y con una batería saludable. Ideal para usuarios de todos los niveles.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-slate-300">
            <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
              <Sparkles className="h-4 w-4 text-emerald-200" />
              Consejos prácticos y seguros
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
              Enfoque en batería, limpieza y seguridad
            </span>
          </div>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          {quickTips.map((tip) => {
            const Icon = tip.icon
            return (
              <div
                key={tip.title}
                className="group rounded-3xl border border-white/10 bg-white/5 p-6 transition duration-300 hover:-translate-y-1 hover:border-emerald-300/50 hover:bg-white/10 hover:shadow-[0_20px_60px_-30px_rgba(16,185,129,0.7)]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 transition group-hover:scale-105 group-hover:bg-emerald-500/20">
                    <Icon className="h-6 w-6 text-emerald-200 transition group-hover:text-emerald-100" />
                  </div>
                  <h2 className="text-xl font-semibold text-white">{tip.title}</h2>
                </div>
                <p className="mt-4 text-sm text-slate-300">{tip.description}</p>
              </div>
            )
          })}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          {careSections.map((section) => {
            const Icon = section.icon
            return (
              <article
                key={section.title}
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/60 p-6 transition duration-300 hover:-translate-y-1 hover:border-sky-300/40 hover:bg-slate-900/60"
              >
                <div
                  className={`pointer-events-none absolute -left-10 top-6 h-40 w-40 rounded-full bg-gradient-to-br ${section.accent} blur-2xl opacity-70`}
                />
                <div className="pointer-events-none absolute right-6 top-6 h-10 w-10 rounded-full border border-white/15 bg-white/5 motion-safe:animate-care-orbit" />
                <div className="pointer-events-none absolute left-4 top-6 h-16 w-0.5 rounded-full bg-gradient-to-b from-white/5 via-white/30 to-white/5 motion-safe:animate-care-line" />
                <div className="pointer-events-none absolute -bottom-8 right-0 h-28 w-20 rounded-[26px] border border-white/10 bg-slate-900/60 shadow-[0_10px_30px_rgba(15,23,42,0.45)] opacity-70 motion-safe:animate-phone-float">
                  <div className="absolute left-2 top-2 h-3 w-8 rounded-full bg-white/10" />
                  <div className="absolute inset-3 rounded-[20px] bg-gradient-to-br from-slate-800 via-slate-900 to-black/80 motion-safe:animate-charge-pulse" />
                  <div className="absolute bottom-3 left-6 h-1.5 w-8 rounded-full bg-emerald-300/40" />
                </div>
                <div className="pointer-events-none absolute bottom-4 right-16 h-1.5 w-16 rounded-full bg-white/15 opacity-60 motion-safe:animate-cable-pulse" />
                <div className="pointer-events-none absolute bottom-1 right-20 h-10 w-12 rounded-2xl border border-white/15 bg-slate-900/70 opacity-70 motion-safe:animate-plug-in">
                  <div className="absolute inset-2 rounded-xl bg-slate-800/80" />
                  <div className="absolute right-2 top-3 h-3 w-0.5 rounded-full bg-emerald-300/70" />
                  <div className="absolute right-4 top-3 h-3 w-0.5 rounded-full bg-emerald-300/70" />
                </div>
                <div className="pointer-events-none absolute right-8 top-16 h-2.5 w-2.5 rounded-full bg-emerald-300/60 blur-[0.5px] motion-safe:animate-spark" />
                <div className="pointer-events-none absolute right-16 top-10 h-2 w-2 rounded-full bg-sky-300/50 blur-[0.5px] motion-safe:animate-spark [animation-delay:0.6s]" />
                <div className="pointer-events-none absolute right-2 top-12 h-3 w-3 rounded-full bg-white/40 blur-[0.5px] motion-safe:animate-spark [animation-delay:1.2s]" />
                <div className="flex items-center gap-3">
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 transition group-hover:scale-105 group-hover:bg-sky-500/10">
                    <div className="absolute inset-0 rounded-2xl bg-white/10 opacity-0 blur-md transition group-hover:opacity-100 motion-safe:animate-care-glow" />
                    <Icon className="h-6 w-6 text-sky-200 transition group-hover:text-sky-100" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">{section.title}</h3>
                </div>
                <ul className="mt-4 space-y-3 text-sm text-slate-300">
                  {section.items.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span
                        className={`relative mt-1 h-2 w-2 flex-none rounded-full ${section.dot}`}
                      >
                        <span
                          className={`absolute inset-0 rounded-full ${section.pulse} opacity-0 motion-safe:animate-care-pulse`}
                        />
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            )
          })}
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-2xl font-semibold text-white">
                Cosas que conviene evitar
              </h3>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Estos hábitos dañan el rendimiento y la estética. Si los evitás, tu iPhone se va a
                mantener como nuevo por más tiempo.
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-slate-950/70 px-4 py-2 text-xs uppercase tracking-[0.3em] text-slate-300">
              Recordatorio rápido
            </span>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {avoidList.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.title}
                  className="group rounded-2xl border border-white/10 bg-slate-950/60 p-4 transition duration-300 hover:-translate-y-1 hover:border-rose-300/50 hover:bg-slate-900/60"
                >
                  <div className="flex items-center gap-2 text-sm text-slate-200">
                    <Icon className="h-4 w-4 text-rose-200 transition group-hover:scale-110 group-hover:text-rose-100" />
                    <span className="font-semibold">{item.title}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-300">{item.description}</p>
                </div>
              )}
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-6 shadow-[0_20px_60px_-40px_rgba(16,185,129,0.7)]">
          <div className="flex flex-wrap items-center gap-3 text-sm text-emerald-100">
            <Sparkles className="h-5 w-5" />
            <span className="font-semibold">
              Nota sobre la salud de batería: el porcentaje es un estimativo
            </span>
          </div>
          <p className="mt-3 text-sm text-emerald-100/90">
            La lectura puede variar según el uso, ciclos de carga y la calidad de cargadores o
            cables. Si notás cambios bruscos, consultá para revisar el estado real.
          </p>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-6">
            <h3 className="text-xl font-semibold text-white">Checklist semanal</h3>
            <p className="mt-2 text-sm text-slate-300">
              Tomate 5 minutos por semana para revisar estos puntos.
            </p>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              {[
                "Limpiá la pantalla con paño de microfibra.",
                "Verificá el almacenamiento y eliminá apps que no uses.",
                "Chequeá si hay actualizaciones de iOS pendientes.",
                "Hacé un respaldo rápido en iCloud o en tu computadora.",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-1 h-2 w-2 flex-none rounded-full bg-sky-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-xl font-semibold text-white">¿Necesitás ayuda?</h3>
            <p className="mt-2 text-sm text-slate-300">
              Si notás que la batería dura menos, la pantalla responde raro o querés accesorios
              certificados, escribinos y te asesoramos.
            </p>
            <Link
              href="/catalogo/contacto"
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100 transition hover:border-emerald-300/70"
            >
              Contactar a iMarket
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <footer className="space-y-2 text-center text-xs text-slate-400">
          <p>Cuidá tu iPhone hoy, disfrutalo por más tiempo.</p>
          <p className="text-slate-500">Sitio creado por Grupo iMarket.</p>
        </footer>
      </div>
    </div>
  )
}
