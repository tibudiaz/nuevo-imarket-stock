"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Package, ShoppingCart, DollarSign, BarChart, User, Bell, Database, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

interface MobileMenuProps {
  userRole: string
}

export default function MobileMenu({ userRole }: MobileMenuProps) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  const routes = [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: Home,
      active: pathname === "/dashboard",
      roles: ["admin", "moderator"],
    },
    {
      href: "/dashboard/inventory",
      label: "Inventario",
      icon: Package,
      active: pathname === "/dashboard/inventory",
      roles: ["admin", "moderator"],
    },
    {
      href: "/dashboard/sales",
      label: "Ventas",
      icon: ShoppingCart,
      active: pathname === "/dashboard/sales",
      roles: ["admin", "moderator"],
    },
    {
      href: "/dashboard/reserves",
      label: "Reservas",
      icon: ShoppingCart,
      active: pathname === "/dashboard/reserves",
      roles: ["admin", "moderator"],
    },
    {
      href: "/dashboard/customers",
      label: "Clientes",
      icon: User,
      active: pathname === "/dashboard/customers",
      roles: ["admin", "moderator"],
    },
    {
      href: "/dashboard/finances",
      label: "Finanzas",
      icon: DollarSign,
      active: pathname === "/dashboard/finances",
      roles: ["admin"],
    },
    {
      href: "/dashboard/reports",
      label: "Reportes",
      icon: BarChart,
      active: pathname === "/dashboard/reports",
      roles: ["admin"],
    },
    {
      href: "/dashboard/notifications",
      label: "Notificaciones",
      icon: Bell,
      active: pathname === "/dashboard/notifications",
      roles: ["admin"],
    },
    {
      href: "/dashboard/backup",
      label: "Backup",
      icon: Database,
      active: pathname === "/dashboard/backup",
      roles: ["admin"],
    },
  ]

  const filteredRoutes = routes.filter((route) => route.roles.includes(userRole))

  return (
    <div className="md:hidden">
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Abrir menú</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 sm:max-w-xs p-0">
          <div className="flex h-16 items-center border-b px-4">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold" onClick={() => setIsOpen(false)}>
              <span className="text-xl">iMarket</span>
            </Link>
            <Button variant="ghost" size="icon" className="ml-auto" onClick={() => setIsOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <nav className="grid gap-1 p-4">
            {filteredRoutes.map((route) => (
              <Link
                key={route.href}
                href={route.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-slate-900 transition-all hover:bg-slate-100",
                  route.active && "bg-slate-100 font-medium",
                )}
              >
                <route.icon className={cn("h-5 w-5", route.active && "text-primary")} />
                <span>{route.label}</span>
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  )
}
