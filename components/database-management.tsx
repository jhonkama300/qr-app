"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { collection, getDocs, doc, writeBatch, query, where, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Upload,
  Search,
  Users,
  GraduationCap,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  RotateCcw,
  Utensils,
  UserPlus,
} from "lucide-react"
import * as XLSX from "xlsx"

interface PersonData {
  id?: string
  puesto: string
  identificacion: string
  nombre: string
  programa: string
  cuposExtras: number
  fechaImportacion?: string
  cuposConsumidos?: number
}

interface InvitadoData {
  id?: string
  puesto: string
  identificacion: string
  nombre: string
  fechaImportacion?: string
  cuposConsumidos?: number
}

export function DatabaseManagement() {
  const [persons, setPersons] = useState<PersonData[]>([])
  const [filteredPersons, setFilteredPersons] = useState<PersonData[]>([])
  const [invitados, setInvitados] = useState<InvitadoData[]>([])
  const [filteredInvitados, setFilteredInvitados] = useState<InvitadoData[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // Búsqueda y paginación
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [selectedPrograma, setSelectedPrograma] = useState<string>("todos")
  const [selectedCuposExtras, setSelectedCuposExtras] = useState<string>("todos")

  const [activeSection, setActiveSection] = useState<"estudiantes" | "invitados">("estudiantes")
  const [invitadosSearchTerm, setInvitadosSearchTerm] = useState("")
  const [invitadosCurrentPage, setInvitadosCurrentPage] = useState(1)

  // Estados para el diálogo de reinicio de bufetes
  const [isResetBufetesDialogOpen, setIsResetBufetesDialogOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [mesas, setMesas] = useState<Array<{ id: string; numero: number; nombre: string; activa: boolean }>>([])

  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [selectedFileName, setSelectedFileName] = useState<string>("")

  const [isImportInvitadosDialogOpen, setIsImportInvitadosDialogOpen] = useState(false)
  const [selectedInvitadosFileName, setSelectedInvitadosFileName] = useState<string>("")
  const [importingInvitados, setImportingInvitados] = useState(false)

  const totalPages = Math.ceil(filteredPersons.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentPersons = filteredPersons.slice(startIndex, endIndex)
  const uniquePrograms = Array.from(new Set(persons.map((person) => person.programa)))

  const totalInvitadosPages = Math.ceil(filteredInvitados.length / itemsPerPage)
  const invitadosStartIndex = (invitadosCurrentPage - 1) * itemsPerPage
  const invitadosEndIndex = invitadosStartIndex + itemsPerPage
  const currentInvitados = filteredInvitados.slice(invitadosStartIndex, invitadosEndIndex)

  const totalRegistros = filteredPersons.length
  const programasUnicos = Array.from(new Set(filteredPersons.map((p) => p.programa))).length
  const totalCuposExtras = filteredPersons.reduce((sum, p) => sum + (p.cuposExtras || 0), 0)
  const bufeteDisponible = totalRegistros * 2 + totalCuposExtras

  useEffect(() => {
    loadPersons()
    loadMesas()
    loadInvitados() // Cargar invitados
  }, [])

  // Filtro de estudiantes
  useEffect(() => {
    let filtered = [...persons]

    if (searchTerm.trim() !== "") {
      filtered = filtered.filter(
        (person) =>
          person.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          person.identificacion?.includes(searchTerm) ||
          person.puesto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          person.programa?.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    if (selectedPrograma && selectedPrograma !== "todos") {
      filtered = filtered.filter((person) => person.programa === selectedPrograma)
    }

    if (selectedCuposExtras && selectedCuposExtras !== "todos") {
      if (selectedCuposExtras === "con-extras") {
        filtered = filtered.filter((person) => (person.cuposExtras || 0) > 0)
      } else if (selectedCuposExtras === "sin-extras") {
        filtered = filtered.filter((person) => (person.cuposExtras || 0) === 0)
      }
    }

    setFilteredPersons(filtered)
    setCurrentPage(1)
  }, [searchTerm, selectedPrograma, selectedCuposExtras, persons])

  useEffect(() => {
    let filtered = [...invitados]

    if (invitadosSearchTerm.trim() !== "") {
      filtered = filtered.filter(
        (invitado) =>
          invitado.nombre?.toLowerCase().includes(invitadosSearchTerm.toLowerCase()) ||
          invitado.identificacion?.includes(invitadosSearchTerm) ||
          invitado.puesto?.toLowerCase().includes(invitadosSearchTerm.toLowerCase()),
      )
    }

    setFilteredInvitados(filtered)
    setInvitadosCurrentPage(1)
  }, [invitadosSearchTerm, invitados])

  const loadPersons = async () => {
    setLoading(true)
    try {
      const querySnapshot = await getDocs(collection(db, "personas"))
      const personsData: PersonData[] = []
      querySnapshot.forEach((doc) => {
        personsData.push({ id: doc.id, ...doc.data() } as PersonData)
      })
      setPersons(personsData)
      setFilteredPersons(personsData)
    } catch (error) {
      console.error("Error loading persons:", error)
      setError("Error al cargar las personas")
    } finally {
      setLoading(false)
    }
  }

  const loadInvitados = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "invitados"))
      const invitadosData: InvitadoData[] = []
      querySnapshot.forEach((doc) => {
        invitadosData.push({ id: doc.id, ...doc.data() } as InvitadoData)
      })
      setInvitados(invitadosData)
      setFilteredInvitados(invitadosData)
    } catch (error) {
      console.error("Error loading invitados:", error)
    }
  }

  const loadMesas = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "table_meal_inventory"))
      const mesasData: Array<{ id: string; numero: number; nombre: string; activa: boolean }> = []
      querySnapshot.forEach((doc) => {
        const data = doc.data()
        mesasData.push({
          id: doc.id,
          numero: data.numeroMesa,
          nombre: data.nombreMesa,
          activa: data.activa,
        })
      })
      setMesas(mesasData.sort((a, b) => a.numero - b.numero))
    } catch (error) {
      console.error("Error loading mesas:", error)
    }
  }

  const fileInputRef = useRef<HTMLInputElement>(null)
  const invitadosFileInputRef = useRef<HTMLInputElement>(null) // Ref para invitados

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setSelectedFileName(file.name)
    setImporting(true)
    setError("")
    setSuccess("")

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[]

      if (jsonData.length === 0) {
        setError("El archivo está vacío o no tiene el formato correcto")
        return
      }

      const batch = writeBatch(db)
      let count = 0

      for (const row of jsonData) {
        const puesto = String(row["puesto"] || row["Puesto"] || "")
        const identificacion = String(row["identificacion"] || row["Identificacion"] || row["ID"] || "")
        const nombre = String(row["nombre"] || row["Nombre"] || "")
        const programa = String(row["programa"] || row["Programa"] || "")
        const cuposExtras = Number(row["cuposExtras"] || row["CuposExtras"] || row["cupos_extras"] || 0)

        if (identificacion && nombre) {
          const docRef = doc(collection(db, "personas"))
          batch.set(docRef, {
            puesto,
            identificacion,
            nombre,
            programa,
            cuposExtras,
            cuposConsumidos: 0,
            fechaImportacion: new Date().toISOString(),
          })
          count++
        }
      }

      await batch.commit()
      setSuccess(`Se importaron ${count} personas exitosamente`)
      loadPersons()
      setIsImportDialogOpen(false)
    } catch (error) {
      console.error("Error importing file:", error)
      setError("Error al importar el archivo")
    } finally {
      setImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleInvitadosFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setSelectedInvitadosFileName(file.name)
    setImportingInvitados(true)
    setError("")
    setSuccess("")

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[]

      if (jsonData.length === 0) {
        setError("El archivo está vacío o no tiene el formato correcto")
        return
      }

      const batch = writeBatch(db)
      let count = 0

      for (const row of jsonData) {
        const puesto = String(row["puesto"] || row["Puesto"] || "")
        const identificacion = String(row["identificacion"] || row["Identificacion"] || row["ID"] || "")
        const nombre = String(row["nombre"] || row["Nombre"] || "")

        if (identificacion && nombre) {
          const docRef = doc(collection(db, "invitados"))
          batch.set(docRef, {
            puesto,
            identificacion,
            nombre,
            fechaImportacion: new Date().toISOString(),
            cuposConsumidos: 0,
          })
          count++
        }
      }

      await batch.commit()
      setSuccess(`Se importaron ${count} invitados exitosamente`)
      loadInvitados()
      setIsImportInvitadosDialogOpen(false)
    } catch (error) {
      console.error("Error importing invitados file:", error)
      setError("Error al importar el archivo de invitados")
    } finally {
      setImportingInvitados(false)
      if (invitadosFileInputRef.current) {
        invitadosFileInputRef.current.value = ""
      }
    }
  }

  const handleDeleteAll = async () => {
    const confirmed = window.confirm("¿Estás seguro de eliminar todos los registros? Esta acción no se puede deshacer.")

    if (!confirmed) return

    setImporting(true)
    setError("")
    setSuccess("")

    try {
      const querySnapshot = await getDocs(collection(db, "personas"))

      if (querySnapshot.empty) {
        window.alert("No hay registros para eliminar")
        return
      }

      const batch = writeBatch(db)
      querySnapshot.forEach((doc) => {
        batch.delete(doc.ref)
      })

      await batch.commit()

      window.alert(`${querySnapshot.size} registros eliminados exitosamente`)
      loadPersons()
    } catch (error) {
      console.error("Error deleting records:", error)
      window.alert("Error al eliminar los registros")
    } finally {
      setImporting(false)
    }
  }

  const handleDeleteAllInvitados = async () => {
    const confirmed = window.confirm("¿Estás seguro de eliminar todos los invitados? Esta acción no se puede deshacer.")

    if (!confirmed) return

    setImporting(true)
    setError("")
    setSuccess("")

    try {
      const querySnapshot = await getDocs(collection(db, "invitados"))

      if (querySnapshot.empty) {
        window.alert("No hay invitados para eliminar")
        return
      }

      const batch = writeBatch(db)
      querySnapshot.forEach((doc) => {
        batch.delete(doc.ref)
      })

      await batch.commit()

      window.alert(`${querySnapshot.size} invitados eliminados exitosamente`)
      loadInvitados()
    } catch (error) {
      console.error("Error deleting invitados:", error)
      window.alert("Error al eliminar los invitados")
    } finally {
      setImporting(false)
    }
  }

  const handleResetMetrics = async () => {
    const confirmed = window.confirm(
      "¿Estás seguro de reiniciar todas las métricas? Esto eliminará todos los registros de acceso (access_logs). Esta acción no se puede deshacer.",
    )

    if (!confirmed) return

    setImporting(true)
    setError("")
    setSuccess("")

    try {
      const accessLogsSnapshot = await getDocs(collection(db, "access_logs"))

      if (accessLogsSnapshot.empty) {
        window.alert("No hay métricas para reiniciar")
        return
      }

      const batch = writeBatch(db)
      accessLogsSnapshot.forEach((doc) => {
        batch.delete(doc.ref)
      })

      await batch.commit()

      window.alert(`Métricas reiniciadas exitosamente: ${accessLogsSnapshot.size} registros de acceso eliminados`)
    } catch (error) {
      console.error("Error al reiniciar métricas:", error)
      window.alert("Error al reiniciar las métricas")
    } finally {
      setImporting(false)
    }
  }

  const handleResetAllBufetes = async () => {
    const confirmed = window.confirm(
      "¿Estás seguro de reiniciar todos los bufetes? Esto restaurará las comidas consumidas para todos los estudiantes y reiniciará el inventario de comidas por mesa.",
    )

    if (!confirmed) return

    setResetting(true)
    setError("")
    setSuccess("")

    try {
      const batch = writeBatch(db)

      // Reiniciar cuposConsumidos de todos los estudiantes
      persons.forEach((person) => {
        if (person.id) {
          batch.update(doc(db, "personas", person.id), {
            cuposConsumidos: 0,
          })
        }
      })

      await batch.commit()

      // Eliminar logs de acceso con mesaUsada
      const logsQuery = query(collection(db, "access_logs"), where("status", "==", "granted"))
      const logsSnapshot = await getDocs(logsQuery)

      const deleteBatch = writeBatch(db)
      let deletedCount = 0

      logsSnapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data()
        if (data.mesaUsada !== undefined && data.mesaUsada !== null) {
          deleteBatch.delete(docSnapshot.ref)
          deletedCount++
        }
      })

      await deleteBatch.commit()

      const tablesSnapshot = await getDocs(collection(db, "table_meal_inventory"))
      const tablesBatch = writeBatch(db)
      let tablesResetCount = 0

      tablesSnapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data()
        tablesBatch.update(doc(db, "table_meal_inventory", docSnapshot.id), {
          comidasConsumidas: 0,
          comidasDisponibles: data.totalComidas || 0,
        })
        tablesResetCount++
      })

      await tablesBatch.commit()

      window.alert(
        `Todos los bufetes han sido reiniciados exitosamente.\n${persons.length} estudiantes actualizados\n${deletedCount} registros de comidas eliminados\n${tablesResetCount} mesas reiniciadas`,
      )
      setIsResetBufetesDialogOpen(false)
      loadPersons()
    } catch (error) {
      console.error("Error al reiniciar bufetes:", error)
      window.alert("Error al reiniciar los bufetes. Intenta nuevamente")
    } finally {
      setResetting(false)
    }
  }

  const handleResetBufeteByMesa = async (mesaNumero: number) => {
    const confirmed = window.confirm(
      `¿Estás seguro de reiniciar el bufete de la Mesa ${mesaNumero}? Esto restaurará las comidas consumidas en esta mesa y reiniciará su inventario.`,
    )

    if (!confirmed) return

    setResetting(true)
    setError("")
    setSuccess("")

    try {
      const logsQuery = query(
        collection(db, "access_logs"),
        where("mesaUsada", "==", mesaNumero),
        where("status", "==", "granted"),
      )
      const logsSnapshot = await getDocs(logsQuery)

      if (logsSnapshot.empty) {
        window.alert(`No hay consumos registrados para la Mesa ${mesaNumero}`)
        setIsResetBufetesDialogOpen(false)
        return
      }

      const consumosPorEstudiante = new Map<string, number>()
      logsSnapshot.forEach((doc) => {
        const data = doc.data()
        if (data.identificacion) {
          const count = consumosPorEstudiante.get(data.identificacion) || 0
          consumosPorEstudiante.set(data.identificacion, count + 1)
        }
      })

      const batch = writeBatch(db)
      let updatedCount = 0

      for (const [identificacion, consumosEnMesa] of consumosPorEstudiante.entries()) {
        const personQuery = query(collection(db, "personas"), where("identificacion", "==", identificacion))
        const personSnapshot = await getDocs(personQuery)

        if (!personSnapshot.empty) {
          const personDoc = personSnapshot.docs[0]
          const currentCuposConsumidos = personDoc.data().cuposConsumidos || 0

          const newCuposConsumidos = Math.max(0, currentCuposConsumidos - consumosEnMesa)

          batch.update(doc(db, "personas", personDoc.id), {
            cuposConsumidos: newCuposConsumidos,
          })
          updatedCount++
        }
      }

      await batch.commit()

      const deleteBatch = writeBatch(db)
      logsSnapshot.forEach((docSnapshot) => {
        deleteBatch.delete(docSnapshot.ref)
      })
      await deleteBatch.commit()

      const mesaRef = doc(db, "table_meal_inventory", `mesa_${mesaNumero}`)
      const mesaDoc = await getDocs(
        query(collection(db, "table_meal_inventory"), where("numeroMesa", "==", mesaNumero)),
      )

      if (!mesaDoc.empty) {
        const mesaData = mesaDoc.docs[0].data()
        await updateDoc(doc(db, "table_meal_inventory", mesaDoc.docs[0].id), {
          comidasConsumidas: 0,
          comidasDisponibles: mesaData.totalComidas || 0,
        })
      }

      window.alert(
        `Bufete de Mesa ${mesaNumero} reiniciado exitosamente.\n${updatedCount} estudiante(s) actualizado(s)\n${logsSnapshot.size} registro(s) de comidas eliminados\nInventario de mesa reiniciado`,
      )
      setIsResetBufetesDialogOpen(false)
      loadPersons()
    } catch (error) {
      console.error("Error al reiniciar bufete por mesa:", error)
      window.alert("Error al reiniciar el bufete. Intenta nuevamente")
    } finally {
      setResetting(false)
    }
  }

  // Función para calcular cupos como en el login
  const calculateCuposDisplay = (person: PersonData) => {
    const cuposExtras = person.cuposExtras || 0
    const acompanantes = 1 + cuposExtras // 1 base + extras
    return {
      graduando: 1,
      acompanantes,
      total: 2 + cuposExtras,
      extras: cuposExtras,
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2 border-b">
        <Button
          variant={activeSection === "estudiantes" ? "default" : "ghost"}
          onClick={() => setActiveSection("estudiantes")}
          className="rounded-b-none"
        >
          <GraduationCap className="mr-2 h-4 w-4" />
          Estudiantes ({persons.length})
        </Button>
        <Button
          variant={activeSection === "invitados" ? "default" : "ghost"}
          onClick={() => setActiveSection("invitados")}
          className="rounded-b-none"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Invitados ({invitados.length})
        </Button>
      </div>

      {/* Sección de Estudiantes */}
      {activeSection === "estudiantes" && (
        <>
          {/* Estadísticas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Registros</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalRegistros}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Programas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{programasUnicos}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Cupos Extras</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalCuposExtras}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Bufete Disponible</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{bufeteDisponible}</div>
              </CardContent>
            </Card>
          </div>

          {/* Acciones */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setIsImportDialogOpen(true)} disabled={importing}>
              <Upload className="mr-2 h-4 w-4" />
              Importar Excel
            </Button>

            <Button
              onClick={handleDeleteAll}
              disabled={importing}
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50 bg-transparent"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Eliminar Todo
            </Button>

            <Button
              onClick={handleResetMetrics}
              disabled={importing}
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50 bg-transparent"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reiniciar Métricas
            </Button>

            <Button
              onClick={() => setIsResetBufetesDialogOpen(true)}
              disabled={resetting}
              variant="outline"
              className="border-teal-300 text-teal-600 hover:bg-teal-50"
            >
              <Utensils className="mr-2 h-4 w-4" />
              Reiniciar Bufetes
            </Button>
          </div>

          {/* Búsqueda y filtros */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Personas Registradas
              </CardTitle>
              <CardDescription>
                Mostrando {startIndex + 1} - {Math.min(endIndex, filteredPersons.length)} de {filteredPersons.length}{" "}
                personas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre, identificación, puesto o programa..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Select value={selectedPrograma} onValueChange={setSelectedPrograma}>
                  <SelectTrigger className="w-full md:w-[200px]">
                    <SelectValue placeholder="Filtrar por programa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los programas</SelectItem>
                    {uniquePrograms.map((programa) => (
                      <SelectItem key={programa} value={programa}>
                        {programa}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedCuposExtras} onValueChange={setSelectedCuposExtras}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Cupos extras" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="con-extras">Con extras</SelectItem>
                    <SelectItem value="sin-extras">Sin extras</SelectItem>
                  </SelectContent>
                </Select>

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

              {/* Lista de personas */}
              <div className="space-y-3">
                {currentPersons.map((person) => {
                  const cupos = calculateCuposDisplay(person)
                  return (
                    <Card key={person.id} className="p-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <GraduationCap className="h-6 w-6 text-primary" />
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
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{person.programa}</Badge>
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                            Graduando + {cupos.acompanantes} acompañante{cupos.acompanantes !== 1 ? "s" : ""}
                            {cupos.extras > 0 && (
                              <span className="ml-1 text-xs opacity-75">
                                (1 + {cupos.extras} extra{cupos.extras !== 1 ? "s" : ""})
                              </span>
                            )}
                          </Badge>
                          {(person.cuposConsumidos || 0) > 0 && (
                            <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
                              {person.cuposConsumidos} consumido{(person.cuposConsumidos || 0) !== 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </Card>
                  )
                })}
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
        </>
      )}

      {activeSection === "invitados" && (
        <>
          {/* Estadísticas de invitados */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Invitados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{invitados.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Cupos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{invitados.length}</div>
                <p className="text-xs text-muted-foreground">1 cupo por invitado</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-purple-700">Comidas por Entregar</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {invitados.reduce((sum, inv) => {
                    const consumidos = inv.cuposConsumidos || 0
                    return sum + Math.max(0, 1 - consumidos)
                  }, 0)}
                </div>
                <p className="text-xs text-purple-600">
                  {invitados.filter((inv) => (inv.cuposConsumidos || 0) >= 1).length} ya consumieron
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Acciones de invitados */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setIsImportInvitadosDialogOpen(true)} disabled={importingInvitados}>
              <Upload className="mr-2 h-4 w-4" />
              Importar Invitados
            </Button>

            <Button
              onClick={handleDeleteAllInvitados}
              disabled={importing}
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50 bg-transparent"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Eliminar Todos los Invitados
            </Button>
          </div>

          {/* Lista de invitados */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Invitados Registrados
              </CardTitle>
              <CardDescription>
                Mostrando {invitadosStartIndex + 1} - {Math.min(invitadosEndIndex, filteredInvitados.length)} de{" "}
                {filteredInvitados.length} invitados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre, identificación o puesto..."
                    value={invitadosSearchTerm}
                    onChange={(e) => setInvitadosSearchTerm(e.target.value)}
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

              {/* Lista de invitados */}
              <div className="space-y-3">
                {currentInvitados.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay invitados registrados</p>
                    <p className="text-sm">Importa un archivo Excel con los campos: puesto, identificacion, nombre</p>
                  </div>
                ) : (
                  currentInvitados.map((invitado) => (
                    <Card key={invitado.id} className="p-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                            <UserPlus className="h-6 w-6 text-purple-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{invitado.nombre}</h3>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Briefcase className="h-3 w-3" />
                                Puesto {invitado.puesto}
                              </span>
                              <span>•</span>
                              <span>ID: {invitado.identificacion}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300">
                            Invitado
                          </Badge>
                          <Badge variant="secondary">1 cupo único</Badge>
                          {(invitado.cuposConsumidos || 0) > 0 && (
                            <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
                              {invitado.cuposConsumidos} consumido{(invitado.cuposConsumidos || 0) !== 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>

              {/* Paginación de invitados */}
              {totalInvitadosPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setInvitadosCurrentPage(1)}
                    disabled={invitadosCurrentPage === 1}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setInvitadosCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={invitadosCurrentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    Página {invitadosCurrentPage} de {totalInvitadosPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setInvitadosCurrentPage((p) => Math.min(totalInvitadosPages, p + 1))}
                    disabled={invitadosCurrentPage === totalInvitadosPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setInvitadosCurrentPage(totalInvitadosPages)}
                    disabled={invitadosCurrentPage === totalInvitadosPages}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Diálogo de importar estudiantes */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar Estudiantes desde Excel</DialogTitle>
            <DialogDescription>
              Selecciona un archivo Excel con las columnas: puesto, identificacion, nombre, programa, cuposExtras
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
            <Button onClick={() => fileInputRef.current?.click()} disabled={importing} className="w-full">
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Seleccionar archivo
                </>
              )}
            </Button>
            {selectedFileName && <p className="text-sm text-muted-foreground">Archivo: {selectedFileName}</p>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isImportInvitadosDialogOpen} onOpenChange={setIsImportInvitadosDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar Invitados desde Excel</DialogTitle>
            <DialogDescription>
              Selecciona un archivo Excel con las columnas: puesto, identificacion, nombre
              <br />
              <span className="text-xs text-muted-foreground mt-2 block">
                Los invitados tienen acceso al evento pero no tienen bufete ni cupos extras (1 cupo único).
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <input
              ref={invitadosFileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleInvitadosFileUpload}
              className="hidden"
            />
            <Button
              onClick={() => invitadosFileInputRef.current?.click()}
              disabled={importingInvitados}
              className="w-full"
            >
              {importingInvitados ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Seleccionar archivo
                </>
              )}
            </Button>
            {selectedInvitadosFileName && (
              <p className="text-sm text-muted-foreground">Archivo: {selectedInvitadosFileName}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de reinicio de bufetes */}
      <Dialog open={isResetBufetesDialogOpen} onOpenChange={setIsResetBufetesDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Utensils className="h-5 w-5" />
              Reiniciar Bufetes
            </DialogTitle>
            <DialogDescription>
              Selecciona qué bufetes deseas reiniciar. Esto restaurará las comidas consumidas y el inventario por mesa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Button onClick={handleResetAllBufetes} disabled={resetting} variant="destructive" className="w-full">
              {resetting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reiniciando...
                </>
              ) : (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reiniciar TODOS los Bufetes
                </>
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">O por mesa</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {mesas.map((mesa) => (
                <Button
                  key={mesa.id}
                  onClick={() => handleResetBufeteByMesa(mesa.numero)}
                  disabled={resetting}
                  variant="outline"
                  size="sm"
                >
                  Mesa {mesa.numero}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetBufetesDialogOpen(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
