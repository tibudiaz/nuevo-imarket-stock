"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"

interface FirebaseErrorProps {
  error: string
  onRetry?: () => void
}

export default function FirebaseError({ error, onRetry }: FirebaseErrorProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="bg-red-50 text-red-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            <CardTitle>Error de Conexión</CardTitle>
          </div>
          <CardDescription className="text-red-600">
            No se pudo conectar con la base de datos de Firebase
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <p className="mb-4 text-gray-700">{error}</p>
          <div className="rounded-md bg-amber-50 p-4 text-sm text-amber-700">
            <p className="font-medium">Posibles soluciones:</p>
            <ul className="mt-2 list-inside list-disc">
              <li>Verifica que las variables de entorno de Firebase estén correctamente configuradas</li>
              <li>Asegúrate de que la URL de la base de datos sea válida</li>
              <li>Comprueba que el proyecto de Firebase esté activo</li>
              <li>Configura las reglas de seguridad de Firebase para permitir el acceso:</li>
              <li className="ml-6 mt-1">
                Abre la consola de Firebase &rarr; Realtime Database &rarr; Reglas
                <pre className="mt-1 rounded bg-amber-100 p-2 text-xs">
                  {`{
  "rules": {
    ".read": true,  // Permite lectura a todos (solo para desarrollo)
    ".write": true  // Permite escritura a todos (solo para desarrollo)
  }
}`}
                </pre>
                <span className="mt-1 block text-xs font-medium text-red-600">
                  Nota: Estas reglas son solo para desarrollo. Para producción, configura reglas más restrictivas.
                </span>
              </li>
            </ul>
          </div>
        </CardContent>
        {onRetry && (
          <CardFooter>
            <Button onClick={onRetry} className="w-full">
              Reintentar Conexión
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  )
}
