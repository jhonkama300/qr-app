"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle, User, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useStudentStoreContext } from "@/components/providers/student-store-provider"

export default function AccessGrantedPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = searchParams.get("id")
  const source = searchParams.get("source") // 'q10' o null
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50 p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-900 mx-auto"></div>
          <p className="mt-2 text-green-700">Cargando información...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-green-50 p-4">
      <Card className="w-full max-w-md text-center border-green-300 shadow-lg">
        <CardHeader className="space-y-4">
          <CheckCircle className="mx-auto h-20 w-20 text-green-600" />
          <CardTitle className="text-3xl font-bold text-green-800">¡Acceso Concedido!</CardTitle>
          <CardDescription className="text-green-700 text-lg">
            La persona ha sido validada exitosamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {student ? (
            <div className="bg-green-100 p-4 rounded-lg space-y-2 text-left">
              <div className="flex items-center gap-2 text-green-800">
                <User className="h-5 w-5" />
                <h3 className="text-xl font-semibold">{student.nombre}</h3>
              </div>
              <p className="text-green-700">
                <span className="font-medium">Identificación:</span> {student.identificacion}
              </p>
              <p className="text-green-700">
                <span className="font-medium">Puesto:</span> {student.puesto}
              </p>
              <p className="text-green-700">
                <span className="font-medium">Programa:</span> {student.programa}
              </p>
              <p className="text-green-700">
                <span className="font-medium">Cupos Extras:</span> {student.cuposExtras}
              </p>
              {source === "q10" && (
                <p className="text-green-700 text-sm mt-2">
                  <span className="font-medium">Validado por:</span> Certificado Q10
                </p>
              )}
            </div>
          ) : (
            <div className="bg-green-100 p-4 rounded-lg text-green-700">
              <p className="font-medium">Identificación: {id || "No disponible"}</p>
              <p className="text-sm mt-2">No se pudo cargar la información detallada del estudiante.</p>
            </div>
          )}
          <Button
            onClick={() => router.push("/dashboard/escanear")}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Escanear
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
