"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { getAuth, onAuthStateChanged } from "firebase/auth"
import { safeLocalStorage } from "@/lib/safe-storage"

export default function PathCleaner() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const auth = getAuth()
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (
        pathname.startsWith("/dashboard") &&
        !firebaseUser
      ) {
        const storedUser = safeLocalStorage.getItem("user")
        if (!storedUser.ok || !storedUser.value) {
          router.replace("/")
        }
      }
    })

    return () => unsubscribe()
  }, [router, pathname])

  return null
}
