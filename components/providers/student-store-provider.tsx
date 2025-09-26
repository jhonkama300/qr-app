"use client"

import type React from "react"
import { createContext, useContext, useCallback } from "react"
import { collection, query, where, getDocs, addDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

interface Student {
  id: string // Corresponde a la identificación en Firestore
  puesto: string
  identificacion: string
  nombre: string
  programa: string
  cuposExtras: number
}

export interface AccessLog {
  // Exportar la interfaz
  identificacion: string
  timestamp: string
  status: "granted" | "denied" | "q10_success" | "q10_failed"
  details?: string
  source?: "direct" | "q10" | "manual" // Nuevo campo para el origen del escaneo/entrada
  grantedByUserId?: string // ID del usuario que otorgó el acceso
  grantedByUserName?: string // Nombre del usuario que otorgó el acceso
  grantedByUserEmail?: string // Email del usuario que otorgó el acceso
}

interface UserInfo {
  userId?: string
  userName?: string
  userEmail?: string
}

interface StudentStoreContextType {
  getStudentById: (id: string) => Promise<Student | null>
  markStudentAccess: (
    id: string,
    granted: boolean,
    details?: string,
    source?: "direct" | "q10" | "manual",
    userInfo?: UserInfo,
  ) => Promise<void>
  markQ10Access: (
    id: string,
    status: "q10_success" | "q10_failed",
    details?: string,
    source?: "direct" | "q10" | "manual",
    userInfo?: UserInfo,
  ) => Promise<void>
}

const StudentStoreContext = createContext<StudentStoreContextType | undefined>(undefined)

export const useStudentStoreContext = () => {
  const context = useContext(StudentStoreContext)
  if (!context) {
    throw new Error("useStudentStoreContext must be used within a StudentStoreProvider")
  }
  return context
}

export function StudentStoreProvider({ children }: { children: React.ReactNode }) {
  const getStudentById = useCallback(async (identificacion: string): Promise<Student | null> => {
    try {
      console.log("Buscando estudiante por identificación:", identificacion)
      const q = query(collection(db, "personas"), where("identificacion", "==", identificacion))
      const querySnapshot = await getDocs(q)

      if (querySnapshot.empty) {
        console.log("Estudiante no encontrado:", identificacion)
        return null
      }

      const doc = querySnapshot.docs[0]
      const studentData = doc.data()
      console.log("Estudiante encontrado:", studentData.nombre)
      return {
        id: doc.id, // Firestore document ID
        puesto: studentData.puesto,
        identificacion: studentData.identificacion,
        nombre: studentData.nombre,
        programa: studentData.programa,
        cuposExtras: studentData.cuposExtras,
      } as Student
    } catch (error) {
      console.error("Error al obtener estudiante por ID:", error)
      return null
    }
  }, [])

  const markStudentAccess = useCallback(
    async (
      identificacion: string,
      granted: boolean,
      details?: string,
      source?: "direct" | "q10" | "manual",
      userInfo?: UserInfo,
    ) => {
      try {
        const log: AccessLog = {
          identificacion,
          timestamp: new Date().toISOString(),
          status: granted ? "granted" : "denied",
          details: details || (granted ? "Acceso concedido" : "Acceso denegado"),
          source: source || "direct", // Guardar el origen
          grantedByUserId: userInfo?.userId,
          grantedByUserName: userInfo?.userName,
          grantedByUserEmail: userInfo?.userEmail,
        }
        await addDoc(collection(db, "access_logs"), log)
        console.log("Registro de acceso guardado:", log)
      } catch (error) {
        console.error("Error al registrar acceso:", error)
      }
    },
    [],
  )

  const markQ10Access = useCallback(
    async (
      identificacion: string,
      status: "q10_success" | "q10_failed",
      details?: string,
      source?: "direct" | "q10" | "manual",
      userInfo?: UserInfo,
    ) => {
      try {
        const log: AccessLog = {
          identificacion,
          timestamp: new Date().toISOString(),
          status,
          details: details || (status === "q10_success" ? "Validación Q10 exitosa" : "Validación Q10 fallida"),
          source: source || "q10", // Guardar el origen
          grantedByUserId: userInfo?.userId,
          grantedByUserName: userInfo?.userName,
          grantedByUserEmail: userInfo?.userEmail,
        }
        await addDoc(collection(db, "access_logs"), log)
        console.log("Registro de acceso Q10 guardado:", log)
      } catch (error) {
        console.error("Error al registrar acceso Q10:", error)
      }
    },
    [],
  )

  return (
    <StudentStoreContext.Provider value={{ getStudentById, markStudentAccess, markQ10Access }}>
      {children}
    </StudentStoreContext.Provider>
  )
}
