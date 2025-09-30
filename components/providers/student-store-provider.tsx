"use client"

import type React from "react"
import { createContext, useContext, useCallback } from "react"
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from "firebase/firestore"
import { db } from "@/lib/firebase"

interface Student {
  id: string // Corresponde a la identificación en Firestore
  puesto: string
  identificacion: string
  nombre: string
  programa: string
  cuposExtras: number
  cuposConsumidos?: number // Agregado campo para cupos consumidos
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
  mesaUsada?: number // Agregado campo para la mesa donde se escaneó
}

interface UserInfo {
  userId?: string
  userName?: string
  userEmail?: string
  mesaAsignada?: number // Agregado campo para mesa del usuario
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
  checkIfAlreadyScanned: (identificacion: string) => Promise<boolean>
  validateMesaAccess: (identificacion: string, mesaRequerida: number) => Promise<{ valid: boolean; message: string }> // Nueva función para validar mesa
  checkMesaStatus: (mesaNumero: number) => Promise<boolean> // Nueva función para verificar si una mesa está activa
  checkAccessGranted: (identificacion: string) => Promise<boolean>
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
  const checkMesaStatus = useCallback(async (mesaNumero: number): Promise<boolean> => {
    try {
      const mesasQuery = query(collection(db, "mesas_config"), where("numero", "==", mesaNumero))
      const mesasSnapshot = await getDocs(mesasQuery)

      if (mesasSnapshot.empty) {
        return false // Mesa no encontrada, considerarla inactiva
      }

      const mesaData = mesasSnapshot.docs[0].data()
      return mesaData.activa === true
    } catch (error) {
      console.error("Error al verificar estado de mesa:", error)
      return false
    }
  }, [])

  const checkIfAlreadyScanned = useCallback(async (identificacion: string): Promise<boolean> => {
    try {
      console.log("[v0] Verificando si el usuario ya fue escaneado:", identificacion)
      const q = query(
        collection(db, "access_logs"),
        where("identificacion", "==", identificacion),
        where("status", "==", "granted"),
      )
      const querySnapshot = await getDocs(q)

      const alreadyScanned = !querySnapshot.empty
      console.log("[v0] Usuario ya escaneado:", alreadyScanned)
      return alreadyScanned
    } catch (error) {
      console.error("Error al verificar si el usuario ya fue escaneado:", error)
      return false
    }
  }, [])

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
        cuposConsumidos: studentData.cuposConsumidos || 0, // Incluir cupos consumidos
      } as Student
    } catch (error) {
      console.error("Error al obtener estudiante por ID:", error)
      return null
    }
  }, [])

  const checkAccessGranted = useCallback(async (identificacion: string): Promise<boolean> => {
    try {
      console.log("[v0] Verificando si el estudiante tiene acceso concedido:", identificacion)
      const q = query(
        collection(db, "access_logs"),
        where("identificacion", "==", identificacion),
        where("status", "==", "granted"),
      )
      const querySnapshot = await getDocs(q)

      const hasAccess = !querySnapshot.empty
      console.log("[v0] Estudiante tiene acceso concedido:", hasAccess)
      return hasAccess
    } catch (error) {
      console.error("Error al verificar acceso concedido:", error)
      return false
    }
  }, [])

  const validateMesaAccess = useCallback(
    async (identificacion: string, mesaRequerida: number): Promise<{ valid: boolean; message: string }> => {
      try {
        const hasAccessGranted = await checkAccessGranted(identificacion)
        if (!hasAccessGranted) {
          return {
            valid: false,
            message: "El estudiante debe pasar primero por control de acceso antes de reclamar comida.",
          }
        }

        const mesaActiva = await checkMesaStatus(mesaRequerida)
        if (!mesaActiva) {
          return {
            valid: false,
            message: `La Mesa ${mesaRequerida} está inactiva. No se puede procesar la entrega.`,
          }
        }

        const student = await getStudentById(identificacion)
        if (!student) {
          return { valid: false, message: "Estudiante no encontrado en la base de datos" }
        }

        const cuposTotales = 2 + student.cuposExtras
        const cuposConsumidos = student.cuposConsumidos || 0
        const cuposDisponibles = cuposTotales - cuposConsumidos

        if (cuposDisponibles <= 0) {
          return { valid: false, message: "No tiene cupos disponibles. Ya consumió todas sus comidas." }
        }

        return {
          valid: true,
          message: `Comida entregada exitosamente. Cupos restantes: ${cuposDisponibles - 1}/${cuposTotales}`,
        }
      } catch (error) {
        console.error("Error al validar acceso por mesa:", error)
        return { valid: false, message: "Error al validar el acceso" }
      }
    },
    [getStudentById, checkMesaStatus, checkAccessGranted],
  )

  const markStudentAccess = useCallback(
    async (
      identificacion: string,
      granted: boolean,
      details?: string,
      source?: "direct" | "q10" | "manual",
      userInfo?: UserInfo,
    ) => {
      try {
        const shouldConsumeCupo = userInfo?.mesaAsignada !== undefined && userInfo?.mesaAsignada !== null

        if (granted && shouldConsumeCupo) {
          const student = await getStudentById(identificacion)
          if (student) {
            const cuposConsumidos = (student.cuposConsumidos || 0) + 1
            await updateDoc(doc(db, "personas", student.id), {
              cuposConsumidos: cuposConsumidos,
            })
            console.log(`[v0] Cupo consumido para ${identificacion}. Total consumidos: ${cuposConsumidos}`)
          }
        } else if (granted && !shouldConsumeCupo) {
          console.log(`[v0] Acceso registrado para ${identificacion} sin consumir cupo (rol admin/operativo)`)
        }

        const log: AccessLog = {
          identificacion,
          timestamp: new Date().toISOString(),
          status: granted ? "granted" : "denied",
          details: details || (granted ? "Acceso concedido" : "Acceso denegado"),
          source: source || "direct",
          grantedByUserId: userInfo?.userId || "unknown",
          grantedByUserName: userInfo?.userName || "Usuario desconocido",
          grantedByUserEmail: userInfo?.userEmail || "sin-email@sistema.com",
        }

        if (userInfo?.mesaAsignada !== undefined && userInfo?.mesaAsignada !== null) {
          log.mesaUsada = userInfo.mesaAsignada
        }

        console.log("[v0] Guardando log de acceso:", log)
        await addDoc(collection(db, "access_logs"), log)
        console.log("Registro de acceso guardado exitosamente")
      } catch (error) {
        console.error("Error al registrar acceso:", error)
        throw error
      }
    },
    [getStudentById],
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
          source: source || "q10",
          grantedByUserId: userInfo?.userId || "unknown",
          grantedByUserName: userInfo?.userName || "Usuario desconocido",
          grantedByUserEmail: userInfo?.userEmail || "sin-email@sistema.com",
        }

        if (userInfo?.mesaAsignada !== undefined && userInfo?.mesaAsignada !== null) {
          log.mesaUsada = userInfo.mesaAsignada
        }

        console.log("[v0] Guardando log de acceso Q10:", log)
        await addDoc(collection(db, "access_logs"), log)
        console.log("Registro de acceso Q10 guardado exitosamente")
      } catch (error) {
        console.error("Error al registrar acceso Q10:", error)
        throw error
      }
    },
    [],
  )

  return (
    <StudentStoreContext.Provider
      value={{
        getStudentById,
        markStudentAccess,
        markQ10Access,
        checkIfAlreadyScanned,
        validateMesaAccess,
        checkMesaStatus,
        checkAccessGranted,
      }}
    >
      {children}
    </StudentStoreContext.Provider>
  )
}
