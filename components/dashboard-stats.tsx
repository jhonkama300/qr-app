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
    })

    const inventoryRef = doc(db, "config", "meal_inventory")
    const unsubscribeInventory = onSnapshot(inventoryRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        setMealInventory(docSnapshot.data() as MealInventory)
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
        return userData
      }
      return null
    } catch (error) {
      console.error("Error al cargar usuario:", error)
      return null
    }
  }

  const getFilteredLogs = () => {
    return accessLogs
  }

  const getUserStats = async (): Promise<{ adminOperativo: UserStats[]; bufete: UserStats[] }> => {
    const adminOperativoMap = new Map<string, UserStats>()
    const bufeteMap = new Map<string, UserStats>()

    const filteredLogs = getFilteredLogs()

    for (const log of filteredLogs) {
      if (log.grantedByUserId) {
        let userName = log.grantedByUserName || "Usuario desconocido"
        let userRole = log.grantedByUserRole || "Usuario"

        if (!log.grantedByUserName || !log.grantedByUserRole) {
          const userData = await fetchUserData(log.grantedByUserId)
          if (userData) {
            userName = userData.fullName || userName
            userRole = userData.role || userRole
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
            <div className="relative mx-auto w-10 h-10">
              <div className="absolute inset-0 rounded-full border-2 border-gray-200" />
              <div className="absolute inset-0 rounded-full border-2 border-t-uparsistem-500 animate-spin" />
            </div>
            <p className="mt-3 text-sm text-gray-400 font-medium">Cargando estadísticas...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-6 p-3 md:p-6 bg-gradient-to-br from-gray-50/80 via-white to-emerald-50/20 min-h-screen">
      {/* Greeting header */}
      <div className="relative overflow-hidden rounded-2xl border border-uparsistem-200/60 bg-gradient-to-br from-uparsistem-50/80 via-white to-uparsistem-50/40 p-4 md:p-6 shadow-sm">
        <div className="absolute top-0 right-0 w-40 h-40 bg-uparsistem-200/15 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-200/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-xl" />
        <div className="relative flex items-center gap-3 md:gap-4">
          <div className="flex size-10 md:size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-uparsistem-500 to-uparsistem-600 shadow-md shadow-uparsistem-500/20">
            <span className="text-base md:text-lg font-bold text-white">
              {(userName || "D")[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            {userName ? (
              <>
                <h1 className="text-sm md:text-xl font-bold text-gray-900 leading-tight">
                  Hola, <span className="bg-gradient-to-r from-uparsistem-600 to-uparsistem-700 bg-clip-text text-transparent">{userName}</span>
                </h1>
                <p className="text-[10px] md:text-sm text-gray-400 leading-tight mt-0.5">
                  Este es el resumen general del sistema
                </p>
              </>
            ) : (
              <>
                <h1 className="text-sm md:text-xl font-bold text-gray-900">Dashboard Principal</h1>
                <p className="text-[10px] md:text-sm text-gray-400">Resumen general del sistema de control de acceso</p>
              </>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-uparsistem-50 ring-1 ring-uparsistem-200/60">
            <span className="flex size-2 rounded-full bg-uparsistem-500 animate-pulse" />
            <span className="text-[10px] md:text-xs text-uparsistem-700 font-semibold">Tiempo real</span>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="rounded-xl">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLowInventory && mealInventory && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200/60 rounded-xl py-3 px-4">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-800">Inventario bajo</p>
            <p className="text-xs text-red-600/80">
              Solo quedan {mealInventory.comidasDisponibles} de {mealInventory.totalComidas} comidas ({inventoryPercentage.toFixed(1)}% disponible)
            </p>
          </div>
        </div>
      )}

      {/* Meal inventory card */}
      {mealInventory && (
        <Card className="bg-gradient-to-br from-orange-50/80 to-amber-50/50 border-orange-200/50 rounded-2xl shadow-sm overflow-hidden">
          <CardHeader className="pb-2 p-4 md:p-6">
            <CardTitle className="text-sm md:text-base flex items-center gap-2 text-gray-800">
              <div className="flex items-center justify-center size-8 rounded-lg bg-orange-100">
                <Package className="h-4 w-4 text-orange-600" />
              </div>
              Inventario Global de Comidas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4 md:p-6 pt-0">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center bg-white/60 rounded-xl py-3 px-2">
                <div className="text-base md:text-2xl font-bold text-gray-900">{mealInventory.totalComidas}</div>
                <p className="text-[10px] md:text-xs text-gray-500 font-medium">Total</p>
              </div>
              <div className="text-center bg-white/60 rounded-xl py-3 px-2">
                <div className="text-base md:text-2xl font-bold text-red-600">{mealInventory.comidasConsumidas}</div>
                <p className="text-[10px] md:text-xs text-gray-500 font-medium">Entregadas</p>
              </div>
              <div className="text-center bg-white/60 rounded-xl py-3 px-2">
                <div className={`text-base md:text-2xl font-bold ${isLowInventory ? "text-red-600" : "text-uparsistem-600"}`}>
                  {mealInventory.comidasDisponibles}
                </div>
                <p className={`text-[10px] md:text-xs font-medium ${isLowInventory ? "text-red-500" : "text-gray-500"}`}>
                  Disponibles
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 font-medium">Progreso</span>
                <span className="font-semibold text-orange-700">
                  {((mealInventory.comidasConsumidas / mealInventory.totalComidas) * 100).toFixed(1)}%
                </span>
              </div>
              <Progress value={(mealInventory.comidasConsumidas / mealInventory.totalComidas) * 100} className="h-2 rounded-full [&>div]:bg-gradient-to-r [&>div]:from-orange-400 [&>div]:to-amber-500" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats grid */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100/80 border border-blue-200/50 p-3 md:p-4 shadow-sm">
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-200/20 rounded-full -translate-y-1/3 translate-x-1/3 blur-lg" />
          <div className="relative flex items-center justify-between mb-2">
            <span className="text-[10px] md:text-xs font-semibold text-blue-700 uppercase tracking-wider">Graduandos</span>
            <div className="flex items-center justify-center size-7 md:size-8 rounded-lg bg-blue-100/80">
              <GraduationCap className="size-3.5 md:size-4 text-blue-600" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-bold text-blue-900">{graduandosRegistrados}</div>
          <p className="text-[9px] md:text-[10px] text-blue-600/60 font-medium mt-0.5">Registrados</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-uparsistem-50 to-uparsistem-100/80 border border-uparsistem-200/50 p-3 md:p-4 shadow-sm">
          <div className="absolute top-0 right-0 w-16 h-16 bg-uparsistem-200/20 rounded-full -translate-y-1/3 translate-x-1/3 blur-lg" />
          <div className="relative flex items-center justify-between mb-2">
            <span className="text-[10px] md:text-xs font-semibold text-uparsistem-700 uppercase tracking-wider">Accesos</span>
            <div className="flex items-center justify-center size-7 md:size-8 rounded-lg bg-uparsistem-100/80">
              <CheckCircle className="size-3.5 md:size-4 text-uparsistem-600" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-bold text-uparsistem-800">{grantedAccessCount}</div>
          <p className="text-[9px] md:text-[10px] text-uparsistem-600/60 font-medium mt-0.5">Permitidos</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-50 to-red-100/80 border border-red-200/50 p-3 md:p-4 shadow-sm">
          <div className="absolute top-0 right-0 w-16 h-16 bg-red-200/20 rounded-full -translate-y-1/3 translate-x-1/3 blur-lg" />
          <div className="relative flex items-center justify-between mb-2">
            <span className="text-[10px] md:text-xs font-semibold text-red-700 uppercase tracking-wider">Denegados</span>
            <div className="flex items-center justify-center size-7 md:size-8 rounded-lg bg-red-100/80">
              <XCircle className="size-3.5 md:size-4 text-red-600" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-bold text-red-900">{deniedAccessCount}</div>
          <p className="text-[9px] md:text-[10px] text-red-600/60 font-medium mt-0.5">Rechazados</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100/80 border border-amber-200/50 p-3 md:p-4 shadow-sm">
          <div className="absolute top-0 right-0 w-16 h-16 bg-amber-200/20 rounded-full -translate-y-1/3 translate-x-1/3 blur-lg" />
          <div className="relative flex items-center justify-between mb-2">
            <span className="text-[10px] md:text-xs font-semibold text-amber-700 uppercase tracking-wider">Espera</span>
            <div className="flex items-center justify-center size-7 md:size-8 rounded-lg bg-amber-100/80">
              <Clock className="size-3.5 md:size-4 text-amber-600" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-bold text-amber-900">{waitingPersonsCount}</div>
          <p className="text-[9px] md:text-[10px] text-amber-600/60 font-medium mt-0.5">Sin procesar</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-50 to-cyan-100/80 border border-cyan-200/50 p-3 md:p-4 shadow-sm">
          <div className="absolute top-0 right-0 w-16 h-16 bg-cyan-200/20 rounded-full -translate-y-1/3 translate-x-1/3 blur-lg" />
          <div className="relative flex items-center justify-between mb-2">
            <span className="text-[10px] md:text-xs font-semibold text-cyan-700 uppercase tracking-wider">Mesas</span>
            <div className="flex items-center justify-center size-7 md:size-8 rounded-lg bg-cyan-100/80">
              <Utensils className="size-3.5 md:size-4 text-cyan-600" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-bold text-cyan-900">
            {buffetStats.mesasActivas}/{buffetStats.totalMesas}
          </div>
          <p className="text-[9px] md:text-[10px] text-cyan-600/60 font-medium mt-0.5">Operativas</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-50 to-violet-100/80 border border-violet-200/50 p-3 md:p-4 shadow-sm">
          <div className="absolute top-0 right-0 w-16 h-16 bg-violet-200/20 rounded-full -translate-y-1/3 translate-x-1/3 blur-lg" />
          <div className="relative flex items-center justify-between mb-2">
            <span className="text-[10px] md:text-xs font-semibold text-violet-700 uppercase tracking-wider">Comidas</span>
            <div className="flex items-center justify-center size-7 md:size-8 rounded-lg bg-violet-100/80">
              <ChefHat className="size-3.5 md:size-4 text-violet-600" />
            </div>
          </div>
          <div className="text-xl md:text-2xl font-bold text-violet-900">
            {buffetStats.comidasEntregadas}
          </div>
          <p className="text-[9px] md:text-[10px] text-violet-600/60 font-medium mt-0.5">Entregadas</p>
        </div>
      </div>

      {/* Two-column: Top User + User History */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
        <Card className="shadow-sm border-gray-200/60 rounded-2xl overflow-hidden">
          <CardHeader className="p-4 md:p-6 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm md:text-lg font-bold text-gray-900">
              <div className="flex items-center justify-center size-8 rounded-lg bg-uparsistem-100">
                <TrendingUp className="w-4 h-4 text-uparsistem-600" />
              </div>
              Usuario Más Activo
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            {topUser ? (
              <div className="flex items-center gap-3 p-3 md:p-4 rounded-xl bg-gradient-to-br from-uparsistem-50/80 to-white border border-uparsistem-200/50">
                <div className="flex size-10 md:size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-uparsistem-500 to-uparsistem-600 text-white text-sm md:text-base font-bold shadow-sm shadow-uparsistem-500/20">
                  1
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm md:text-base font-semibold text-gray-900 truncate">{topUser.userName}</p>
                  <p className="text-xs text-gray-400 truncate capitalize">
                    {topUser.userRole} · {topUser.total} registros
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-center px-2">
                    <p className="text-sm md:text-base font-bold text-uparsistem-600 tabular-nums">{topUser.accedidos}</p>
                    <p className="text-[9px] md:text-[10px] text-gray-400 font-medium">Accesos</p>
                  </div>
                  <div className="w-px h-8 bg-gray-200" />
                  <div className="text-center px-2">
                    <p className="text-sm md:text-base font-bold text-red-500 tabular-nums">{topUser.denegados}</p>
                    <p className="text-[9px] md:text-[10px] text-gray-400 font-medium">Denegados</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-400 text-sm text-center py-6">No hay datos de usuarios disponibles</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-gray-200/60 rounded-2xl overflow-hidden">
          <CardHeader className="p-4 md:p-6 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm md:text-lg font-bold text-gray-900">
              <div className="flex items-center justify-center size-8 rounded-lg bg-blue-100">
                <Activity className="w-4 h-4 text-blue-600" />
              </div>
              Historial por Usuario
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <div className="space-y-3 md:space-y-4">
              {adminOperativoStats.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2 md:mb-3">
                    <div className="flex items-center justify-center size-6 rounded-md bg-blue-100">
                      <UserCheck className="w-3 h-3 md:w-4 md:h-4 text-blue-600" />
                    </div>
                    <h3 className="text-xs md:text-sm font-semibold text-blue-700">Admin / Operativo</h3>
                  </div>
                  <div className="space-y-2">
                    {adminOperativoStats.slice(0, 5).map((user, index) => (
                      <div key={user.userId} className="flex items-center justify-between p-2.5 md:p-3 border rounded-xl bg-blue-50/50 border-blue-100/80 gap-2">
                        <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                          <div className="flex items-center justify-center size-7 md:size-8 rounded-lg text-[10px] md:text-sm font-bold shrink-0 bg-blue-100 text-blue-700">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-xs md:text-sm text-gray-900 truncate">{user.userName}</p>
                            <p className="text-[10px] md:text-xs text-gray-400 truncate capitalize">{user.userRole}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                          <div className="text-center px-1.5">
                            <p className="font-bold text-xs md:text-sm text-uparsistem-600 tabular-nums">{user.accedidos}</p>
                            <p className="text-[8px] md:text-[10px] text-gray-400">Acc</p>
                          </div>
                          <div className="text-center px-1.5">
                            <p className="font-bold text-xs md:text-sm text-red-500 tabular-nums">{user.denegados}</p>
                            <p className="text-[8px] md:text-[10px] text-gray-400">Den</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {bufeteStats.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2 md:mb-3">
                    <div className="flex items-center justify-center size-6 rounded-md bg-violet-100">
                      <ChefHat className="w-3 h-3 md:w-4 md:h-4 text-violet-600" />
                    </div>
                    <h3 className="text-xs md:text-sm font-semibold text-violet-600">Bufete</h3>
                  </div>
                  <div className="space-y-2">
                    {bufeteStats.slice(0, 5).map((user, index) => (
                      <div key={user.userId} className="flex items-center justify-between p-2.5 md:p-3 border rounded-xl bg-violet-50/50 border-violet-100/80 gap-2">
                        <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                          <div className="flex items-center justify-center size-7 md:size-8 rounded-lg text-[10px] md:text-sm font-bold shrink-0 bg-violet-100 text-violet-700">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-xs md:text-sm text-gray-900 truncate">{user.userName}</p>
                            <p className="text-[10px] md:text-xs text-gray-400 truncate capitalize">{user.userRole}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                          <div className="text-center px-1.5">
                            <p className="font-bold text-xs md:text-sm text-uparsistem-600 tabular-nums">{user.accedidos}</p>
                            <p className="text-[8px] md:text-[10px] text-gray-400">Acc</p>
                          </div>
                          <div className="text-center px-1.5">
                            <p className="font-bold text-xs md:text-sm text-red-500 tabular-nums">{user.denegados}</p>
                            <p className="text-[8px] md:text-[10px] text-gray-400">Den</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {adminOperativoStats.length === 0 && bufeteStats.length === 0 && (
                <p className="text-gray-400 text-sm text-center py-6">
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