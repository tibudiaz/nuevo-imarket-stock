"use client"

import { Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

type PublicTopBarProps = {
  marqueeItems: string[]
  desktopContent: React.ReactNode
  mobileContent: React.ReactNode
}

export default function PublicTopBar({
  marqueeItems,
  desktopContent,
  mobileContent,
}: PublicTopBarProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-black/10">
      <div className="hidden w-full items-center justify-between gap-4 md:flex md:flex-nowrap">
        {desktopContent}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex-1 overflow-hidden rounded-full border border-white/10 bg-slate-950/60">
          <div className="flex w-full">
            <div className="flex min-w-full shrink-0 animate-marquee items-center justify-start gap-6 whitespace-nowrap px-4 py-2 text-sm text-slate-200">
              {marqueeItems.map((item, index) => (
                <span key={`offer-primary-${index}`} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                  {item}
                </span>
              ))}
            </div>
            <div
              className="flex min-w-full shrink-0 animate-marquee items-center justify-start gap-6 whitespace-nowrap px-4 py-2 text-sm text-slate-200"
              style={{ animationDelay: "12s" }}
            >
              {marqueeItems.map((item, index) => (
                <span key={`offer-secondary-${index}`} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full border border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Abrir opciones</span>
              </Button>
            </SheetTrigger>
            <SheetContent className="border-white/10 bg-slate-950 text-white">
              <div className="space-y-6 pt-6">{mobileContent}</div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  )
}
