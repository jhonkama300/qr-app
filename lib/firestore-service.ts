"use client"

import { collection, getDocs, writeBatch, doc, setDoc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

interface PersonData {
  puesto: string
  identificacion: string
  nombre: string
  programa: string
  cuposExtras: number
  fechaImportacion?: string
}

export interface MealInventory {
  totalComidas: number // Total de comidas disponibles inicialmente
  comidasConsumidas: number // Comidas ya entregadas
  comidasDisponibles: number // Comidas que quedan por entregar
  fechaActualizacion: string
}

export interface TableMealInventory {
  id?: string
  numeroMesa: number
  nombreMesa: string
  totalComidas: number
  comidasConsumidas: number
  comidasDisponibles: number
  fechaActualizacion: string
  activa: boolean
}

export const getMealInventory = async (): Promise<MealInventory> => {
  try {
    const inventoryRef = doc(db, "config", "meal_inventory")
    const inventorySnap = await getDoc(inventoryRef)

    if (inventorySnap.exists()) {
      return inventorySnap.data() as MealInventory
    } else {
      // Si no existe, crear uno por defecto
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
    console.error("Error al obtener inventario de comidas:", error)
    throw error
  }
}

export const updateMealInventory = async (totalComidas: number): Promise<void> => {
  try {
    const inventoryRef = doc(db, "config", "meal_inventory")
    const currentInventory = await getMealInventory()

    const updatedInventory: MealInventory = {
      totalComidas: totalComidas,
      comidasConsumidas: currentInventory.comidasConsumidas,
      comidasDisponibles: totalComidas - currentInventory.comidasConsumidas,
      fechaActualizacion: new Date().toISOString(),
    }

    await setDoc(inventoryRef, updatedInventory)
  } catch (error) {
    console.error("Error al actualizar inventario de comidas:", error)
    throw error
  }
}

export const resetMealInventory = async (totalComidas = 2400): Promise<void> => {
  try {
    const inventoryRef = doc(db, "config", "meal_inventory")
    const resetInventory: MealInventory = {
      totalComidas: totalComidas,
      comidasConsumidas: 0,
      comidasDisponibles: totalComidas,
      fechaActualizacion: new Date().toISOString(),
    }
    await setDoc(inventoryRef, resetInventory)
  } catch (error) {
    console.error("Error al reiniciar inventario de comidas:", error)
    throw error
  }
}

// Función para importar personas en lotes más pequeños
export const importPersonsToFirestore = async (persons: PersonData[]): Promise<boolean> => {
  try {
    const batchSize = 500 // Firestore permite máximo 500 operaciones por batch
    const batches = []

    // Dividir en lotes
    for (let i = 0; i < persons.length; i += batchSize) {
      const batch = writeBatch(db)
      const batchPersons = persons.slice(i, i + batchSize)

      batchPersons.forEach((person) => {
        const docRef = doc(collection(db, "personas"))
        batch.set(docRef, {
          ...person,
          fechaImportacion: new Date().toISOString(),
        })
      })

      batches.push(batch)
    }

    // Ejecutar todos los lotes
    for (const batch of batches) {
      await batch.commit()
    }

    return true
  } catch (error) {
    console.error("Error al importar a Firestore:", error)
    throw error
  }
}

// Función para obtener todas las personas
export const getPersonsFromFirestore = async (): Promise<PersonData[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, "personas"))
    const persons: PersonData[] = []

    querySnapshot.forEach((doc) => {
      persons.push({
        id: doc.id,
        ...doc.data(),
      } as PersonData & { id: string })
    })

    return persons
  } catch (error) {
    console.error("Error al obtener personas:", error)
    throw error
  }
}

export const getTableMealInventory = async (numeroMesa: number): Promise<TableMealInventory | null> => {
  try {
    const tableRef = doc(db, "table_meal_inventory", `mesa_${numeroMesa}`)
    const tableSnap = await getDoc(tableRef)

    if (tableSnap.exists()) {
      return { id: tableSnap.id, ...tableSnap.data() } as TableMealInventory
    }
    return null
  } catch (error) {
    console.error("Error al obtener inventario de mesa:", error)
    throw error
  }
}

