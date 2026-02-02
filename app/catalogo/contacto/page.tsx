import Link from "next/link"
import { ArrowLeft, MapPin, Phone } from "lucide-react"

import PublicTopBar from "@/components/public-top-bar"

const contactDetails = [
  {
    title: "Dirección",
    description: "San Martín 1234, Río Cuarto, Córdoba.",
    icon: MapPin,
  },
  {
    title: "Teléfonos",
    description: "+54 9 358 412-3456 · +54 9 358 498-7654",
    icon: Phone,
  },
]

export default function CatalogoContactoPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.22),transparent_45%),radial-gradient(circle_at_bottom,_rgba(16,185,129,0.18),transparent_40%)]" />
      <div className="absolute inset-0 opacity-40 [background:linear-gradient(120deg,_rgba(15,23,42,0.65)_0%,_rgba(2,6,23,0.9)_100%)]" />
      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 pb-20 pt-10">
        <PublicTopBar
          marqueeItems={["Escribinos y coordinamos tu visita."]}
          desktopContent={
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <Link
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 transition hover:border-white/20"
                href="/catalogo"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver al catálogo
              </Link>
            </div>
          }
          mobileContent={
            <div className="space-y-3 text-sm text-slate-200">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Accesos</p>
              <Link
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                href="/catalogo"
              >
                Volver al catálogo
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </div>
          }
        />

        <header className="space-y-4">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">iMarket</p>
          <h1 className="text-4xl font-semibold">Contacto</h1>
          <p className="max-w-2xl text-lg text-slate-200">
            Estamos listos para ayudarte. Estos son nuestros datos para coordinar tu visita o hacer
            una consulta.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          {contactDetails.map((detail) => {
            const Icon = detail.icon
            return (
              <div
                key={detail.title}
                className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent" />
                <div className="relative flex flex-col gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                    <Icon className="h-6 w-6 text-sky-200" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-semibold text-white">{detail.title}</h2>
                    <p className="text-sm text-slate-300">{detail.description}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </section>
      </div>
    </div>
  )
}
