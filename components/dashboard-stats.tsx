"use client"

import { useState, useEffect } from "react"
import { collection, getDocs, query, orderBy, onSnapshot, doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  UserCheck,
  TrendingUp,
  Utensils,
  Activity,
  ChefHat,
  GraduationCap,
  Package,
  AlertTriangle,
} from "lucide-react"
import { Progress } from "@/components/ui/progress"
import type { MealInventory } from "@/lib/firestore-service"

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
  grantedByUserRole?: string
  mesaUsada?: number
}

interface UserStats {
  userId: string
  userName: string
  userEmail: string
  userRole: string
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

interface UserData {
  id: string
  fullName: string
  role: string
  idNumber: string
}

interface DashboardStatsProps {
  currentUserRole?: string
  userName?: string
}

export function DashboardStats({ currentUserRole = "administrador", userName = "" }: DashboardStatsProps) {
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
  const [usersCache, setUsersCache] = useState<Map<string, UserData>>(new Map())
  const [adminOperativoStats, setAdminOperativoStats] = useState<UserStats[]>([])
  const [bufeteStats, setBuffeteStats] = useState<UserStats[]>([])
  const [mealInventory, setMealInventory] = useState<MealInventory | null>(null)

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

    const inventoryRef = doc(db, "config", "meal_inventory")
    const unsubscribeInventory = onSnapshot(inventoryRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        setMealInventory(docSnapshot.data() as MealInventory)
        console.log("[v0] Inventario de comidas actualizado:", docSnapshot.data())
      }
    })

    return () => {
      unsubscribeLogs()
      unsubscribeMesas()
      unsubscribeInventory()
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
      if (log.mesaUsada !== undefined) {
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
      entregasPorMesa: Array.from(entregasPorMesa.entries()),
    })
  }

  const fetchUserData = async (userId: string): Promise<UserData | null> => {
    try {
      if (usersCache.has(userId)) {
        return usersCache.get(userId)!
      }

      const userDoc = await getDoc(doc(db, "users", userId))
      if (userDoc.exists()) {
        const userData: UserData = {
          id: userDoc.id,
          ...userDoc.data(),
        } as UserData

        setUsersCache((prev) => new Map(prev).set(userId, userData))
        console.log("[v0] Usuario cargado desde Firestore:", userData)
        return userData
      }
      return null
    } catch (error) {
      console.error("[v0] Error al cargar usuario:", error)
      return null
    }
  }

  const getFilteredLogs = () => {
    console.log("[v0] Mostrando todos los logs sin filtrar por rol:", {
      totalLogs: accessLogs.length,
    })

    return accessLogs
  }

  const getUserStats = async (): Promise<{ adminOperativo: UserStats[]; bufete: UserStats[] }> => {
    const adminOperativoMap = new Map<string, UserStats>()
    const bufeteMap = new Map<string, UserStats>()

    const filteredLogs = getFilteredLogs()

    for (const log of filteredLogs) {
      console.log("[v0] Procesando log en getUserStats:", {
        grantedByUserId: log.grantedByUserId,
        grantedByUserName: log.grantedByUserName,
        grantedByUserRole: log.grantedByUserRole,
        identificacion: log.identificacion,
        status: log.status,
      })

      if (log.grantedByUserId) {
        let userName = log.grantedByUserName || "Usuario desconocido"
        let userRole = log.grantedByUserRole || "Usuario"

        if (!log.grantedByUserName || !log.grantedByUserRole) {
          console.log("[v0] Datos de usuario faltantes en log, consultando Firestore...")
          const userData = await fetchUserData(log.grantedByUserId)
          if (userData) {
            userName = userData.fullName || userName
            userRole = userData.role || userRole
            console.log("[v0] Datos actualizados desde Firestore:", { userName, userRole })
          }
        }

        const isBufete = userRole.toLowerCase() === "bufete"
        const targetMap = isBufete ? bufeteMap : adminOperativoMap

        const existing = targetMap.get(log.grantedByUserId)
        const isGranted = log.status === "granted" || log.status === "q10_success"
        const isDenied = log.status === "denied" || log.status === "q10_failed"

        if (existing) {
          if (isGranted) {
            existing.accedidos++
          }
          if (isDenied) {
            existing.denegados++
          }
          existing.total = existing.accedidos + existing.denegados
        } else {
          const accedidos = isGranted ? 1 : 0
          const denegados = isDenied ? 1 : 0

          targetMap.set(log.grantedByUserId, {
            userId: log.grantedByUserId,
            userName: userName,
            userEmail: log.grantedByUserEmail || "",
            userRole: userRole,
            accedidos,
            denegados,
            total: accedidos + denegados,
          })
        }
      }
    }

    const adminOperativoStats = Array.from(adminOperativoMap.values())
      .filter((stat) => stat.userName !== "Usuario desconocido")
      .sort((a, b) => b.total - a.total)

    const bufeteStatsArray = Array.from(bufeteMap.values())
      .filter((stat) => stat.userName !== "Usuario desconocido")
      .sort((a, b) => b.total - a.total)

    console.log("[v0] Estadísticas separadas calculadas:", {
      adminOperativo: adminOperativoStats,
      bufete: bufeteStatsArray,
    })

    return { adminOperativo: adminOperativoStats, bufete: bufeteStatsArray }
  }

  useEffect(() => {
    const loadUserStats = async () => {
      const stats = await getUserStats()
      setAdminOperativoStats(stats.adminOperativo)
      setBuffeteStats(stats.bufete)
    }
    if (accessLogs.length > 0) {
      loadUserStats()
    }
  }, [accessLogs, realTimeUpdates, currentUserRole])

  const getUniqueAccessLogs = () => {
    const filteredLogs = getFilteredLogs()
    const uniqueLogs = new Map<string, AccessLog>()

    filteredLogs.forEach((log) => {
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
      if (log.mesaUsada !== undefined) {
        entregasPorMesa.set(log.mesaUsada, (entregasPorMesa.get(log.mesaUsada) || 0) + 1)
      }
    })

    return Array.from(entregasPorMesa.entries())
      .map(([mesa, entregas]) => ({ mesa, entregas }))
      .sort((a, b) => b.entregas - a.entregas)
  }

  const uniqueAccessLogs = getUniqueAccessLogs()
  const allUserStatsMap = new Map<string, UserStats>()
  ;[...adminOperativoStats, ...bufeteStats].forEach((stat) => {
    const existing = allUserStatsMap.get(stat.userId)
    if (existing) {
      existing.accedidos += stat.accedidos
      existing.denegados += stat.denegados
      existing.total += stat.total
    } else {
      allUserStatsMap.set(stat.userId, { ...stat })
    }
  })

  const allUserStats = Array.from(allUserStatsMap.values())
  const topUser = allUserStats.sort((a, b) => b.total - a.total)[0]

  const grantedAccessCount = uniqueAccessLogs.filter(
    (log) => log.status === "granted" || log.status === "q10_success",
  ).length
  const deniedAccessCount = uniqueAccessLogs.filter(
    (log) => log.status === "denied" || log.status === "q10_failed",
  ).length
  const scannedIdentifications = new Set(uniqueAccessLogs.map((log) => log.identificacion))
  const waitingPersonsCount = allPersons.filter((person) => !scannedIdentifications.has(person.identificacion)).length
  const totalPersonsCount = allPersons.length
  const graduandosRegistrados = totalPersonsCount
  const entregasPorMesa = getEntregasPorMesa()

  const inventoryPercentage = mealInventory
    ? (mealInventory.comidasDisponibles / mealInventory.totalComidas) * 100
    : 100
  const isLowInventory = inventoryPercentage < 20

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 md:gap-6 p-2 md:p-4 px-1">
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
    <div className="flex flex-1 flex-col gap-1 md:gap-6 p-1 md:p-4 bg-gray-50/80 dark:bg-gray-950/50">
      <div className="relative overflow-hidden rounded-xl border border-uparsistem-200 dark:border-uparsistem-800/30 bg-gradient-to-br from-uparsistem-50/80 via-white to-uparsistem-50/50 dark:from-uparsistem-950/20 dark:via-gray-900 dark:to-uparsistem-950/10 p-3 md:p-5 shadow-sm">
        <div className="absolute top-0 right-0 w-32 h-32 bg-uparsistem-200/20 dark:bg-uparsistem-800/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
        <div className="relative flex items-center gap-3 md:gap-4">
          <div className="flex size-9 md:size-12 shrink-0 items-center justify-center rounded-xl bg-uparsistem-600 dark:bg-uparsistem-700 shadow-sm shadow-uparsistem-600/20">
            <span className="text-base md:text-xl font-bold text-white">
              {(userName || "D")[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            {userName ? (
              <>
                <h1 className="text-sm md:text-xl font-bold text-uparsistem-800 dark:text-uparsistem-200 leading-tight">
                  Hola, <span className="text-uparsistem-700 dark:text-uparsistem-400">{userName}</span>
                </h1>
                <p className="text-[10px] md:text-sm text-uparsistem-600/70 dark:text-uparsistem-400/70 leading-tight mt-0.5">
                  Este es el resumen general del sistema
                </p>
              </>
            ) : (
              <>
                <h1 className="text-sm md:text-xl font-bold text-uparsistem-800 dark:text-uparsistem-200">Dashboard Principal</h1>
                <p className="text-[10px] md:text-sm text-uparsistem-600/70 dark:text-uparsistem-400/70">Resumen general del sistema de control de acceso</p>
              </>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-uparsistem-100 dark:bg-uparsistem-900/30 ring-1 ring-uparsistem-300 dark:ring-uparsistem-700">
            <span className="flex size-1.5 rounded-full bg-uparsistem-500 animate-pulse" />
            <span className="text-[10px] md:text-xs text-uparsistem-700 dark:text-uparsistem-300 font-medium">Tiempo real</span>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLowInventory && mealInventory && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            ¡Advertencia! El inventario de comidas está bajo ({inventoryPercentage.toFixed(1)}% disponible). Solo quedan{" "}
            {mealInventory.comidasDisponibles} de {mealInventory.totalComidas} comidas.
          </AlertDescription>
        </Alert>
      )}

      {mealInventory && (
        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 !p-0 md:!p-0">
          <CardHeader className="pb-1 md:pb-2 p-2 md:p-6">
            <CardTitle className="text-[11px] md:text-base flex items-center gap-1 md:gap-2 text-uparsistem-700">
              <Package className="h-3 w-3 md:h-5 md:w-5 text-uparsistem-600" />
              Inventario Global de Comidas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 md:space-y-3 p-2 md:p-6 pt-0 md:pt-0">
            <div className="grid grid-cols-3 gap-1 md:gap-4">
              <div className="text-center">
                <div className="text-sm md:text-2xl font-bold text-uparsistem-800">{mealInventory.totalComidas}</div>
                <p className="text-[8px] md:text-xs text-uparsistem-600">Total</p>
              </div>
              <div className="text-center">
                <div className="text-sm md:text-2xl font-bold text-red-700">{mealInventory.comidasConsumidas}</div>
                <p className="text-[8px] md:text-xs text-red-600">Entregadas</p>
              </div>
              <div className="text-center">
                <div className={`text-sm md:text-2xl font-bold ${isLowInventory ? "text-red-700" : "text-uparsistem-700"}`}>
                  {mealInventory.comidasDisponibles}
                </div>
                <p className={`text-[8px] md:text-xs ${isLowInventory ? "text-red-600" : "text-uparsistem-600"}`}>
                  Disponibles
                </p>
              </div>
            </div>
            <div className="space-y-0.5 md:space-y-1">
              <div className="flex items-center justify-between text-[10px] md:text-xs">
                <span className="text-orange-700">Progreso</span>
                <span className="font-medium text-orange-800">
                  {((mealInventory.comidasConsumidas / mealInventory.totalComidas) * 100).toFixed(1)}%
                </span>
              </div>
              <Progress value={(mealInventory.comidasConsumidas / mealInventory.totalComidas) * 100} className="h-1.5 md:h-2 [&>div]:bg-gradient-to-r [&>div]:from-orange-400 [&>div]:to-amber-600" />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-1 md:gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card className="p-1 md:p-2 shadow-sm md:shadow-sm border-blue-300/60 dark:border-blue-800/40 bg-blue-100/70 dark:bg-blue-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 p-1 md:p-2">
            <CardTitle className="text-[8px] sm:text-[10px] md:text-xs font-medium text-blue-800 leading-tight">
              Graduandos
            </CardTitle>
            <GraduationCap className="h-2.5 w-2.5 md:h-4 md:w-4 text-blue-700 flex-shrink-0" />
          </CardHeader>
          <CardContent className="p-1 md:p-2 pt-0">
            <div className="text-[11px] sm:text-sm md:text-lg font-bold text-blue-900">{graduandosRegistrados}</div>
            <p className="hidden md:block text-[8px] sm:text-[9px] md:text-xs text-muted-foreground leading-tight">
              Total registrados
            </p>
          </CardContent>
        </Card>

        <Card className="p-1 md:p-2 shadow-sm md:shadow-sm bg-uparsistem-100/70 dark:bg-uparsistem-950/20 border-uparsistem-300/60 dark:border-uparsistem-800/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 p-1 md:p-2">
            <CardTitle className="text-[8px] sm:text-[10px] md:text-xs font-medium text-uparsistem-800 leading-tight">
              Accesos
            </CardTitle>
            <CheckCircle className="h-2.5 w-2.5 md:h-4 md:w-4 text-uparsistem-700 flex-shrink-0" />
          </CardHeader>
          <CardContent className="p-1 md:p-2 pt-0">
            <div className="text-[11px] sm:text-sm md:text-lg font-bold text-uparsistem-800">{grantedAccessCount}</div>
            <p className="hidden md:block text-[8px] sm:text-[9px] md:text-xs text-muted-foreground leading-tight">
              Con acceso permitido
            </p>
          </CardContent>
        </Card>

        <Card className="p-1 md:p-2 shadow-sm md:shadow-sm bg-red-100/70 dark:bg-red-950/20 border-red-300/60 dark:border-red-800/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 p-1 md:p-2">
            <CardTitle className="text-[8px] sm:text-[10px] md:text-xs font-medium text-red-800 leading-tight">
              Denegados
            </CardTitle>
            <XCircle className="h-2.5 w-2.5 md:h-4 md:w-4 text-red-700 flex-shrink-0" />
          </CardHeader>
          <CardContent className="p-1 md:p-2 pt-0">
            <div className="text-[11px] sm:text-sm md:text-lg font-bold text-red-900">{deniedAccessCount}</div>
            <p className="hidden md:block text-[8px] sm:text-[9px] md:text-xs text-muted-foreground leading-tight">
              Acceso denegado
            </p>
          </CardContent>
        </Card>

        <Card className="p-1 md:p-2 shadow-sm md:shadow-sm bg-amber-100/70 dark:bg-amber-950/20 border-amber-300/60 dark:border-amber-800/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 p-1 md:p-2">
            <CardTitle className="text-[8px] sm:text-[10px] md:text-xs font-medium text-amber-800 leading-tight">
              Espera
            </CardTitle>
            <Clock className="h-2.5 w-2.5 md:h-4 md:w-4 text-amber-700 flex-shrink-0" />
          </CardHeader>
          <CardContent className="p-1 md:p-2 pt-0">
            <div className="text-[11px] sm:text-sm md:text-lg font-bold text-amber-900">{waitingPersonsCount}</div>
            <p className="hidden md:block text-[8px] sm:text-[9px] md:text-xs text-muted-foreground leading-tight">
              Sin procesar
            </p>
          </CardContent>
        </Card>

        <Card className="p-1 md:p-2 shadow-sm md:shadow-sm bg-cyan-100/70 dark:bg-cyan-950/20 border-cyan-300/60 dark:border-cyan-800/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 p-1 md:p-2">
            <CardTitle className="text-[8px] sm:text-[10px] md:text-xs font-medium text-cyan-800 leading-tight">
              Mesas
            </CardTitle>
            <Utensils className="h-2.5 w-2.5 md:h-4 md:w-4 text-cyan-700 flex-shrink-0" />
          </CardHeader>
          <CardContent className="p-1 md:p-2 pt-0">
            <div className="text-[11px] sm:text-sm md:text-lg font-bold text-cyan-900">
              {buffetStats.mesasActivas}/{buffetStats.totalMesas}
            </div>
            <p className="hidden md:block text-[8px] sm:text-[9px] md:text-xs text-muted-foreground leading-tight">
              Bufete operativas
            </p>
          </CardContent>
        </Card>

        <Card className="p-1 md:p-2 shadow-sm md:shadow-sm bg-violet-100/70 dark:bg-violet-950/20 border-violet-300/60 dark:border-violet-800/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 p-1 md:p-2">
            <CardTitle className="text-[8px] sm:text-[10px] md:text-xs font-medium text-violet-800 leading-tight">
              Comidas
            </CardTitle>
            <ChefHat className="h-2.5 w-2.5 md:h-4 md:w-4 text-violet-700 flex-shrink-0" />
          </CardHeader>
          <CardContent className="p-1 md:p-2 pt-0">
            <div className="text-[11px] sm:text-sm md:text-lg font-bold text-violet-900">
              {buffetStats.comidasEntregadas}
            </div>
            <p className="hidden md:block text-[8px] sm:text-[9px] md:text-xs text-muted-foreground leading-tight">
              Entregas realizadas
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-1 md:gap-4 grid-cols-1 lg:grid-cols-2">
        <Card className="shadow-sm md:shadow-sm border-uparsistem-200/50 dark:border-uparsistem-800/30">
          <CardHeader className="p-2 md:p-6 pb-1 md:pb-4">
            <CardTitle className="flex items-center gap-1 md:gap-2 text-[11px] md:text-lg">
              <TrendingUp className="w-3 h-3 md:w-5 md:h-5 text-uparsistem-600" />
              Usuario Más Activo
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 md:p-6 pt-0 md:pt-0">
            {topUser ? (
              <div className="flex items-center gap-1 md:gap-3 p-1 md:p-3 rounded border bg-uparsistem-50 border-uparsistem-200">
                <div className="flex size-5 md:size-9 shrink-0 items-center justify-center rounded bg-uparsistem-600 text-white text-[9px] md:text-base font-bold">
                  1
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] md:text-sm font-semibold truncate leading-tight">{topUser.userName}</p>
                  <p className="text-[8px] md:text-xs text-muted-foreground truncate capitalize leading-tight">
                    {topUser.userRole} · {topUser.total} registros
                  </p>
                </div>
                <div className="flex items-center gap-0.5 md:gap-3 shrink-0">
                  <div className="text-center px-0.5">
                    <p className="text-[13px] md:text-sm font-bold text-uparsistem-600 tabular-nums leading-tight">{topUser.accedidos}</p>
                    <p className="text-[6px] md:text-[10px] text-muted-foreground leading-tight">A</p>
                  </div>
                  <div className="w-px h-4 md:h-7 bg-gray-200 dark:bg-gray-700" />
                  <div className="text-center px-0.5">
                    <p className="text-[13px] md:text-sm font-bold text-red-600 tabular-nums leading-tight">{topUser.denegados}</p>
                    <p className="text-[6px] md:text-[10px] text-muted-foreground leading-tight">D</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-xs md:text-sm">No hay datos de usuarios disponibles</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm md:shadow-sm border-uparsistem-200/50 dark:border-uparsistem-800/30">
          <CardHeader className="p-2 md:p-6 pb-1 md:pb-4">
            <CardTitle className="text-[11px] md:text-lg">Historial por Usuario</CardTitle>
          </CardHeader>
          <CardContent className="p-2 md:p-6 pt-0 md:pt-0">
            <div className="space-y-2 md:space-y-4">
              {adminOperativoStats.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 mb-1 md:mb-3">
                    <UserCheck className="w-2.5 h-2.5 md:w-4 md:h-4 text-blue-600 flex-shrink-0" />
                    <h3 className="text-[9px] md:text-sm font-semibold text-blue-700">Admin / Operativo</h3>
                  </div>
                  <div className="space-y-px md:space-y-2">
                    {adminOperativoStats.slice(0, 5).map((user, index) => (
                      <div
                        key={user.userId}
                        className="flex items-center justify-between p-1 md:p-3 border rounded gap-0.5 md:gap-2 bg-blue-50/50 border-blue-100"
                      >
                        <div className="flex items-center gap-1 md:gap-3 flex-1 min-w-0">
                          <div className="flex items-center justify-center w-3.5 h-3.5 md:w-8 md:h-8 rounded-full text-[7px] md:text-sm flex-shrink-0 bg-blue-100 text-blue-700">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-[9px] sm:text-xs md:text-base truncate leading-tight">{user.userName}</p>
                            <p className="hidden md:block text-[8px] sm:text-[10px] md:text-sm text-muted-foreground truncate">
                              Rol: <span className="capitalize">{user.userRole}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 md:gap-4 flex-shrink-0">
                          <div className="text-center px-0.5">
                            <p className="font-bold text-[12px] sm:text-xs md:text-sm text-uparsistem-600 leading-tight">
                              {user.accedidos}
                            </p>
                            <p className="text-[6px] sm:text-[9px] md:text-xs text-muted-foreground whitespace-nowrap leading-tight">
                              Acc
                            </p>
                          </div>
                          <div className="text-center px-0.5">
                            <p className="font-bold text-[12px] sm:text-xs md:text-sm text-red-600 leading-tight">{user.denegados}</p>
                            <p className="text-[6px] sm:text-[9px] md:text-xs text-muted-foreground whitespace-nowrap leading-tight">
                              Den
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {bufeteStats.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 mb-1 md:mb-3">
                    <ChefHat className="w-2.5 h-2.5 md:w-4 md:h-4 text-violet-600 flex-shrink-0" />
                    <h3 className="text-[9px] md:text-sm font-semibold text-violet-600">Bufete</h3>
                  </div>
                  <div className="space-y-px md:space-y-2">
                    {bufeteStats.slice(0, 5).map((user, index) => (
                      <div
                        key={user.userId}
                        className="flex items-center justify-between p-1 md:p-3 border rounded gap-0.5 md:gap-2 bg-violet-50/50 border-violet-100"
                      >
                        <div className="flex items-center gap-1 md:gap-3 flex-1 min-w-0">
                          <div className="flex items-center justify-center w-3.5 h-3.5 md:w-8 md:h-8 rounded-full text-[7px] md:text-sm flex-shrink-0 bg-violet-100 text-violet-700">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-[9px] sm:text-xs md:text-base truncate leading-tight">{user.userName}</p>
                            <p className="hidden md:block text-[8px] sm:text-[10px] md:text-sm text-muted-foreground truncate">
                              Rol: <span className="capitalize">{user.userRole}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 md:gap-4 flex-shrink-0">
                          <div className="text-center px-0.5">
                            <p className="font-bold text-[12px] sm:text-xs md:text-sm text-uparsistem-600 leading-tight">
                              {user.accedidos}
                            </p>
                            <p className="text-[6px] sm:text-[9px] md:text-xs text-muted-foreground whitespace-nowrap leading-tight">
                              Acc
                            </p>
                          </div>
                          <div className="text-center px-0.5">
                            <p className="font-bold text-[12px] sm:text-xs md:text-sm text-red-600 leading-tight">{user.denegados}</p>
                            <p className="text-[6px] sm:text-[9px] md:text-xs text-muted-foreground whitespace-nowrap leading-tight">
                              Den
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {adminOperativoStats.length === 0 && bufeteStats.length === 0 && (
                <p className="text-muted-foreground text-xs md:text-sm text-center py-4">
                  No hay datos de usuarios disponibles
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
