"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged } from "firebase/auth";

export interface AuthUser {
  username: string;
  role: string;
}

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        const role = firebaseUser.email.endsWith("@admin.com")
          ? "admin"
          : "moderator";
        const userData = {
          username: firebaseUser.email,
          role,
        };
        setUser(userData);
        localStorage.setItem("user", JSON.stringify(userData));
        setLoading(false);
      } else {
        const stored = localStorage.getItem("user");
        if (stored) {
          try {
            setUser(JSON.parse(stored));
            setLoading(false);
            return;
          } catch {
            localStorage.removeItem("user");
          }
        }
        localStorage.removeItem("user");
        setLoading(false);
        router.push("/");
      }
    });
    return () => unsubscribe();
  }, [router]);

  return { user, loading };
}
