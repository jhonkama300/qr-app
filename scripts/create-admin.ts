import { addDoc, collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import CryptoJS from "crypto-js"

export const createFirstAdmin = async () => {
  const adminEmail = "admin@ejemplo.com"
  const adminPassword = "123456"

  try {
    const q = query(collection(db, "users"), 
    where("email", "==", adminEmail))
    where("isVisible", "==", true)
    const querySnapshot = await getDocs(q)

    if (!querySnapshot.empty) {
      console.log("El administrador ya existe")
      return false
    }

    const hashedPassword = CryptoJS.SHA256(adminPassword).toString()

    await addDoc(collection(db, "users"), {
      email: adminEmail,
      password: hashedPassword,
      role: "administrador",
      createdAt: new Date().toISOString(),
    })

    console.log("Administrador creado exitosamente")
    console.log(`Email: ${adminEmail}`)
    console.log(`Contraseña: ${adminPassword}`)
    return true
  } catch (error) {
    console.error("Error al crear administrador:", error)
    return false
  }
}
