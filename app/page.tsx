"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getAuth } from "firebase/auth"
import LoginForm from "@/components/login-form"

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const auth = getAuth()

    // Si existe un usuario autenticado en Firebase, redirigir al dashboard
    if (auth.currentUser) {
      router.replace("/dashboard")
      return
    }

    // Verificar usuario almacenado localmente
    const storedUser = localStorage.getItem("user")
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser)

        // Solo redirigir si los datos son válidos
        if (parsedUser && parsedUser.username) {
          router.replace("/dashboard")
          return
        }
      } catch {
        // Si los datos no son válidos, eliminarlos
        localStorage.removeItem("user")
      }
    }
  }, [router])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-slate-800">iMarket</h1>
          <p className="mt-2 text-slate-600">Sistema de gestión para tu negocio de celulares</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}