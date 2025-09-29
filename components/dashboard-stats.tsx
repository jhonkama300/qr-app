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
  Loader2,
  UserCheck,
  BarChart3,
  TrendingUp,
  Utensils,
  Activity,
  ChefHat,
  Target,
  GraduationCap,
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
  mesaUsada?: number
}

interface UserStats {
  userId: string
  userName: string
  userEmail: string
  accedidos: number
  denegados: number
  total: number
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
  const [realTimeUpdates, setRealTimeUpdates] = useState(0)

  useEffect(() => {
    loadInitialData()
    setupRealTimeListeners()
  }, [])

  const loadInitialData = async () => {
    setLoading(true)
    setError(null)
    try {
      const personsSnapshot = await getDocs(collection(db, "personas"))
      const personsData: PersonData[] = []
      personsSnapshot.forEach((doc) => {
        personsData.push({
          id: doc.id,
          ...doc.data(),
        } as PersonData)
      })
      setAllPersons(personsData)

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

    const entregasComida = accessLogs.filter(
      (log) => (log.status === "granted" || log.status === "q10_success") && log.mesaUsada !== undefined,
    )

    const comidasEntregadas = entregasComida.length
    const precioPorComida = 8000
    const ingresosPorComida = comidasEntregadas * precioPorComida

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
        const isGranted = log.status === "granted" || log.status === "q10_success"
        const isDenied = log.status === "denied" || log.status === "q10_failed"

        if (existing) {
          if (isGranted) existing.accedidos++
          if (isDenied) existing.denegados++
          existing.total++
        } else {
          userStatsMap.set(log.grantedByUserId, {
            userId: log.grantedByUserId,
            userName: log.grantedByUserName,
            userEmail: log.grantedByUserEmail || "",
            accedidos: isGranted ? 1 : 0,
            denegados: isDenied ? 1 : 0,
            total: 1,
          })
        }
      }
    })

    return Array.from(userStatsMap.values()).sort((a, b) => b.total - a.total)
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

  const getEntregasPorMesa = () => {
    const entregasPorMesa = new Map<number, number>()
    const entregasComida = accessLogs.filter(
      (log) => (log.status === "granted" || log.status === "q10_success") && log.mesaUsada !== undefined,
    )

    entregasComida.forEach((log) => {
      if (log.mesaUsada) {
        entregasPorMesa.set(log.mesaUsada, (entregasPorMesa.get(log.mesaUsada) || 0) + 1)
      }
    })

    return Array.from(entregasPorMesa.entries())
      .map(([mesa, entregas]) => ({ mesa, entregas }))
      .sort((a, b) => b.entregas - a.entregas)
  }

  const uniqueAccessLogs = getUniqueAccessLogs()
  const userStats = getUserStats()
  const topUser = userStats[0]

  const grantedAccessCount = uniqueAccessLogs.filter(
    (log) => log.status === "granted" || log.status === "q10_success",
  ).length
  const deniedAccessCount = uniqueAccessLogs.filter(
    (log) => log.status === "denied" || log.status === "q10_failed",
  ).length
  const scannedIdentifications = new Set(uniqueAccessLogs.map((log) => log.identificacion))
  const waitingPersonsCount = allPersons.filter((person) => !scannedIdentifications.has(person.identificacion)).length
  const totalPersonsCount = allPersons.length
  const graduandosRegistrados = totalPersonsCount - scannedIdentifications.size
  const entregasPorMesa = getEntregasPorMesa()

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-center justify-center min-h-[400px] text-foreground">
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

      <div className="grid gap-2 md:gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 text-center">
        <Card className="p-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium text-blue-600">Graduandos Registrados</CardTitle>
            <GraduationCap className="h-3 w-3 text-blue-600" />
          </CardHeader>
          <CardContent className="p-2 pt-0">
            <div className="text-lg font-bold text-blue-800">{graduandosRegistrados}</div>
            <p className="text-xs text-muted-foreground">Pendientes por procesar</p>
          </CardContent>
        </Card>

        <Card className="p-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium text-green-600">Accesos Concedidos</CardTitle>
            <CheckCircle className="h-3 w-3 text-green-600" />
          </CardHeader>
          <CardContent className="p-2 pt-0">
            <div className="text-lg font-bold text-green-800">{grantedAccessCount}</div>
            <p className="text-xs text-muted-foreground">Personas con acceso permitido</p>
          </CardContent>
        </Card>

        <Card className="p-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium text-red-600">Accesos Denegados</CardTitle>
            <XCircle className="h-3 w-3 text-red-600" />
          </CardHeader>
          <CardContent className="p-2 pt-0">
            <div className="text-lg font-bold text-red-800">{deniedAccessCount}</div>
            <p className="text-xs text-muted-foreground">Personas con acceso denegado</p>
          </CardContent>
        </Card>

        <Card className="p-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium text-orange-600">En Espera</CardTitle>
            <Clock className="h-3 w-3 text-orange-600" />
          </CardHeader>
          <CardContent className="p-2 pt-0">
            <div className="text-lg font-bold text-orange-800">{waitingPersonsCount}</div>
            <p className="text-xs text-muted-foreground">Personas sin procesar</p>
          </CardContent>
        </Card>

        <Card className="p-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium text-blue-600">Mesas Activas</CardTitle>
            <Utensils className="h-3 w-3 text-blue-600" />
          </CardHeader>
          <CardContent className="p-2 pt-0">
            <div className="text-lg font-bold text-blue-800">
              {buffetStats.mesasActivas}/{buffetStats.totalMesas}
            </div>
            <p className="text-xs text-muted-foreground">Mesas de bufete operativas</p>
          </CardContent>
        </Card>

        <Card className="p-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium text-purple-600">Comidas Entregadas</CardTitle>
            <ChefHat className="h-3 w-3 text-purple-600" />
          </CardHeader>
          <CardContent className="p-2 pt-0">
            <div className="text-lg font-bold text-purple-800">{buffetStats.comidasEntregadas}</div>
            <p className="text-xs text-muted-foreground">Total de entregas realizadas</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-2 md:gap-3 grid-cols-1 sm:grid-cols-2">
        <Card className="p-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium text-orange-600">Mesa Más Activa</CardTitle>
            <Target className="h-3 w-3 text-orange-600" />
          </CardHeader>
          <CardContent className="p-2 pt-0">
            {buffetStats.mesaMasActiva ? (
              <>
                <div className="text-lg font-bold text-orange-800">Mesa {buffetStats.mesaMasActiva.numero}</div>
                <p className="text-xs text-muted-foreground">
                  {buffetStats.mesaMasActiva.entregas} entregas realizadas
                </p>
              </>
            ) : (
              <>
                <div className="text-lg font-bold text-gray-500">N/A</div>
                <p className="text-xs text-muted-foreground">Sin entregas registradas</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="p-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium text-indigo-600">Promedio por Mesa</CardTitle>
            <BarChart3 className="h-3 w-3 text-indigo-600" />
          </CardHeader>
          <CardContent className="p-2 pt-0">
            <div className="text-lg font-bold text-indigo-800">{buffetStats.promedioEntregasPorMesa}</div>
            <p className="text-xs text-muted-foreground">Entregas promedio por mesa activa</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 md:gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <BarChart3 className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
              Estado General
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs md:text-sm text-green-600">Concedidos</span>
                  <span className="font-medium text-green-600">{grantedAccessCount}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{
                      width: `${totalPersonsCount > 0 ? (grantedAccessCount / totalPersonsCount) * 100 : 0}%`,
                    }}
                  ></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs md:text-sm text-red-600">Denegados</span>
                  <span className="font-medium text-red-600">{deniedAccessCount}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-red-600 h-2 rounded-full"
                    style={{
                      width: `${totalPersonsCount > 0 ? (deniedAccessCount / totalPersonsCount) * 100 : 0}%`,
                    }}
                  ></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs md:text-sm text-orange-600">En Espera</span>
                  <span className="font-medium text-orange-600">{waitingPersonsCount}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-orange-600 h-2 rounded-full"
                    style={{
                      width: `${totalPersonsCount > 0 ? (waitingPersonsCount / totalPersonsCount) * 100 : 0}%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
              Usuario Más Activo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topUser ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-sm md:text-base">{topUser.userName}</span>
                </div>
                <p className="text-xs md:text-sm text-muted-foreground">{topUser.userEmail}</p>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="text-center p-2 bg-green-50 rounded-lg">
                    <div className="text-lg md:text-xl font-bold text-green-800">{topUser.accedidos}</div>
                    <p className="text-xs text-green-600">Accedidos</p>
                  </div>
                  <div className="text-center p-2 bg-red-50 rounded-lg">
                    <div className="text-lg md:text-xl font-bold text-red-800">{topUser.denegados}</div>
                    <p className="text-xs text-red-600">Denegados</p>
                  </div>
                </div>
                <div className="text-center mt-2">
                  <div className="text-sm text-muted-foreground">
                    Total: <span className="font-semibold">{topUser.total}</span> registros
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No hay datos de usuarios disponibles</p>
            )}
          </CardContent>
        </Card>
      </div>

      {entregasPorMesa.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg">Cantidad de Comidas Entregadas por Mesa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {entregasPorMesa.map(({ mesa, entregas }) => (
                <div key={mesa} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <ChefHat className="w-4 h-4 text-purple-600" />
                    <span className="font-medium text-sm md:text-base">Mesa {mesa}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm md:text-base text-purple-800">{entregas}</p>
                    <p className="text-xs text-muted-foreground">entregas</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {userStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg">Historial de Registros por Usuario</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {userStats.slice(0, 10).map((user, index) => (
                <div key={user.userId} className="flex items-center justify-between p-2 md:p-3 border rounded-lg">
                  <div className="flex items-center gap-2 md:gap-3 flex-1">
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
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm md:text-base truncate">{user.userName}</p>
                      <p className="text-xs md:text-sm text-muted-foreground truncate">{user.userEmail}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 md:gap-4 ml-2">
                    <div className="text-center">
                      <p className="font-bold text-xs md:text-sm text-green-600">{user.accedidos}</p>
                      <p className="text-[10px] md:text-xs text-muted-foreground">Accedidos</p>
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-xs md:text-sm text-red-600">{user.denegados}</p>
                      <p className="text-[10px] md:text-xs text-muted-foreground">Denegados</p>
                    </div>
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
