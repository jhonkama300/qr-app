"use client"

import { useState, useEffect } from "react"
import { collection, query, orderBy, onSnapshot, addDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  CheckCircle,
  XCircle,
  Users,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  UserCheck,
  Briefcase,
  GraduationCap,
  UserPlus,
} from "lucide-react"
import { useAuth } from "@/components/auth-provider"

interface PersonData {
  id: string
  puesto: string
  identificacion: string
  nombre: string
  programa: string
  cuposExtras: number
}

interface InvitadoData {
  id: string
  puesto: string
  identificacion: string
  nombre: string
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
  tipoPersona?: "estudiante" | "invitado" // Nuevo campo
}

export function AccessControl() {
  const [allPersons, setAllPersons] = useState<PersonData[]>([])
  const [allInvitados, setAllInvitados] = useState<InvitadoData[]>([])
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedToAuthorize, setSelectedToAuthorize] = useState<Set<string>>(new Set())
  const [authorizing, setAuthorizing] = useState(false)

  const { user } = useAuth()

  // Estados de búsqueda y paginación
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState<"granted" | "denied" | "waiting">("granted")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  const [activeSection, setActiveSection] = useState<"estudiantes" | "invitados">("estudiantes")

  useEffect(() => {
    setLoading(true)
    setError(null)

    try {
      // Real-time listener for personas collection
      const personsUnsubscribe = onSnapshot(
        collection(db, "personas"),
        (snapshot) => {
          const personsData: PersonData[] = []
          snapshot.forEach((doc) => {
            personsData.push({ id: doc.id, ...doc.data() } as PersonData)
          })
          setAllPersons(personsData)
        },
        (error) => {
          console.error("Error listening to persons:", error)
          setError("Error al cargar las personas")
        },
      )

      const invitadosUnsubscribe = onSnapshot(
        collection(db, "invitados"),
        (snapshot) => {
          const invitadosData: InvitadoData[] = []
          snapshot.forEach((doc) => {
            invitadosData.push({ id: doc.id, ...doc.data() } as InvitadoData)
          })
          setAllInvitados(invitadosData)
        },
        (error) => {
          console.error("Error listening to invitados:", error)
        },
      )

      // Real-time listener for access_logs collection
      const logsUnsubscribe = onSnapshot(
        query(collection(db, "access_logs"), orderBy("timestamp", "desc")),
        (snapshot) => {
          const logsData: AccessLog[] = []
          snapshot.forEach((doc) => {
            logsData.push({ id: doc.id, ...doc.data() } as AccessLog)
          })
          setAccessLogs(logsData)
          setLoading(false)
        },
        (error) => {
          console.error("Error listening to access logs:", error)
          setError("Error al cargar los registros de acceso")
          setLoading(false)
        },
      )

      return () => {
        personsUnsubscribe()
        invitadosUnsubscribe() // Cleanup invitados listener
        logsUnsubscribe()
      }
    } catch (error) {
      console.error("Error setting up listeners:", error)
      setError("Error al configurar los listeners")
      setLoading(false)
    }
  }, [])

  // Obtener logs únicos por identificación (el más reciente)
  const uniqueAccessLogs = accessLogs.reduce((acc: AccessLog[], log) => {
    const existing = acc.find((l) => l.identificacion === log.identificacion)
    if (!existing) {
      acc.push(log)
    }
    return acc
  }, [])

  const calculateCuposDisplay = (person: PersonData) => {
    const cuposExtras = person.cuposExtras || 0
    const acompanantes = 1 + cuposExtras
    return {
      graduando: 1,
      acompanantes,
      total: 2 + cuposExtras,
      extras: cuposExtras,
    }
  }

  const getDataForSection = () => {
    if (activeSection === "estudiantes") {
      // Estudiantes
      const grantedAccess = uniqueAccessLogs
        .filter((log) => (log.status === "granted" || log.status === "q10_success") && log.tipoPersona !== "invitado")
        .map((log) => {
          const person = allPersons.find((p) => p.identificacion === log.identificacion)
          return { ...log, person }
        })
        .filter((log) => log.person) // Solo si existe el estudiante

      const deniedAccess = uniqueAccessLogs
        .filter((log) => (log.status === "denied" || log.status === "q10_failed") && log.tipoPersona !== "invitado")
        .map((log) => {
          const person = allPersons.find((p) => p.identificacion === log.identificacion)
          return { ...log, person }
        })
        .filter((log) => log.person)

      const scannedIdentifications = new Set(uniqueAccessLogs.map((log) => log.identificacion))
      const waitingPersons = allPersons.filter((person) => !scannedIdentifications.has(person.identificacion))

      return { grantedAccess, deniedAccess, waitingPersons }
    } else {
      // Invitados
      const grantedAccess = uniqueAccessLogs
        .filter((log) => (log.status === "granted" || log.status === "q10_success") && log.tipoPersona === "invitado")
        .map((log) => {
          const invitado = allInvitados.find((i) => i.identificacion === log.identificacion)
          return { ...log, person: invitado }
        })
        .filter((log) => log.person)

      const deniedAccess = uniqueAccessLogs
        .filter((log) => (log.status === "denied" || log.status === "q10_failed") && log.tipoPersona === "invitado")
        .map((log) => {
          const invitado = allInvitados.find((i) => i.identificacion === log.identificacion)
          return { ...log, person: invitado }
        })
        .filter((log) => log.person)

      const scannedIdentifications = new Set(
        uniqueAccessLogs.filter((log) => log.tipoPersona === "invitado").map((log) => log.identificacion),
      )
      const waitingPersons = allInvitados.filter((invitado) => !scannedIdentifications.has(invitado.identificacion))

      return { grantedAccess, deniedAccess, waitingPersons }
    }
  }

  const { grantedAccess, deniedAccess, waitingPersons } = getDataForSection()

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

  // Resetear página cuando cambie la pestaña, búsqueda o sección
  useEffect(() => {
    setCurrentPage(1)
    setSelectedToAuthorize(new Set())
  }, [activeTab, searchTerm, activeSection])

  // Función para autorizar estudiantes/invitados seleccionados
  const handleAuthorizeSelected = async () => {
    if (selectedToAuthorize.size === 0) return

    setAuthorizing(true)
    try {
      const promises = Array.from(selectedToAuthorize).map(async (identificacion) => {
        const person =
          activeSection === "estudiantes"
            ? waitingPersons.find((p: any) => p.identificacion === identificacion)
            : waitingPersons.find((p: any) => p.identificacion === identificacion)

        if (person) {
          await addDoc(collection(db, "access_logs"), {
            identificacion: person.identificacion,
            timestamp: new Date().toISOString(),
            status: "granted",
            details: `Acceso autorizado manualmente por ${user?.displayName || user?.email || "Admin"}`,
            grantedByUserId: user?.uid || null,
            grantedByUserName: user?.displayName || null,
            grantedByUserEmail: user?.email || null,
            tipoPersona: activeSection === "estudiantes" ? "estudiante" : "invitado", // Guardar tipo
          })
        }
      })

      await Promise.all(promises)
      setSelectedToAuthorize(new Set())
    } catch (error) {
      console.error("Error authorizing:", error)
      setError("Error al autorizar")
    } finally {
      setAuthorizing(false)
    }
  }

  // Toggle selección individual
  const toggleSelectPerson = (identificacion: string) => {
    const newSelected = new Set(selectedToAuthorize)
    if (newSelected.has(identificacion)) {
      newSelected.delete(identificacion)
    } else {
      newSelected.add(identificacion)
    }
    setSelectedToAuthorize(newSelected)
  }

  // Seleccionar/deseleccionar todos los visibles
  const toggleSelectAll = () => {
    if (selectedToAuthorize.size === currentData.length) {
      setSelectedToAuthorize(new Set())
    } else {
      const allIds = currentData.map((item: any) => item.identificacion)
      setSelectedToAuthorize(new Set(allIds))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b">
        <Button
          variant={activeSection === "estudiantes" ? "default" : "ghost"}
          onClick={() => setActiveSection("estudiantes")}
          className="rounded-b-none"
        >
          <GraduationCap className="mr-2 h-4 w-4" />
          Estudiantes ({allPersons.length})
        </Button>
        <Button
          variant={activeSection === "invitados" ? "default" : "ghost"}
          onClick={() => setActiveSection("invitados")}
          className="rounded-b-none"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Invitados ({allInvitados.length})
        </Button>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          className={`cursor-pointer transition-all ${activeTab === "granted" ? "ring-2 ring-green-500" : ""}`}
          onClick={() => setActiveTab("granted")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Acceso Concedido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{grantedAccess.length}</div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${activeTab === "denied" ? "ring-2 ring-red-500" : ""}`}
          onClick={() => setActiveTab("denied")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              Acceso Denegado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{deniedAccess.length}</div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${activeTab === "waiting" ? "ring-2 ring-yellow-500" : ""}`}
          onClick={() => setActiveTab("waiting")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              En Espera
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{waitingPersons.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de personas */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              {activeTab === "granted" && <CheckCircle className="h-5 w-5 text-green-500" />}
              {activeTab === "denied" && <XCircle className="h-5 w-5 text-red-500" />}
              {activeTab === "waiting" && <Clock className="h-5 w-5 text-yellow-500" />}
              {activeTab === "granted" && "Acceso Concedido"}
              {activeTab === "denied" && "Acceso Denegado"}
              {activeTab === "waiting" && "En Espera"}
            </CardTitle>
            {activeTab === "waiting" && selectedToAuthorize.size > 0 && (
              <Button onClick={handleAuthorizeSelected} disabled={authorizing} size="sm">
                {authorizing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UserCheck className="mr-2 h-4 w-4" />
                )}
                Autorizar ({selectedToAuthorize.size})
              </Button>
            )}
          </div>
          <CardDescription className="text-sm">
            {activeTab === "granted" &&
              `${activeSection === "estudiantes" ? "Estudiantes" : "Invitados"} que han obtenido acceso al sistema`}
            {activeTab === "denied" &&
              `${activeSection === "estudiantes" ? "Estudiantes" : "Invitados"} a los que se les ha denegado el acceso`}
            {activeTab === "waiting" &&
              `${activeSection === "estudiantes" ? "Estudiantes" : "Invitados"} registrados que aún no han sido escaneados`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Búsqueda */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, identificación, puesto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={String(itemsPerPage)} onValueChange={(v) => setItemsPerPage(Number(v))}>
              <SelectTrigger className="w-full md:w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Checkbox para seleccionar todos (solo en pestaña waiting) */}
          {activeTab === "waiting" && currentData.length > 0 && (
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
              <Checkbox
                checked={selectedToAuthorize.size === currentData.length && currentData.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-sm text-muted-foreground">
                Seleccionar todos los visibles ({currentData.length})
              </span>
            </div>
          )}

          {/* Lista */}
          <div className="space-y-3">
            {currentData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay {activeSection === "estudiantes" ? "estudiantes" : "invitados"} en esta categoría</p>
              </div>
            ) : (
              currentData.map((item: any) => {
                const person = item.person || item
                const isStudent = activeSection === "estudiantes"
                const cupos =
                  isStudent && person.cuposExtras !== undefined ? calculateCuposDisplay(person as PersonData) : null

                return (
                  <Card key={person.id || person.identificacion} className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        {activeTab === "waiting" && (
                          <Checkbox
                            checked={selectedToAuthorize.has(person.identificacion)}
                            onCheckedChange={() => toggleSelectPerson(person.identificacion)}
                          />
                        )}
                        <div
                          className={`h-12 w-12 rounded-full flex items-center justify-center ${
                            isStudent ? "bg-primary/10" : "bg-purple-100"
                          }`}
                        >
                          {isStudent ? (
                            <GraduationCap className="h-6 w-6 text-primary" />
                          ) : (
                            <UserPlus className="h-6 w-6 text-purple-600" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold">{person.nombre}</h3>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Briefcase className="h-3 w-3" />
                              Puesto {person.puesto}
                            </span>
                            <span>•</span>
                            <span>ID: {person.identificacion}</span>
                            {item.timestamp && (
                              <>
                                <span>•</span>
                                <span>{new Date(item.timestamp).toLocaleString()}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {isStudent && person.programa && <Badge variant="outline">{person.programa}</Badge>}
                        <Badge
                          variant={isStudent ? "default" : "secondary"}
                          className={isStudent ? "" : "bg-purple-100 text-purple-800 border-purple-300"}
                        >
                          {isStudent ? "Estudiante" : "Invitado"}
                        </Badge>
                        {isStudent && cupos && (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                            Graduando + {cupos.acompanantes} acompañante{cupos.acompanantes !== 1 ? "s" : ""}
                            {cupos.extras > 0 && (
                              <span className="ml-1 text-xs opacity-75">
                                (1 + {cupos.extras} extra{cupos.extras !== 1 ? "s" : ""})
                              </span>
                            )}
                          </Badge>
                        )}
                        {/* Badge de cupo único para invitados */}
                        {!isStudent && <Badge variant="secondary">1 cupo único</Badge>}
                        {/* Badge de estado */}
                        {activeTab !== "waiting" && (
                          <Badge
                            variant={
                              item.status === "granted" || item.status === "q10_success" ? "default" : "destructive"
                            }
                            className={
                              item.status === "granted" || item.status === "q10_success"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }
                          >
                            {item.status === "granted" || item.status === "q10_success" ? "Concedido" : "Denegado"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })
            )}
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
