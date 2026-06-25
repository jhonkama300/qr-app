"use client"

import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
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

const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

// Función para validar login de estudiante
export const validateStudentLogin = async (identificacion: string, password: string): Promise<StudentUser | null> => {
  try {
    const hashedPassword = await hashPassword(password)

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
