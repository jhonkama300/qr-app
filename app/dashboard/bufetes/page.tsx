"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { collection, query, where, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/components/auth-provider"
import { Utensils, Users, TrendingUp, Activity, Scale } from "lucide-react"

interface MesaStats {
  numero: number
  activa: boolean
  estudiantesAtendidos: number
  ultimoAcceso?: string
}

interface MesaConfig {
  id?: string
  numero: number
  activa: boolean
  nombre: string
}

export default function BufetesPage() {
  const { user, activeRole } = useAuth()
  const [mesas, setMesas] = useState<MesaStats[]>([])
  const [mesasConfig, setMesasConfig] = useState<MesaConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [totalComidasPorEntregar, setTotalComidasPorEntregar] = useState(0)

  useEffect(() => {
    const mesasQuery = query(collection(db, "mesas_config"))
    const unsubscribe = onSnapshot(mesasQuery, (snapshot) => {
      const mesasData: MesaConfig[] = []
      snapshot.forEach((doc) => {
        mesasData.push({ id: doc.id, ...doc.data() } as MesaConfig)
      })
      mesasData.sort((a, b) => a.numero - b.numero)
      setMesasConfig(mesasData)
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    if (mesasConfig.length === 0) return

    const accessLogsQuery = query(collection(db, "access_logs"), where("status", "==", "granted"))

    const unsubscribe = onSnapshot(accessLogsQuery, (snapshot) => {
      const mesasStats: MesaStats[] = []

      for (let i = 1; i <= 10; i++) {
        const mesaLogs = snapshot.docs.filter((doc) => {
          const data = doc.data()
          return data.mesaUsada === i
        })

        const estudiantesAtendidos = mesaLogs.length
        const ultimoAcceso = mesaLogs.length > 0 ? mesaLogs[mesaLogs.length - 1].data().timestamp : undefined
        const mesaConfig = mesasConfig.find((m) => m.numero === i)

        mesasStats.push({
          numero: i,
          activa: mesaConfig?.activa ?? true,
          estudiantesAtendidos,
          ultimoAcceso,
        })
      }

      setMesas(mesasStats)
      setLoading(false)
    })

    return unsubscribe
  }, [mesasConfig])

  useEffect(() => {
    const estudiantesQuery = query(collection(db, "personas"))
    const unsubscribe = onSnapshot(estudiantesQuery, (snapshot) => {
      let totalBufetes = 0

      snapshot.forEach((doc) => {
        const data = doc.data()
        const cuposTotales = 2 + (data.cuposExtras || 0)
        const cuposConsumidos = data.cuposConsumidos || 0
        const cuposDisponibles = Math.max(0, cuposTotales - cuposConsumidos)
        totalBufetes += cuposDisponibles
      })

      setTotalComidasPorEntregar(totalBufetes)
    })

    return unsubscribe
  }, [])

  const totalEstudiantes = mesas.reduce((sum, mesa) => sum + mesa.estudiantesAtendidos, 0)
  const mesasActivas = mesas.filter((mesa) => mesa.activa).length
  const promedioEstudiantes = mesas.length > 0 ? Math.round(totalEstudiantes / mesas.length) : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6 sm:p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground">Cargando estadísticas de bufetes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Bufetes</h1>
          <p className="text-muted-foreground">Monitorea el estado y estadísticas de los bufetes en tiempo real</p>
        </div>
        <Badge variant="outline" className="text-sm">
          Rol: {activeRole}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Comidas Entregadas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEstudiantes}</div>
            <p className="text-xs text-muted-foreground">Estudiantes atendidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bufetes Activos</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mesasActivas}/10</div>
            <p className="text-xs text-muted-foreground">Bufetes habilitados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promedio por Bufete</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{promedioEstudiantes}</div>
            <p className="text-xs text-muted-foreground">Estudiantes por bufete</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comidas por Entregar</CardTitle>
            <Utensils className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{totalComidasPorEntregar}</div>
            <p className="text-xs text-muted-foreground">Cupos disponibles totales</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estado de los Bufetes en Tiempo Real</CardTitle>
          <CardDescription>
            Visualiza el estado actual de cada bufete y cuántos estudiantes han sido atendidos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {mesas.map((mesa) => (
              <Card
                key={mesa.numero}
                className={`transition-all ${mesa.activa ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}
              >
                <CardHeader className="pb-2 p-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Bufete {mesa.numero}</CardTitle>
                    <Badge variant={mesa.activa ? "default" : "secondary"} className="text-xs">
                      {mesa.activa ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Comidas:</span>
                    <span className="text-lg font-bold text-primary">{mesa.estudiantesAtendidos}</span>
                  </div>
                  {mesa.activa && (
                    <div className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-xs text-green-700">En servicio</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Información del Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Bufetes Operativos</h3>
              <p className="text-sm text-muted-foreground">
                Actualmente hay <span className="font-bold text-primary">{mesasActivas}</span> bufetes activos de un
                total de 10 disponibles.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Actualización en Tiempo Real</h3>
              <p className="text-sm text-muted-foreground">
                Los contadores se actualizan automáticamente cuando se registra un nuevo acceso en cualquier bufete.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
