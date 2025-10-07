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
  BookOpen,
  Armchair,
  UtensilsCrossed,
  LogOut,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
} from "lucide-react"
import { useRouter } from "next/navigation"

interface AccessLog {
  timestamp: string
  status: "granted" | "denied" | "q10_success" | "q10_failed"
  details?: string
  mesaUsada?: number
  bufeteUsado?: string
}

interface BufeteInfo {
  id: string
  nombre: string
  cuposDisponibles: number
  cuposTotales: number
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
  const [bufetes, setBuffetes] = useState<BufeteInfo[]>([])
  const [loadingBuffetes, setLoadingBuffetes] = useState(true)

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
            bufeteUsado: data.bufeteUsado,
          })
        })

        logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        setAccessLogs(logs.slice(0, 10))
        setLoadingLogs(false)
      },
      (error) => {
        console.error("Error en listener de logs:", error)
        setLoadingLogs(false)
      },
    )

    const bufetesQuery = query(collection(db, "mesas_bufete"))
    const unsubscribeBuffetes = onSnapshot(
      bufetesQuery,
      (querySnapshot) => {
        const bufetesData: BufeteInfo[] = []
        querySnapshot.forEach((doc) => {
          const data = doc.data()
          bufetesData.push({
            id: doc.id,
            nombre: data.nombre || `Bufete ${doc.id}`,
            cuposDisponibles: data.cuposDisponibles || 0,
            cuposTotales: data.cuposTotales || 0,
          })
        })
        setBuffetes(bufetesData)
        setLoadingBuffetes(false)
      },
      (error) => {
        console.error("Error en listener de bufetes:", error)
        setLoadingBuffetes(false)
      },
    )

    return () => {
      unsubscribeStudent()
      unsubscribeLogs()
      unsubscribeBuffetes()
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
          bufeteUsado: data.bufeteUsado,
        })
      })

      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      setAccessLogs(logs.slice(0, 10))
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
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
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

  const bufetesConsumidos = accessLogs.filter((log) => log.status === "granted" && log.bufeteUsado).length
  const bufetesDisponibles = bufetes.reduce((acc, b) => acc + b.cuposDisponibles, 0)
  const bufetesTotales = bufetes.reduce((acc, b) => acc + b.cuposTotales, 0)

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
      <main className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-3 sm:p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <GraduationCap className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-gray-900">Portal de Estudiantes</h1>
                <p className="text-sm text-gray-600">Bienvenido, {studentInfo.nombre.split(" ")[0]}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="bg-white hover:bg-gray-50 shadow-sm"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="bg-white hover:bg-red-50 text-red-600 hover:text-red-700 shadow-sm"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Columna izquierda - Puesto Asignado (más grande) */}
            <div className="lg:col-span-2">
              <Card className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white shadow-2xl border-0 h-full">
                <CardContent className="pt-12 pb-12">
                  <div className="text-center space-y-6">
                    <div className="flex justify-center">
                      <div className="w-28 h-28 rounded-3xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-xl">
                        <Armchair className="w-14 h-14 text-white" />
                      </div>
                    </div>
                    <div>
                      <p className="text-base font-semibold text-white/80 uppercase tracking-widest mb-3">
                        Tu Puesto Asignado
                      </p>
                      <p className="text-8xl sm:text-9xl font-black tracking-tighter mb-4">{studentInfo.puesto}</p>
                      <div className="inline-flex items-center gap-3 bg-white/20 backdrop-blur-sm px-6 py-3 rounded-2xl">
                        <BookOpen className="w-5 h-5" />
                        <span className="text-base font-semibold">{studentInfo.programa}</span>
                      </div>
                    </div>
                    <div className="pt-4 grid grid-cols-2 gap-4 max-w-md mx-auto">
                      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                        <p className="text-sm text-white/70 mb-1">Identificación</p>
                        <p className="text-lg font-bold">{studentInfo.identificacion}</p>
                      </div>
                      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                        <p className="text-sm text-white/70 mb-1">Nombre</p>
                        <p className="text-lg font-bold">{studentInfo.nombre.split(" ")[0]}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Columna derecha - Cupos */}
            <div className="space-y-6">
              <Card className="bg-white shadow-xl border-0">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <UtensilsCrossed className="w-5 h-5 text-blue-600" />
                      Mis Cupos
                    </CardTitle>
                    <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="font-semibold">En vivo</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-3">
                    <div className="text-center p-5 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl border-2 border-blue-200">
                      <p className="text-5xl font-black text-blue-600">{cuposTotales}</p>
                      <p className="text-xs text-gray-600 font-semibold mt-2">Total Asignados</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-2 border-green-200">
                        <p className="text-3xl font-black text-green-600">{cuposDisponibles}</p>
                        <p className="text-xs text-gray-600 font-semibold mt-1">Disponibles</p>
                      </div>
                      <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border-2 border-orange-200">
                        <p className="text-3xl font-black text-orange-600">{studentInfo.cuposConsumidos}</p>
                        <p className="text-xs text-gray-600 font-semibold mt-1">Consumidos</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-gray-600">
                      <span className="font-semibold">Progreso</span>
                      <span className="font-black">{Math.round(porcentajeUsado)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
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
                    <Alert variant="destructive" className="bg-red-50 border-red-300">
                      <AlertDescription className="text-xs font-semibold">
                        Has consumido todos tus cupos disponibles.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="bg-white shadow-xl border-0">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                  Estado de Bufetes
                </CardTitle>
                <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="font-semibold">Actualización en vivo</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingBuffetes ? (
                <div className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-600" />
                  <p className="text-sm text-gray-600">Cargando bufetes...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Resumen general */}
                  <div className="grid grid-cols-3 gap-3 p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border-2 border-indigo-200">
                    <div className="text-center">
                      <p className="text-3xl font-black text-indigo-600">{bufetesTotales}</p>
                      <p className="text-xs text-gray-600 font-semibold mt-1">Cupos Totales</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-black text-green-600">{bufetesDisponibles}</p>
                      <p className="text-xs text-gray-600 font-semibold mt-1">Disponibles</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-black text-orange-600">{bufetesTotales - bufetesDisponibles}</p>
                      <p className="text-xs text-gray-600 font-semibold mt-1">Consumidos</p>
                    </div>
                  </div>

                  {/* Lista de bufetes individuales */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {bufetes.map((bufete) => {
                      const porcentajeDisponible = (bufete.cuposDisponibles / bufete.cuposTotales) * 100
                      return (
                        <div
                          key={bufete.id}
                          className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-gray-200 hover:shadow-lg transition-shadow"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-bold text-sm text-gray-900">{bufete.nombre}</h3>
                            <UtensilsCrossed className="w-4 h-4 text-indigo-600" />
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between items-baseline">
                              <span className="text-2xl font-black text-indigo-600">{bufete.cuposDisponibles}</span>
                              <span className="text-xs text-gray-500 font-medium">de {bufete.cuposTotales}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full transition-all duration-500 ${
                                  porcentajeDisponible > 50
                                    ? "bg-gradient-to-r from-green-400 to-green-600"
                                    : porcentajeDisponible > 20
                                      ? "bg-gradient-to-r from-yellow-400 to-yellow-600"
                                      : "bg-gradient-to-r from-red-400 to-red-600"
                                }`}
                                style={{ width: `${porcentajeDisponible}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-600 font-medium text-center">
                              {Math.round(porcentajeDisponible)}% disponible
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white shadow-xl border-0">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  Historial de Consumo
                </CardTitle>
                <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="font-semibold">En vivo</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingLogs ? (
                <div className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
                  <p className="text-sm text-gray-600">Cargando historial...</p>
                </div>
              ) : accessLogs.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm text-gray-500 font-medium">No hay registros de acceso aún</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {accessLogs.map((log, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200 hover:shadow-md transition-all"
                    >
                      <div className="mt-0.5">{getStatusIcon(log.status)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-sm font-bold text-gray-900">{getStatusText(log.status)}</p>
                          <p className="text-xs text-gray-500 whitespace-nowrap font-medium">
                            {new Date(log.timestamp).toLocaleDateString("es-ES", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        {log.details && <p className="text-xs text-gray-600 mb-2">{log.details}</p>}
                        <div className="flex flex-wrap gap-2">
                          {log.mesaUsada && (
                            <div className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                              <UtensilsCrossed className="w-3 h-3" />
                              <span className="text-xs font-bold">Mesa {log.mesaUsada}</span>
                            </div>
                          )}
                          {log.bufeteUsado && (
                            <div className="inline-flex items-center gap-1.5 bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full">
                              <TrendingUp className="w-3 h-3" />
                              <span className="text-xs font-bold">{log.bufeteUsado}</span>
                            </div>
                          )}
                        </div>
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-xl font-bold text-center">¿Cerrar sesión?</h2>
            <p className="text-sm text-gray-600 text-center">
              ¿Estás seguro de que deseas cerrar sesión? Tendrás que volver a iniciar sesión para acceder a tu
              información.
            </p>
            <div className="space-y-2">
              <button
                onClick={confirmLogout}
                className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white py-3 rounded-xl font-bold hover:from-red-600 hover:to-red-700 transition-all shadow-lg"
              >
                Confirmar
              </button>
              <button
                onClick={cancelLogout}
                className="w-full bg-white text-gray-900 py-3 rounded-xl font-semibold border-2 border-gray-300 hover:bg-gray-50 transition-colors"
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
