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
              nombre: `Mesa ${i}`,
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

        // Escuchar cambios en access_logs en tiempo real
        const accessLogsQuery = query(collection(db, "access_logs"), where("status", "==", "granted"))

        const unsubscribe = onSnapshot(accessLogsQuery, async (snapshot) => {
          const mesasStats: MesaStats[] = []

          for (let i = 1; i <= 10; i++) {
            // Contar estudiantes atendidos por mesa desde el snapshot
            const mesaLogs = snapshot.docs.filter((doc) => {
              const data = doc.data()
              return data.mesaUsada === i
            })

            // Obtener último acceso
            const ultimoAcceso = mesaLogs.length > 0 ? mesaLogs[mesaLogs.length - 1].data().timestamp : undefined

            // Buscar configuración de la mesa
            const mesaConfig = mesasConfig.find((m) => m.numero === i)

            mesasStats.push({
              numero: i,
              activa: mesaConfig?.activa ?? true,
              estudiantesAtendidos: mesaLogs.length,
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
    const calcularComidasTotales = () => {
      try {
        // Escuchar cambios en la colección personas en tiempo real
        const estudiantesQuery = query(collection(db, "personas"))
        const unsubscribe = onSnapshot(estudiantesQuery, (snapshot) => {
          let totalComidas = 0
          snapshot.forEach((doc) => {
            const data = doc.data()
            const cuposTotales = 2 + (data.cuposExtras || 0) // 2 predeterminados + extras
            const cuposConsumidos = data.cuposConsumidos || 0
            const cuposDisponibles = Math.max(0, cuposTotales - cuposConsumidos)
            totalComidas += cuposDisponibles
          })

          console.log("[v0] Total comidas por entregar calculado:", totalComidas)
          setTotalComidasPorEntregar(totalComidas)
        })

        return unsubscribe
      } catch (error) {
        console.error("Error al calcular comidas totales:", error)
      }
    }

    const unsubscribe = calcularComidasTotales()
    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [])

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
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Cargando estadísticas de mesas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Control de Mesas</h1>
          <p className="text-muted-foreground">
            Administra el estado de las 10 mesas del bufete y monitorea las estadísticas
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          Solo Administradores
        </Badge>
      </div>

      {/* Estadísticas Generales */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Estudiantes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEstudiantes}</div>
            <p className="text-xs text-muted-foreground">Atendidos en total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mesas Activas</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mesasActivas}/10</div>
            <p className="text-xs text-muted-foreground">Mesas habilitadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promedio por Mesa</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{promedioEstudiantes}</div>
            <p className="text-xs text-muted-foreground">Estudiantes por mesa</p>
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

      {/* Control de Mesas */}
      <Card>
        <CardHeader>
          <CardTitle>Estado de las Mesas</CardTitle>
          <CardDescription>
            Habilita o deshabilita mesas individualmente. Solo las mesas activas pueden atender estudiantes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {mesas.map((mesa) => (
              <Card
                key={mesa.numero}
                className={`transition-all ${mesa.activa ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Mesa {mesa.numero}</CardTitle>
                    <Switch
                      checked={mesa.activa}
                      onCheckedChange={() => toggleMesaStatus(mesa.numero)}
                      disabled={updating === mesa.numero}
                    />
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Estado:</span>
                      <Badge variant={mesa.activa ? "default" : "secondary"}>
                        {mesa.activa ? "Activa" : "Inactiva"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Atendidos:</span>
                      <span className="font-semibold">{mesa.estudiantesAtendidos}</span>
                    </div>
                    {mesa.ultimoAcceso && (
                      <div className="text-xs text-muted-foreground">
                        Último: {new Date(mesa.ultimoAcceso).toLocaleString()}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Acciones Rápidas */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
          <CardDescription>Controla todas las mesas de una vez</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              onClick={() => {
                mesasConfig.forEach((mesa) => {
                  if (mesa.id && !mesa.activa) {
                    updateDoc(doc(db, "mesas_config", mesa.id), { activa: true })
                  }
                })
              }}
              variant="default"
            >
              Activar Todas las Mesas
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
            >
              Desactivar Todas las Mesas
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
