// Ruta: lib/firebase.ts

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getAuth, type Auth } from "firebase/auth";

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

// Función para verificar que todas las claves necesarias están presentes
function checkFirebaseConfig(config: typeof firebaseConfig): string | null {
  const requiredKeys: (keyof typeof firebaseConfig)[] = ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
  for (const key of requiredKeys) {
    if (!config[key]) {
      return `La variable de entorno NEXT_PUBLIC_FIREBASE_${key.toUpperCase()} no está definida en tu archivo .env.local.`;
    }
  }
  return null;
}

// --- Inicialización Segura de Firebase ---
let app: FirebaseApp;
let database: Database;
let storage: FirebaseStorage;
let auth: Auth;
const configError = checkFirebaseConfig(firebaseConfig);

if (configError) {
  console.error("ERROR GRAVE DE CONFIGURACIÓN DE FIREBASE:", configError);
}

// Inicializa Firebase solo si no se ha hecho ya
if (!getApps().length) {
  if (!configError) {
    app = initializeApp(firebaseConfig);
    console.log("Firebase se ha inicializado correctamente.");
  } else {
    console.error("La inicialización de Firebase se ha omitido debido a la falta de variables de entorno.");
  }
} else {
  app = getApp();
}

// Asegúrate de que la app se inicializó antes de obtener los servicios
if (app) {
    database = getDatabase(app);
    storage = getStorage(app);
    auth = getAuth(app);
} else {
    // Si la app no se pudo inicializar, asignamos placeholders para evitar más errores
    database = {} as Database;
    storage = {} as FirebaseStorage;
    auth = {} as Auth;
}

export { app, database, storage, auth, configError };