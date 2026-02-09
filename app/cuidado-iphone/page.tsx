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
    items: [
      "Activá la carga optimizada y evitá dejarlo enchufado toda la noche en ambientes calurosos.",
      "Usá cargadores certificados (MFi o equivalentes) y cables en buen estado.",
      "Si vas a guardar el equipo por mucho tiempo, dejalo con 50% de batería.",
    ],
  },
  {
    title: "Pantalla y estructura",
    icon: ShieldCheck,
    items: [
      "Elegí fundas con bordes elevados y materiales que absorban impactos.",
      "Evitá apoyar el teléfono boca abajo sobre superficies rugosas.",
      "Si lo llevás en la mochila, usá un compartimento separado de llaves o monedas.",
    ],
  },
  {
    title: "Limpieza sin riesgos",
    icon: Droplets,
    items: [
      "Usá paños de microfibra y agua apenas humedecida, sin rociar directo al equipo.",
      "No uses aerosoles, limpiavidrios o solventes agresivos.",
      "Secalo antes de volver a conectarlo a cargadores o accesorios.",
    ],
  },
  {
    title: "Conectividad y seguridad",
    icon: Wifi,
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
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 pb-20 pt-10">
        <header className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-white/30"
            >
              Volver al inicio
              <ArrowRight className="h-4 w-4" />
            </Link>
            <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-emerald-200/90">
              Guía de cuidado
            </span>
          </div>
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
                className="rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:border-emerald-300/50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10">
                    <Icon className="h-6 w-6 text-emerald-200" />
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
                className="rounded-3xl border border-white/10 bg-slate-950/60 p-6"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                    <Icon className="h-6 w-6 text-sky-200" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">{section.title}</h3>
                </div>
                <ul className="mt-4 space-y-3 text-sm text-slate-300">
                  {section.items.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-1 h-2 w-2 flex-none rounded-full bg-emerald-300" />
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
                  className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
                >
                  <div className="flex items-center gap-2 text-sm text-slate-200">
                    <Icon className="h-4 w-4 text-rose-200" />
                    <span className="font-semibold">{item.title}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-300">{item.description}</p>
                </div>
              )}
            )}
          </div>
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

        <footer className="text-center text-xs text-slate-400">
          Cuidá tu iPhone hoy, disfrutalo por más tiempo.
        </footer>
      </div>
    </div>
  )
}
