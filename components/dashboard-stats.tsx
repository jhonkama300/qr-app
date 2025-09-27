"use client"

import { useState, useEffect } from "react"
import { collection, getDocs, query, orderBy, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  CheckCircle,
  XCircle,
  Clock,
  Users,
  Loader2,
  UserCheck,
  BarChart3,
  TrendingUp,
  Utensils,
  DollarSign,
  Activity,
  ChefHat,
  Target,
} from "lucide-react"

interface PersonData {
  id: string
  puesto: string
  identificacion: string
  nombre: string
  programa: string
  cuposExtras: number
}

interface AccessLog {
  id: string
  identificacion: string
  timestamp: string
  status: "granted" | "denied" | "q10_success" | "q10_failed"
  details?: string
  grantedByUserId?: string
  grantedByUserName?: string
  grantedByUserEmail?: string
  mesaUsada?: number // Agregado campo para mesa utilizada
}

interface UserStats {
  userId: string
  userName: string
  userEmail: string
  registrosCount: number
}

interface MesaConfig {
  id: string
  numero: number
  nombre: string
  activa: boolean
}

interface BuffetStats {
  mesasActivas: number
  totalMesas: number
  comidasEntregadas: number
  ingresosPorComida: number
  mesaMasActiva: { numero: number; entregas: number } | null
  promedioEntregasPorMesa: number
}

