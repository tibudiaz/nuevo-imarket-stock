"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  getAuth,
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const auth = getAuth();
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    try {
      await setPersistence(auth, browserLocalPersistence);
      const credentials = await signInWithEmailAndPassword(
        auth,
        trimmedEmail,
        trimmedPassword,
      );

      if (credentials.user && credentials.user.email) {
        const role = credentials.user.email.endsWith("@admin.com")
          ? "admin"
          : "moderator";
        const userData = {
          username: credentials.user.email,
          role,
        };
        localStorage.setItem("user", JSON.stringify(userData));
      }

      // --- CORRECCIÓN CLAVE ---
      // Se redirige directamente al dashboard. El layout se encargará de la carga.
      router.push("/dashboard");
    } catch (authError: any) {
      console.error("Error de Firebase Auth:", authError);
      setError("Usuario o contraseña incorrectos. Verifique sus credenciales.");
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Iniciar Sesión</CardTitle>
        <CardDescription>
          Ingresa tus credenciales para acceder al sistema
        </CardDescription>
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
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
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
      </CardFooter>
    </Card>
  );
}
