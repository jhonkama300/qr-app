"use client"

import { useState } from "react"
import { createFirstAdmin } from "@/scripts/create-admin"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield, CheckCircle, AlertCircle } from "lucide-react"

export default function SetupPage() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")

  const handleCreateAdmin = async () => {
    setLoading(true)
    setError("")
    setSuccess(false)

    try {
      const result = await createFirstAdmin()
      if (result) {
        setSuccess(true)
      } else {
        setError("El administrador ya existe o hubo un error")
      }
    } catch (err) {
      setError("Error al crear el administrador")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Shield className="w-6 h-6 text-blue-600" />
          </div>
          <CardTitle className="text-xl">Configuración Inicial</CardTitle>
          <CardDescription>Crea el primer usuario administrador para comenzar a usar el sistema</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50 text-green-800">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">¡Administrador creado exitosamente!</p>
                  <div className="text-sm">
                    <p>
                      <strong>Email:</strong> admin@ejemplo.com
                    </p>
                    <p>
                      <strong>Contraseña:</strong> 123456
                    </p>
                    <p className="text-red-600 mt-2">⚠️ Cambia la contraseña después del primer login</p>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Credenciales por defecto:</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>
                <strong>Email:</strong> admin@ejemplo.com
              </p>
              <p>
                <strong>Contraseña:</strong> 123456
              </p>
              <p>
                <strong>Rol:</strong> Administrador
              </p>
            </div>
          </div>

          <Button onClick={handleCreateAdmin} disabled={loading || success} className="w-full">
            {loading ? "Creando..." : success ? "Administrador Creado" : "Crear Administrador"}
          </Button>

          {success && (
            <div className="text-center">
              <a href="/" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                Ir al Login →
              </a>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
