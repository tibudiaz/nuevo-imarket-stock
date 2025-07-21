"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { ref, get, set } from "firebase/database";
import { database } from "@/lib/firebase";

export default function LoadingPage() {
  const router = useRouter();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // 1. Usuario autenticado, ahora buscamos sus datos en la base de datos
        try {
          const userRef = ref(database, `users/${firebaseUser.uid}`);
          const userSnapshot = await get(userRef);
          let finalUserData;

          if (userSnapshot.exists()) {
            const dbData = userSnapshot.val();
            finalUserData = {
              username: dbData.username || firebaseUser.email,
              role: dbData.role,
              uid: firebaseUser.uid,
              email: firebaseUser.email,
            };
          } else {
            // Si no existe en la base de datos, lo creamos
            let role = "moderator";
            if (firebaseUser.email?.endsWith("@admin.com")) {
              role = "admin";
            }
            finalUserData = {
              username: firebaseUser.email,
              role: role,
              email: firebaseUser.email,
              createdAt: new Date().toISOString(),
              uid: firebaseUser.uid,
            };
            await set(userRef, finalUserData);
          }
          
          // 2. Guardamos los datos en localStorage
          localStorage.setItem("user", JSON.stringify(finalUserData));
          // 3. ¡Todo listo! Redirigimos al Dashboard
          router.replace("/dashboard");

        } catch (error) {
          console.error("Error al obtener los datos del usuario:", error);
          await signOut(auth); // Si falla, cerramos sesión
          router.replace("/");
        }
      } else {
        // Si por alguna razón no hay usuario, lo enviamos al inicio de sesión
        router.replace("/");
      }
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      <p className="ml-4 text-muted-foreground">Verificando sesión...</p>
    </div>
  );
}