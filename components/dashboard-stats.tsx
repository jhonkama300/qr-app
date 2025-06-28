"use client"

import { AlertDescription } from "@/components/ui/alert"

import { Alert } from "@/components/ui/alert"

import { useState, useEffect } from "react"
import { collection, getDocs, query, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, XCircle, Clock, Users, Loader2 } from "lucide-react"

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
}

export function DashboardStats() {
  const [allPersons, setAllPersons] = useState<PersonData[]>([])
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
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

      const logsQuery = query(collection(db, "access_logs"), orderBy("timestamp", "desc"))
      const logsSnapshot = await getDocs(logsQuery)
      const logsData: AccessLog[] = []
      logsSnapshot.forEach((doc) => {
        logsData.push({
          id: doc.id,
          ...doc.data(),
        } as AccessLog)
      })
      setAccessLogs(logsData)
    } catch (err) {
      console.error("Error al cargar datos:", err)
      setError("Error al cargar los datos de las estadísticas.")
    } finally {
      setLoading(false)
    }
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

  const grantedAccessCount = uniqueAccessLogs.filter(
    (log) => log.status === "granted" || log.status === "q10_success",
  ).length
  const deniedAccessCount = uniqueAccessLogs.filter(
    (log) => log.status === "denied" || log.status === "q10_failed",
  ).length
  const scannedIdentifications = new Set(uniqueAccessLogs.map((log) => log.identificacion))
  const waitingPersonsCount = allPersons.filter((person) => !scannedIdentifications.has(person.identificacion)).length
  const totalPersonsCount = allPersons.length

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Cargando estadísticas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Personas</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalPersonsCount}</div>
          <p className="text-xs text-muted-foreground">Registros en la base de datos</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-green-600">Acceso Concedido</CardTitle>
          <CheckCircle className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-800">{grantedAccessCount}</div>
          <p className="text-xs text-muted-foreground">Personas con acceso permitido</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-red-600">Acceso Denegado</CardTitle>
          <XCircle className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-800">{deniedAccessCount}</div>
          <p className="text-xs text-muted-foreground">Personas con acceso denegado</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-blue-600">En Espera</CardTitle>
          <Clock className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-800">{waitingPersonsCount}</div>
          <p className="text-xs text-muted-foreground">Personas sin escanear</p>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="col-span-full">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
