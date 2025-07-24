"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getAuth, onAuthStateChanged } from "firebase/auth"

export default function PathCleaner() {
  const router = useRouter()
  useEffect(() => {
    const auth = getAuth()
    const path = window.location.pathname

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (
        path.startsWith("/dashboard") &&
        !firebaseUser &&
        !localStorage.getItem("user")
      ) {
        router.replace("/")
      }
    })

    return () => unsubscribe()
  }, [router])
  return null
}
