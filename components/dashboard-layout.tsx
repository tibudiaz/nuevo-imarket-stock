"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  DollarSign,
  BarChart,
  Users,
  Settings,
  LogOut,
  Bell,
  Database,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { getAuth, signOut } from "firebase/auth"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter()
  const [user, setUser] = useState(null)

  useEffect(() => {
    // Verificar autenticación
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
  }, [router])

  const handleLogout = async () => {
    try {
      // Cerrar sesión en Firebase Auth
      const auth = getAuth()
      await signOut(auth)
    } catch (error) {
      console.error("Error al cerrar sesión:", error)
    } finally {
      // Siempre limpiar localStorage y redirigir
      localStorage.removeItem("user")
      router.push("/")
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-white px-4 md:px-6">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <span className="text-xl">iMarket</span>
        </Link>

        <div className="ml-auto flex items-center gap-4">
          <span className="text-sm font-medium">
            {user?.username} ({user?.role === "admin" ? "Admin" : "Moderador"})
          </span>
        </div>
      </header>
      <div className="flex flex-1">
        <aside className="hidden w-64 flex-col border-r bg-white md:flex">
          <nav className="grid gap-2 p-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-900 transition-all hover:bg-slate-100"
            >
              <LayoutDashboard className="h-5 w-5" />
              <span>Dashboard</span>
            </Link>
            <Link
              href="/dashboard/inventory"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-900 transition-all hover:bg-slate-100"
            >
              <Package className="h-5 w-5" />
              <span>Inventario</span>
            </Link>
            <Link
              href="/dashboard/sales"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-900 transition-all hover:bg-slate-100"
            >
              <ShoppingCart className="h-5 w-5" />
              <span>Ventas</span>
            </Link>
            <Link
              href="/dashboard/customers"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-900 transition-all hover:bg-slate-100"
            >
              <Users className="h-5 w-5" />
              <span>Clientes</span>
            </Link>
            {user?.role === "admin" && (
              <>
                <Link
                  href="/dashboard/finances"
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-900 transition-all hover:bg-slate-100"
                >
                  <DollarSign className="h-5 w-5" />
                  <span>Finanzas</span>
                </Link>
                <Link
                  href="/dashboard/reports"
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-900 transition-all hover:bg-slate-100"
                >
                  <BarChart className="h-5 w-5" />
                  <span>Reportes</span>
                </Link>
                <Link
                  href="/dashboard/notifications"
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-900 transition-all hover:bg-slate-100"
                >
                  <Bell className="h-5 w-5" />
                  <span>Notificaciones</span>
                </Link>
                <Link
                  href="/dashboard/backup"
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-900 transition-all hover:bg-slate-100"
                >
                  <Database className="h-5 w-5" />
                  <span>Backup</span>
                </Link>
              </>
            )}
            <Link
              href="/dashboard/settings"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-900 transition-all hover:bg-slate-100"
            >
              <Settings className="h-5 w-5" />
              <span>Configuración</span>
            </Link>
            <Button
              variant="ghost"
              className="flex w-full items-center justify-start gap-3 rounded-lg px-3 py-2 text-slate-900 transition-all hover:bg-slate-100"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5" />
              <span>Cerrar Sesión</span>
            </Button>
          </nav>
        </aside>
        <main className="flex-1 bg-slate-50">{children}</main>
      </div>
    </div>
  )
}
