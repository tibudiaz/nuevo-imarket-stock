import { initializeApp, getApps, type FirebaseApp } from "firebase/app"
import { getDatabase, type Database } from "firebase/database"
import { getStorage, type FirebaseStorage } from "firebase/storage"
import { getAuth, type Auth } from "firebase/auth"

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

// Verificar que las variables de entorno estén disponibles y proporcionar valores predeterminados si es necesario
if (!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL) {
  console.error("FIREBASE ERROR: Missing NEXT_PUBLIC_FIREBASE_DATABASE_URL environment variable")
}

if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
  console.error("FIREBASE ERROR: Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID environment variable")
}

// Imprimir la configuración para depuración (sin las claves sensibles)
console.log("Firebase config:", {
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
})

// Initialize Firebase with error handling
let app: FirebaseApp
let database: Database
let storage: FirebaseStorage
let auth: Auth

try {
  if (!getApps().length) {
    // Verificar que las variables de entorno críticas estén presentes
    if (!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL) {
      throw new Error("NEXT_PUBLIC_FIREBASE_DATABASE_URL no está definido")
    }

    if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
      throw new Error("NEXT_PUBLIC_FIREBASE_PROJECT_ID no está definido")
    }

    app = initializeApp(firebaseConfig)
  } else {
    app = getApps()[0]
  }

  database = getDatabase(app)
  storage = getStorage(app)
  auth = getAuth(app)

  // Verificar que la base de datos se inicializó correctamente
  if (!database) {
    throw new Error("No se pudo inicializar la base de datos de Firebase")
  }

  console.log("Firebase inicializado correctamente")
} catch (error) {
  console.error("Firebase initialization error:", error)
  // Creamos objetos vacíos para evitar errores de null/undefined
  // Usamos tipos explícitos para evitar errores de TypeScript
  database = {} as Database
  storage = {} as FirebaseStorage
  auth = {} as Auth
}

export { app, database, storage, auth }
