"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  Shield,
  ArrowRight,
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

export function LoginNew() {
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
  const [showQrPreview, setShowQrPreview] = useState(false)
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
            setStudentData({ ...completeData })
          }
        },
        () => {},
      )
      return () => { unsubscribe() }
    }
  }, [studentData?.identificacion, showStudentModal, studentData?.esInvitado])

  useEffect(() => {
    if (studentData) {
      QRCode.toDataURL(studentData.identificacion, {
        width: 256,
        margin: 2,
        color: { dark: "#1a4a03", light: "#FFFFFF" },
        errorCorrectionLevel: "H",
      })
        .then((url) => setQrCodeUrl(url))
        .catch(() => {})
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
      } else if (result.type === "invitado") {
        setUserType("invitado")
        setStudentData(result.userData)
        setShowStudentModal(true)
      }
    } catch {
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
        primaryRole === "administrador" ? "Acceso Administrador"
        : primaryRole === "operativo" ? "Acceso Operativo"
        : primaryRole === "bufete" ? "Acceso Bufete"
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
    if (newPassword !== confirmPassword) { setChangePasswordError("Las contraseñas no coinciden"); setChangingPassword(false); return }
    if (newPassword.length < 6) { setChangePasswordError("La contraseña debe tener al menos 6 caracteres"); setChangingPassword(false); return }
    if (newPassword === "Uparsistem01-") { setChangePasswordError("No puedes usar la contraseña predeterminada del sistema"); setChangingPassword(false); return }
    try {
      if (loggedUser) {
        await changePassword(loggedUser.id, newPassword)
        const updatedUser = { ...loggedUser, hasDefaultPassword: false }
        login(updatedUser)
        const primaryRole = updatedUser.roles[0]
        const accessMessage =
          primaryRole === "administrador" ? "Acceso Administrador"
          : primaryRole === "operativo" ? "Acceso Operativo"
          : primaryRole === "bufete" ? "Acceso Bufete"
          : "Acceso concedido"
        setSuccessMessage(accessMessage)
        setShowChangePasswordModal(false)
        setChangingPassword(false)
        setTimeout(() => router.push("/dashboard"), 1500)
      }
    } catch {
      setChangePasswordError("Error al cambiar la contraseña. Intenta nuevamente")
      setChangingPassword(false)
    }
  }

  const handleBack = () => { setStep("id"); setPassword(""); setError(""); setUserType(null); setStudentData(null) }
  const calculateTotalCupos = () => { if (!studentData) return 0; if (studentData.esInvitado) return 1; return 2 + (studentData.cuposExtras || 0) }
  const calculateCuposDisponibles = () => { const t = calculateTotalCupos(); return Math.max(0, t - (studentData?.cuposConsumidos || 0)) }
  const calculateAcompanantes = () => { if (!studentData) return 0; if (studentData.esInvitado) return 0; return 1 + (studentData.cuposExtras || 0) }

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 sm:p-6">
        <div className="w-full max-w-md animate-login-entrance">
          <div className="bg-white rounded-3xl shadow-xl shadow-uparsistem-500/10 border border-slate-100 overflow-hidden">
            <div className="flex flex-col items-center gap-3 pt-8 pb-2 px-8">
              <div className="bg-uparsistem-50 p-3 rounded-2xl border border-uparsistem-100">
                <Image src="/images/logo1.png" alt="Logo Uparsistem" width={56} height={56} className="object-contain" />
              </div>
              <div className="text-center">
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Iniciar Sesión</h1>
                <p className="text-sm text-slate-400 mt-1">Sistema de control de acceso</p>
              </div>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center justify-center gap-4 pt-8 lg:pt-6 pb-6 px-8">
              <div className={`flex items-center gap-2 text-sm font-semibold transition-colors duration-300 ${step === "id" ? "text-slate-900" : "text-slate-300"}`}>
                <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-all duration-300 ${step === "id" ? "bg-uparsistem-600 text-white" : "bg-slate-100 text-slate-400"}`}>1</div>
                <span>Identificación</span>
              </div>
              <div className={`h-px w-8 transition-colors duration-300 ${step === "password" ? "bg-uparsistem-500" : "bg-slate-200"}`} />
              <div className={`flex items-center gap-2 text-sm font-semibold transition-colors duration-300 ${step === "password" ? "text-slate-900" : "text-slate-300"}`}>
                <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-all duration-300 ${step === "password" ? "bg-uparsistem-600 text-white" : "bg-slate-100 text-slate-400"}`}>2</div>
                <span>Contraseña</span>
              </div>
            </div>

            {/* Form Container */}
            <div className="px-8 pb-10 space-y-6">
              {step === "id" && (
                <form onSubmit={handleIdSubmit} className="space-y-5 animate-step-in">
                  <div className="space-y-2">
                    <Label htmlFor="idNumber" className="text-sm font-medium text-slate-700">
                      Número de Identificación
                    </Label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                      <Input
                        id="idNumber"
                        type="text"
                        placeholder="Ej: 1234567890"
                        value={idNumber}
                        onChange={(e) => setIdNumber(e.target.value)}
                        className="pl-12 h-12 text-base border-slate-200 rounded-xl focus:ring-2 focus:ring-uparsistem-500/20 focus:border-uparsistem-500 transition-all"
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-3 bg-red-50 text-red-700 border border-red-100 rounded-xl p-3.5 text-sm font-medium animate-step-in">
                      <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center shrink-0 text-red-500 text-xs font-bold">!</div>
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-12 text-base bg-uparsistem-600 hover:bg-uparsistem-700 text-white font-semibold rounded-xl shadow-lg shadow-uparsistem-500/20 transition-all duration-200 active:scale-[0.98]"
                    disabled={loading || !idNumber}
                  >
                    {loading ? (
                      <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Verificando...</>
                    ) : (
                      <>Continuar<ArrowRight className="ml-2 h-5 w-5" /></>
                    )}
                  </Button>
                </form>
              )}

              {step === "password" && (
                <form onSubmit={handlePasswordSubmit} className="space-y-5 animate-step-in">
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                      Contraseña
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Ingresa tu contraseña"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-12 pr-12 h-12 text-base border-slate-200 rounded-xl focus:ring-2 focus:ring-uparsistem-500/20 focus:border-uparsistem-500 transition-all"
                        required
                        disabled={loading || !!successMessage}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        disabled={loading || !!successMessage}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-3 bg-red-50 text-red-700 border border-red-100 rounded-xl p-3.5 text-sm font-medium animate-step-in">
                      <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center shrink-0 text-red-500 text-xs font-bold">!</div>
                      {error}
                    </div>
                  )}

                  {successMessage && (
                    <div className="flex items-center gap-3 bg-uparsistem-50 text-uparsistem-700 border border-uparsistem-100 rounded-xl p-3.5 text-sm font-semibold animate-step-in">
                      <CheckCircle2 className="h-5 w-5 shrink-0" />
                      {successMessage}
                    </div>
                  )}

                  <div className="space-y-3">
                    <Button
                      type="submit"
                      className="w-full h-12 text-base bg-uparsistem-600 hover:bg-uparsistem-700 text-white font-semibold rounded-xl shadow-lg shadow-uparsistem-500/20 transition-all duration-200 active:scale-[0.98]"
                      disabled={loading || !password || !!successMessage}
                    >
                      {loading ? (
                        <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Iniciando sesión...</>
                      ) : successMessage ? (
                        <><CheckCircle2 className="mr-2 h-5 w-5" />Redirigiendo...</>
                      ) : (
                        <>Iniciar Sesión<ArrowRight className="ml-2 h-5 w-5" /></>
                      )}
                    </Button>
                    <button
                      type="button"
                      onClick={handleBack}
                      disabled={!!successMessage}
                      className="w-full h-12 text-sm font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
                    >
                      <ArrowLeft className="h-4 w-4" />Volver
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">© {new Date().getFullYear()} Uparsistem. Todos los derechos reservados.</p>
        </div>
      </div>

      {/* ====== Student/Invitado Modal ====== */}
      <Dialog open={showStudentModal} onOpenChange={setShowStudentModal}>
        <DialogContent className="w-[94vw] max-w-[400px] p-0 bg-white rounded-2xl shadow-xl border-slate-100 overflow-y-auto max-h-[90vh]">
          <DialogHeader className={`px-4 py-3 rounded-t-2xl border-b ${
            studentData?.esInvitado ? "bg-violet-600 border-violet-700" : "bg-uparsistem-600 border-uparsistem-700"
          } text-white`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-xl bg-white/10 border border-white/20 shrink-0">
                {studentData?.esInvitado ? <UserPlus className="w-5 h-5" /> : <GraduationCap className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base sm:text-lg font-bold tracking-tight truncate">
                  {studentData?.esInvitado ? "Invitado Verificado" : "Graduando Verificado"}
                </DialogTitle>
                <DialogDescription className="text-white/70 text-xs mt-0.5 truncate">
                  {studentData?.esInvitado ? "Información del invitado al evento" : "Información y estado de cupos"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {studentData && (
            <div className="px-4 py-3 space-y-3">
              <div className="flex flex-col items-center min-w-0">
                <div className="min-w-0 w-full text-center">
                  <p className="text-lg font-bold text-slate-900 truncate">{studentData.nombre}</p>
                  <div className="flex items-center justify-center gap-1.5 text-base text-slate-500 font-mono">
                    <CreditCard className="w-3 h-3 shrink-0" />
                    <span>{studentData.identificacion}</span>
                  </div>
                </div>
                {studentData.esInvitado && (
                  <Badge variant="outline" className="shrink-0 border-violet-200 bg-violet-50 text-violet-700 text-xs mt-1">Invitado</Badge>
                )}
              </div>

              <div className="space-y-2">
                {studentData.esInvitado ? (
                  <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 min-w-0">
                    <div className="bg-violet-100 rounded-md p-1.5 shrink-0"><Briefcase className="w-4 h-4 text-violet-600" /></div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500 font-medium">Puesto</p>
                      <p className="text-sm font-semibold text-slate-900 truncate">{studentData.puesto || "No especificado"}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 min-w-0">
                    <div className="bg-uparsistem-100 rounded-md p-1.5 shrink-0"><BookOpen className="w-4 h-4 text-uparsistem-600" /></div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500 font-medium">Programa Académico</p>
                      <p className="text-sm font-semibold text-slate-900 truncate">{studentData.programa}</p>
                    </div>
                  </div>
                )}
                {!studentData.esInvitado && studentData.puesto && (
                  <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 min-w-0">
                    <div className="bg-blue-100 rounded-md p-1.5 shrink-0"><MapPin className="w-4 h-4 text-blue-600" /></div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500 font-medium">Puesto Asignado</p>
                      <p className="text-sm font-bold text-slate-900 truncate">{studentData.puesto}</p>
                    </div>
                  </div>
                )}
              </div>

              {qrCodeUrl && (
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => setShowQrPreview(true)}
                    className="p-1.5 bg-white rounded-xl border-2 border-dashed border-slate-200 shadow-sm hover:border-uparsistem-400 hover:shadow-md transition-all cursor-pointer active:scale-95"
                  >
                    <img src={qrCodeUrl} alt="QR Code" className="w-24 h-24 sm:w-28 sm:h-28" />
                  </button>
                  <p className="mt-1 text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center">Toca para ampliar</p>
                </div>
              )}

              <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <h4 className="text-xs font-bold text-slate-900">Estado de Bufete</h4>
                </div>

                <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center mb-2">
                  <div className="bg-white rounded-md p-1.5 sm:p-2 border border-slate-100">
                    <p className="text-[10px] sm:text-[11px] text-slate-500 leading-tight">{studentData.esInvitado ? "Cupo Único" : "Grad. + Acomp."}</p>
                    <p className="text-base sm:text-lg font-extrabold text-slate-900 mt-0.5">{studentData.esInvitado ? "1" : `1+${calculateAcompanantes()}`}</p>
                  </div>
                  <div className="bg-white rounded-md p-1.5 sm:p-2 border border-slate-100">
                    <p className="text-[10px] sm:text-[11px] text-slate-500 leading-tight">Consumidos</p>
                    <p className="text-base sm:text-lg font-extrabold text-red-500 mt-0.5">{studentData.cuposConsumidos || 0}</p>
                  </div>
                  <div className="bg-white rounded-md p-1.5 sm:p-2 border border-slate-100">
                    <p className="text-[10px] sm:text-[11px] text-slate-500 leading-tight">Disponibles</p>
                    <p className="text-base sm:text-lg font-extrabold text-uparsistem-600 mt-0.5">{calculateCuposDisponibles()}</p>
                  </div>
                </div>

                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-uparsistem-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, ((studentData.cuposConsumidos || 0) / calculateTotalCupos()) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] sm:text-[11px] text-slate-400 mt-1 font-medium">
                  <span>Uso de cupos</span>
                  <span>{studentData.cuposConsumidos || 0} / {calculateTotalCupos()}</span>
                </div>
              </div>

              <Button
                onClick={() => { setShowStudentModal(false); setStudentData(null); setIdNumber(""); setQrCodeUrl("") }}
                className={`w-full h-10 sm:h-11 text-sm font-semibold rounded-xl transition-all duration-200 active:scale-[0.98] shadow-md ${
                  studentData.esInvitado
                    ? "bg-violet-600 hover:bg-violet-700 text-white shadow-violet-200"
                    : "bg-uparsistem-600 hover:bg-uparsistem-700 text-white shadow-uparsistem-200"
                }`}
              >
                Cerrar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ====== Change Password Modal ====== */}
      <Dialog open={showChangePasswordModal} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[420px] bg-white rounded-2xl shadow-xl border-slate-100" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <div className="flex flex-col items-center gap-4 mb-2 text-center">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                <Shield className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-900 tracking-tight">Cambio de Contraseña</DialogTitle>
                <DialogDescription className="text-sm text-slate-500 mt-1">
                  Debes cambiar tu contraseña predeterminada antes de continuar
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleChangePassword} className="space-y-4 py-2">
            {changePasswordError && (
              <div className="flex items-center gap-3 bg-red-50 text-red-700 border border-red-100 rounded-xl p-3.5 text-sm font-medium">
                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center shrink-0 text-red-500 text-xs font-bold">!</div>
                {changePasswordError}
              </div>
            )}
            {successMessage && (
              <div className="flex items-center gap-3 bg-uparsistem-50 text-uparsistem-700 border border-uparsistem-100 rounded-xl p-3.5 text-sm font-semibold">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                {successMessage}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-sm font-medium text-slate-700">Nueva Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                <Input id="newPassword" type={showNewPassword ? "text" : "password"} placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="pl-11 pr-11 h-11 border-slate-200 rounded-xl focus:ring-2 focus:ring-uparsistem-500/20 focus:border-uparsistem-500 transition-all" required disabled={changingPassword || !!successMessage} minLength={6} />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" disabled={changingPassword || !!successMessage}>
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">Confirmar Nueva Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                <Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-11 pr-11 h-11 border-slate-200 rounded-xl focus:ring-2 focus:ring-uparsistem-500/20 focus:border-uparsistem-500 transition-all" required disabled={changingPassword || !!successMessage} minLength={6} />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" disabled={changingPassword || !!successMessage}>
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-900 mb-2">Requisitos de seguridad</p>
              <ul className="text-xs text-slate-500 space-y-1">
                <li className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-slate-400" />Mínimo 6 caracteres</li>
                <li className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-slate-400" />No puede ser la contraseña predeterminada</li>
                <li className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-slate-400" />Debe ser diferente a tu contraseña actual</li>
              </ul>
            </div>

            <Button type="submit" className="w-full h-12 bg-uparsistem-600 hover:bg-uparsistem-700 text-white font-semibold rounded-xl shadow-lg shadow-uparsistem-500/20 transition-all duration-200 active:scale-[0.98]" disabled={changingPassword || !!successMessage}>
              {changingPassword ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Cambiando contraseña...</>
              ) : successMessage ? (
                <><CheckCircle2 className="mr-2 h-5 w-5" />Redirigiendo...</>
              ) : (
                "Cambiar Contraseña"
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ====== QR Preview ====== */}
      <Dialog open={showQrPreview} onOpenChange={setShowQrPreview}>
        <DialogContent className="max-w-[90vw] sm:max-w-[360px] bg-white rounded-2xl shadow-xl border-slate-100 p-6">
          <DialogHeader>
            <DialogTitle className="text-center text-lg font-bold text-slate-900">Código QR</DialogTitle>
            <DialogDescription className="text-center text-sm text-slate-500">
              {studentData?.nombre} — {studentData?.identificacion}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-2">
            {qrCodeUrl && (
              <div className="p-3 bg-white rounded-2xl border-2 border-slate-200 shadow-sm">
                <img src={qrCodeUrl} alt="QR Code" className="w-56 h-56 sm:w-64 sm:h-64" />
              </div>
            )}
            <p className="mt-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">Presenta este QR en el bufete</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}