"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, User, Lock, ArrowLeft, GraduationCap, Shield } from "lucide-react"
import { checkIdType, validateLogin } from "@/lib/auth-service"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

type LoginStep = "id" | "password" | "student-info"

export function UnifiedLogin() {
  const [step, setStep] = useState<LoginStep>("id")
  const [idNumber, setIdNumber] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [userType, setUserType] = useState<"admin" | "student" | null>(null)
  const [studentData, setStudentData] = useState<any>(null)
  const { login } = useAuth()
  const router = useRouter()

  const handleIdSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    console.log("[v0] Iniciando verificación de ID:", idNumber)

    try {
      const result = await checkIdType(idNumber)

      console.log("[v0] Resultado de verificación:", result)

      if (result.type === "none") {
        setError("Número de identificación no encontrado en el sistema")
        setLoading(false)
        return
      }

      if (result.type === "admin") {
        console.log("[v0] Usuario admin detectado, solicitando contraseña")
        setUserType("admin")
        setStep("password")
      } else if (result.type === "student") {
        console.log("[v0] Estudiante detectado, mostrando información")
        setUserType("student")
        setStudentData(result.userData)
        setStep("student-info")
      }
    } catch (err) {
      console.error("[v0] Error al verificar la identificación:", err)
      setError("Error al verificar la identificación")
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const user = await validateLogin(idNumber, password)

      if (!user) {
        setError("Contraseña incorrecta")
        setLoading(false)
        return
      }

      login(user)

      // Redirect based on role
      if (user.role === "administrador") {
        router.push("/dashboard")
      } else if (user.role === "operativo") {
        router.push("/dashboard")
      } else if (user.role === "bufete") {
        router.push("/dashboard")
      }
    } catch (err) {
      setError("Error al iniciar sesión")
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    setStep("id")
    setPassword("")
    setError("")
    setUserType(null)
    setStudentData(null)
  }

  const totalCupos = 3 + (studentData?.cuposExtras || 0)
  const cuposDisponibles = totalCupos - (studentData?.cuposConsumidos || 0)
  const progressPercentage = ((studentData?.cuposConsumidos || 0) / totalCupos) * 100

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-blue-50 to-green-100 p-4">
      <Card className="w-full max-w-md shadow-2xl border-2">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg ${
                userType === "student"
                  ? "bg-gradient-to-br from-blue-400 to-blue-600"
                  : "bg-gradient-to-br from-green-400 to-green-600"
              }`}
            >
              {userType === "student" ? (
                <GraduationCap className="w-8 h-8 text-white" />
              ) : (
                <Shield className="w-8 h-8 text-white" />
              )}
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            {step === "id" && "Acceso al Sistema"}
            {step === "password" && "Acceso Administrativo"}
            {step === "student-info" && "Información del Estudiante"}
          </CardTitle>
          <CardDescription>
            {step === "id" && "Ingresa tu número de identificación"}
            {step === "password" && "Ingresa tu contraseña para continuar"}
            {step === "student-info" && "Consulta de información personal"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Step 1: ID Number */}
          {step === "id" && (
            <form onSubmit={handleIdSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="idNumber">Número de Identificación</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="idNumber"
                    type="text"
                    placeholder="Ej: 1234567890"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    className="pl-10"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={loading || !idNumber}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  "Continuar"
                )}
              </Button>
            </form>
          )}

          {/* Step 2: Password (for admin users) */}
          {step === "password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Ingresa tu contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Button
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={loading || !password}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Iniciando sesión...
                    </>
                  ) : (
                    "Iniciar Sesión"
                  )}
                </Button>
                <Button type="button" variant="outline" className="w-full bg-transparent" onClick={handleBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver
                </Button>
              </div>
            </form>
          )}

          {/* Step 3: Student Info Display */}
          {step === "student-info" && studentData && (
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Nombre Completo</span>
                  <span className="text-sm font-bold text-gray-900">{studentData.nombre}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Identificación</span>
                  <span className="text-sm font-bold text-gray-900">{studentData.identificacion}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Programa</span>
                  <span className="text-sm font-bold text-gray-900">{studentData.programa}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Silla Asignada</span>
                  <Badge variant="secondary" className="font-bold">
                    Silla {studentData.silla}
                  </Badge>
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-gray-900">Cupos de Comida</h3>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Cupos Totales</span>
                    <span className="font-bold text-gray-900">{totalCupos}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Cupos Consumidos</span>
                    <span className="font-bold text-red-600">{studentData.cuposConsumidos}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Cupos Disponibles</span>
                    <span className="font-bold text-green-600">{cuposDisponibles}</span>
                  </div>

                  <Progress value={progressPercentage} className="h-2" />
                </div>

                {studentData.cuposExtras > 0 && (
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Cupos Extras</span>
                      <Badge variant="default" className="bg-blue-600">
                        +{studentData.cuposExtras}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <h3 className="font-semibold text-gray-900">Bufetes Asignados</h3>
                {studentData.mesasAsignadas && studentData.mesasAsignadas.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {studentData.mesasAsignadas.map((mesa: number) => (
                      <Badge key={mesa} variant="outline">
                        Bufete {mesa}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No hay bufetes asignados</p>
                )}
              </div>

              <Button type="button" variant="outline" className="w-full bg-transparent" onClick={handleBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Nueva Consulta
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
