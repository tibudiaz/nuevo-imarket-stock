"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getAuth } from "firebase/auth"

export default function PathCleaner() {
  const router = useRouter()
  useEffect(() => {
    const auth = getAuth()
    const path = window.location.pathname
    if (path.startsWith("/dashboard") && !auth.currentUser && !localStorage.getItem("user")) {
      router.replace("/")
    }
  }, [router])
  return null
}
