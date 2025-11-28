"use client"

import type React from "react"
import { createContext, useContext, useCallback } from "react"
import { collection, query, where, getDocs, addDoc, updateDoc, doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { MealInventory } from "@/lib/firestore-service"
import { consumeTableMeal } from "@/lib/firestore-service"

interface Student {
  id: string
  puesto: string
  identificacion: string
  nombre: string
  programa: string
  cuposExtras: number
  cuposConsumidos?: number
}

export interface AccessLog {
  identificacion: string
  timestamp: string
  status: "granted" | "denied" | "q10_success" | "q10_failed"
  details?: string
  source?: "direct" | "q10" | "manual"
  grantedByUserId?: string
  grantedByUserName?: string
  grantedByUserEmail?: string
  grantedByUserRole?: string
  mesaUsada?: number
}

interface UserInfo {
  userId?: string
  userName?: string
  userEmail?: string
  userRole?: string
  mesaAsignada?: number
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
  validateMesaAccess: (identificacion: string, mesaRequerida: number) => Promise<{ valid: boolean; message: string }>
  checkMesaStatus: (mesaNumero: number) => Promise<boolean>
  checkAccessGranted: (identificacion: string) => Promise<boolean>
  getMealInventory: () => Promise<MealInventory>
  decrementMealInventory: () => Promise<boolean>
  isSystemUser: (identificacion: string) => Promise<boolean>
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
  const getMealInventory = useCallback(async (): Promise<MealInventory> => {
    try {
      const inventoryRef = doc(db, "config", "meal_inventory")
      const inventorySnap = await getDoc(inventoryRef)

      if (inventorySnap.exists()) {
        return inventorySnap.data() as MealInventory
      } else {
        const defaultInventory: MealInventory = {
          totalComidas: 2400,
          comidasConsumidas: 0,
          comidasDisponibles: 2400,
          fechaActualizacion: new Date().toISOString(),
        }
        await setDoc(inventoryRef, defaultInventory)
        return defaultInventory
      }
    } catch (error) {
      console.error("Error al obtener inventario:", error)
      throw error
    }
  }, [])

  const decrementMealInventory = useCallback(async (): Promise<boolean> => {
    try {
      const inventoryRef = doc(db, "config", "meal_inventory")
      const currentInventory = await getMealInventory()

      if (currentInventory.comidasDisponibles <= 0) {
        console.error("[v0] No hay comidas disponibles en el inventario")
        return false
      }

      const updatedInventory: MealInventory = {
        totalComidas: currentInventory.totalComidas,
        comidasConsumidas: currentInventory.comidasConsumidas + 1,
        comidasDisponibles: currentInventory.comidasDisponibles - 1,
        fechaActualizacion: new Date().toISOString(),
      }

      await setDoc(inventoryRef, updatedInventory)
      console.log("[v0] Inventario actualizado:", updatedInventory)
      return true
    } catch (error) {
      console.error("Error al decrementar inventario:", error)
      return false
    }
  }, [getMealInventory])

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
        const tableMealSuccess = await consumeTableMeal(mesaRequerida)
        if (!tableMealSuccess) {
          return {
            valid: false,
            message: `⚠️ La Mesa ${mesaRequerida} no tiene comidas disponibles o está inactiva`,
          }
        }

        const inventory = await getMealInventory()
        if (inventory.comidasDisponibles <= 0) {
          return {
            valid: false,
            message: `⚠️ No hay comidas disponibles en el inventario global`,
          }
        }

        const mesaActiva = await checkMesaStatus(mesaRequerida)
        if (!mesaActiva) {
          return {
            valid: false,
            message: `La Mesa ${mesaRequerida} está inactiva`,
          }
        }

        const student = await getStudentById(identificacion)
        if (!student) {
          return { valid: false, message: "Estudiante no encontrado" }
        }

        const cuposTotales = 2 + student.cuposExtras
        const cuposConsumidos = student.cuposConsumidos || 0
        const cuposDisponibles = cuposTotales - cuposConsumidos

        if (cuposDisponibles <= 0) {
          return {
            valid: false,
            message: `❌ Se acabaron los cupos. Ya consumió todas sus ${cuposTotales} comidas`,
          }
        }

        return {
          valid: true,
          message: `Comida entregada exitosamente en Mesa ${mesaRequerida}. Cupos: ${cuposDisponibles - 1}/${cuposTotales}`,
        }
      } catch (error) {
        console.error("Error al validar acceso:", error)
        return { valid: false, message: "Error al validar el acceso" }
      }
    },
    [getStudentById, checkMesaStatus, getMealInventory],
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
        console.log("[v0] UserInfo recibido en markStudentAccess:", userInfo)

        const shouldConsumeCupo = userInfo?.mesaAsignada !== undefined && userInfo?.mesaAsignada !== null

        if (granted && shouldConsumeCupo) {
          const inventorySuccess = await decrementMealInventory()
          if (!inventorySuccess) {
            throw new Error("No se pudo actualizar el inventario de comidas")
          }

          const student = await getStudentById(identificacion)
          if (student) {
            const cuposConsumidos = (student.cuposConsumidos || 0) + 1
            await updateDoc(doc(db, "personas", student.id), {
              cuposConsumidos: cuposConsumidos,
            })
            console.log(`[v0] 1 comida consumida para ${identificacion}. Total acumulado: ${cuposConsumidos}`)
          }
        } else if (granted && !shouldConsumeCupo) {
          console.log(`[v0] Acceso registrado para ${identificacion} sin consumir cupo (rol admin/operativo)`)
        }

        if (granted) {
          const log: AccessLog = {
            identificacion,
            timestamp: new Date().toISOString(),
            status: "granted",
            details: details || "Acceso concedido",
            source: source || "direct",
            grantedByUserId: userInfo?.userId || "unknown",
            grantedByUserName: userInfo?.userName || "Usuario desconocido",
            grantedByUserEmail: userInfo?.userEmail || "sin-email@sistema.com",
            grantedByUserRole: userInfo?.userRole || "Usuario",
          }

          if (userInfo?.mesaAsignada !== undefined && userInfo?.mesaAsignada !== null) {
            log.mesaUsada = userInfo.mesaAsignada
          }

          console.log("[v0] Log completo a guardar en Firebase:", log)
          await addDoc(collection(db, "access_logs"), log)
          console.log("[v0] Registro de acceso guardado exitosamente en Firebase")
        } else {
          const hasAccessGranted = await checkAccessGranted(identificacion)
          if (!hasAccessGranted) {
            const log: AccessLog = {
              identificacion,
              timestamp: new Date().toISOString(),
              status: "denied",
              details: details || "Acceso denegado",
              source: source || "direct",
              grantedByUserId: userInfo?.userId || "unknown",
              grantedByUserName: userInfo?.userName || "Usuario desconocido",
              grantedByUserEmail: userInfo?.userEmail || "sin-email@sistema.com",
              grantedByUserRole: userInfo?.userRole || "Usuario",
            }

            if (userInfo?.mesaAsignada !== undefined && userInfo?.mesaAsignada !== null) {
              log.mesaUsada = userInfo.mesaAsignada
            }

            console.log("[v0] Log de acceso denegado guardado:", log)
            await addDoc(collection(db, "access_logs"), log)
          } else {
            console.log("[v0] No se registra el acceso denegado porque ya existe un acceso concedido previo")
          }
        }
      } catch (error) {
        console.error("Error al registrar acceso:", error)
        throw error
      }
    },
    [getStudentById, checkAccessGranted, decrementMealInventory],
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
          grantedByUserRole: userInfo?.userRole || "Usuario",
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

  const isSystemUser = useCallback(async (identificacion: string): Promise<boolean> => {
    try {
      console.log("[v0] Verificando si la identificación es de un usuario del sistema:", identificacion)
      const q = query(collection(db, "users"), where("idNumber", "==", identificacion))
      const querySnapshot = await getDocs(q)

      const isUser = !querySnapshot.empty
      console.log("[v0] Es usuario del sistema:", isUser)
      return isUser
    } catch (error) {
      console.error("Error al verificar si es usuario del sistema:", error)
      return false
    }
  }, [])

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
        getMealInventory,
        decrementMealInventory,
        isSystemUser,
      }}
    >
      {children}
    </StudentStoreContext.Provider>
  )
}
