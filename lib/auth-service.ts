"use client"

import { collection, query, where, getDocs, addDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import CryptoJS from "crypto-js"

export interface User {
  id: string
  email: string
  role: "administrador" | "operativo"
  createdAt: string
}

// Función para hashear contraseñas
const hashPassword = (password: string): string => {
  return CryptoJS.SHA256(password).toString()
}

// Función para validar login
export const validateLogin = async (email: string, password: string): Promise<User | null> => {
  try {
    const hashedPassword = hashPassword(password)

    // Buscar usuario por email y contraseña
    const q = query(collection(db, "users"), where("email", "==", email), where("password", "==", hashedPassword))

    const querySnapshot = await getDocs(q)

    if (querySnapshot.empty) {
      return null // Usuario no encontrado o contraseña incorrecta
    }

    const userDoc = querySnapshot.docs[0]
    const userData = userDoc.data()

    return {
      id: userDoc.id,
      email: userData.email,
      role: userData.role,
      createdAt: userData.createdAt,
    }
  } catch (error) {
    console.error("Error al validar login:", error)
    return null
  }
}

// Función para crear usuario
export const createUser = async (
  email: string,
  password: string,
  role: "administrador" | "operativo",
): Promise<boolean> => {
  try {
    const hashedPassword = hashPassword(password)

    // Verificar si el usuario ya existe
    const q = query(collection(db, "users"), where("email", "==", email))
    const querySnapshot = await getDocs(q)

    if (!querySnapshot.empty) {
      throw new Error("El usuario ya existe")
    }

    // Crear nuevo usuario
    await addDoc(collection(db, "users"), {
      email,
      password: hashedPassword,
      role,
      createdAt: new Date().toISOString(),
    })

    return true
  } catch (error) {
    console.error("Error al crear usuario:", error)
    throw error
  }
}

// Función para verificar si existe un usuario por email
export const checkUserExists = async (email: string): Promise<boolean> => {
  try {
    const q = query(collection(db, "users"), where("email", "==", email))
    const querySnapshot = await getDocs(q)
    return !querySnapshot.empty
  } catch (error) {
    console.error("Error al verificar usuario:", error)
    return false
  }
}
