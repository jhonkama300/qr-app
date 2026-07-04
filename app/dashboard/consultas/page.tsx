"use client"

import { useAuth } from "@/components/auth-provider"
import { StudentConsultation } from "@/components/student-consultation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye } from "lucide-react"

export default function ConsultasPage() {
  const { user, isConsultor, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-2 md:p-4">
      {isConsultor && (
        <Alert className="border-purple-200 bg-purple-50 text-purple-800">
          <Eye className="h-4 w-4" />
          <AlertDescription>
            Modo consulta - Solo puedes visualizar los datos
          </AlertDescription>
        </Alert>
      )}
      <StudentConsultation />
    </main>
  )
}
