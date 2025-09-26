"use client"

import { useState, useEffect } from "react"
import { collection, getDocs, query, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  CheckCircle,
  XCircle,
  Users,
  Search,
  RefreshCw,
  User,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  UserCheck,
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
}

export function AccessControl() {
  const [allPersons, setAllPersons] = useState<PersonData[]>([])
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Estados de búsqueda y paginación
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState<"granted" | "denied" | "waiting">("granted")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
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

      // Cargar logs de acceso ordenados por timestamp descendente
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
      setError("Error al cargar los datos del sistema.")
    } finally {
      setLoading(false)
    }
  }

  // Filtrar logs únicos por identificación (solo el más reciente de cada persona)
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

  // Obtener personas con acceso concedido
  const grantedAccess = uniqueAccessLogs
    .filter((log) => log.status === "granted" || log.status === "q10_success")
    .map((log) => {
      const person = allPersons.find((p) => p.identificacion === log.identificacion)
      return { ...log, person }
    })

  // Obtener personas con acceso denegado
  const deniedAccess = uniqueAccessLogs
    .filter((log) => log.status === "denied" || log.status === "q10_failed")
    .map((log) => {
      const person = allPersons.find((p) => p.identificacion === log.identificacion)
      return { ...log, person }
    })

  // Obtener personas en espera (que no han sido escaneadas)
  const scannedIdentifications = new Set(uniqueAccessLogs.map((log) => log.identificacion))
  const waitingPersons = allPersons.filter((person) => !scannedIdentifications.has(person.identificacion))

  // Función para obtener los datos filtrados según la pestaña activa
  const getFilteredData = () => {
    let data: any[] = []

    switch (activeTab) {
      case "granted":
        data = grantedAccess
        break
      case "denied":
        data = deniedAccess
        break
      case "waiting":
        data = waitingPersons
        break
    }

    // Aplicar filtro de búsqueda
    if (searchTerm.trim() !== "") {
      data = data.filter((item) => {
        const person = item.person || item
        return (
          person.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          person.identificacion?.includes(searchTerm) ||
          person.puesto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          person.programa?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      })
    }

    return data
  }

  const filteredData = getFilteredData()
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentData = filteredData.slice(startIndex, endIndex)

  // Resetear página cuando cambie la pestaña o búsqueda
  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, searchTerm])

  // Funciones de paginación
  const goToFirstPage = () => setCurrentPage(1)
  const goToLastPage = () => setCurrentPage(totalPages)
  const goToPreviousPage = () => setCurrentPage(Math.max(1, currentPage - 1))
  const goToNextPage = () => setCurrentPage(Math.min(totalPages, currentPage + 1))

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p className="text-muted-foreground">Cargando control de acceso...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Control de Acceso</h1>
          <p className="text-muted-foreground">Monitoreo de accesos al sistema</p>
        </div>
        <Button onClick={loadData} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tarjetas de estadísticas */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          className={`cursor-pointer transition-colors ${activeTab === "granted" ? "ring-2 ring-green-500" : ""}`}
          onClick={() => setActiveTab("granted")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Acceso Concedido</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-800">{grantedAccess.length}</div>
            <p className="text-xs text-muted-foreground">Personas con acceso permitido</p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${activeTab === "denied" ? "ring-2 ring-red-500" : ""}`}
          onClick={() => setActiveTab("denied")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-600">Acceso Denegado</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-800">{deniedAccess.length}</div>
            <p className="text-xs text-muted-foreground">Personas con acceso denegado</p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${activeTab === "waiting" ? "ring-2 ring-blue-500" : ""}`}
          onClick={() => setActiveTab("waiting")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">En Espera</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-800">{waitingPersons.length}</div>
            <p className="text-xs text-muted-foreground">Personas sin escanear</p>
          </CardContent>
        </Card>
      </div>

      {/* Controles de búsqueda y paginación */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {activeTab === "granted" && <CheckCircle className="w-5 h-5 text-green-600" />}
            {activeTab === "denied" && <XCircle className="w-5 h-5 text-red-600" />}
            {activeTab === "waiting" && <Clock className="w-5 h-5 text-blue-600" />}
            {activeTab === "granted" && "Personas con Acceso Concedido"}
            {activeTab === "denied" && "Personas con Acceso Denegado"}
            {activeTab === "waiting" && "Personas en Espera"}({filteredData.length})
          </CardTitle>
          <CardDescription>
            {activeTab === "granted" && "Lista de personas que han obtenido acceso al sistema"}
            {activeTab === "denied" && "Lista de personas a las que se les ha denegado el acceso"}
            {activeTab === "waiting" && "Lista de personas registradas que aún no han sido escaneadas"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nombre, identificación, puesto o programa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm whitespace-nowrap">Mostrar:</span>
              <Select
                value={itemsPerPage.toString()}
                onValueChange={(value) => {
                  setItemsPerPage(Number(value))
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="w-16">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Lista de datos */}
          <div className="space-y-3">
            {currentData.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {searchTerm ? "No se encontraron resultados" : "No hay datos disponibles"}
                </p>
              </div>
            ) : (
              currentData.map((item, index) => {
                const person = item.person || item
                const isAccessLog = "status" in item

                return (
                  <div
                    key={item.id || index}
                    className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg gap-3 ${
                      activeTab === "granted"
                        ? "bg-green-50 border-green-200"
                        : activeTab === "denied"
                          ? "bg-red-50 border-red-200"
                          : "bg-blue-50 border-blue-200"
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div
                        className={`flex items-center justify-center w-10 h-10 rounded-full ${
                          activeTab === "granted"
                            ? "bg-green-100"
                            : activeTab === "denied"
                              ? "bg-red-100"
                              : "bg-blue-100"
                        }`}
                      >
                        <User
                          className={`w-5 h-5 ${
                            activeTab === "granted"
                              ? "text-green-600"
                              : activeTab === "denied"
                                ? "text-red-600"
                                : "text-blue-600"
                          }`}
                        />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{person.nombre}</p>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm text-muted-foreground">
                          <span>ID: {person.identificacion}</span>
                          <span className="hidden sm:inline">•</span>
                          <span>{person.puesto}</span>
                          <span className="hidden sm:inline">•</span>
                          <span>{person.programa}</span>
                        </div>
                        {isAccessLog && (
                          <div className="mt-1 space-y-1">
                            <p className="text-xs text-muted-foreground">
                              Último acceso: {new Date(item.timestamp).toLocaleString()}
                            </p>
                            {item.grantedByUserName && (
                              <div className="flex items-center gap-1 text-xs">
                                <UserCheck className="w-3 h-3 text-blue-600" />
                                <span className="text-blue-600 font-medium">
                                  {person.nombre}, autorizado por {item.grantedByUserName}
                                </span>
                                {item.grantedByUserEmail && (
                                  <Badge variant="outline" className="text-xs px-1 py-0">
                                    {item.grantedByUserEmail}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Mostrando {startIndex + 1} a {Math.min(endIndex, filteredData.length)} de {filteredData.length}{" "}
                registros
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToFirstPage}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0 bg-transparent"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0 bg-transparent"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNumber
                    if (totalPages <= 5) {
                      pageNumber = i + 1
                    } else if (currentPage <= 3) {
                      pageNumber = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNumber = totalPages - 4 + i
                    } else {
                      pageNumber = currentPage - 2 + i
                    }

                    return (
                      <Button
                        key={pageNumber}
                        variant={currentPage === pageNumber ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNumber)}
                        className="h-8 w-8 p-0"
                      >
                        {pageNumber}
                      </Button>
                    )
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 p-0 bg-transparent"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToLastPage}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 p-0 bg-transparent"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
