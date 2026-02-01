"use client";

import { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import { database } from "@/lib/firebase";
import { safeLocalStorage } from "@/lib/safe-storage";

interface User {
  username: string;
  role: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    let isActive = true;
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      const syncUser = async () => {
        if (!isActive) return;
        if (firebaseUser?.uid) {
          try {
            const snapshot = await get(ref(database, `users/${firebaseUser.uid}`));
            const data = snapshot.exists() ? snapshot.val() : null;
            const role = data?.role;
            if (role === "admin" || role === "moderator") {
              const username = data?.username || firebaseUser.email || "Usuario";
              const currentUser = { username, role };
              setUser((previous) => {
                if (
                  previous?.username === currentUser.username &&
                  previous?.role === currentUser.role
                ) {
                  return previous;
                }
                return currentUser;
              });
              safeLocalStorage.setItem("user", JSON.stringify(currentUser));
            } else {
              safeLocalStorage.removeItem("user");
              setUser(null);
            }
          } catch (error) {
            console.error("Error al validar el usuario del dashboard:", error);
            safeLocalStorage.removeItem("user");
            setUser(null);
          }
        } else {
          safeLocalStorage.removeItem("user");
          setUser(null);
        }
        setLoading(false);
      };
      void syncUser();
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, []);

  return { user, loading };
}
