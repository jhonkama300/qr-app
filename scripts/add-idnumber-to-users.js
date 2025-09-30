import { initializeApp } from "firebase/app"
import { getFirestore, collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore"

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
const db = getFirestore(app)

// Mapeo de emails a números de identificación
const userMigrations = [
  { email: "jhonkama300@gmail.com", idNumber: "1003380205" },
  { email: "elicenith@gmail.com", idNumber: "1065654403" },
]

async function migrateUsers() {
  console.log("[v0] Iniciando migración de usuarios...")

  for (const migration of userMigrations) {
    try {
      console.log(`[v0] Buscando usuario con email: ${migration.email}`)

      // Buscar el usuario por email
      const usersRef = collection(db, "users")
      const q = query(usersRef, where("email", "==", migration.email))
      const querySnapshot = await getDocs(q)

      if (querySnapshot.empty) {
        console.log(`[v0] ⚠️ No se encontró usuario con email: ${migration.email}`)
        continue
      }

      // Actualizar cada documento encontrado
      for (const docSnapshot of querySnapshot.docs) {
        const userRef = doc(db, "users", docSnapshot.id)
        await updateDoc(userRef, {
          idNumber: migration.idNumber,
        })

        console.log(`[v0] ✅ Usuario ${migration.email} actualizado con idNumber: ${migration.idNumber}`)
      }
    } catch (error) {
      console.error(`[v0] ❌ Error al migrar usuario ${migration.email}:`, error)
    }
  }

  console.log("[v0] Migración completada!")
  process.exit(0)
}

// Ejecutar la migración
migrateUsers().catch((error) => {
  console.error("[v0] Error fatal:", error)
  process.exit(1)
})
