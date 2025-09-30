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
  Briefcase,
  GraduationCap,
  Plus,
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
      <main className="flex flex-1 flex-col gap-4 p-3 sm:p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">Cargando control de acceso...</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex flex-1 flex-col gap-4 sm:gap-6 p-3 sm:p-6">
      <header className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Control de Acceso</h1>
          <p className="text-muted-foreground text-sm">Monitoreo de accesos al sistema</p>
        </div>
        <Button onClick={loadData} variant="outline" size="sm" className="w-full sm:w-auto bg-transparent">
          <RefreshCw className="w-4 h-4 mr-2" />
          <span className="sm:hidden">Actualizar</span>
          <span className="hidden sm:inline">Actualizar</span>
        </Button>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}

      <section className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${
            activeTab === "granted" ? "ring-2 ring-green-500 bg-green-50" : ""
          }`}
          onClick={() => setActiveTab("granted")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Concedido</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-800">{grantedAccess.length}</div>
            <p className="text-xs text-muted-foreground">Con acceso</p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${
            activeTab === "denied" ? "ring-2 ring-red-500 bg-red-50" : ""
          }`}
          onClick={() => setActiveTab("denied")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-600">Denegado</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-800">{deniedAccess.length}</div>
            <p className="text-xs text-muted-foreground">Sin acceso</p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${
            activeTab === "waiting" ? "ring-2 ring-blue-500 bg-blue-50" : ""
          }`}
          onClick={() => setActiveTab("waiting")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">En Espera</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-800">{waitingPersons.length}</div>
            <p className="text-xs text-muted-foreground">Sin escanear</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            {activeTab === "granted" && <CheckCircle className="w-5 h-5 text-green-600" />}
            {activeTab === "denied" && <XCircle className="w-5 h-5 text-red-600" />}
            {activeTab === "waiting" && <Clock className="w-5 h-5 text-blue-600" />}
            <CardTitle className="text-lg">
              {activeTab === "granted" && "Acceso Concedido"}
              {activeTab === "denied" && "Acceso Denegado"}
              {activeTab === "waiting" && "En Espera"}
              <span className="text-sm font-normal ml-2">({filteredData.length})</span>
            </CardTitle>
          </div>
          <CardDescription className="text-sm">
            {activeTab === "granted" && "Personas que han obtenido acceso al sistema"}
            {activeTab === "denied" && "Personas a las que se les ha denegado el acceso"}
            {activeTab === "waiting" && "Personas registradas que aún no han sido escaneadas"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nombre, ID, puesto..."
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
                <SelectTrigger className="w-20">
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

          <div className="space-y-3">
            {currentData.length === 0 ? (
              <div className="text-center py-12">
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
                    className={`border rounded-lg p-4 transition-all hover:shadow-sm ${
                      activeTab === "granted"
                        ? "bg-green-50/50 border-green-200"
                        : activeTab === "denied"
                          ? "bg-red-50/50 border-red-200"
                          : "bg-blue-50/50 border-blue-200"
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div
                        className={`flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0 ${
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
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base leading-tight">{person.nombre}</h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-xs font-mono">
                            ID: {person.identificacion}
                          </Badge>
                          {person.cuposExtras > 0 && (
                            <Badge
                              variant="secondary"
                              className="text-xs bg-orange-100 text-orange-800 border-orange-200"
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              {person.cuposExtras} cupo{person.cuposExtras > 1 ? "s" : ""} extra
                              {person.cuposExtras > 1 ? "s" : ""}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                            Total: {2 + (person.cuposExtras || 0)} cupos
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:gap-3">
                      <div className="flex items-start gap-2">
                        <Briefcase className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">Puesto</p>
                          <p className="text-sm text-muted-foreground">{person.puesto}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <GraduationCap className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">Programa</p>
                          <p className="text-sm text-muted-foreground break-words leading-relaxed hyphens-auto">
                            {person.programa}
                          </p>
                        </div>
                      </div>

                      {isAccessLog && (
                        <div className="pt-2 border-t border-gray-200">
                          <div className="flex items-start gap-2 mb-2">
                            <Clock className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">Último acceso</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(item.timestamp).toLocaleString()}
                              </p>
                            </div>
                          </div>

                          {item.grantedByUserName && (
                            <div className="flex items-start gap-2">
                              <UserCheck className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-blue-600">
                                  Autorizado por {item.grantedByUserName}
                                </p>
                                {item.grantedByUserEmail && (
                                  <p className="text-xs text-muted-foreground mt-1">{item.grantedByUserEmail}</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 pt-4 border-t">
              <div className="text-sm text-muted-foreground text-center sm:text-left">
                Mostrando {startIndex + 1} a {Math.min(endIndex, filteredData.length)} de {filteredData.length}{" "}
                registros
              </div>

              <div className="flex items-center justify-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToFirstPage}
                  disabled={currentPage === 1}
                  className="h-9 w-9 p-0 bg-transparent"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                  className="h-9 w-9 p-0 bg-transparent"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                    let pageNumber
                    if (totalPages <= 3) {
                      pageNumber = i + 1
                    } else if (currentPage <= 2) {
                      pageNumber = i + 1
                    } else if (currentPage >= totalPages - 1) {
                      pageNumber = totalPages - 2 + i
                    } else {
                      pageNumber = currentPage - 1 + i
                    }

                    return (
                      <Button
                        key={pageNumber}
                        variant={currentPage === pageNumber ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNumber)}
                        className="h-9 w-9 p-0"
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
                  className="h-9 w-9 p-0 bg-transparent"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToLastPage}
                  disabled={currentPage === totalPages}
                  className="h-9 w-9 p-0 bg-transparent"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
