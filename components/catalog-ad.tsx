"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel"
import type { CatalogAdConfig } from "@/lib/catalog-ads"

type CatalogAdProps = {
  config?: CatalogAdConfig | null
  className?: string
}

export default function CatalogAd({ config, className }: CatalogAdProps) {
  if (!config?.enabled || !config.urls.length) return null
  const [carouselApi, setCarouselApi] = React.useState<CarouselApi | null>(null)

  React.useEffect(() => {
    if (config.type !== "carousel" || !carouselApi || config.urls.length < 2) {
      return
    }
    const intervalMs = Math.max(
      1000,
      Math.round((config.carouselIntervalSeconds ?? 5) * 1000)
    )
    const interval = window.setInterval(() => {
      carouselApi.scrollNext()
    }, intervalMs)
    return () => window.clearInterval(interval)
  }, [carouselApi, config.carouselIntervalSeconds, config.type, config.urls.length])

  return (
    <section
      className={cn(
        "relative left-1/2 right-1/2 mt-10 w-screen -translate-x-1/2 overflow-hidden",
        className
      )}
    >
      {config.type === "video" ? (
        <video
          controls
          className="h-[220px] w-full object-cover md:h-[360px]"
          src={config.urls[0]}
        >
          Tu navegador no soporta la reproducción de video.
        </video>
      ) : config.type === "carousel" ? (
        <Carousel
          opts={{ align: "center", loop: true }}
          className="relative"
          setApi={setCarouselApi}
        >
          <CarouselContent>
            {config.urls.map((url, index) => (
              <CarouselItem key={`${url}-${index}`}>
                <div className="h-[220px] overflow-hidden md:h-[360px]">
                  <img
                    src={url}
                    alt={config.title ? `${config.title} ${index + 1}` : `Anuncio ${index + 1}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-4 border-white/10 bg-slate-950/70 text-white hover:bg-slate-900/80" />
          <CarouselNext className="right-4 border-white/10 bg-slate-950/70 text-white hover:bg-slate-900/80" />
        </Carousel>
      ) : (
        <div className="h-[220px] overflow-hidden md:h-[360px]">
          <img
            src={config.urls[0]}
            alt={config.title || "Anuncio"}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      )}
    </section>
  )
}
