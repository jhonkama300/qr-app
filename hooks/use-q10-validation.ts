"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useStudentStoreContext } from "@/components/providers/student-store-provider"

interface Q10Message {
  type: "info" | "success" | "error"
  text: string
}

export function useQ10Validation() {
  const [isProcessingQ10, setIsProcessingQ10] = useState(false)
  const [q10Message, setQ10Message] = useState<Q10Message | null>(null)
  const { getStudentById, markQ10Access } = useStudentStoreContext()
  const router = useRouter()

  const processQ10Url = useCallback(
    async (url: string) => {
      setIsProcessingQ10(true)
      setQ10Message({ type: "info", text: "Accediendo a la URL de Q10..." })

      try {
        // Llama a tu API route para hacer el scraping
        const response = await fetch(`/api/scrape-page?url=${encodeURIComponent(url)}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Error al acceder a la página de Q10")
        }

        const identificacion = data.identificacion

        if (!identificacion) {
          setQ10Message({ type: "error", text: "No se encontró identificación en la página de Q10." })
          await markQ10Access("N/A", "q10_failed", "No se encontró identificación en la página de Q10.")
          router.push(`/access-denied?reason=no_id_q10`)
          return
        }

        setQ10Message({
          type: "info",
          text: `Identificación encontrada: ${identificacion}. Verificando en base de datos...`,
        })

        // Buscar en la base de datos local
        const student = await getStudentById(identificacion)

        if (student) {
          setQ10Message({ type: "success", text: `Estudiante ${student.nombre} encontrado y validado.` })
          await markQ10Access(identificacion, "q10_success", `Estudiante ${student.nombre} validado por Q10.`)
          router.push(`/access-granted?id=${identificacion}&source=q10`)
        } else {
          setQ10Message({ type: "error", text: `Identificación ${identificacion} no encontrada en la base de datos.` })
          await markQ10Access(identificacion, "q10_failed", `Identificación ${identificacion} no encontrada en BD.`)
          router.push(`/access-denied?id=${identificacion}&source=q10`)
        }
      } catch (error: any) {
        console.error("Error en processQ10Url:", error)
        setQ10Message({ type: "error", text: `Error al validar Q10: ${error.message}` })
        await markQ10Access("N/A", "q10_failed", `Error al validar Q10: ${error.message}`)
        router.push(`/access-denied?reason=q10_error`)
      } finally {
        setIsProcessingQ10(false)
      }
    },
    [getStudentById, markQ10Access, router],
  )

  return { processQ10Url, isProcessingQ10, q10Message }
}
