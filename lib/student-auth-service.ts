"use client"

import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import CryptoJS from "crypto-js"

export interface StudentUser {
  id: string
  identificacion: string
  nombre: string
  programa: string
  puesto: string
  cuposExtras: number
  cuposConsumidos: number
  mesaAsignada?: number
}

// Función para hashear contraseñas
const hashPassword = (password: string): string => {
  return CryptoJS.SHA256(password).toString()
}

// Función para validar login de estudiante
export const validateStudentLogin = async (identificacion: string, password: string): Promise<StudentUser | null> => {
  try {
    const hashedPassword = hashPassword(password)

    // Buscar estudiante por identificación y contraseña
    const q = query(
      collection(db, "personas"),
      where("identificacion", "==", identificacion),
      where("password", "==", hashedPassword),
    )

    const querySnapshot = await getDocs(q)

    if (querySnapshot.empty) {
      return null // Estudiante no encontrado o contraseña incorrecta
    }

    const studentDoc = querySnapshot.docs[0]
    const studentData = studentDoc.data()

    return {
      id: studentDoc.id,
      identificacion: studentData.identificacion,
      nombre: studentData.nombre,
      programa: studentData.programa,
      puesto: studentData.puesto,
      cuposExtras: studentData.cuposExtras || 0,
      cuposConsumidos: studentData.cuposConsumidos || 0,
      mesaAsignada: studentData.mesaAsignada,
    }
  } catch (error) {
    console.error("Error al validar login de estudiante:", error)
    return null
  }
}

// Función para obtener información actualizada del estudiante
export const getStudentInfo = async (identificacion: string): Promise<StudentUser | null> => {
  try {
    const q = query(collection(db, "personas"), where("identificacion", "==", identificacion))
    const querySnapshot = await getDocs(q)

    if (querySnapshot.empty) {
      return null
    }

    const studentDoc = querySnapshot.docs[0]
    const studentData = studentDoc.data()

    return {
      id: studentDoc.id,
      identificacion: studentData.identificacion,
      nombre: studentData.nombre,
      programa: studentData.programa,
      puesto: studentData.puesto,
      cuposExtras: studentData.cuposExtras || 0,
      cuposConsumidos: studentData.cuposConsumidos || 0,
      mesaAsignada: studentData.mesaAsignada,
    }
  } catch (error) {
    console.error("Error al obtener información del estudiante:", error)
    return null
  }
}
