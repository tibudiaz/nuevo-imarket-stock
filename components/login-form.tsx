"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getAuth, signInWithEmailAndPassword } from "firebase/auth"
import { ref, get, set } from "firebase/database"
import { database } from "@/lib/firebase"

export default function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const auth = getAuth()

      // Iniciar sesión con Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      // Determinar el rol basado en el dominio del correo
      let role = "moderator" // Rol por defecto

      if (email.endsWith("@admin.com")) {
        role = "admin"
      } else if (email.endsWith("@moderador.com")) {
        role = "moderator"
      }

      // Obtener el rol del usuario desde la base de datos
      const userRef = ref(database, `users/${user.uid}`)
      const userSnapshot = await get(userRef)

      if (userSnapshot.exists()) {
        const userData = userSnapshot.val()

        // Actualizar el rol si ha cambiado
        if (userData.role !== role) {
          await set(userRef, {
            ...userData,
            role: role,
            updatedAt: new Date().toISOString(),
          })
        }

        // Guardar información del usuario en localStorage
        localStorage.setItem(
          "user",
          JSON.stringify({
            username: userData.username || user.email,
            role: role, // Usar el rol determinado por el dominio
            uid: user.uid,
            email: user.email,
          }),
        )
      } else {
        // Si el usuario existe en Auth pero no en la base de datos, crear su perfil
        await set(userRef, {
          username: user.email,
          role: role, // Usar el rol determinado por el dominio
          email: user.email,
          createdAt: new Date().toISOString(),
        })

        localStorage.setItem(
          "user",
          JSON.stringify({
            username: user.email,
            role: role,
            uid: user.uid,
            email: user.email,
          }),
        )
      }

      router.push("/dashboard")
    } catch (error) {
      console.error("Error de autenticación:", error)
      setError("Usuario o contraseña incorrectos")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Iniciar Sesión</CardTitle>
        <CardDescription>Ingresa tus credenciales para acceder al sistema</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Correo Electrónico</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Iniciando sesión..." : "Ingresar"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col justify-center text-sm text-muted-foreground">
        <p>Acceso exclusivo para personal autorizado</p>
        <p className="mt-2 text-xs">
          Nota: Usuarios con correo @admin.com tendrán rol de administrador.
          <br />
          Usuarios con correo @moderador.com tendrán rol de moderador.
        </p>
      </CardFooter>
    </Card>
  )
}
