"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, User, Lock, ArrowLeft, GraduationCap, CheckCircle2, Eye, EyeOff } from "lucide-react"
import { checkIdType, validateLogin, changePassword } from "@/lib/auth-service"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import QRCode from "qrcode"
import Image from "next/image"

type LoginStep = "id" | "password"

export function UnifiedLogin() {
  const [step, setStep] = useState<LoginStep>("id")
  const [idNumber, setIdNumber] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [userType, setUserType] = useState<"admin" | "student" | null>(null)
  const [studentData, setStudentData] = useState<any>(null)
  const [showStudentModal, setShowStudentModal] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [changePasswordError, setChangePasswordError] = useState("")
  const [loggedUser, setLoggedUser] = useState<any>(null)
  const { login } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (studentData) {
      const qrData = studentData.identificacion

      QRCode.toDataURL(qrData, {
        width: 200,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      })
        .then((url) => {
          setQrCodeUrl(url)
        })
        .catch((err) => {
          console.error("[v0] Error generando QR:", err)
        })
    }
  }, [studentData])

  const handleIdSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const result = await checkIdType(idNumber)

      if (result.type === "none") {
        setError("Número de identificación no encontrado en el sistema")
        setLoading(false)
        return
      }

      if (result.type === "admin") {
        setUserType("admin")
        setStep("password")
      } else if (result.type === "student") {
        setUserType("student")
        setStudentData(result.userData)
        setShowStudentModal(true)
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

      if (user.hasDefaultPassword) {
        console.log("[v0] Usuario tiene contraseña predeterminada, requiere cambio")
        setLoggedUser(user)
        setShowChangePasswordModal(true)
        setLoading(false)
        return
      }

      login(user)

      let accessMessage = ""
      const primaryRole = user.roles[0] // Use first role as primary
      if (primaryRole === "administrador") {
        accessMessage = "Acceso Administrador"
      } else if (primaryRole === "operativo") {
        accessMessage = "Acceso Operativo"
      } else if (primaryRole === "bufete") {
        accessMessage = "Acceso Bufete"
      }

      setSuccessMessage(accessMessage)
      setLoading(false)

      setTimeout(() => {
        router.push("/dashboard")
      }, 1500)
    } catch (err) {
      setError("Error al iniciar sesión")
      setLoading(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setChangePasswordError("")
    setChangingPassword(true)

    if (newPassword !== confirmPassword) {
      setChangePasswordError("Las contraseñas no coinciden")
      setChangingPassword(false)
      return
    }

    if (newPassword.length < 6) {
      setChangePasswordError("La contraseña debe tener al menos 6 caracteres")
      setChangingPassword(false)
      return
    }

    if (newPassword === "Uparsistem123") {
      setChangePasswordError("No puedes usar la contraseña predeterminada del sistema")
      setChangingPassword(false)
      return
    }

    try {
      if (loggedUser) {
        await changePassword(loggedUser.id, newPassword)

        // Actualizar el usuario para que ya no tenga la contraseña predeterminada
        const updatedUser = { ...loggedUser, hasDefaultPassword: false }
        login(updatedUser)

        let accessMessage = ""
        const primaryRole = updatedUser.roles[0]
        if (primaryRole === "administrador") {
          accessMessage = "Acceso Administrador"
        } else if (primaryRole === "operativo") {
          accessMessage = "Acceso Operativo"
        } else if (primaryRole === "bufete") {
          accessMessage = "Acceso Bufete"
        }

        setSuccessMessage(accessMessage)
        setShowChangePasswordModal(false)
        setChangingPassword(false)

        setTimeout(() => {
          router.push("/dashboard")
        }, 1500)
      }
    } catch (error: any) {
      console.error("[v0] Error al cambiar contraseña:", error)
      setChangePasswordError("Error al cambiar la contraseña. Intenta nuevamente")
      setChangingPassword(false)
    }
  }

  const handleBack = () => {
    setStep("id")
    setPassword("")
    setError("")
    setUserType(null)
    setStudentData(null)
  }

  const handleCloseModal = () => {
    setShowStudentModal(false)
    setIdNumber("")
    setStudentData(null)
    setUserType(null)
  }

  return (
    <>
      <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
        <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover">
          <source src="/videos/background.mp4" type="video/mp4" />
        </video>

        <div className="absolute inset-0 bg-black/40" />

        <Card className="relative z-10 w-full max-w-sm shadow-2xl border-0 overflow-hidden backdrop-blur-sm bg-white/95">
          <div className="bg-gradient-to-r from-lime-500 to-green-600 p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-white rounded-full p-3 shadow-lg">
                <Image
                  src="/images/logoupar.png"
                  alt="Logo Uparsistem"
                  width={80}
                  height={80}
                  className="object-contain"
                />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Bienvenido a Grados</h1>
            <p className="text-lime-50 text-sm font-medium">UPARSISTEM</p>
          </div>

          <CardHeader className="text-center space-y-2 pt-6">
            <CardTitle className="text-xl font-bold text-gray-800">
              {step === "id" && "Acceso al Sistema"}
              {step === "password" && "Acceso Administrativo"}
            </CardTitle>
            <CardDescription className="text-gray-600">
              {step === "id" && "Ingresa tu número de identificación para continuar"}
              {step === "password" && "Ingresa tu contraseña para acceder"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pb-8 px-6">
            {step === "id" && (
              <form onSubmit={handleIdSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="idNumber" className="text-gray-700 font-medium">
                    Número de Identificación
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-5 w-5 text-lime-600" />
                    <Input
                      id="idNumber"
                      type="text"
                      placeholder="Ej: 1234567890"
                      value={idNumber}
                      onChange={(e) => setIdNumber(e.target.value)}
                      className="pl-11 h-12 border-gray-300 focus:border-lime-500 focus:ring-lime-500"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive" className="bg-red-50 border-red-200">
                    <AlertDescription className="text-red-800">{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-lime-500 to-green-600 hover:from-lime-600 hover:to-green-700 text-white font-semibold shadow-md"
                  disabled={loading || !idNumber}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    "Continuar"
                  )}
                </Button>
              </form>
            )}

            {step === "password" && (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-gray-700 font-medium">
                    Contraseña
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-lime-600" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Ingresa tu contraseña"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-11 h-12 border-gray-300 focus:border-lime-500 focus:ring-lime-500"
                      required
                      disabled={loading || !!successMessage}
                    />
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive" className="bg-red-50 border-red-200">
                    <AlertDescription className="text-red-800">{error}</AlertDescription>
                  </Alert>
                )}

                {successMessage && (
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800 font-semibold flex items-center gap-2">
                      {successMessage}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-3">
                  <Button
                    type="submit"
                    className="w-full h-12 bg-gradient-to-r from-lime-500 to-green-600 hover:from-lime-600 hover:to-green-700 text-white font-semibold shadow-md"
                    disabled={loading || !password || !!successMessage}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Iniciando sesión...
                      </>
                    ) : successMessage ? (
                      <>
                        <CheckCircle2 className="mr-2 h-5 w-5" />
                        Redirigiendo...
                      </>
                    ) : (
                      "Iniciar Sesión"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-12 border-gray-300 hover:bg-gray-50 bg-transparent"
                    onClick={handleBack}
                    disabled={!!successMessage}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showStudentModal} onOpenChange={setShowStudentModal}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lime-700">
              <GraduationCap className="w-5 h-5" />
              Información del Graduando
            </DialogTitle>
            <DialogDescription>Consulta de información personal</DialogDescription>
          </DialogHeader>

          {studentData && (
            <div className="space-y-4 py-4">
              <div className="bg-gradient-to-br from-lime-50 to-green-50 rounded-lg p-4 space-y-3 border border-lime-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Nombre Completo</span>
                  <span className="text-sm font-bold text-gray-900 text-right">{studentData.nombre}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Identificación</span>
                  <span className="text-sm font-bold text-gray-900">{studentData.identificacion}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Programa</span>
                  <span className="text-sm font-bold text-gray-900 text-right">{studentData.programa}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Puesto Asignado</span>
                  <Badge className="font-bold bg-lime-600 hover:bg-lime-700">{studentData.puesto}</Badge>
                </div>

                <div className="pt-2 border-t border-lime-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Bufetes Disponibles</span>
                    <span className="text-lg font-bold text-green-600">
                      {2 + (studentData.cuposExtras || 0) - (studentData.cuposConsumidos || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-500">Total de bufetes</span>
                    <span className="text-xs font-semibold text-gray-700">
                      {2 + (studentData.cuposExtras || 0)}
                      {studentData.cuposExtras > 0 && (
                        <span className="text-lime-600">
                          {" "}
                          (2 base + {studentData.cuposExtras} extra{studentData.cuposExtras !== 1 ? "s" : ""})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-500">Bufetes consumidos</span>
                    <span className="text-xs font-semibold text-orange-600">{studentData.cuposConsumidos || 0}</span>
                  </div>
                </div>
              </div>

              {qrCodeUrl && (
                <div className="bg-white rounded-lg p-4 flex flex-col items-center space-y-2 border border-gray-200">
                  <h3 className="font-semibold text-gray-900">Código QR</h3>
                  <p className="text-xs text-gray-500 text-center">Escanea este código para verificar tu información</p>
                  <img
                    src={qrCodeUrl || "/placeholder.svg"}
                    alt="QR Code"
                    className="w-48 h-48 border-2 border-lime-200 rounded-lg"
                  />
                </div>
              )}

              <Button
                type="button"
                className="w-full bg-gradient-to-r from-lime-500 to-green-600 hover:from-lime-600 hover:to-green-700"
                onClick={handleCloseModal}
              >
                Cerrar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showChangePasswordModal} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center text-red-600">
              Cambio de Contraseña Requerido
            </DialogTitle>
            <DialogDescription className="text-center">
              Debes cambiar tu contraseña predeterminada antes de continuar
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleChangePassword} className="space-y-4 py-4">
            {changePasswordError && (
              <Alert variant="destructive" className="text-sm">
                <AlertDescription>{changePasswordError}</AlertDescription>
              </Alert>
            )}

            {successMessage && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 font-semibold flex items-center gap-2">
                  {successMessage}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-sm font-medium">
                Nueva Contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-10 pr-10 h-11"
                  required
                  disabled={changingPassword || !!successMessage}
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={changingPassword || !!successMessage}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirmar Nueva Contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-10 h-11"
                  required
                  disabled={changingPassword || !!successMessage}
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={changingPassword || !!successMessage}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Alert className="border-yellow-200 bg-yellow-50 text-yellow-800">
              <AlertDescription className="text-xs">
                <strong>Requisitos:</strong>
                <ul className="mt-1 list-disc list-inside space-y-1">
                  <li>Mínimo 6 caracteres</li>
                  <li>No puede ser la contraseña predeterminada</li>
                  <li>Debe ser diferente a tu contraseña actual</li>
                </ul>
              </AlertDescription>
            </Alert>

            <Button
              type="submit"
              className="w-full h-11 bg-gradient-to-r from-lime-500 to-green-600 hover:from-lime-600 hover:to-green-700"
              disabled={changingPassword || !!successMessage}
            >
              {changingPassword ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cambiando contraseña...
                </>
              ) : successMessage ? (
                <>
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  Redirigiendo...
                </>
              ) : (
                "Cambiar Contraseña"
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
