// components/dashboard-layout.tsx

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
  Store,
  AlertTriangle,
  Calculator,
  Wallet,
  Smartphone,
  Banknote,
  Copy,
  X,
  ClipboardList,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { getAuth, signOut } from "firebase/auth"
import { ref, onValue, query, orderByChild, equalTo, update } from "firebase/database"
import { database } from "@/lib/firebase"
import { useAuth } from "@/hooks/use-auth"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { motion, AnimatePresence } from "framer-motion"
import MobileMenu from "@/components/mobile-menu"
import { useStore } from "@/hooks/use-store"
import { Reserve } from "@/components/sell-product-modal"
import ChatWidget from '@/components/ChatWidget' // <<<--- AÑADIDO
import CashWithdrawalDialog from "@/components/cash-withdrawal-dialog"
import { toast } from "sonner"
import { safeLocalStorage } from "@/lib/safe-storage"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useMobile } from "@/hooks/use-mobile"
import { getAppBaseUrl } from "@/lib/base-url"

interface DashboardLayoutProps {
  children: React.ReactNode
}

interface PendingUploadSession {
  id: string
  createdAt?: string
  repairId?: string | null
}

const NavItem = ({ href, icon: Icon, label, active, children, isCollapsible = false, alert = false }) => {
  const commonClasses = cn(
    "flex items-center h-10 w-full justify-center group-hover:justify-start group-hover:px-4 rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
    active && "bg-accent text-accent-foreground"
  );

  const itemContent = (
    <>
      <div className="relative">
        <Icon className="h-5 w-5 shrink-0" />
        {alert && <AlertTriangle className="absolute -top-1 -right-1 h-3 w-3 text-red-500 fill-red-500" />}
      </div>
      <div className="ml-4 flex-1 overflow-hidden opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <span className="whitespace-nowrap">{label}</span>
      </div>
      {children && <div className="ml-auto opacity-0 transition-opacity duration-200 group-hover:opacity-100">{children}</div>}
    </>
  );

  const triggerElement = isCollapsible ? (
    <CollapsibleTrigger className={commonClasses} asChild>
      <div>{itemContent}</div>
    </CollapsibleTrigger>
  ) : (
    <Link href={href || "#"} className={commonClasses}>
      {itemContent}
    </Link>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {triggerElement}
      </TooltipTrigger>
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
  const lastDashboardSearch = React.useRef<string | null>(null)
  const [dashboardFilters, setDashboardFilters] = React.useState({
    currentCategory: null as string | null,
    currentReserveStatus: null as string | null,
    currentSalesType: null as string | null,
  })

  React.useEffect(() => {
    const nextParamsString = searchParams?.toString() ?? ""
    if (lastDashboardSearch.current === nextParamsString) {
      return
    }

    lastDashboardSearch.current = nextParamsString

    if (!nextParamsString) {
      setDashboardFilters({ currentCategory: null, currentReserveStatus: null, currentSalesType: null })
      return
    }

    const params = new URLSearchParams(nextParamsString)
    setDashboardFilters({
      currentCategory: params.get("category"),
      currentReserveStatus: params.get("status"),
      currentSalesType: params.get("type"),
    })
  }, [searchParams])

  const { currentCategory, currentReserveStatus, currentSalesType } = dashboardFilters
  const { user, loading: authLoading } = useAuth();
  const isMobile = useMobile();
  const [categories, setCategories] = useState<string[]>([])
  const [isInventoryOpen, setIsInventoryOpen] = useState(false)
  const [isReservesOpen, setIsReservesOpen] = useState(false);
  const [dolarBlueRate, setDolarBlueRate] = useState<number | null>(null);
  const [isDolarLoading, setIsDolarLoading] = useState(true);
  const [expiringReserves, setExpiringReserves] = useState(false);
  const [pendingUploadSessions, setPendingUploadSessions] = useState<PendingUploadSession[]>([]);
  const [appOrigin, setAppOrigin] = useState<string>("");
  const [dismissLoadingIds, setDismissLoadingIds] = useState<Record<string, boolean>>({});

  const { selectedStore, setSelectedStore } = useStore();
  const [isWithdrawalOpen, setIsWithdrawalOpen] = useState(false);

  useEffect(() => {
    const fetchDolarBlue = async () => {
      try {
        const response = await fetch("https://dolarapi.com/v1/dolares/blue");
        if (!response.ok) {
          throw new Error('No se pudo obtener la cotización');
        }
        const data = await response.json();
        setDolarBlueRate(data.venta);
      } catch (error) {
        console.error("Error al obtener dólar blue:", error);
        setDolarBlueRate(null);
      } finally {
        setIsDolarLoading(false);
      }
    };

    fetchDolarBlue();
    const intervalId = setInterval(fetchDolarBlue, 180000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const categoriesRef = ref(database, "categories")
    const unsubscribeCategories = onValue(categoriesRef, (snapshot) => {
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

    const reservesRef = ref(database, "reserves");
    const unsubscribeReserves = onValue(reservesRef, (snapshot) => {
        if (snapshot.exists()) {
            const reservesData: Reserve[] = [];
            snapshot.forEach((child) => {
                reservesData.push({ id: child.key!, ...child.val() });
            });
            
            const now = new Date();
            const threeDaysFromNow = new Date();
            threeDaysFromNow.setDate(now.getDate() + 3);
            
            const hasExpiring = reservesData.some(r => r.status === 'reserved' && r.expirationDate && new Date(r.expirationDate) <= threeDaysFromNow);
            setExpiringReserves(hasExpiring);
        } else {
            setExpiringReserves(false);
        }
    });

    return () => {
        unsubscribeCategories();
        unsubscribeReserves();
    }
  }, []);

  useEffect(() => {
    const resolvedOrigin = getAppBaseUrl()
    setAppOrigin(resolvedOrigin)
  }, [])

  useEffect(() => {
    if (!user?.username) {
      setPendingUploadSessions([]);
      return;
    }

    const sessionsQuery = query(
      ref(database, "repairUploadSessions"),
      orderByChild("createdBy"),
      equalTo(user.username)
    );

    const unsubscribe = onValue(
      sessionsQuery,
      (snapshot) => {
        if (!snapshot.exists()) {
          setPendingUploadSessions([]);
          return;
        }

        const sessions: PendingUploadSession[] = [];
        snapshot.forEach((child) => {
          if (!child.key) return;
          const value = child.val() || {};
          const hasPhotos = value.photos && Object.keys(value.photos).length > 0;
          const isPending = value.pendingUpload ?? !hasPhotos;
          if (!isPending) {
            return;
          }
          sessions.push({
            id: child.key,
            createdAt: value.createdAt,
            repairId: value.repairId ?? null,
          });
        });

        sessions.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });

        setPendingUploadSessions(sessions);
      },
      () => setPendingUploadSessions([])
    );

    return () => unsubscribe();
  }, [user?.username]);

  useEffect(() => {
    setIsInventoryOpen(pathname.startsWith("/dashboard/inventory"));
    setIsReservesOpen(pathname.startsWith("/dashboard/reserves"));
  }, [pathname]);

  const handleDismissUploadSession = React.useCallback(async (sessionId: string) => {
    setDismissLoadingIds((prev) => ({ ...prev, [sessionId]: true }));
    try {
      const sessionRef = ref(database, `repairUploadSessions/${sessionId}`);
      await update(sessionRef, {
        pendingUpload: false,
        dismissedAt: new Date().toISOString(),
      });
      setPendingUploadSessions((prev) => prev.filter((session) => session.id !== sessionId));
      toast.success("Notificación cerrada");
    } catch (error) {
      console.error("Error al descartar la carga pendiente:", error);
      toast.error("No se pudo descartar la carga pendiente.");
    } finally {
      setDismissLoadingIds((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
    }
  }, []);

  const handleLogout = async () => {
    const auth = getAuth();
    try {
      safeLocalStorage.removeItem("user");
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  }
  
  const pageVariants = {
    initial: { opacity: 0, y: 5 },
    in: { opacity: 1, y: 0 },
    out: { opacity: 0, y: -5 },
  };
  
  const storeLabel = {
    all: 'Todos los locales',
    local1: 'Local 1',
    local2: 'Local 2'
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/');
    }
  }, [authLoading, user, router]);

  if (authLoading) {
    return (
        <div className="flex h-screen items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
    );
  }
  
  if (!user) {
      return null;
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex min-h-screen w-full flex-col bg-slate-50">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white px-4 md:px-6">
          <div className="flex items-center gap-2">
            <MobileMenu userRole={user.role} />
            <Link href="/dashboard" className="hidden md:flex items-center gap-2 font-semibold">
              <Package className="h-6 w-6" />
              <span className="text-xl">iMarket</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  <span className="hidden sm:inline">{storeLabel[selectedStore]}</span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48">
                <DropdownMenuLabel>Seleccionar Local</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={selectedStore} onValueChange={(value) => setSelectedStore(value as any)}>
                  <DropdownMenuRadioItem value="all">Todos los locales</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="local1">Local 1</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="local2">Local 2</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            {(user.role === "admin" || user.role === "moderator") && (
              <Button
                variant="destructive"
                onClick={() => {
                  if (selectedStore === "all") {
                    toast.error("Seleccione un local", {
                      description: "Debe elegir un local antes de registrar extracciones.",
                    });
                    return;
                  }
                  setIsWithdrawalOpen(true);
                }}
                className="hidden sm:flex"
              >
                <Banknote className="mr-2 h-4 w-4" />
                Extracción
              </Button>
            )}

            <div className="hidden sm:flex items-center gap-2">
                <span className="font-semibold text-sm text-blue-600">Dólar Blue:</span>
                {isDolarLoading ? (
                    <span className="text-sm text-muted-foreground">Cargando...</span>
                ) : (
                    <span className="font-bold text-sm">
                        ${dolarBlueRate ? dolarBlueRate.toFixed(2) : 'N/A'}
                    </span>
                )}
            </div>

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
                    <DropdownMenuItem asChild><Link href="/dashboard/caja"><Wallet className="mr-2 h-4 w-4" /><span>Caja</span></Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link href="/dashboard/finances"><DollarSign className="mr-2 h-4 w-4" /><span>Finanzas</span></Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link href="/dashboard/reports"><BarChart className="mr-2 h-4 w-4" /><span>Reportes</span></Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link href="/dashboard/notifications"><Bell className="mr-2 h-4 w-4" /><span>Notificaciones</span></Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link href="/dashboard/backup"><Database className="mr-2 h-4 w-4" /><span>Backup</span></Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link href="/dashboard/settings"><Settings className="mr-2 h-4 w-4" /><span>Configuración</span></Link></DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}><LogOut className="mr-2 h-4 w-4" /><span>Cerrar Sesión</span></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <CashWithdrawalDialog
          isOpen={isWithdrawalOpen}
          onClose={() => setIsWithdrawalOpen(false)}
        />

        <div className="flex flex-1">
          <aside className="group sticky top-16 hidden h-[calc(100vh-4rem)] md:flex flex-col border-r bg-white w-16 hover:w-64 transition-all duration-300 ease-in-out">
            <nav className="flex flex-col items-center gap-1 p-2 mt-2 flex-1 overflow-y-auto overflow-x-hidden">
              
              <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" active={pathname === "/dashboard"} />
              
              <Collapsible open={isInventoryOpen} onOpenChange={setIsInventoryOpen} className="w-full">
                <NavItem icon={Package} label="Inventario" active={pathname.startsWith("/dashboard/inventory")} isCollapsible>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", isInventoryOpen && "rotate-180")}/>
                </NavItem>
                <CollapsibleContent className="space-y-1 pt-1 hidden group-hover:block">
                  <Link href="/dashboard/inventory" className={cn("flex items-center rounded-md py-2 pl-12 pr-3 text-sm text-slate-700 hover:bg-slate-100", pathname === "/dashboard/inventory" && !currentCategory && "bg-slate-200 font-semibold")}>Todos</Link>
                  {categories.map((category) => (
                    <Link
                      key={category}
                      href={{ pathname: "/dashboard/inventory", query: { category } }}
                      className={cn(
                        "flex items-center rounded-md py-2 pl-12 pr-3 text-sm text-slate-700 hover:bg-slate-100",
                        currentCategory === category && "bg-slate-200 font-semibold"
                      )}
                    >
                      {category}
                    </Link>
                  ))}
                </CollapsibleContent>
              </Collapsible>

              <NavItem
                href="/dashboard/used-phones"
                icon={ClipboardList}
                label="Listado Usados"
                active={pathname === "/dashboard/used-phones"}
              />

              <NavItem href="/dashboard/low-stock" icon={AlertTriangle} label="Bajo Stock" active={pathname === "/dashboard/low-stock"} />

              <NavItem href="/dashboard/sales" icon={ShoppingCart} label="Ventas" active={pathname === "/dashboard/sales" && currentSalesType !== 'celulares'} />
              <NavItem href="/dashboard/sales?type=celulares" icon={Smartphone} label="Ventas de Celulares" active={pathname === "/dashboard/sales" && currentSalesType === 'celulares'} />

              <Collapsible open={isReservesOpen} onOpenChange={setIsReservesOpen} className="w-full">
                  <NavItem icon={ShoppingCart} label="Reservas" active={pathname.startsWith("/dashboard/reserves")} isCollapsible alert={expiringReserves}>
                      <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", isReservesOpen && "rotate-180")}/>
                  </NavItem>
                  <CollapsibleContent className="space-y-1 pt-1 hidden group-hover:block">
                      <Link href="/dashboard/reserves?status=todas" className={cn("flex items-center rounded-md py-2 pl-12 pr-3 text-sm text-slate-700 hover:bg-slate-100", (!currentReserveStatus || currentReserveStatus === 'todas') && "bg-slate-200 font-semibold")}>Todas</Link>
                      <Link href="/dashboard/reserves?status=activas" className={cn("flex items-center rounded-md py-2 pl-12 pr-3 text-sm text-slate-700 hover:bg-slate-100", currentReserveStatus === 'activas' && "bg-slate-200 font-semibold")}>Activas</Link>
                      <Link href="/dashboard/reserves?status=proximas-a-vencer" className={cn("flex items-center rounded-md py-2 pl-12 pr-3 text-sm text-slate-700 hover:bg-slate-100", currentReserveStatus === 'proximas-a-vencer' && "bg-slate-200 font-semibold")}>Próximas a Vencer</Link>
                      <Link href="/dashboard/reserves?status=canceladas" className={cn("flex items-center rounded-md py-2 pl-12 pr-3 text-sm text-slate-700 hover:bg-slate-100", currentReserveStatus === 'canceladas' && "bg-slate-200 font-semibold")}>Canceladas</Link>
                  </CollapsibleContent>
              </Collapsible>

              <NavItem href="/dashboard/repairs" icon={Wrench} label="Reparaciones" active={pathname === "/dashboard/repairs"} />
              
              {user?.role === 'admin' && (
                <NavItem href="/dashboard/customers" icon={Users} label="Clientes" active={pathname === "/dashboard/customers"} />
              )}

              <NavItem href="/dashboard/simulator" icon={Calculator} label="Simulador de Costos" active={pathname === "/dashboard/simulator"} />

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
                className="p-4 md:p-6"
              >
                {pendingUploadSessions.length > 0 && (
                  <div className="mb-4 space-y-3">
                    {pendingUploadSessions.map((session) => {
                      const sessionLink = `/repairs/mobile-upload?sessionId=${session.id}`
                      const absoluteLink = appOrigin ? `${appOrigin}${sessionLink}` : ""
                      return (
                        <Alert
                          key={session.id}
                          className="border-amber-200 bg-amber-50 text-amber-900"
                        >
                          <AlertTitle>Fotos pendientes de carga</AlertTitle>
                          <AlertDescription>
                            {session.repairId
                              ? `Tenés imágenes pendientes para la reparación #${session.repairId}.`
                              : "Tenés una sesión de carga de imágenes pendiente para completar."}
                          </AlertDescription>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button asChild size="sm" className="bg-amber-600 text-white hover:bg-amber-700">
                              <Link href={sessionLink}>
                                <Smartphone className="mr-2 h-4 w-4" />
                                {isMobile ? "Abrir cámara" : "Continuar desde el celular"}
                              </Link>
                            </Button>
                            {absoluteLink && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (!navigator.clipboard) {
                                    toast.error("No se pudo copiar el enlace");
                                    return;
                                  }
                                  navigator.clipboard
                                    .writeText(absoluteLink)
                                    .then(() =>
                                      toast.success("Enlace copiado", {
                                        description: "Pegalo en tu dispositivo móvil para continuar.",
                                      })
                                    )
                                    .catch(() => toast.error("No se pudo copiar el enlace"));
                                }}
                              >
                                <Copy className="mr-2 h-4 w-4" /> Copiar enlace
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-amber-900 hover:bg-amber-100"
                              disabled={!!dismissLoadingIds[session.id]}
                              onClick={() => handleDismissUploadSession(session.id)}
                            >
                              {dismissLoadingIds[session.id] ? (
                                "Cerrando..."
                              ) : (
                                <>
                                  <X className="mr-2 h-4 w-4" /> No cargar imágenes
                                </>
                              )}
                            </Button>
                          </div>
                        </Alert>
                      )
                    })}
                  </div>
                )}
                {children}
              </motion.main>
            </AnimatePresence>
          </div>
        </div>
        
        {/* --- WIDGET DE CHAT AÑADIDO AQUÍ --- */}
        <ChatWidget />
      </div>
    </TooltipProvider>
  )
}
