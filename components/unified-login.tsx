"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Loader2,
  User,
  Lock,
  ArrowLeft,
  GraduationCap,
  CheckCircle2,
  Eye,
  EyeOff,
  MapPin,
  BookOpen,
  CreditCard,
  Users,
  TrendingUp,
  UserPlus,
} from "lucide-react"
import { checkIdType, validateLogin, changePassword } from "@/lib/auth-service"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import QRCode from "qrcode"
import Image from "next/image"
import { db } from "@/lib/firebase"
import { doc, onSnapshot } from "firebase/firestore"

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
    if (studentData?.identificacion && showStudentModal) {
      console.log("[v0] Configurando listener para:", studentData.identificacion)
      const studentRef = doc(db, "estudiantes", studentData.identificacion)

      const unsubscribe = onSnapshot(
        studentRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const updatedData = docSnap.data()
            // Preservar la identificacion del documento
            const completeData = {
              ...updatedData,
              identificacion: docSnap.id,
            }
            console.log("[v0] Snapshot recibido - Actualizando datos:", completeData)
            // Forzar actualización creando un nuevo objeto
            setStudentData({ ...completeData })
          }
        },
        (error) => {
          console.error("[v0] Error en listener:", error)
        },
      )

      return () => {
        console.log("[v0] Limpiando listener")
        unsubscribe()
      }
    }
  }, [studentData?.identificacion, showStudentModal])

  useEffect(() => {
    if (studentData) {
      const qrData = studentData.identificacion
      QRCode.toDataURL(qrData, {
        width: 200,
        margin: 2,
        color: { dark: "#000000", light: "#FFFFFF" },
      })
        .then((url) => setQrCodeUrl(url))
        .catch((err) => console.error("[v0] Error generando QR:", err))
    }
  }, [studentData])

  const handleIdSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      console.log("[v0] Verificando tipo de ID:", idNumber)
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
        setLoggedUser(user)
        setShowChangePasswordModal(true)
        setLoading(false)
        return
      }
      login(user)
      const primaryRole = user.roles[0]
      const accessMessage =
        primaryRole === "administrador"
          ? "Acceso Administrador"
          : primaryRole === "operativo"
            ? "Acceso Operativo"
            : primaryRole === "bufete"
              ? "Acceso Bufete"
              : "Acceso concedido"
      setSuccessMessage(accessMessage)
      setLoading(false)
      setTimeout(() => router.push("/dashboard"), 1500)
    } catch {
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
    if (newPassword === "Uparsistem01-") {
      setChangePasswordError("No puedes usar la contraseña predeterminada del sistema")
      setChangingPassword(false)
      return
    }

    try {
      if (loggedUser) {
        await changePassword(loggedUser.id, newPassword)
        const updatedUser = { ...loggedUser, hasDefaultPassword: false }
        login(updatedUser)
        const primaryRole = updatedUser.roles[0]
        const accessMessage =
          primaryRole === "administrador"
            ? "Acceso Administrador"
            : primaryRole === "operativo"
              ? "Acceso Operativo"
              : primaryRole === "bufete"
                ? "Acceso Bufete"
                : "Acceso concedido"
        setSuccessMessage(accessMessage)
        setShowChangePasswordModal(false)
        setChangingPassword(false)
        setTimeout(() => router.push("/dashboard"), 1500)
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

  const cuposStats = useMemo(() => {
    if (!studentData) {
      return {
        cuposTotal: 0,
        cuposConsumidos: 0,
        cuposDisponibles: 0,
        porcentajeConsumido: 0,
        totalAcompanantes: 0,
      }
    }

    const total = 2 + (studentData.cuposExtras || 0)
    const consumidos = studentData.cuposConsumidos || 0
    const disponibles = total - consumidos
    const porcentaje = total > 0 ? (consumidos / total) * 100 : 0
    const acompanantes = total // Total de acompañantes = base (2) + extras

    console.log("[v0] Cupos recalculados:", {
      total,
      consumidos,
      disponibles,
      porcentaje,
      acompanantes,
      timestamp: new Date().toISOString(),
    })

    return {
      cuposTotal: total,
      cuposConsumidos: consumidos,
      cuposDisponibles: disponibles,
      porcentajeConsumido: porcentaje,
      totalAcompanantes: acompanantes,
    }
  }, [studentData, studentData?.cuposConsumidos, studentData?.cuposExtras])

  return (
    <>
      <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
        {/* Imagen de fondo de graduación */}
        <div className="absolute inset-0 -z-10">
          <Image
            src="/images/graduacion-hero.jpg"
            alt="Ceremonia de graduación"
            fill
            priority
            className="object-cover object-[center_30%] select-none pointer-events-none"
            sizes="100vw"
            quality={90}
          />
          {/* Overlay oscuro para contraste */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60" />
          {/* Blur sutil para mejor legibilidad */}
          <div className="absolute inset-0 backdrop-blur-[0.5px]" />
        </div>

        {/* Tarjeta del login con diseño mejorado para móvil */}
        <Card className="relative z-10 w-full max-w-md shadow-2xl border-0 overflow-hidden backdrop-blur-md bg-white/95">
          {/* Header con gradiente y logo */}
          <div className="bg-gradient-to-r from-lime-500 to-green-600 p-6 sm:p-8 text-center">
            <div className="flex justify-center mb-3 sm:mb-4">
              <div className="bg-white rounded-full p-2.5 sm:p-3 shadow-lg">
                <Image
                  src="/images/logoupar.png"
                  alt="Logo Uparsistem"
                  width={70}
                  height={70}
                  className="object-contain sm:w-20 sm:h-20"
                />
              </div>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white mb-1.5 sm:mb-2">Bienvenido a Grados</h1>
            <p className="text-lime-50 text-xs sm:text-sm font-medium">UPARSISTEM</p>
          </div>

          <CardHeader className="text-center space-y-1.5 sm:space-y-2 pt-5 sm:pt-6 pb-3 sm:pb-4 px-4 sm:px-6">
            <CardTitle className="text-lg sm:text-xl font-bold text-gray-800">
              {step === "id" ? "Acceso al Sistema" : "Acceso Administrativo"}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm text-gray-600">
              {step === "id"
                ? "Ingresa tu número de identificación para continuar"
                : "Ingresa tu contraseña para acceder"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3.5 sm:space-y-4 pb-6 sm:pb-8 px-4 sm:px-6">
            {step === "id" && (
              <form onSubmit={handleIdSubmit} className="space-y-3.5 sm:space-y-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="idNumber" className="text-sm sm:text-base text-gray-700 font-medium">
                    Número de Identificación
                  </Label>
                  <div className="relative">
                    <User className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-lime-600" />
                    <Input
                      id="idNumber"
                      type="text"
                      placeholder="Ej: 1234567890"
                      value={idNumber}
                      onChange={(e) => setIdNumber(e.target.value)}
                      className="pl-9 sm:pl-11 h-11 sm:h-12 text-sm sm:text-base border-gray-300 focus:border-lime-500 focus:ring-lime-500"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive" className="bg-red-50 border-red-200 py-2.5 sm:py-3">
                    <AlertDescription className="text-xs sm:text-sm text-red-800">{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 sm:h-12 text-sm sm:text-base bg-gradient-to-r from-lime-500 to-green-600 hover:from-lime-600 hover:to-green-700 text-white font-semibold shadow-md"
                  disabled={loading || !idNumber}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    "Continuar"
                  )}
                </Button>
              </form>
            )}

            {step === "password" && (
              <form onSubmit={handlePasswordSubmit} className="space-y-3.5 sm:space-y-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="password" className="text-sm sm:text-base text-gray-700 font-medium">
                    Contraseña
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-lime-600" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Ingresa tu contraseña"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9 sm:pl-11 h-11 sm:h-12 text-sm sm:text-base border-gray-300 focus:border-lime-500 focus:ring-lime-500"
                      required
                      disabled={loading || !!successMessage}
                    />
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive" className="bg-red-50 border-red-200 py-2.5 sm:py-3">
                    <AlertDescription className="text-xs sm:text-sm text-red-800">{error}</AlertDescription>
                  </Alert>
                )}

                {successMessage && (
                  <Alert className="bg-green-50 border-green-200 py-2.5 sm:py-3">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-xs sm:text-sm text-green-800 font-semibold flex items-center gap-2">
                      {successMessage}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2.5 sm:space-y-3">
                  <Button
                    type="submit"
                    className="w-full h-11 sm:h-12 text-sm sm:text-base bg-gradient-to-r from-lime-500 to-green-600 hover:from-lime-600 hover:to-green-700 text-white font-semibold shadow-md"
                    disabled={loading || !password || !!successMessage}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
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
                    className="w-full h-11 sm:h-12 text-sm sm:text-base border-gray-300 hover:bg-gray-50 bg-transparent"
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
        <DialogContent
          className="sm:max-w-2xl max-h-[95vh] overflow-y-auto p-0"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="px-4 pt-4 pb-2 space-y-1">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-lime-700 text-base sm:text-lg">
                <GraduationCap className="w-5 h-5" />
                Información del Graduando
              </DialogTitle>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 animate-pulse text-xs">
                <span className="relative flex h-1.5 w-1.5 mr-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                </span>
                En vivo
              </Badge>
            </div>
          </DialogHeader>

          {studentData && (
            <div className="space-y-3 px-4 pb-4">
              <div className="bg-gradient-to-br from-lime-50 via-green-50 to-emerald-50 rounded-lg p-3 space-y-2.5 border-2 border-lime-200">
                {/* Nombre y ID compactos */}
                <div className="text-center pb-2 border-b border-lime-200">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">{studentData.nombre}</h3>
                  <div className="flex items-center justify-center gap-1.5 text-xs text-gray-600 mt-0.5">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span className="font-semibold">{studentData.identificacion}</span>
                  </div>
                </div>

                <div className="grid gap-2">
                  {/* Programa */}
                  <div className="flex items-start gap-2 bg-white/60 rounded-lg p-2 border border-lime-100">
                    <div className="bg-lime-100 rounded-md p-1.5 mt-0.5">
                      <BookOpen className="w-4 h-4 text-lime-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-medium text-gray-500 mb-0.5">Programa Académico</p>
                      <p className="text-xs font-semibold text-gray-900 leading-tight">{studentData.programa}</p>
                      {/* Mostrar acompañantes */}
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-lime-700 bg-lime-50 px-1.5 py-0.5 rounded-md border border-lime-200 w-fit">
                        <UserPlus className="w-3 h-3" />
                        <span className="font-semibold">
                          {cuposStats.totalAcompanantes} acompañante{cuposStats.totalAcompanantes !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-gradient-to-r from-lime-500 to-green-600 rounded-lg p-2.5 shadow-md">
                    <div className="bg-white/20 rounded-md p-1.5">
                      <MapPin className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-medium text-lime-50 mb-0.5">Puesto Asignado</p>
                      <p className="text-2xl sm:text-3xl font-bold text-white tracking-wider">{studentData.puesto}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div
                key={`bufetes-${cuposStats.cuposConsumidos}-${cuposStats.cuposTotal}`}
                className="bg-white rounded-lg p-3 border-2 border-gray-200"
              >
                <div className="flex items-center gap-1.5 mb-2.5">
                  <Users className="w-4 h-4 text-lime-600" />
                  <h4 className="font-bold text-gray-900 text-sm">Estado de Bufetes</h4>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-2.5">
                  <div className="text-center p-2 bg-blue-50 rounded-md border border-blue-100">
                    <p className="text-xl font-bold text-blue-600">{cuposStats.cuposTotal}</p>
                    <p className="text-[10px] text-blue-700 font-medium mt-0.5">Total</p>
                  </div>
                  <div className="text-center p-2 bg-green-50 rounded-md border border-green-100">
                    <p className="text-xl font-bold text-green-600">{cuposStats.cuposDisponibles}</p>
                    <p className="text-[10px] text-green-700 font-medium mt-0.5">Disponibles</p>
                  </div>
                  <div className="text-center p-2 bg-orange-50 rounded-md border border-orange-100">
                    <p className="text-xl font-bold text-orange-600">{cuposStats.cuposConsumidos}</p>
                    <p className="text-[10px] text-orange-700 font-medium mt-0.5">Consumidos</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-gray-600">
                    <span className="font-medium">Progreso</span>
                    <span className="font-bold">{Math.round(cuposStats.porcentajeConsumido)}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        cuposStats.porcentajeConsumido >= 100
                          ? "bg-gradient-to-r from-red-500 to-red-600"
                          : cuposStats.porcentajeConsumido >= 75
                            ? "bg-gradient-to-r from-orange-400 to-orange-500"
                            : "bg-gradient-to-r from-lime-400 to-green-500"
                      }`}
                      style={{ width: `${Math.min(cuposStats.porcentajeConsumido, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Cupos extras */}
                {studentData.cuposExtras > 0 && (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] bg-lime-50 text-lime-700 p-1.5 rounded-md border border-lime-200">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span className="font-medium">
                      Incluye {studentData.cuposExtras} bufete{studentData.cuposExtras !== 1 ? "s" : ""} extra
                      {studentData.cuposExtras !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
              </div>

              {qrCodeUrl && (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-3 flex flex-col items-center space-y-2 border-2 border-gray-200">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    <h4 className="font-bold text-gray-900 text-sm">Código QR Personal</h4>
                  </div>
                  <p className="text-[10px] text-gray-600 text-center max-w-xs leading-tight">
                    Escanea este código en los puntos de control
                  </p>
                  <div className="bg-white p-2.5 rounded-lg border-2 border-gray-300 shadow-sm">
                    <img src={qrCodeUrl || "/placeholder.svg"} alt="QR Code" className="w-32 h-32 sm:w-36 sm:h-36" />
                  </div>
                </div>
              )}

              <Button
                type="button"
                className="w-full h-10 text-sm bg-gradient-to-r from-lime-500 to-green-600 hover:from-lime-600 hover:to-green-700 shadow-md font-semibold"
                onClick={handleCloseModal}
              >
                Cerrar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* === Modales (sin cambios funcionales) === */}
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
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
