"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { collection, query, where, getDocs, doc, updateDoc, addDoc, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/components/auth-provider"
import { Utensils, Users, TrendingUp, Activity } from "lucide-react"

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

export function MesaControlAdmin() {
  const { user } = useAuth()
  const [mesas, setMesas] = useState<MesaStats[]>([])
  const [mesasConfig, setMesasConfig] = useState<MesaConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<number | null>(null)

  const [totalComidasPorEntregar, setTotalComidasPorEntregar] = useState(0)

  // Inicializar configuración de mesas
  useEffect(() => {
    const initializeMesas = async () => {
      try {
        // Verificar si ya existe configuración de mesas
        const mesasQuery = query(collection(db, "mesas_config"))
        const mesasSnapshot = await getDocs(mesasQuery)

        if (mesasSnapshot.empty) {
          // Crear configuración inicial para 10 mesas
          const mesasIniciales: Omit<MesaConfig, "id">[] = []
          for (let i = 1; i <= 10; i++) {
            mesasIniciales.push({
              numero: i,
              activa: true,
              nombre: `Bufete ${i}`,
            })
          }

          // Guardar en Firestore
          for (const mesa of mesasIniciales) {
            await addDoc(collection(db, "mesas_config"), mesa)
          }
        }

        // Cargar configuración actual
        loadMesasConfig()
      } catch (error) {
        console.error("Error al inicializar mesas:", error)
      }
    }

    initializeMesas()
  }, [])

  // Cargar configuración de mesas
  const loadMesasConfig = async () => {
    try {
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
    } catch (error) {
      console.error("Error al cargar configuración de mesas:", error)
    }
  }

  useEffect(() => {
    if (mesasConfig.length === 0) return

    const loadMesasStats = () => {
      try {
        setLoading(true)

        const accessLogsQuery = query(collection(db, "access_logs"), where("status", "==", "granted"))

        const unsubscribe = onSnapshot(accessLogsQuery, async (snapshot) => {
          const mesasStats: MesaStats[] = []

          for (let i = 1; i <= 10; i++) {
            const mesaLogs = snapshot.docs.filter((doc) => {
              const data = doc.data()
              return data.mesaUsada === i
            })

            const estudiantesAtendidos = mesaLogs.length

            // Get last access
            const ultimoAcceso = mesaLogs.length > 0 ? mesaLogs[mesaLogs.length - 1].data().timestamp : undefined

            // Find mesa configuration
            const mesaConfig = mesasConfig.find((m) => m.numero === i)

            mesasStats.push({
              numero: i,
              activa: mesaConfig?.activa ?? true,
              estudiantesAtendidos, // Now counts total scans/meals
              ultimoAcceso,
            })
          }

          setMesas(mesasStats)
          setLoading(false)
        })

        return unsubscribe
      } catch (error) {
        console.error("Error al cargar estadísticas de mesas:", error)
        setLoading(false)
      }
    }

    const unsubscribe = loadMesasStats()
    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [mesasConfig])

  useEffect(() => {
    const fetchBufeteCount = () => {
      try {
        // Listen to personas collection in real-time to get total available bufetes
        const estudiantesQuery = query(collection(db, "personas"))
        const unsubscribe = onSnapshot(estudiantesQuery, (snapshot) => {
          // Total bufetes available is simply the count of all personas
          // Each person gets 2 base cupos + cuposExtras
          let totalBufetes = 0

          snapshot.forEach((doc) => {
            const data = doc.data()
            const cuposTotales = 2 + (data.cuposExtras || 0)
            const cuposConsumidos = data.cuposConsumidos || 0
            const cuposDisponibles = Math.max(0, cuposTotales - cuposConsumidos)
            totalBufetes += cuposDisponibles
          })

          console.log("[v0] Total bufetes disponibles:", totalBufetes)
          setTotalComidasPorEntregar(totalBufetes)
        })

        return unsubscribe
      } catch (error) {
        console.error("Error al obtener conteo de bufetes:", error)
      }
    }

    const unsubscribe = fetchBufeteCount()
    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [mesasConfig])

  // Actualizar estado de mesa
  const toggleMesaStatus = async (numeroMesa: number) => {
    try {
      setUpdating(numeroMesa)

      const mesaConfig = mesasConfig.find((m) => m.numero === numeroMesa)
      if (mesaConfig && mesaConfig.id) {
        await updateDoc(doc(db, "mesas_config", mesaConfig.id), {
          activa: !mesaConfig.activa,
        })
      }

      setUpdating(null)
    } catch (error) {
      console.error("Error al actualizar mesa:", error)
      setUpdating(null)
    }
  }

  // Calcular estadísticas generales
  const totalEstudiantes = mesas.reduce((sum, mesa) => sum + mesa.estudiantesAtendidos, 0)
  const mesasActivas = mesas.filter((mesa) => mesa.activa).length
  const promedioEstudiantes = mesas.length > 0 ? Math.round(totalEstudiantes / mesas.length) : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6 sm:p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground">Cargando estadísticas de mesas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-0">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Control de Bufetes</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Administra el estado de los 10 bufetes y monitorea las estadísticas
          </p>
        </div>
        <Badge variant="outline" className="text-xs sm:text-sm w-fit">
          Solo Administradores
        </Badge>
      </header>

      <section className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Estudiantes</CardTitle>
            <Users className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{totalEstudiantes}</div>
            <p className="text-xs text-muted-foreground">Comidas entregadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Bufetes Activos</CardTitle>
            <Activity className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{mesasActivas}/10</div>
            <p className="text-xs text-muted-foreground">Bufetes habilitados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Promedio por Bufete</CardTitle>
            <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{promedioEstudiantes}</div>
            <p className="text-xs text-muted-foreground">Estudiantes por bufete</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 p-3">
            <CardTitle className="text-sm sm:text-base">Comidas por Entregar</CardTitle>
            <Utensils className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-orange-600">{totalComidasPorEntregar}</div>
            <p className="text-xs text-muted-foreground">Cupos disponibles totales</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="text-lg sm:text-xl">Estado de los Bufetes</CardTitle>
          <CardDescription className="text-sm">
            Habilita o deshabilita bufetes individualmente. Solo los bufetes activos pueden atender estudiantes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {mesas.map((mesa) => (
              <Card
                key={mesa.numero}
                className={`transition-all ${mesa.activa ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}
              >
                <CardHeader className="pb-2 p-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm sm:text-base">Bufete {mesa.numero}</CardTitle>
                    <Switch
                      checked={mesa.activa}
                      onCheckedChange={() => toggleMesaStatus(mesa.numero)}
                      disabled={updating === mesa.numero}
                      className="scale-75 sm:scale-90"
                      aria-label={`${mesa.activa ? "Desactivar" : "Activar"} Bufete ${mesa.numero}`}
                    />
                  </div>
                </CardHeader>
                <CardContent className="pt-0 p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Estado:</span>
                    <Badge variant={mesa.activa ? "default" : "secondary"} className="text-xs px-1.5 py-0.5">
                      {mesa.activa ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Atendidos:</span>
                    <span className="text-sm font-semibold">{mesa.estudiantesAtendidos}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="text-lg sm:text-xl">Acciones Rápidas</CardTitle>
          <CardDescription className="text-sm">Controla todos los bufetes de una vez</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Button
              onClick={() => {
                mesasConfig.forEach((mesa) => {
                  if (mesa.id && !mesa.activa) {
                    updateDoc(doc(db, "mesas_config", mesa.id), { activa: true })
                  }
                })
              }}
              variant="default"
              size="sm"
              className="w-full sm:w-auto h-9 text-sm font-medium"
              aria-label="Activar todos los bufetes"
            >
              Activar Todos los Bufetes
            </Button>
            <Button
              onClick={() => {
                mesasConfig.forEach((mesa) => {
                  if (mesa.id && mesa.activa) {
                    updateDoc(doc(db, "mesas_config", mesa.id), { activa: false })
                  }
                })
              }}
              variant="destructive"
              size="sm"
              className="w-full sm:w-auto h-9 text-sm font-medium text-white"
              aria-label="Desactivar todos los bufetes"
            >
              Desactivar Todos los Bufetes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
