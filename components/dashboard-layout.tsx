"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Settings,
  LogOut,
  Bell,
  Database,
  ChevronDown,
  BarChart,
  DollarSign,
  Wrench,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { getAuth, signOut } from "firebase/auth"
import { ref, onValue } from "firebase/database"
import { database } from "@/lib/firebase"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { motion, AnimatePresence } from "framer-motion"

interface DashboardLayoutProps {
  children: React.ReactNode
}

// Componente unificado para todos los items de la barra de navegación
const NavItem = ({ href, icon: Icon, label, active, children, isCollapsible = false, ...props }) => {
  const itemContent = (
    <div
      className={cn(
        "flex h-10 w-full items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground group-hover:justify-start group-hover:px-4",
        active && "bg-accent text-accent-foreground"
      )}
      {...props}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <div className="ml-4 flex flex-1 items-center justify-between max-w-0 overflow-hidden opacity-0 transition-all duration-200 group-hover:max-w-full group-hover:opacity-100">
        <span className="whitespace-nowrap">{label}</span>
        {children}
      </div>
    </div>
  );

  const trigger = isCollapsible ? (
    <CollapsibleTrigger asChild>{itemContent}</CollapsibleTrigger>
  ) : (
    <Link href={href} className="w-full">
      {itemContent}
    </Link>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent side="right" className="group-hover:hidden">
        {label}
      </TooltipContent>
    </Tooltip>
  );
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<{ username: string; role: string } | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  const [isInventoryOpen, setIsInventoryOpen] = useState(false)
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true)
    const storedUser = localStorage.getItem("user")
    if (!storedUser) {
      router.push("/")
      return
    }
    try {
      setUser(JSON.parse(storedUser))
    } catch (e) {
      localStorage.removeItem("user")
      router.push("/")
    }

    const categoriesRef = ref(database, "categories")
    const unsubscribe = onValue(categoriesRef, (snapshot) => {
      if (snapshot.exists()) {
        const categoriesData = snapshot.val()
        const categoryNames = Object.values(categoriesData)
          .map((category: any) => category.name)
          .filter(Boolean) as string[]
        setCategories(categoryNames)
      } else {
        setCategories([])
      }
    })

    return () => unsubscribe()
  }, [router])

  useEffect(() => {
    if (pathname.startsWith("/dashboard/inventory")) {
      setIsInventoryOpen(true)
    } else {
      setIsInventoryOpen(false)
    }
  }, [pathname])

  const handleLogout = async () => {
    try {
      const auth = getAuth()
      await signOut(auth)
    } catch (error) {
      console.error("Error al cerrar sesión:", error)
    } finally {
      localStorage.removeItem("user")
      router.push("/")
    }
  }

  const currentCategory = searchParams.get('category')

  const pageVariants = {
    initial: { opacity: 0, y: 5 },
    in: { opacity: 1, y: 0 },
    out: { opacity: 0, y: -5 },
  };

  if (!hasMounted) {
    return null; // O un spinner de carga para evitar el parpadeo
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex min-h-screen w-full flex-col bg-slate-50">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white px-4 md:px-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
             <Package className="h-6 w-6" />
            <span className="text-xl">iMarket</span>
          </Link>
          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback>{user?.username?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.username}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user?.role}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user?.role === "admin" && (
                  <>
                    <DropdownMenuItem asChild><Link href="/dashboard/finances"><DollarSign className="mr-2 h-4 w-4" /><span>Finanzas</span></Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link href="/dashboard/reports"><BarChart className="mr-2 h-4 w-4" /><span>Reportes</span></Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link href="/dashboard/notifications"><Bell className="mr-2 h-4 w-4" /><span>Notificaciones</span></Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link href="/dashboard/backup"><Database className="mr-2 h-4 w-4" /><span>Backup</span></Link></DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem asChild><Link href="/dashboard/settings"><Settings className="mr-2 h-4 w-4" /><span>Configuración</span></Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}><LogOut className="mr-2 h-4 w-4" /><span>Cerrar Sesión</span></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="flex flex-1">
          <aside className="group sticky top-16 hidden h-[calc(100vh-4rem)] md:flex flex-col border-r bg-white w-16 hover:w-64 transition-all duration-300 ease-in-out">
            <nav className="flex flex-col items-center gap-1 p-2 mt-2 flex-1">
              
              <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" active={pathname === "/dashboard"} />
              
              <Collapsible open={isInventoryOpen} onOpenChange={setIsInventoryOpen} className="w-full">
                <NavItem icon={Package} label="Inventario" active={pathname.startsWith("/dashboard/inventory")} isCollapsible>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", isInventoryOpen && "rotate-180")}/>
                </NavItem>
                <CollapsibleContent className="space-y-1 pt-1 hidden group-hover:block">
                  <Link href="/dashboard/inventory" className={cn("flex items-center rounded-md py-2 pl-12 pr-3 text-sm text-slate-700 hover:bg-slate-100", pathname === "/dashboard/inventory" && !currentCategory && "bg-slate-200 font-semibold")}>Todos</Link>
                  {categories.map((category) => (
                    <Link key={category} href={`/dashboard/inventory?category=${encodeURIComponent(category)}`} className={cn("flex items-center rounded-md py-2 pl-12 pr-3 text-sm text-slate-700 hover:bg-slate-100", currentCategory === category && "bg-slate-200 font-semibold")}>{category}</Link>
                  ))}
                </CollapsibleContent>
              </Collapsible>
              
              <NavItem href="/dashboard/sales" icon={ShoppingCart} label="Ventas" active={pathname === "/dashboard/sales"} />
              <NavItem href="/dashboard/repairs" icon={Wrench} label="Reparaciones" active={pathname === "/dashboard/repairs"} />
              <NavItem href="/dashboard/customers" icon={Users} label="Clientes" active={pathname === "/dashboard/customers"} />

            </nav>
          </aside>

          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.main
                key={pathname + searchParams.toString()}
                variants={pageVariants}
                initial="initial"
                animate="in"
                exit="out"
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="p-6"
              >
                {children}
              </motion.main>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}