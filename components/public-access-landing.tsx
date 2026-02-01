import Link from "next/link"
import { ArrowRight, Smartphone, Sparkles, Zap } from "lucide-react"

const landingOptions = [
  {
    title: "Celulares nuevos",
    description: "Modelos sellados con disponibilidad inmediata y precios en USD/ARS.",
    href: "/catalogo/nuevos",
    accent: "from-sky-500/20 via-sky-400/5 to-transparent",
    icon: Smartphone,
  },
  {
    title: "Celulares usados",
    description: "Equipos testeados, con detalle de IMEI parcial y stock real.",
    href: "/catalogo/usados",
    accent: "from-emerald-500/20 via-emerald-400/5 to-transparent",
    icon: Zap,
  },
]

export default function PublicAccessLanding() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.22),transparent_45%),radial-gradient(circle_at_bottom,_rgba(16,185,129,0.18),transparent_40%)]" />
      <div className="absolute inset-0 opacity-40 [background:linear-gradient(120deg,_rgba(15,23,42,0.65)_0%,_rgba(2,6,23,0.9)_100%)]" />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 pb-20 pt-16">
        <header className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
              <Smartphone className="h-7 w-7 text-sky-300" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">iMarket</p>
              <h1 className="text-4xl font-semibold">Catálogo de celulares</h1>
            </div>
          </div>
          <p className="max-w-2xl text-lg text-slate-200">
            Elegí el tipo de catálogo que querés consultar para cargar solo la información
            necesaria y abrir la página más rápido.
          </p>
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

        <section className="grid gap-6 md:grid-cols-2">
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
    </div>
  )
}
