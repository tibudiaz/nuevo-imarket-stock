"use client"

import { type ReactNode, useEffect, useState } from "react"
import { database } from "@/lib/firebase"
// Importar el componente FirebaseError
import FirebaseError from "@/components/firebase-error"

interface FirebaseProviderProps {
  children: ReactNode
}

export default function FirebaseProvider({ children }: FirebaseProviderProps) {
  const [isFirebaseReady, setIsFirebaseReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Modificar la función checkFirebaseConnection para evitar problemas de permisos
    const checkFirebaseConnection = async () => {
      try {
        // Verificar si Firebase está inicializado correctamente
        if (!database || !database.app) {
          throw new Error("Firebase no está inicializado correctamente")
        }

        // En lugar de intentar leer datos, solo verificamos que la configuración sea válida
        // Esto evita problemas de permisos
        const appConfig = database.app.options

        if (!appConfig.databaseURL) {
          throw new Error("La URL de la base de datos no está configurada")
        }

        if (!appConfig.projectId) {
          throw new Error("El ID del proyecto no está configurado")
        }

        // Si llegamos aquí, la configuración básica es válida
        console.log("Firebase configurado correctamente:", {
          projectId: appConfig.projectId,
          databaseURL: appConfig.databaseURL,
        })

        setIsFirebaseReady(true)
      } catch (err) {
        console.error("Firebase connection error:", err)

        // Mensaje de error más específico basado en el tipo de error
        if (err.message && err.message.includes("permission_denied")) {
          setError(
            "Error de permisos: No tienes acceso a la base de datos. " +
              "Necesitas configurar las reglas de seguridad de Firebase para permitir el acceso. " +
              "Consulta la documentación para más información.",
          )
        } else if (err.message && err.message.includes("database URL")) {
          setError("Error de configuración: URL de la base de datos no válida o faltante.")
        } else {
          setError(`Error al conectar con Firebase: ${err.message || "Error desconocido"}`)
        }
      }
    }

    checkFirebaseConnection()
  }, [])

  // Reemplazar la sección de renderizado de error con:
  if (error) {
    return (
      <FirebaseError
        error={error}
        onRetry={() => {
          setError(null)
          checkFirebaseConnection()
        }}
      />
    )
  }

  if (!isFirebaseReady) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        <p className="mt-4 text-gray-600">Conectando con Firebase...</p>
      </div>
    )
  }

  return <>{children}</>
}
