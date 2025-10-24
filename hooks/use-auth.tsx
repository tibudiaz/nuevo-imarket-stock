"use client";

import { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";

interface User {
  username: string;
  role: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        const role = firebaseUser.email.endsWith("@admin.com")
          ? "admin"
          : "moderator";
        const currentUser = { username: firebaseUser.email, role };

        setUser((previous) => {
          if (
            previous?.username === currentUser.username &&
            previous?.role === currentUser.role
          ) {
            return previous;
          }
          return currentUser;
        });
        const stored = localStorage.getItem("user");
        if (!stored) {
          localStorage.setItem("user", JSON.stringify(currentUser));
        } else {
          try {
            const parsed = JSON.parse(stored) as User;
            if (
              parsed.username !== currentUser.username ||
              parsed.role !== currentUser.role
            ) {
              localStorage.setItem("user", JSON.stringify(currentUser));
            }
          } catch {
            localStorage.setItem("user", JSON.stringify(currentUser));
          }
        }
      } else {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser) as User;
            setUser((previous) => {
              if (
                previous?.username === parsed.username &&
                previous?.role === parsed.role
              ) {
                return previous;
              }
              return parsed;
            });
          } catch {
            localStorage.removeItem("user");
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, loading };
}