export const getAllTableMealInventories = async (): Promise<TableMealInventory[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, "table_meal_inventory"))
    const tables: TableMealInventory[] = []

    querySnapshot.forEach((doc) => {
      tables.push({ id: doc.id, ...doc.data() } as TableMealInventory)
    })

    return tables.sort((a, b) => a.numeroMesa - b.numeroMesa)
  } catch (error) {
    console.error("Error al obtener inventarios de mesas:", error)
    throw error
  }
}

export const createOrUpdateTableMealInventory = async (
  numeroMesa: number,
  nombreMesa: string,
  totalComidas: number,
  activa = true,
): Promise<void> => {
  try {
    const tableRef = doc(db, "table_meal_inventory", `mesa_${numeroMesa}`)
    const existingTable = await getDoc(tableRef)

    let tableData: TableMealInventory

    if (existingTable.exists()) {
      // Actualizar mesa existente
      const current = existingTable.data() as TableMealInventory
      tableData = {
        numeroMesa,
        nombreMesa,
        totalComidas,
        comidasConsumidas: current.comidasConsumidas,
        comidasDisponibles: totalComidas - current.comidasConsumidas,
        fechaActualizacion: new Date().toISOString(),
        activa,
      }
    } else {
      // Crear nueva mesa
      tableData = {
        numeroMesa,
        nombreMesa,
        totalComidas,
        comidasConsumidas: 0,
        comidasDisponibles: totalComidas,
        fechaActualizacion: new Date().toISOString(),
        activa,
      }
    }

    await setDoc(tableRef, tableData)
  } catch (error) {
    console.error("Error al crear/actualizar inventario de mesa:", error)
    throw error
  }
}

export const addMealsToTable = async (numeroMesa: number, cantidadComidas: number): Promise<void> => {
  try {
    const tableRef = doc(db, "table_meal_inventory", `mesa_${numeroMesa}`)
    const tableSnap = await getDoc(tableRef)

    if (!tableSnap.exists()) {
      throw new Error(`La mesa ${numeroMesa} no existe`)
    }

    const currentTable = tableSnap.data() as TableMealInventory
    const updatedTable: TableMealInventory = {
      ...currentTable,
      totalComidas: currentTable.totalComidas + cantidadComidas,
      comidasDisponibles: currentTable.comidasDisponibles + cantidadComidas,
      fechaActualizacion: new Date().toISOString(),
    }

    await setDoc(tableRef, updatedTable)
  } catch (error) {
    console.error("Error al agregar comidas a la mesa:", error)
    throw error
  }
}

export const deleteTableMealInventory = async (numeroMesa: number): Promise<void> => {
  try {
    const tableRef = doc(db, "table_meal_inventory", `mesa_${numeroMesa}`)
    const batch = writeBatch(db)

    // Eliminar completamente el documento
    batch.delete(tableRef)

    await batch.commit()
  } catch (error) {
    console.error("Error al eliminar inventario de mesa:", error)
    throw error
  }
}

export const consumeTableMeal = async (numeroMesa: number): Promise<boolean> => {
  try {
    const tableRef = doc(db, "table_meal_inventory", `mesa_${numeroMesa}`)
    const tableSnap = await getDoc(tableRef)

    if (!tableSnap.exists()) {
      return true // Si no hay inventario por mesa, permitir
    }

    const table = tableSnap.data() as TableMealInventory

    if (!table.activa || table.comidasDisponibles <= 0) {
      return false
    }

    const updatedTable: TableMealInventory = {
      ...table,
      comidasConsumidas: table.comidasConsumidas + 1,
      comidasDisponibles: table.comidasDisponibles - 1,
      fechaActualizacion: new Date().toISOString(),
    }

    await setDoc(tableRef, updatedTable)
    return true
  } catch (error) {
    console.error("Error al consumir comida de mesa:", error)
    throw error
  }
}
