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

// --- Inicialización Segura y Simplificada de Firebase ---

// Declaramos las variables que vamos a exportar
let app: FirebaseApp;
let database: Database;
let storage: FirebaseStorage;
let auth: Auth;
const configError = checkFirebaseConfig(firebaseConfig);

// Si no hay errores de configuración, procedemos a inicializar Firebase
if (!configError) {
  // Si no hay ninguna app de Firebase inicializada, la creamos. Si ya existe, la obtenemos.
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  
  // Obtenemos los servicios de Firebase a partir de la app inicializada
  database = getDatabase(app);
  storage = getStorage(app);
  auth = getAuth(app);
  
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