"use client"

import { collection, getDocs, writeBatch, doc } from "firebase/firestore"
import { db } from "@/lib/firebase"

interface PersonData {
  puesto: string
  identificacion: string
  nombre: string
  programa: string
  cuposExtras: number
  fechaImportacion?: string
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
