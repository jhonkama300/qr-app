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
    <div className="space-y-3 md:space-y-6 w-full min-w-0 overflow-hidden">
      {/* Section Tabs (Estudiantes / Invitados) */}
      <div className="flex gap-1 p-1 rounded-xl bg-uparsistem-50/50 dark:bg-uparsistem-950/10 border border-uparsistem-100 dark:border-uparsistem-900/20 w-fit">
        <button
          onClick={() => setActiveSection("estudiantes")}
          className={`flex items-center gap-1.5 px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all ${
            activeSection === "estudiantes"
              ? "bg-uparsistem-600 text-white shadow-sm"
              : "text-uparsistem-700/70 dark:text-uparsistem-300/70 hover:text-uparsistem-700 dark:hover:text-uparsistem-300"
          }`}
        >
          <GraduationCap className="size-3.5 md:size-4" />
          <span>Estudiantes <span className="opacity-70">({allPersons.length})</span></span>
        </button>
        <button
          onClick={() => setActiveSection("invitados")}
          className={`flex items-center gap-1.5 px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-all ${
            activeSection === "invitados"
              ? "bg-uparsistem-600 text-white shadow-sm"
              : "text-uparsistem-700/70 dark:text-uparsistem-300/70 hover:text-uparsistem-700 dark:hover:text-uparsistem-300"
          }`}
        >
          <UserPlus className="size-3.5 md:size-4" />
          <span>Invitados <span className="opacity-70">({allInvitados.length})</span></span>
        </button>
      </div>

      {/* Stat Cards - Compact */}
      <div className="flex gap-1.5 md:gap-3 w-full">
        <button
          onClick={() => setActiveTab("granted")}
          className={`flex-1 flex items-center gap-2 md:gap-3 rounded-xl border transition-all px-3 md:px-4 py-2 md:py-3 ${
            activeTab === "granted"
              ? "border-green-300 ring-2 ring-green-200 dark:ring-green-800 bg-green-50 dark:bg-green-950/20"
              : "border-green-200/50 hover:border-green-300 bg-white dark:bg-gray-900"
          }`}
        >
          <CheckCircle className="size-4 md:size-5 text-green-500 shrink-0" />
          <div className="flex-1 min-w-0 text-left">
            <div className="text-sm md:text-lg font-bold text-green-800 dark:text-green-300">{grantedAccess.length}</div>
            <p className="text-[8px] md:text-[10px] text-green-600/70 dark:text-green-400/70 font-medium uppercase tracking-wider leading-tight">Concedidos</p>
          </div>
        </button>

        <button
          onClick={() => setActiveTab("denied")}
          className={`flex-1 flex items-center gap-2 md:gap-3 rounded-xl border transition-all px-3 md:px-4 py-2 md:py-3 ${
            activeTab === "denied"
              ? "border-red-300 ring-2 ring-red-200 dark:ring-red-800 bg-red-50 dark:bg-red-950/20"
              : "border-red-200/50 hover:border-red-300 bg-white dark:bg-gray-900"
          }`}
        >
          <XCircle className="size-4 md:size-5 text-red-500 shrink-0" />
          <div className="flex-1 min-w-0 text-left">
            <div className="text-sm md:text-lg font-bold text-red-800 dark:text-red-300">{deniedAccess.length}</div>
            <p className="text-[8px] md:text-[10px] text-red-600/70 dark:text-red-400/70 font-medium uppercase tracking-wider leading-tight">Denegados</p>
          </div>
        </button>

        <button
          onClick={() => setActiveTab("waiting")}
          className={`flex-1 flex items-center gap-2 md:gap-3 rounded-xl border transition-all px-3 md:px-4 py-2 md:py-3 ${
            activeTab === "waiting"
              ? "border-amber-300 ring-2 ring-amber-200 dark:ring-amber-800 bg-amber-50 dark:bg-amber-950/20"
              : "border-amber-200/50 hover:border-amber-300 bg-white dark:bg-gray-900"
          }`}
        >
          <Clock className="size-4 md:size-5 text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0 text-left">
            <div className="text-sm md:text-lg font-bold text-amber-800 dark:text-amber-300">{waitingPersons.length}</div>
            <p className="text-[8px] md:text-[10px] text-amber-600/70 dark:text-amber-400/70 font-medium uppercase tracking-wider leading-tight">Espera</p>
          </div>
        </button>
      </div>

      {/* Search + Bulk Actions */}
      <div className="flex flex-col md:flex-row gap-2 md:gap-3 w-full">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 md:size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, ID, puesto o programa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 md:pl-9 h-9 md:h-10 text-xs md:text-sm w-full"
          />
        </div>
        {activeTab === "waiting" && selectedToAuthorize.size > 0 && (
          <Button
            onClick={handleAuthorizeSelected}
            disabled={authorizing}
            size="sm"
            className="h-9 md:h-10 text-xs md:text-sm shrink-0 bg-uparsistem-600 hover:bg-uparsistem-700 text-white"
          >
            {authorizing ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <UserCheck className="mr-1.5 size-3.5" />
            )}
            Autorizar ({selectedToAuthorize.size})
          </Button>
        )}
      </div>

      {/* List */}
      <Card className="border-uparsistem-100 dark:border-uparsistem-900/20 shadow-sm">
        <CardHeader className="p-3 md:p-5 pb-2 md:pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {activeTab === "granted" && <CheckCircle className="size-4 md:size-5 text-uparsistem-600" />}
              {activeTab === "denied" && <XCircle className="size-4 md:size-5 text-red-500" />}
              {activeTab === "waiting" && <Clock className="size-4 md:size-5 text-amber-500" />}
              <div>
                <h3 className="text-xs md:text-base font-semibold">
                  {activeTab === "granted" && "Acceso Concedido"}
                  {activeTab === "denied" && "Acceso Denegado"}
                  {activeTab === "waiting" && "En Espera"}
                </h3>
                <p className="text-[10px] md:text-xs text-muted-foreground">
                  {filteredData.length} registro{filteredData.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            {activeTab === "waiting" && currentData.length > 0 && (
              <label className="flex items-center gap-1.5 text-[10px] md:text-xs text-muted-foreground cursor-pointer select-none">
                <Checkbox
                  checked={selectedToAuthorize.size === currentData.length && currentData.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                Seleccionar todos
              </label>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-3 md:p-5 pt-0 md:pt-0 space-y-1.5 md:space-y-2">
          {currentData.length === 0 ? (
            <div className="text-center py-8 md:py-12 text-muted-foreground">
              <Users className="size-10 md:size-14 mx-auto mb-3 opacity-30" />
              <p className="text-xs md:text-sm font-medium">
                No hay {activeSection === "estudiantes" ? "estudiantes" : "invitados"} en esta categoría
              </p>
              <p className="text-[10px] md:text-xs text-muted-foreground/60 mt-1">
                {activeTab === "waiting"
                  ? "Todos han sido procesados"
                  : "No se encontraron registros con los filtros actuales"}
              </p>
            </div>
          ) : (
            currentData.map((item: any) => {
              const person = item.person || item
              const isStudent = activeSection === "estudiantes"
              const cupos =
                isStudent && person.cuposExtras !== undefined ? calculateCuposDisplay(person as PersonData) : null

              return (
                <div
                  key={person.id || person.identificacion}
                  className={`relative flex items-start gap-1.5 md:gap-3 p-2 md:p-3 rounded-lg border transition-all hover:shadow-sm ${
                    activeTab === "waiting"
                      ? "border-uparsistem-200/60 dark:border-uparsistem-800/30 hover:border-uparsistem-300 dark:hover:border-uparsistem-700 bg-white dark:bg-gray-900 hover:bg-uparsistem-50/50 dark:hover:bg-uparsistem-950/20"
                      : activeTab === "granted"
                        ? "border-green-200/60 dark:border-green-900/30 bg-white dark:bg-gray-900 hover:bg-green-50/50 dark:hover:bg-green-950/20 hover:border-green-300 dark:hover:border-green-700"
                        : "border-red-200/60 dark:border-red-900/30 bg-white dark:bg-gray-900 hover:bg-red-50/50 dark:hover:bg-red-950/20 hover:border-red-300 dark:hover:border-red-700"
                  }`}
                >
                  {/* Left accent bar */}
                  <div className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-full ${
                    activeTab === "waiting" ? "bg-amber-400" : activeTab === "granted" ? "bg-green-400" : "bg-red-400"
                  }`} />
                  {activeTab === "waiting" && (
                    <Checkbox
                      checked={selectedToAuthorize.has(person.identificacion)}
                      onCheckedChange={() => toggleSelectPerson(person.identificacion)}
                      className="shrink-0 mt-1.5 md:mt-2"
                    />
                  )}
                  <div className={`flex size-7 md:size-10 shrink-0 items-center justify-center rounded-full mt-0.5 ${
                    isStudent ? "bg-uparsistem-100 dark:bg-uparsistem-900/30" : "bg-purple-100 dark:bg-purple-900/30"
                  }`}>
                    {isStudent ? (
                      <GraduationCap className="size-3.5 md:size-5 text-uparsistem-600 dark:text-uparsistem-400" />
                    ) : (
                      <UserPlus className="size-3.5 md:size-5 text-purple-600 dark:text-purple-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm font-semibold">{person.nombre}</p>
                    {isStudent && person.programa && (
                      <span className="text-[9px] md:text-xs font-bold px-1.5 py-0.5 rounded-md bg-uparsistem-100/70 dark:bg-uparsistem-900/30 text-uparsistem-700 dark:text-uparsistem-300 border border-uparsistem-200/50 dark:border-uparsistem-800/30 inline-block mt-0.5">
                        {person.programa}
                      </span>
                    )}
                    <div className="flex items-center gap-1 text-[9px] md:text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <span className="text-xs md:text-sm font-bold text-foreground font-mono">{person.identificacion}</span>
                      {item.timestamp && (
                        <>
                          <span className="opacity-50">·</span>
                          <span className="truncate">{new Date(item.timestamp).toLocaleString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span className="text-[10px] md:text-xs font-bold text-uparsistem-700 dark:text-uparsistem-300 truncate max-w-[100px] md:max-w-[140px] text-right">
                      <Briefcase className="size-2.5 md:size-3 inline mr-0.5 -mt-0.5" />
                      {person.puesto}
                    </span>
                    <Badge
                      variant="secondary"
                      className={`text-[9px] md:text-xs px-1.5 py-0 md:py-0.5 ${
                        isStudent
                          ? "bg-uparsistem-100 text-uparsistem-700 dark:bg-uparsistem-900/30 dark:text-uparsistem-300"
                          : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                      }`}
                    >
                      {isStudent ? "Estudiante" : "Invitado"}
                    </Badge>
                    {activeTab !== "waiting" && (
                      <Badge
                        variant="secondary"
                        className={`text-[9px] md:text-xs px-1.5 py-0 md:py-0.5 ${
                          item.status === "granted" || item.status === "q10_success"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                        }`}
                      >
                        {item.status === "granted" || item.status === "q10_success" ? "Concedido" : "Denegado"}
                      </Badge>
                    )}
                  </div>
                </div>
              )
            })
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 pt-2 md:pt-3">
              <Button variant="ghost" size="icon" onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="size-7 md:size-8">
                <ChevronsLeft className="size-3 md:size-3.5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="size-7 md:size-8">
                <ChevronLeft className="size-3 md:size-3.5" />
              </Button>
              <span className="text-[10px] md:text-xs text-muted-foreground px-2 min-w-[80px] text-center">
                {currentPage} / {totalPages}
              </span>
              <Button variant="ghost" size="icon" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="size-7 md:size-8">
                <ChevronRight className="size-3 md:size-3.5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="size-7 md:size-8">
                <ChevronsRight className="size-3 md:size-3.5" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
