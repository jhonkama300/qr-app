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
  UserPlus,
  Briefcase,
} from "lucide-react"
import { checkIdType, validateLogin, changePassword } from "@/lib/auth-service"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import QRCode from "qrcode"
import Image from "next/image"
import { db } from "@/lib/firebase"
import { collection, query, where, onSnapshot } from "firebase/firestore"

type LoginStep = "id" | "password"

export function UnifiedLogin() {
  const [step, setStep] = useState<LoginStep>("id")
  const [idNumber, setIdNumber] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [userType, setUserType] = useState<"admin" | "student" | "invitado" | null>(null)
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
      console.log("[v0] Configurando listener en tiempo real para:", studentData.identificacion)

      // Determinar la colección según el tipo de usuario
      const collectionName = studentData.esInvitado ? "invitados" : "personas"
      const studentQuery = query(
        collection(db, collectionName),
        where("identificacion", "==", studentData.identificacion),
      )

      const unsubscribe = onSnapshot(
        studentQuery,
        (querySnapshot) => {
          if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0]
            const updatedData = docSnap.data()
            const completeData = {
              ...updatedData,
              id: docSnap.id,
              identificacion: updatedData.identificacion,
              esInvitado: studentData.esInvitado,
            }
            console.log("[v0] Datos actualizados en tiempo real:", completeData)
            setStudentData({ ...completeData })
          }
        },
        (error) => {
          console.error("[v0] Error en listener tiempo real:", error)
        },
      )

      return () => {
        console.log("[v0] Limpiando listener")
        unsubscribe()
      }
    }
  }, [studentData?.identificacion, showStudentModal, studentData?.esInvitado])

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
      } else if (result.type === "invitado") {
        setUserType("invitado")
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

  const calculateTotalCupos = () => {
    if (!studentData) return 0
    if (studentData.esInvitado) return 1
    return 2 + (studentData.cuposExtras || 0)
  }

  const calculateCuposDisponibles = () => {
    const total = calculateTotalCupos()
    const consumidos = studentData?.cuposConsumidos || 0
    return Math.max(0, total - consumidos)
  }

  const calculateAcompanantes = () => {
    if (!studentData) return 0
    if (studentData.esInvitado) return 0 // Invitados no tienen acompañantes
    return 1 + (studentData.cuposExtras || 0)
  }

  const cuposStats = useMemo(() => {
    if (!studentData) {
      return {
        cuposTotal: 0,
        cuposConsumidos: 0,
        cuposDisponibles: 0,
        porcentajeConsumido: 0,
        acompanantesBase: 0,
        cuposExtras: 0,
        totalAcompanantes: 0,
      }
    }

    const total = calculateTotalCupos()
    const consumidos = studentData.cuposConsumidos || 0
    const disponibles = calculateCuposDisponibles()
    const porcentaje = total > 0 ? (consumidos / total) * 100 : 0

    const acompanantesBase = studentData.esInvitado ? 0 : 1 // Siempre tiene 1 acompañante base si es estudiante
    const extras = studentData.cuposExtras || 0
    const totalAcompanantes = calculateAcompanantes() // Total de acompañantes (sin contar al graduando)

    return {
      cuposTotal: total,
      cuposConsumidos: consumidos,
      cuposDisponibles: disponibles,
      porcentajeConsumido: porcentaje,
      acompanantesBase,
      cuposExtras: extras,
      totalAcompanantes,
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
                      type={showPassword ? "text" : "password"}
                      placeholder="Ingresa tu contraseña"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9 sm:pl-11 h-11 sm:h-12 text-sm sm:text-base border-gray-300 focus:border-lime-500 focus:ring-lime-500"
                      required
                      disabled={loading || !!successMessage}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      disabled={loading || !!successMessage}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
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

      {/* Modal para estudiantes/invitados */}
      <Dialog open={showStudentModal} onOpenChange={setShowStudentModal}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="p-4 pb-2 bg-gradient-to-r from-lime-500 to-green-600 text-white rounded-t-lg">
            <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
              {studentData?.esInvitado ? (
                <>
                  <UserPlus className="w-5 h-5" />
                  Invitado Verificado
                </>
              ) : (
                <>
                  <GraduationCap className="w-5 h-5" />
                  Graduando Verificado
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-lime-100 text-sm">
              {studentData?.esInvitado
                ? "Información del invitado al evento"
                : "Información del estudiante y estado de cupos"}
            </DialogDescription>
          </DialogHeader>

          {studentData && (
            <div className="space-y-3 px-4 pb-4">
              <div
                className={`rounded-lg p-3 space-y-2.5 border-2 ${
                  studentData.esInvitado
                    ? "bg-gradient-to-br from-purple-50 via-violet-50 to-purple-50 border-purple-200"
                    : "bg-gradient-to-br from-lime-50 via-green-50 to-emerald-50 border-lime-200"
                }`}
              >
                {/* Nombre y ID compactos */}
                <div
                  className={`text-center pb-2 border-b ${studentData.esInvitado ? "border-purple-200" : "border-lime-200"}`}
                >
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">{studentData.nombre}</h3>
                  <div className="flex items-center justify-center gap-1.5 text-xs text-gray-600 mt-0.5">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span className="font-semibold">{studentData.identificacion}</span>
                  </div>
                  {studentData.esInvitado && <Badge className="mt-1 bg-purple-600 text-white text-xs">Invitado</Badge>}
                </div>

                <div className="grid gap-2">
                  {/* Programa o Puesto */}
                  {studentData.esInvitado ? (
                    <div className={`flex items-start gap-2 bg-white/60 rounded-lg p-2 border border-purple-100`}>
                      <div className="bg-purple-100 rounded-md p-1.5 mt-0.5">
                        <Briefcase className="w-4 h-4 text-purple-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-medium text-gray-500 mb-0.5">Puesto</p>
                        <p className="text-xs font-semibold text-gray-900 leading-tight">
                          {studentData.puesto || "No especificado"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 bg-white/60 rounded-lg p-2 border border-lime-100">
                      <div className="bg-lime-100 rounded-md p-1.5 mt-0.5">
                        <BookOpen className="w-4 h-4 text-lime-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-medium text-gray-500 mb-0.5">Programa Académico</p>
                        <p className="text-xs font-semibold text-gray-900 leading-tight">{studentData.programa}</p>
                      </div>
                    </div>
                  )}

                  {/* Puesto (solo estudiantes) */}
                  {!studentData.esInvitado && studentData.puesto && (
                    <div className="flex items-start gap-2 bg-white/60 rounded-lg p-2 border border-lime-100">
                      <div className="bg-green-100 rounded-md p-1.5 mt-0.5">
                        <MapPin className="w-4 h-4 text-green-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-medium text-gray-500 mb-0.5">Puesto Asignado</p>
                        <p className="text-sm font-bold text-gray-900">{studentData.puesto}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* QR Code */}
              {qrCodeUrl && (
                <div className="flex justify-center">
                  <div
                    className={`p-2 rounded-xl border-2 shadow-sm ${
                      studentData.esInvitado ? "bg-purple-50 border-purple-200" : "bg-lime-50 border-lime-200"
                    }`}
                  >
                    <img src={qrCodeUrl || "/placeholder.svg"} alt="QR Code" className="w-28 h-28 sm:w-32 sm:h-32" />
                    <p
                      className={`text-center text-[10px] mt-1 font-medium ${
                        studentData.esInvitado ? "text-purple-600" : "text-lime-600"
                      }`}
                    >
                      Presenta este QR en el bufete
                    </p>
                  </div>
                </div>
              )}

              {/* Estado de Bufete */}
              <div
                className={`rounded-xl p-3 border-2 ${
                  studentData.esInvitado
                    ? "bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200"
                    : "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase className={`w-4 h-4 ${studentData.esInvitado ? "text-purple-600" : "text-amber-600"}`} />
                  <h4 className={`text-sm font-bold ${studentData.esInvitado ? "text-purple-800" : "text-amber-800"}`}>
                    Estado de Bufete
                  </h4>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white/70 rounded-lg p-2">
                    <p className="text-[10px] text-gray-500 font-medium">
                      {studentData.esInvitado ? "Cupo Único" : "Graduando + Acompañantes"}
                    </p>
                    <p className={`text-lg font-bold ${studentData.esInvitado ? "text-purple-600" : "text-amber-600"}`}>
                      {studentData.esInvitado ? "1" : `1 + ${calculateAcompanantes()}`}
                    </p>
                  </div>
                  <div className="bg-white/70 rounded-lg p-2">
                    <p className="text-[10px] text-gray-500 font-medium">Consumidos</p>
                    <p className="text-lg font-bold text-red-500">{studentData.cuposConsumidos || 0}</p>
                  </div>
                  <div className="bg-white/70 rounded-lg p-2">
                    <p className="text-[10px] text-gray-500 font-medium">Disponibles</p>
                    <p className="text-lg font-bold text-green-600">{calculateCuposDisponibles()}</p>
                  </div>
                </div>

                {/* Barra de progreso */}
                <div className="mt-2">
                  <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                    <span>Uso de cupos</span>
                    <span>
                      {studentData.cuposConsumidos || 0} / {calculateTotalCupos()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        studentData.esInvitado
                          ? "bg-gradient-to-r from-purple-500 to-violet-500"
                          : "bg-gradient-to-r from-amber-500 to-orange-500"
                      }`}
                      style={{
                        width: `${Math.min(100, ((studentData.cuposConsumidos || 0) / calculateTotalCupos()) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Info adicional para invitados */}
                {studentData.esInvitado && (
                  <p className="text-[10px] text-purple-600 mt-2 text-center">
                    Los invitados tienen derecho a 1 comida sin acompañantes
                  </p>
                )}

                {/* Info adicional para estudiantes */}
                {!studentData.esInvitado && (studentData.cuposExtras || 0) > 0 && (
                  <p className="text-[10px] text-amber-600 mt-2 text-center">
                    Incluye {studentData.cuposExtras} cupo(s) extra(s) asignado(s)
                  </p>
                )}
              </div>

              <Button
                onClick={() => {
                  setShowStudentModal(false)
                  setStudentData(null)
                  setIdNumber("")
                  setQrCodeUrl("")
                }}
                className={`w-full ${
                  studentData.esInvitado ? "bg-purple-600 hover:bg-purple-700" : "bg-lime-600 hover:bg-lime-700"
                } text-white`}
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
