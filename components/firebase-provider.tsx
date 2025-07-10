"use client"

import { type ReactNode } from "react"
// Importa el error de configuración desde tu archivo de firebase
import { configError } from "@/lib/firebase"
import FirebaseError from "@/components/firebase-error"

interface FirebaseProviderProps {
  children: ReactNode
}

export default function FirebaseProvider({ children }: FirebaseProviderProps) {
  // Si hubo un error al cargar las variables de entorno, muestra el componente de error
  if (configError) {
    return (
      <FirebaseError
        error={configError}
        // El botón de reintento simplemente recargará la página
        onRetry={() => window.location.reload()}
      />
    )
  }

  // Si todo está bien, renderiza la aplicación
  return <>{children}</>
}