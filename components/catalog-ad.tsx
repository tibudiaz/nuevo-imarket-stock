"use client"

import { cn } from "@/lib/utils"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import type { CatalogAdConfig } from "@/lib/catalog-ads"

type CatalogAdProps = {
  config?: CatalogAdConfig | null
  className?: string
}

const DEFAULT_TITLE = "Publicidad destacada"

export default function CatalogAd({ config, className }: CatalogAdProps) {
  if (!config?.enabled || !config.urls.length) return null

  return (
    <section className={cn("mt-10", className)}>
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/20">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
              Publicidad
            </p>
            <h2 className="text-xl font-semibold text-white">
              {config.title || DEFAULT_TITLE}
            </h2>
          </div>
        </div>

        <div className="mt-5">
          {config.type === "video" ? (
            <video
              controls
              className="h-[240px] w-full rounded-2xl border border-white/10 bg-slate-950/60 object-cover md:h-[320px]"
              src={config.urls[0]}
            >
              Tu navegador no soporta la reproducción de video.
            </video>
          ) : config.type === "carousel" ? (
            <Carousel opts={{ align: "center", loop: true }} className="relative">
              <CarouselContent>
                {config.urls.map((url, index) => (
                  <CarouselItem key={`${url}-${index}`}>
                    <div className="h-[240px] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 md:h-[320px]">
                      <img
                        src={url}
                        alt={config.title ? `${config.title} ${index + 1}` : `Publicidad ${index + 1}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="-left-4 border-white/10 bg-slate-950/70 text-white hover:bg-slate-900/80" />
              <CarouselNext className="-right-4 border-white/10 bg-slate-950/70 text-white hover:bg-slate-900/80" />
            </Carousel>
          ) : (
            <div className="h-[240px] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 md:h-[320px]">
              <img
                src={config.urls[0]}
                alt={config.title || "Publicidad"}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
