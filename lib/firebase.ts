import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

// Configuración de Firebase - Reemplaza con tus credenciales
const firebaseConfig = {
  apiKey: "AIzaSyCs6WeOtOh6cxjyBYTXmO4zaaNNnAzJ8-w",
  authDomain: "qr-access-a29ad.firebaseapp.com",
  projectId: "qr-access-a29ad",
  storageBucket: "qr-access-a29ad.firebasestorage.app",
  messagingSenderId: "172471519148",
  appId: "1:172471519148:web:2404efb1cdf871bec0dc09",
}

// Inicializar Firebase
const app = initializeApp(firebaseConfig)

// Inicializar Firebase Auth
export const auth = getAuth(app)

// Inicializar Firestore
export const db = getFirestore(app)

export default app
