"use client"

import { collection, query, where, getDocs, addDoc, updateDoc, doc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import CryptoJS from "crypto-js"

export interface User {
  id: string
  email: string
  role: "administrador" | "operativo" | "bufete"
  mesaAsignada?: number
  createdAt: string
  hasDefaultPassword?: boolean
}

// Función para hashear contraseñas
const hashPassword = (password: string): string => {
  return CryptoJS.SHA256(password).toString()
}

const DEFAULT_PASSWORD = "Uparsistem123"
const DEFAULT_PASSWORD_HASH = hashPassword(DEFAULT_PASSWORD)

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

    const hasDefaultPassword = hashedPassword === DEFAULT_PASSWORD_HASH

    return {
      id: userDoc.id,
      email: userData.email,
      role: userData.role,
      mesaAsignada: userData.mesaAsignada,
      createdAt: userData.createdAt,
      hasDefaultPassword,
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
  role: "administrador" | "operativo" | "bufete",
  mesaAsignada?: number,
): Promise<boolean> => {
  try {
    const hashedPassword = hashPassword(password)

    // Verificar si el usuario ya existe
    const q = query(collection(db, "users"), where("email", "==", email))
    const querySnapshot = await getDocs(q)

    if (!querySnapshot.empty) {
      throw new Error("El usuario ya existe")
    }

    const userData: any = {
      email,
      password: hashedPassword,
      role,
      createdAt: new Date().toISOString(),
    }

    if (role === "bufete" && mesaAsignada) {
      userData.mesaAsignada = mesaAsignada
    }

    await addDoc(collection(db, "users"), userData)

    return true
  } catch (error) {
    console.error("Error al crear usuario:", error)
    throw error
  }
}

export const resetUserPassword = async (userId: string): Promise<boolean> => {
  try {
    await updateDoc(doc(db, "users", userId), {
      password: DEFAULT_PASSWORD_HASH,
    })
    return true
  } catch (error) {
    console.error("Error al restaurar contraseña:", error)
    throw error
  }
}

export const changePassword = async (userId: string, newPassword: string): Promise<boolean> => {
  try {
    const hashedPassword = hashPassword(newPassword)
    await updateDoc(doc(db, "users", userId), {
      password: hashedPassword,
    })
    return true
  } catch (error) {
    console.error("Error al cambiar contraseña:", error)
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
