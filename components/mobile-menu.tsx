"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Home, Package, ShoppingCart, Users, Wrench, ChevronDown, LayoutDashboard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { ref, onValue } from "firebase/database"
import { database } from "@/lib/firebase"

interface MobileMenuProps {
  userRole: string
}

interface Category {
  id: string;
  name: string;
}

export default function MobileMenu({ userRole }: MobileMenuProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentCategory = searchParams.get('category');

  const [isOpen, setIsOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(pathname.startsWith("/dashboard/inventory"));
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    // Sincroniza el estado del menú de inventario con la ruta actual
    setIsInventoryOpen(pathname.startsWith("/dashboard/inventory"));
  }, [pathname]);

  useEffect(() => {
    // Carga las categorías para el menú desplegable
    const categoriesRef = ref(database, 'categories');
    const unsubscribeCategories = onValue(categoriesRef, (snapshot) => {
      const data = snapshot.val();
      const categoryList: Category[] = data ? Object.entries(data).map(([id, value]: [string, any]) => ({ id, name: value.name })) : [];
      setCategories(categoryList);
    });

    return () => unsubscribeCategories();
  }, []);

  const handleLinkClick = () => setIsOpen(false);

  const mainRoutes = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, active: pathname === "/dashboard" },
    { href: "/dashboard/sales", label: "Ventas", icon: ShoppingCart, active: pathname === "/dashboard/sales" },
    { href: "/dashboard/repairs", label: "Reparaciones", icon: Wrench, active: pathname === "/dashboard/repairs" },
    { href: "/dashboard/reserves", label: "Reservas", icon: ShoppingCart, active: pathname === "/dashboard/reserves" },
    { href: "/dashboard/customers", label: "Clientes", icon: Users, active: pathname === "/dashboard/customers" },
  ];

  return (
    <div className="md:hidden">
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon">
            <Home className="h-5 w-5" />
            <span className="sr-only">Abrir menú</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 sm:max-w-xs p-0">
          <div className="flex h-16 items-center border-b px-4">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold" onClick={handleLinkClick}>
              <span className="text-xl">iMarket</span>
            </Link>
          </div>
          <nav className="grid gap-1 p-4">
            {mainRoutes.map((route) => (
              <Link
                key={route.href}
                href={route.href}
                onClick={handleLinkClick}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-slate-900 transition-all hover:bg-slate-100",
                  route.active && "bg-slate-100 font-medium"
                )}
              >
                <route.icon className={cn("h-5 w-5", route.active && "text-primary")} />
                <span>{route.label}</span>
              </Link>
            ))}
            
            {/* INICIO: Menú desplegable para Inventario */}
            <Collapsible open={isInventoryOpen} onOpenChange={setIsInventoryOpen}>
              <CollapsibleTrigger className="w-full">
                <div className={cn(
                    "flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-slate-900 transition-all hover:bg-slate-100",
                    isInventoryOpen && "bg-slate-100",
                    pathname.startsWith("/dashboard/inventory") && "bg-slate-100 font-medium"
                )}>
                    <div className="flex items-center gap-3">
                        <Package className={cn("h-5 w-5", pathname.startsWith("/dashboard/inventory") && "text-primary")} />
                        <span>Inventario</span>
                    </div>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", isInventoryOpen && "rotate-180")} />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="py-1 pl-8">
                  <Link href="/dashboard/inventory" onClick={handleLinkClick} className={cn(
                      "block rounded-md p-2 text-sm hover:bg-slate-100",
                      pathname === "/dashboard/inventory" && !currentCategory && "bg-slate-200"
                  )}>
                    Todos los productos
                  </Link>
                  {categories.map(cat => (
                      <Link key={cat.id} href={`/dashboard/inventory?category=${cat.name}`} onClick={handleLinkClick} className={cn(
                          "block rounded-md p-2 text-sm hover:bg-slate-100",
                           currentCategory === cat.name && "bg-slate-200"
                      )}>
                          {cat.name}
                      </Link>
                  ))}
              </CollapsibleContent>
            </Collapsible>
            {/* FIN: Menú desplegable para Inventario */}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  )
}