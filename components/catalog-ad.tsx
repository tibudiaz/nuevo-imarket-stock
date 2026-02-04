"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
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
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const [snapCount, setSnapCount] = React.useState(0)

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

  React.useEffect(() => {
    if (config.type !== "carousel" || !carouselApi) return
    setSnapCount(carouselApi.scrollSnapList().length)
    const updateSelected = () => {
      setSelectedIndex(carouselApi.selectedScrollSnap())
    }
    updateSelected()
    carouselApi.on("select", updateSelected)
    carouselApi.on("reInit", updateSelected)
    return () => {
      carouselApi.off("select", updateSelected)
      carouselApi.off("reInit", updateSelected)
    }
  }, [carouselApi, config.type])

  return (
    <section
      className={cn(
        "relative left-1/2 right-1/2 mt-10 w-screen -translate-x-1/2 overflow-hidden px-[2%] md:px-0",
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
          {snapCount > 1 && (
            <div className="mt-3 flex items-center justify-center gap-2">
              {Array.from({ length: snapCount }).map((_, index) => (
                <button
                  key={`catalog-ad-dot-${index}`}
                  type="button"
                  className={cn(
                    "h-2 w-2 rounded-full transition",
                    index === selectedIndex ? "bg-white" : "bg-white/40 hover:bg-white/70"
                  )}
                  aria-label={`Ir a la imagen ${index + 1}`}
                  aria-current={index === selectedIndex ? "true" : "false"}
                  onClick={() => carouselApi?.scrollTo(index)}
                />
              ))}
            </div>
          )}
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