export function DashboardStats() {
  const [allPersons, setAllPersons] = useState<PersonData[]>([])
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mesasConfig, setMesasConfig] = useState<MesaConfig[]>([])
  const [buffetStats, setBuffetStats] = useState<BuffetStats>({
    mesasActivas: 0,
    totalMesas: 0,
    comidasEntregadas: 0,
    ingresosPorComida: 0,
    mesaMasActiva: null,
    promedioEntregasPorMesa: 0,
  })
  const [realTimeUpdates, setRealTimeUpdates] = useState(0) // Para forzar re-renders

  useEffect(() => {
    loadInitialData()
    setupRealTimeListeners()
  }, [])

  const loadInitialData = async () => {
    setLoading(true)
    setError(null)
    try {
      // Cargar todas las personas
      const personsSnapshot = await getDocs(collection(db, "personas"))
      const personsData: PersonData[] = []
      personsSnapshot.forEach((doc) => {
        personsData.push({
          id: doc.id,
          ...doc.data(),
        } as PersonData)
      })
      setAllPersons(personsData)

      // Cargar configuración de mesas
      const mesasSnapshot = await getDocs(collection(db, "mesas_config"))
      const mesasData: MesaConfig[] = []
      mesasSnapshot.forEach((doc) => {
        mesasData.push({
          id: doc.id,
          ...doc.data(),
        } as MesaConfig)
      })
      setMesasConfig(mesasData)
    } catch (err) {
      console.error("Error al cargar datos iniciales:", err)
      setError("Error al cargar los datos de las estadísticas.")
    } finally {
      setLoading(false)
    }
  }

  const setupRealTimeListeners = () => {
    // Listener para access_logs en tiempo real
    const logsQuery = query(collection(db, "access_logs"), orderBy("timestamp", "desc"))
    const unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
      const logsData: AccessLog[] = []
      snapshot.forEach((doc) => {
        logsData.push({
          id: doc.id,
          ...doc.data(),
        } as AccessLog)
      })
      setAccessLogs(logsData)
      setRealTimeUpdates((prev) => prev + 1)
      console.log("[v0] Logs actualizados en tiempo real:", logsData.length)
    })

    // Listener para mesas_config en tiempo real
    const mesasQuery = query(collection(db, "mesas_config"))
    const unsubscribeMesas = onSnapshot(mesasQuery, (snapshot) => {
      const mesasData: MesaConfig[] = []
      snapshot.forEach((doc) => {
        mesasData.push({
          id: doc.id,
          ...doc.data(),
        } as MesaConfig)
      })
      setMesasConfig(mesasData)
      console.log("[v0] Configuración de mesas actualizada:", mesasData.length)
    })

    // Cleanup function
    return () => {
      unsubscribeLogs()
      unsubscribeMesas()
    }
  }

  useEffect(() => {
    if (mesasConfig.length > 0 && accessLogs.length > 0) {
      calculateBuffetStats()
    }
  }, [mesasConfig, accessLogs, realTimeUpdates])

  const calculateBuffetStats = () => {
    const mesasActivas = mesasConfig.filter((mesa) => mesa.activa).length
    const totalMesas = mesasConfig.length

    // Filtrar logs de entregas de comida (con mesaUsada)
    const entregasComida = accessLogs.filter(
      (log) => (log.status === "granted" || log.status === "q10_success") && log.mesaUsada !== undefined,
    )

    const comidasEntregadas = entregasComida.length
    const precioPorComida = 8000 // Precio estimado por comida en pesos colombianos
    const ingresosPorComida = comidasEntregadas * precioPorComida

    // Calcular mesa más activa
    const entregasPorMesa = new Map<number, number>()
    entregasComida.forEach((log) => {
      if (log.mesaUsada) {
        entregasPorMesa.set(log.mesaUsada, (entregasPorMesa.get(log.mesaUsada) || 0) + 1)
      }
    })

    let mesaMasActiva: { numero: number; entregas: number } | null = null
    let maxEntregas = 0
    entregasPorMesa.forEach((entregas, mesa) => {
      if (entregas > maxEntregas) {
        maxEntregas = entregas
        mesaMasActiva = { numero: mesa, entregas }
      }
    })

    const promedioEntregasPorMesa = mesasActivas > 0 ? Math.round(comidasEntregadas / mesasActivas) : 0

    setBuffetStats({
      mesasActivas,
      totalMesas,
      comidasEntregadas,
      ingresosPorComida,
      mesaMasActiva,
      promedioEntregasPorMesa,
    })

    console.log("[v0] Estadísticas de bufete calculadas:", {
      mesasActivas,
      comidasEntregadas,
      ingresosPorComida,
      mesaMasActiva,
    })
  }

  const getUserStats = (): UserStats[] => {
    const userStatsMap = new Map<string, UserStats>()

    accessLogs.forEach((log) => {
      if (log.grantedByUserId && log.grantedByUserName) {
        const existing = userStatsMap.get(log.grantedByUserId)
        if (existing) {
          existing.registrosCount++
        } else {
          userStatsMap.set(log.grantedByUserId, {
            userId: log.grantedByUserId,
            userName: log.grantedByUserName,
            userEmail: log.grantedByUserEmail || "",
            registrosCount: 1,
          })
        }
      }
    })

    return Array.from(userStatsMap.values()).sort((a, b) => b.registrosCount - a.registrosCount)
  }

  const getUniqueAccessLogs = () => {
    const uniqueLogs = new Map<string, AccessLog>()
    accessLogs.forEach((log) => {
      if (
        !uniqueLogs.has(log.identificacion) ||
        new Date(log.timestamp) > new Date(uniqueLogs.get(log.identificacion)!.timestamp)
      ) {
        uniqueLogs.set(log.identificacion, log)
      }
    })
    return Array.from(uniqueLogs.values())
  }

  const uniqueAccessLogs = getUniqueAccessLogs()
  const userStats = getUserStats()
  const topUser = userStats[0] // Usuario con más registros

  const grantedAccessCount = uniqueAccessLogs.filter(
    (log) => log.status === "granted" || log.status === "q10_success",
  ).length
  const deniedAccessCount = uniqueAccessLogs.filter(
    (log) => log.status === "denied" || log.status === "q10_failed",
  ).length
  const scannedIdentifications = new Set(uniqueAccessLogs.map((log) => log.identificacion))
  const waitingPersonsCount = allPersons.filter((person) => !scannedIdentifications.has(person.identificacion)).length
  const totalPersonsCount = allPersons.length
  const totalRegistrosCount = accessLogs.length // Total de registros de acceso

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p className="text-muted-foreground">Cargando estadísticas del dashboard...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-6 p-2 md:p-4">
      <div className="flex flex-col items-start justify-between gap-2 md:gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Dashboard Principal</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Resumen general del sistema de control de acceso
            <span className="ml-2 inline-flex items-center gap-1 text-green-600">
              <Activity className="w-3 h-3" />
              <span className="text-xs">Tiempo Real</span>
            </span>
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Estudiantes Registrados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">{totalPersonsCount}</div>
            <p className="text-xs text-muted-foreground">Total en la base de datos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">Total Registros</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold">{totalRegistrosCount}</div>
            <p className="text-xs text-muted-foreground">Registros de acceso totales</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-green-600">Accesos Concedidos</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold text-green-800">{grantedAccessCount}</div>
            <p className="text-xs text-muted-foreground">Personas con acceso permitido</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-red-600">Accesos Denegados</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold text-red-800">{deniedAccessCount}</div>
            <p className="text-xs text-muted-foreground">Personas con acceso denegado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-blue-600">Mesas Activas</CardTitle>
            <Utensils className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold text-blue-800">
              {buffetStats.mesasActivas}/{buffetStats.totalMesas}
            </div>
            <p className="text-xs text-muted-foreground">Mesas de bufete operativas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-purple-600">Comidas Entregadas</CardTitle>
            <ChefHat className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold text-purple-800">{buffetStats.comidasEntregadas}</div>
            <p className="text-xs text-muted-foreground">Total de entregas realizadas</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-green-600">Ingresos por Comidas</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold text-green-800">
              ${buffetStats.ingresosPorComida.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">COP - Estimado a $8,000/comida</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-orange-600">Mesa Más Activa</CardTitle>
            <Target className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            {buffetStats.mesaMasActiva ? (
              <>
                <div className="text-xl md:text-2xl font-bold text-orange-800">
                  Mesa {buffetStats.mesaMasActiva.numero}
                </div>
                <p className="text-xs text-muted-foreground">
                  {buffetStats.mesaMasActiva.entregas} entregas realizadas
                </p>
              </>
            ) : (
              <>
                <div className="text-xl md:text-2xl font-bold text-gray-500">N/A</div>
                <p className="text-xs text-muted-foreground">Sin entregas registradas</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-indigo-600">Promedio por Mesa</CardTitle>
            <BarChart3 className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold text-indigo-800">{buffetStats.promedioEntregasPorMesa}</div>
            <p className="text-xs text-muted-foreground">Entregas promedio por mesa activa</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-teal-600">Eficiencia Bufete</CardTitle>
            <TrendingUp className="h-4 w-4 text-teal-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl md:text-2xl font-bold text-teal-800">
              {buffetStats.totalMesas > 0 ? Math.round((buffetStats.mesasActivas / buffetStats.totalMesas) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Porcentaje de mesas activas</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 md:gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
              Usuario Más Activo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topUser ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-sm md:text-base">{topUser.userName}</span>
                </div>
                <p className="text-xs md:text-sm text-muted-foreground">{topUser.userEmail}</p>
                <div className="text-xl md:text-2xl font-bold text-blue-800">{topUser.registrosCount}</div>
                <p className="text-xs text-muted-foreground">registros realizados</p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No hay datos de usuarios disponibles</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Clock className="w-4 h-4 md:w-5 md:h-5 text-orange-600" />
              Estado General
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs md:text-sm">En espera</span>
                <span className="font-medium text-orange-600">{waitingPersonsCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs md:text-sm">Procesados</span>
                <span className="font-medium">{grantedAccessCount + deniedAccessCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs md:text-sm">Tasa de aprobación</span>
                <span className="font-medium text-green-600">
                  {grantedAccessCount + deniedAccessCount > 0
                    ? Math.round((grantedAccessCount / (grantedAccessCount + deniedAccessCount)) * 100)
                    : 0}
                  %
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {userStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg">Ranking de Usuarios por Actividad</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {userStats.slice(0, 5).map((user, index) => (
                <div key={user.userId} className="flex items-center justify-between p-2 md:p-3 border rounded-lg">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div
                      className={`flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-full text-xs md:text-sm ${
                        index === 0
                          ? "bg-yellow-100 text-yellow-800"
                          : index === 1
                            ? "bg-gray-100 text-gray-800"
                            : index === 2
                              ? "bg-orange-100 text-orange-800"
                              : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-sm md:text-base">{user.userName}</p>
                      <p className="text-xs md:text-sm text-muted-foreground">{user.userEmail}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm md:text-base">{user.registrosCount}</p>
                    <p className="text-xs text-muted-foreground">registros</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
