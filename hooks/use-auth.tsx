import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getAuth, onAuthStateChanged, User as FirebaseUser } from "firebase/auth"
import { ref, get } from "firebase/database"
import { database } from "@/lib/firebase"

interface AppUser {
  uid: string
  email: string | null
  username: string
  role: string
}

export function useAuth() {
  const router = useRouter()
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const auth = getAuth()
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const userRef = ref(database, `users/${firebaseUser.uid}`)
        const userSnapshot = await get(userRef)
        if (userSnapshot.exists()) {
          const userData = userSnapshot.val()
          const appUser: AppUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            username: userData.username || firebaseUser.email || "Usuario",
            role: userData.role || "moderator",
          }
          setUser(appUser)
          localStorage.setItem("user", JSON.stringify(appUser))
        } else {
          // Si el usuario no existe en la base de datos, lo redirigimos al login
          router.push("/")
        }
      } else {
        localStorage.removeItem("user")
        router.push("/")
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [router])

  return { user, loading }
}