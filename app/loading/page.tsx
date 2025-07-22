"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { ref, get, set, update } from "firebase/database";
import { database } from "@/lib/firebase";

export default function LoadingPage() {
  const router = useRouter();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Primero, nos aseguramos de que haya un usuario y un email.
      if (firebaseUser && firebaseUser.email) {
        try {
          let role = "";

          // 1. Asignamos el rol basándonos únicamente en el dominio del email.
          if (firebaseUser.email.endsWith("@admin.com")) {
            role = "admin";
          } else if (firebaseUser.email.endsWith("@moderador.com")) {
            role = "moderator";
          } else {
            // Si el dominio no es válido, cerramos la sesión y lo enviamos al inicio.
            console.error("Acceso no autorizado para el dominio del correo:", firebaseUser.email);
            await signOut(auth);
            router.replace("/");
            return; // Detenemos la ejecución aquí.
          }

          // 2. Preparamos los datos del usuario para guardarlos en el navegador.
          const finalUserData = {
            username: firebaseUser.email,
            role: role, // Usamos el rol que acabamos de determinar.
            uid: firebaseUser.uid,
            email: firebaseUser.email,
          };
          
          // 3. Guardamos los datos en localStorage inmediatamente.
          localStorage.setItem("user", JSON.stringify(finalUserData));
          
          // 4. Redirigimos al usuario al dashboard sin esperar a la base de datos.
          router.replace("/dashboard");

          // 5. (Opcional pero recomendado) En segundo plano, creamos o actualizamos
          //    el registro del usuario en la base de datos para mantener un registro.
          const userRef = ref(database, `users/${firebaseUser.uid}`);
          const userSnapshot = await get(userRef);

          if (!userSnapshot.exists()) {
            // Si no existe, lo creamos.
            await set(userRef, {
              username: firebaseUser.email,
              role: role,
              email: firebaseUser.email,
              createdAt: new Date().toISOString(),
            });
          } else {
            // Si existe y el rol es diferente, lo actualizamos.
            const dbData = userSnapshot.val();
            if (dbData.role !== role) {
              await update(userRef, { role: role });
            }
          }

        } catch (error) {
          // Si algo falla, cerramos sesión por seguridad.
          console.error("Error al procesar los datos del usuario:", error);
          await signOut(auth);
          router.replace("/");
        }
      } else {
        // Si no hay usuario autenticado, lo enviamos al login.
        router.replace("/");
      }
    });

    // Limpiamos el listener cuando el componente se desmonta.
    return () => unsubscribe();
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      <p className="ml-4 text-muted-foreground">Verificando sesión...</p>
    </div>
  );
}