// Ruta: lib/firebase.ts

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  type Auth,
  Persistence,
} from "firebase/auth";

// Lee las variables de entorno
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const envVarMap: Record<keyof typeof firebaseConfig, string> = {
  apiKey: "NEXT_PUBLIC_FIREBASE_API_KEY",
  authDomain: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  databaseURL: "NEXT_PUBLIC_FIREBASE_DATABASE_URL",
  projectId: "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  storageBucket: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  appId: "NEXT_PUBLIC_FIREBASE_APP_ID",
};

// Función para verificar que todas las claves necesarias están presentes
function checkFirebaseConfig(config: typeof firebaseConfig): string | null {
  for (const key of Object.keys(config) as (keyof typeof firebaseConfig)[]) {
    if (!config[key]) {
      const envVarName = envVarMap[key];
      return `La variable de entorno ${envVarName} no está definida en tu archivo .env.local.`;
    }
  }
  return null;
}

// --- Inicialización Segura y Simplificada de Firebase ---

// Declaramos las variables que vamos a exportar
let app: FirebaseApp;
let database: Database;
let storage: FirebaseStorage;
let auth: Auth;
const configError = checkFirebaseConfig(firebaseConfig);

const getAvailablePersistence = (): Persistence | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const isStorageAvailable = (storageType: "localStorage" | "sessionStorage") => {
    try {
      const storage = storageType === "localStorage" ? window.localStorage : window.sessionStorage;
      const testKey = "__firebase_persistence_test__";
      storage.setItem(testKey, "test");
      storage.removeItem(testKey);
      return true;
    } catch (error) {
      console.warn(`[firebase] ${storageType} no disponible, usando alternativa.`, error);
      return false;
    }
  };

  if (isStorageAvailable("localStorage")) {
    return browserLocalPersistence;
  }

  if (isStorageAvailable("sessionStorage")) {
    return browserSessionPersistence;
  }

  return inMemoryPersistence;
};

// Si no hay errores de configuración, procedemos a inicializar Firebase
if (!configError) {
  // Si no hay ninguna app de Firebase inicializada, la creamos. Si ya existe, la obtenemos.
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  
  // Obtenemos los servicios de Firebase a partir de la app inicializada
  database = getDatabase(app);
  storage = getStorage(app);
  auth = getAuth(app);
  const persistence = getAvailablePersistence();
  if (persistence) {
    setPersistence(auth, persistence).catch((e) =>
      console.error("Error setting auth persistence:", e)
    );
  }

  console.log("Firebase se ha inicializado correctamente.");
} else {
  // Si hay un error de configuración, lo mostramos en la consola
  console.error("ERROR GRAVE DE CONFIGURACIÓN DE FIREBASE:", configError);
  
  // Asignamos placeholders a las variables para que la app no se rompa al intentar usarlas.
  // El componente FirebaseProvider se encargará de mostrar el error al usuario.
  app = {} as FirebaseApp;
  database = {} as Database;
  storage = {} as FirebaseStorage;
  auth = {} as Auth;
}

export { app, database, storage, auth, configError };