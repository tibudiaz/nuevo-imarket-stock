"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { getAuth, signInWithEmailAndPassword, UserCredential } from "firebase/auth"
import { ref, get, set } from "firebase/database"
import { database } from "@/lib/firebase"

export default function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    const auth = getAuth()
    let userCredential: UserCredential;
    
    // 1. Primero, intentar autenticar al usuario
    try {
      userCredential = await signInWithEmailAndPassword(auth, email, password)
    } catch (authError: any) {
      console.error("Error de Firebase Auth:", authError)
      setError("Usuario o contraseña incorrectos. Verifique sus credenciales.")
      setIsLoading(false)
      return;
    }

    // 2. Si la autenticación es exitosa, proceder con la base de datos
    try {
      const user = userCredential.user
      const userRef = ref(database, `users/${user.uid}`)

      // Determinar el rol basado en el dominio del correo
      let role = "moderator"
      if (email.endsWith("@admin.com")) {
        role = "admin"
      } else if (email.endsWith("@moderador.com")) {
        role = "moderator"
      }

      const userSnapshot = await get(userRef)
      let finalUserData;

      if (userSnapshot.exists()) {
        const dbData = userSnapshot.val()
        // Sincronizar el rol del email con la base de datos si es diferente
        if (dbData.role !== role) {
          await set(userRef, { ...dbData, role: role, updatedAt: new Date().toISOString() })
        }
        finalUserData = {
          username: dbData.username || user.email,
          role: role,
          uid: user.uid,
          email: user.email,
        };
      } else {
        // El usuario no existe en la DB, así que lo creamos
        const newUserProfile = {
          username: user.email,
          role: role,
          email: user.email,
          createdAt: new Date().toISOString(),
        };
        await set(userRef, newUserProfile)
        finalUserData = {
          username: user.email,
          role: role,
          uid: user.uid,
          email: user.email,
        };
      }
      
      // 3. Finalmente, guardar en localStorage y redirigir
      localStorage.setItem("user", JSON.stringify(finalUserData));
      router.push("/dashboard");

    } catch (dbError: any) {
      console.error("Error de base de datos o de lógica interna:", dbError);
      setError("No se pudo acceder al perfil de usuario. Contacte al administrador.");
    } finally {
      setIsLoading(false);
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