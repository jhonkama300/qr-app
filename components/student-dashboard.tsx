"use client"

import { useState, useEffect } from "react"
import { useStudentAuth } from "@/components/student-auth-provider"
import { getStudentInfo } from "@/lib/student-auth-service"
import { collection, query, where, getDocs, onSnapshot, doc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Loader2,
  GraduationCap,
  Award as IdCard,
  BookOpen,
  Armchair,
  UtensilsCrossed,
  LogOut,
  RefreshCw,
  CheckCircle2,
  XCircle,
} from "lucide-react"
import { useRouter } from "next/navigation"

interface AccessLog {
  timestamp: string
  status: "granted" | "denied" | "q10_success" | "q10_failed"
  details?: string
  mesaUsada?: number
}

export default function StudentDashboard() {
  const { student, logout } = useStudentAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [studentInfo, setStudentInfo] = useState(student)
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  useEffect(() => {
    if (!student) {
      router.push("/student/login")
      return
    }

    const studentDocRef = doc(db, "personas", student.identificacion)
    const unsubscribeStudent = onSnapshot(
      studentDocRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const updatedData = docSnapshot.data()
          const updatedStudent = {
            ...student,
            cuposConsumidos: updatedData.cuposConsumidos || 0,
            cuposExtras: updatedData.cuposExtras || 0,
            nombre: updatedData.nombre || student.nombre,
            programa: updatedData.programa || student.programa,
            puesto: updatedData.puesto || student.puesto,
          }
          setStudentInfo(updatedStudent)
          localStorage.setItem("currentStudent", JSON.stringify(updatedStudent))
        }
      },
      (error) => {
        console.error("Error en listener de estudiante:", error)
      },
    )

    const q = query(collection(db, "access_logs"), where("identificacion", "==", student.identificacion))
    const unsubscribeLogs = onSnapshot(
      q,
      (querySnapshot) => {
        const logs: AccessLog[] = []
        querySnapshot.forEach((doc) => {
          const data = doc.data()
          logs.push({
            timestamp: data.timestamp,
            status: data.status,
            details: data.details,
            mesaUsada: data.mesaUsada,
          })
        })

        logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        setAccessLogs(logs.slice(0, 5))
        setLoadingLogs(false)
      },
      (error) => {
        console.error("Error en listener de logs:", error)
        setLoadingLogs(false)
      },
    )

    return () => {
      unsubscribeStudent()
      unsubscribeLogs()
    }
  }, [student, router])

  const loadAccessLogs = async () => {
    if (!student) return

    try {
      setLoadingLogs(true)
      const q = query(collection(db, "access_logs"), where("identificacion", "==", student.identificacion))
      const querySnapshot = await getDocs(q)

      const logs: AccessLog[] = []
      querySnapshot.forEach((doc) => {
        const data = doc.data()
        logs.push({
          timestamp: data.timestamp,
          status: data.status,
          details: data.details,
          mesaUsada: data.mesaUsada,
        })
      })

      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      setAccessLogs(logs.slice(0, 5))
    } catch (error) {
      console.error("Error al cargar registros de acceso:", error)
    } finally {
      setLoadingLogs(false)
    }
  }

  const handleRefresh = async () => {
    if (!student) return

    setRefreshing(true)
    try {
      const updatedInfo = await getStudentInfo(student.identificacion)
      if (updatedInfo) {
        setStudentInfo(updatedInfo)
        localStorage.setItem("currentStudent", JSON.stringify(updatedInfo))
      }
      await loadAccessLogs()
    } catch (error) {
      console.error("Error al actualizar información:", error)
    } finally {
      setRefreshing(false)
    }
  }

  const handleLogout = () => {
    setShowLogoutConfirm(true)
  }

  const confirmLogout = () => {
    logout()
    router.push("/student/login")
    setShowLogoutConfirm(false)
  }

  const cancelLogout = () => {
    setShowLogoutConfirm(false)
  }

  if (!studentInfo) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-blue-700">Cargando información...</p>
        </div>
      </main>
    )
  }

  const cuposTotales = 2 + studentInfo.cuposExtras
  const cuposDisponibles = cuposTotales - studentInfo.cuposConsumidos
  const porcentajeUsado = (studentInfo.cuposConsumidos / cuposTotales) * 100

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "granted":
        return <CheckCircle2 className="w-4 h-4 text-green-600" />
      case "denied":
        return <XCircle className="w-4 h-4 text-red-600" />
      case "q10_success":
        return <CheckCircle2 className="w-4 h-4 text-blue-600" />
      case "q10_failed":
        return <XCircle className="w-4 h-4 text-orange-600" />
      default:
        return null
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "granted":
        return "Acceso Concedido"
      case "denied":
        return "Acceso Denegado"
      case "q10_success":
        return "Validación Q10 Exitosa"
      case "q10_failed":
        return "Validación Q10 Fallida"
      default:
        return status
    }
  }

  return (
    <>
      <main className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 p-3 sm:p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-blue-900">Portal de Estudiantes</h1>
                <p className="text-sm text-blue-700">Bienvenido, {studentInfo.nombre.split(" ")[0]}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="bg-white/80 hover:bg-white"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="bg-white/80 hover:bg-white text-red-600 hover:text-red-700"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Silla Asignada */}
          <Card className="bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-2xl border-0">
            <CardContent className="pt-8 pb-8">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Armchair className="w-10 h-10 text-white" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-100 uppercase tracking-wider mb-2">Tu Silla Asignada</p>
                  <p className="text-6xl sm:text-7xl font-black tracking-tight">{studentInfo.puesto}</p>
                </div>
                <div className="pt-2">
                  <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
                    <BookOpen className="w-4 h-4" />
                    <span className="text-sm font-medium">{studentInfo.programa}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Información Personal */}
          <Card className="bg-white/95 backdrop-blur-sm shadow-xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <IdCard className="w-5 h-5 text-blue-600" />
                Información Personal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Nombre Completo</p>
                  <p className="font-medium text-sm">{studentInfo.nombre}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Identificación</p>
                  <p className="font-medium text-sm">{studentInfo.identificacion}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cupos de Comida */}
          <Card className="bg-white/95 backdrop-blur-sm shadow-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <UtensilsCrossed className="w-5 h-5 text-blue-600" />
                  Cupos de Comida
                </CardTitle>
                <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="font-medium">En vivo</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200">
                  <p className="text-3xl font-black text-blue-600">{cuposTotales}</p>
                  <p className="text-xs text-muted-foreground font-medium mt-1">Total</p>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-2 border-green-200">
                  <p className="text-3xl font-black text-green-600">{cuposDisponibles}</p>
                  <p className="text-xs text-muted-foreground font-medium mt-1">Disponibles</p>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border-2 border-orange-200">
                  <p className="text-3xl font-black text-orange-600">{studentInfo.cuposConsumidos}</p>
                  <p className="text-xs text-muted-foreground font-medium mt-1">Consumidos</p>
                </div>
              </div>

              {/* Barra de progreso */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="font-medium">Uso de cupos</span>
                  <span className="font-bold">{Math.round(porcentajeUsado)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden shadow-inner">
                  <div
                    className={`h-full transition-all duration-700 ease-out ${
                      porcentajeUsado < 50
                        ? "bg-gradient-to-r from-green-400 to-green-600"
                        : porcentajeUsado < 80
                          ? "bg-gradient-to-r from-yellow-400 to-yellow-600"
                          : "bg-gradient-to-r from-red-400 to-red-600"
                    }`}
                    style={{ width: `${Math.min(porcentajeUsado, 100)}%` }}
                  />
                </div>
              </div>

              {cuposDisponibles === 0 && (
                <Alert variant="destructive" className="bg-red-50 border-red-200">
                  <AlertDescription className="text-sm font-medium">
                    Has consumido todos tus cupos de comida disponibles.
                  </AlertDescription>
                </Alert>
              )}

              {cuposDisponibles > 0 && cuposDisponibles <= 2 && (
                <Alert className="bg-yellow-50 border-yellow-200">
                  <AlertDescription className="text-sm text-yellow-800 font-medium">
                    Te quedan pocos cupos disponibles. Úsalos sabiamente.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Historial de Acceso */}
          <Card className="bg-white/95 backdrop-blur-sm shadow-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-blue-600" />
                  Historial de Acceso
                </CardTitle>
                <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="font-medium">En vivo</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingLogs ? (
                <div className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
                  <p className="text-sm text-muted-foreground">Cargando historial...</p>
                </div>
              ) : accessLogs.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">No hay registros de acceso aún</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {accessLogs.map((log, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
                    >
                      <div className="mt-0.5">{getStatusIcon(log.status)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-sm font-semibold">{getStatusText(log.status)}</p>
                          <p className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleDateString("es-ES", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        {log.details && <p className="text-xs text-muted-foreground">{log.details}</p>}
                        {log.mesaUsada && (
                          <div className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full mt-1">
                            <UtensilsCrossed className="w-3 h-3" />
                            <span className="text-xs font-medium">Mesa {log.mesaUsada}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-xl font-semibold text-center">¿Cerrar sesión?</h2>
            <p className="text-sm text-muted-foreground text-center">
              ¿Estás seguro de que deseas cerrar sesión? Tendrás que volver a iniciar sesión para acceder a tu
              información.
            </p>
            <div className="space-y-2">
              <button
                onClick={confirmLogout}
                className="w-full bg-black text-white py-3 rounded-lg font-medium hover:bg-black/90 transition-colors"
              >
                Confirmar
              </button>
              <button
                onClick={cancelLogout}
                className="w-full bg-white text-black py-3 rounded-lg font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
