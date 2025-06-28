"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { XCircle, User, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useStudentStoreContext } from "@/components/providers/student-store-provider"

export default function AccessDeniedPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = searchParams.get("id")
  const source = searchParams.get("source") // 'q10' o null
  const reason = searchParams.get("reason") // 'no_id_q10', 'q10_error'
  const [student, setStudent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const { getStudentById } = useStudentStoreContext()

  useEffect(() => {
    const fetchStudent = async () => {
      if (id) {
        const foundStudent = await getStudentById(id)
        setStudent(foundStudent)
      }
      setLoading(false)
    }
    fetchStudent()

    // Redirección automática después de 5 segundos
    const timer = setTimeout(() => {
      router.push("/dashboard/escanear")
    }, 10000) // Redirigir después de 5 segundos

    return () => clearTimeout(timer) // Limpiar el timeout si el componente se desmonta o el ID cambia
  }, [id, getStudentById, router])

  const getReasonMessage = () => {
    switch (reason) {
      case "no_id_q10":
        return "No se pudo extraer una identificación válida del certificado Q10."
      case "q10_error":
        return "Hubo un error al procesar el certificado Q10."
      default:
        return "La identificación no se encontró en la base de datos."
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-900 mx-auto"></div>
          <p className="mt-2 text-red-700">Cargando información...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
      <Card className="w-full max-w-md text-center border-red-300 shadow-lg">
        <CardHeader className="space-y-4">
          <XCircle className="mx-auto h-20 w-20 text-red-600" />
          <CardTitle className="text-3xl font-bold text-red-800">¡Acceso Denegado!</CardTitle>
          <CardDescription className="text-red-700 text-lg">{getReasonMessage()}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {id && (
            <div className="bg-red-100 p-4 rounded-lg space-y-2 text-left">
              <div className="flex items-center gap-2 text-red-800">
                <User className="h-5 w-5" />
                <h3 className="text-xl font-semibold">Identificación Escaneada:</h3>
              </div>
              <p className="text-red-700 font-medium">{id}</p>
              {source === "q10" && (
                <p className="text-red-700 text-sm mt-2">
                  <span className="font-medium">Fuente:</span> Certificado Q10
                </p>
              )}
            </div>
          )}
          <Button
            onClick={() => router.push("/dashboard/escanear")}
            className="w-full bg-red-600 hover:bg-red-700 text-white"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Escanear
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
