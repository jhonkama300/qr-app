"use client"

import { collection, query, where, getDocs, addDoc, updateDoc, doc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import CryptoJS from "crypto-js"

export interface User {
  id: string
  idNumber: string
  fullName: string
  roles: ("administrador" | "operativo" | "bufete")[] // Changed from single role to array of roles
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
export const validateLogin = async (idNumber: string, password: string): Promise<User | null> => {
  try {
    const hashedPassword = hashPassword(password)

    // Buscar usuario por número de identificación y contraseña
    const q = query(collection(db, "users"), where("idNumber", "==", idNumber), where("password", "==", hashedPassword))

    const querySnapshot = await getDocs(q)

    if (querySnapshot.empty) {
      return null // Usuario no encontrado o contraseña incorrecta
    }

    const userDoc = querySnapshot.docs[0]
    const userData = userDoc.data()

    const hasDefaultPassword = hashedPassword === DEFAULT_PASSWORD_HASH

    let roles: ("administrador" | "operativo" | "bufete")[]
    if (Array.isArray(userData.roles)) {
      roles = userData.roles
    } else if (userData.role) {
      // Backward compatibility: convert old single role to array
      roles = [userData.role]
    } else {
      roles = ["operativo"] // Default role
    }

    return {
      id: userDoc.id,
      idNumber: userData.idNumber,
      fullName: userData.fullName,
      roles: roles,
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
  idNumber: string,
  fullName: string,
  password: string,
  roles: ("administrador" | "operativo" | "bufete")[],
  mesaAsignada?: number,
): Promise<boolean> => {
  try {
    const hashedPassword = hashPassword(password)

    // Verificar si el usuario ya existe
    const q = query(collection(db, "users"), where("idNumber", "==", idNumber))
    const querySnapshot = await getDocs(q)

    if (!querySnapshot.empty) {
      throw new Error("El usuario ya existe")
    }

    const userData: any = {
      idNumber,
      fullName,
      password: hashedPassword,
      roles: roles, // Store as array
      createdAt: new Date().toISOString(),
    }

    if (roles.includes("bufete") && mesaAsignada) {
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

// Función para verificar si existe un usuario por número de identificación
export const checkUserExists = async (idNumber: string): Promise<boolean> => {
  try {
    const q = query(collection(db, "users"), where("idNumber", "==", idNumber))
    const querySnapshot = await getDocs(q)
    return !querySnapshot.empty
  } catch (error) {
    console.error("Error al verificar usuario:", error)
    return false
  }
}

export const checkIdType = async (
  idNumber: string,
): Promise<{ type: "admin" | "student" | "invitado" | "none"; userData?: any }> => {
  try {
    console.log("[v0] Verificando tipo de ID:", idNumber)

    const usersQuery = query(collection(db, "users"), where("idNumber", "==", idNumber))
    const usersSnapshot = await getDocs(usersQuery)

    console.log("[v0] Usuarios encontrados:", usersSnapshot.size)

    if (!usersSnapshot.empty) {
      const userData = usersSnapshot.docs[0].data()
      console.log("[v0] Usuario admin encontrado:", userData)

      let roles: ("administrador" | "operativo" | "bufete")[]
      if (Array.isArray(userData.roles)) {
        roles = userData.roles
      } else if (userData.role) {
        roles = [userData.role]
      } else {
        roles = ["operativo"]
      }

      return {
        type: "admin",
        userData: {
          id: usersSnapshot.docs[0].id,
          idNumber: userData.idNumber,
          fullName: userData.fullName,
          roles: roles,
          mesaAsignada: userData.mesaAsignada,
        },
      }
    }

    const studentsQuery = query(collection(db, "personas"), where("identificacion", "==", idNumber))
    const studentsSnapshot = await getDocs(studentsQuery)

    console.log("[v0] Estudiantes encontrados:", studentsSnapshot.size)

    if (!studentsSnapshot.empty) {
      const studentData = studentsSnapshot.docs[0].data()
      console.log("[v0] Estudiante encontrado:", studentData)
      return {
        type: "student",
        userData: {
          id: studentsSnapshot.docs[0].id,
          identificacion: studentData.identificacion,
          nombre: studentData.nombre,
          programa: studentData.programa,
          puesto: studentData.puesto,
          cuposExtras: studentData.cuposExtras || 0,
          cuposConsumidos: studentData.cuposConsumidos || 0,
        },
      }
    }

    const invitadosQuery = query(collection(db, "invitados"), where("identificacion", "==", idNumber))
    const invitadosSnapshot = await getDocs(invitadosQuery)

    console.log("[v0] Invitados encontrados:", invitadosSnapshot.size)

    if (!invitadosSnapshot.empty) {
      const invitadoData = invitadosSnapshot.docs[0].data()
      console.log("[v0] Invitado encontrado:", invitadoData)
      return {
        type: "invitado",
        userData: {
          id: invitadosSnapshot.docs[0].id,
          identificacion: invitadoData.identificacion,
          nombre: invitadoData.nombre,
          puesto: invitadoData.puesto,
          cuposExtras: 0, // Invitados no tienen cupos extras
          cuposConsumidos: invitadoData.cuposConsumidos || 0,
          esInvitado: true,
        },
      }
    }

    console.log("[v0] No se encontró ningún usuario con ID:", idNumber)
    return { type: "none" }
  } catch (error) {
    console.error("[v0] Error al verificar tipo de ID:", error)
    return { type: "none" }
  }
}
