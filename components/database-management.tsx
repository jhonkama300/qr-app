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
  Gift,
} from "lucide-react"
let xlsxModule: any = null
const getXLSX = async () => {
  if (!xlsxModule) {
    xlsxModule = await import("xlsx")
  }
  return xlsxModule
}

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

  // New states for importing extra cupos
  const [isImportCuposExtrasDialogOpen, setIsImportCuposExtrasDialogOpen] = useState(false)
  const [selectedCuposExtrasFileName, setSelectedCuposExtrasFileName] = useState<string>("")
  const [importingCuposExtras, setImportingCuposExtras] = useState(false)
  const [cuposExtrasImportResult, setCuposExtrasImportResult] = useState<{
    actualizados: number
    noEncontrados: string[]
  } | null>(null)

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
  const promedioCupos = totalRegistros > 0 ? (totalCuposExtras / totalRegistros).toFixed(1) : "0"
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
  const cuposExtrasFileInputRef = useRef<HTMLInputElement>(null) // New ref for extra cupos

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setSelectedFileName(file.name)
    setImporting(true)
    setError("")
    setSuccess("")

    try {
      const data = await file.arrayBuffer()
      const XLSX = await getXLSX()
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

        if (identificacion && nombre) {
          const docRef = doc(collection(db, "personas"))
          batch.set(docRef, {
            puesto,
            identificacion,
            nombre,
            programa,
            cuposExtras: 0,
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

  // New function to import extra cupos and assign them to existing students
  const handleCuposExtrasFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setSelectedCuposExtrasFileName(file.name)
    setImportingCuposExtras(true)
    setError("")
    setSuccess("")
    setCuposExtrasImportResult(null)

    try {
      const data = await file.arrayBuffer()
      const XLSX = await getXLSX()
      const workbook = XLSX.read(data)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[]

      if (jsonData.length === 0) {
        setError("El archivo está vacío o no tiene el formato correcto")
        return
      }

      let actualizados = 0
      const noEncontrados: string[] = []

      for (const row of jsonData) {
        const identificacion = String(row["identificacion"] || row["Identificacion"] || row["ID"] || "").trim()
        const nombre = String(row["nombre"] || row["Nombre"] || "").trim()
        const cuposExtras = Number(row["cuposExtras"] || row["CuposExtras"] || row["cupos_extras"] || 0)

        if (!identificacion) continue

        const q = query(collection(db, "personas"), where("identificacion", "==", identificacion))
        const querySnapshot = await getDocs(q)

        if (querySnapshot.empty) {
          noEncontrados.push(`${identificacion} - ${nombre || "Sin nombre"}`)
          continue
        }

        const studentDoc = querySnapshot.docs[0]
        await updateDoc(doc(db, "personas", studentDoc.id), {
          cuposExtras: cuposExtras,
        })
        actualizados++
      }

      setCuposExtrasImportResult({ actualizados, noEncontrados })

      if (actualizados > 0) {
        setSuccess(`Se actualizaron ${actualizados} estudiantes con cupos extras`)
      }

      if (noEncontrados.length > 0) {
        setError(`${noEncontrados.length} estudiantes no fueron encontrados en la base de datos`)
      }

      loadPersons()
    } catch (error) {
      console.error("Error importing cupos extras file:", error)
      setError("Error al importar el archivo de cupos extras")
    } finally {
      setImportingCuposExtras(false)
      if (cuposExtrasFileInputRef.current) {
        cuposExtrasFileInputRef.current.value = ""
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
      const XLSX = await getXLSX()
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
    <div className="space-y-3 md:space-y-6 w-full min-w-0 overflow-hidden">
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
          <span>Estudiantes <span className="opacity-70">({persons.length})</span></span>
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
          <span>Invitados <span className="opacity-70">({invitados.length})</span></span>
        </button>
      </div>

      {/* Sección de Estudiantes */}
      {activeSection === "estudiantes" && (
        <>
          {/* Estadísticas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 md:gap-3">
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-b from-blue-100 to-blue-200 dark:from-blue-950/30 dark:to-blue-900/20 border border-blue-200 dark:border-blue-800/30 p-2 md:p-3">
              <span className="text-[8px] md:text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider">Total Registros</span>
              <div className="text-base md:text-xl font-bold text-blue-800 dark:text-blue-200 mt-0.5">{totalRegistros}</div>
            </div>
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-b from-violet-100 to-violet-200 dark:from-violet-950/30 dark:to-violet-900/20 border border-violet-200 dark:border-violet-800/30 p-2 md:p-3">
              <span className="text-[8px] md:text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wider">Programas</span>
              <div className="text-base md:text-xl font-bold text-violet-800 dark:text-violet-200 mt-0.5">{programasUnicos}</div>
            </div>
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-b from-amber-100 to-amber-200 dark:from-amber-950/30 dark:to-amber-900/20 border border-amber-200 dark:border-amber-800/30 p-2 md:p-3">
              <span className="text-[8px] md:text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider">Cupos Extras</span>
              <div className="text-base md:text-xl font-bold text-amber-800 dark:text-amber-200 mt-0.5">{totalCuposExtras}</div>
            </div>
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-b from-emerald-100 to-emerald-200 dark:from-emerald-950/30 dark:to-emerald-900/20 border border-emerald-200 dark:border-emerald-800/30 p-2 md:p-3">
              <span className="text-[8px] md:text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">Bufetes Disponibles</span>
              <div className="text-base md:text-xl font-bold text-emerald-800 dark:text-emerald-200 mt-0.5">{bufeteDisponible}</div>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex flex-wrap gap-1.5 md:gap-2">
            <Button onClick={() => setIsImportDialogOpen(true)} disabled={importing} size="sm" className="h-8 md:h-9 text-[10px] md:text-xs gap-1 bg-uparsistem-600 hover:bg-uparsistem-700 text-white px-2 md:px-3">
              <Upload className="h-3 w-3 md:h-4 md:w-4 shrink-0" />
              <span className="truncate">Importar Excel</span>
            </Button>
            <Button onClick={() => { setIsImportCuposExtrasDialogOpen(true); setCuposExtrasImportResult(null); setSelectedCuposExtrasFileName("") }} disabled={importingCuposExtras} variant="outline" size="sm" className="h-8 md:h-9 text-[10px] md:text-xs gap-1 border-amber-300 text-amber-700 hover:bg-amber-50 px-2 md:px-3">
              <Gift className="h-3 w-3 md:h-4 md:w-4 shrink-0" />
              <span className="truncate">Cupos Extras</span>
            </Button>
            <Button onClick={handleDeleteAll} disabled={importing} variant="outline" size="sm" className="h-8 md:h-9 text-[10px] md:text-xs gap-1 border-red-300 text-red-700 hover:bg-red-50 px-2 md:px-3">
              <RotateCcw className="h-3 w-3 md:h-4 md:w-4 shrink-0" />
              <span className="truncate">Eliminar Todo</span>
            </Button>
            <Button onClick={handleResetMetrics} disabled={importing} variant="outline" size="sm" className="h-8 md:h-9 text-[10px] md:text-xs gap-1 border-red-300 text-red-700 hover:bg-red-50 px-2 md:px-3">
              <RotateCcw className="h-3 w-3 md:h-4 md:w-4 shrink-0" />
              <span className="truncate">Reiniciar Métricas</span>
            </Button>
            <Button onClick={() => setIsResetBufetesDialogOpen(true)} disabled={resetting} variant="outline" size="sm" className="h-8 md:h-9 text-[10px] md:text-xs gap-1 border-teal-300 text-teal-700 hover:bg-teal-50 px-2 md:px-3">
              <Utensils className="h-3 w-3 md:h-4 md:w-4 shrink-0" />
              <span className="truncate">Reiniciar Bufetes</span>
            </Button>
          </div>

          {/* Búsqueda y filtros */}
          <Card className="border-uparsistem-100/50 dark:border-uparsistem-900/20 shadow-sm">
            <CardHeader className="p-3 md:p-5 pb-2 md:pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                  <Users className="h-4 w-4 md:h-5 md:w-5 text-uparsistem-600" />
                  Personas Registradas
                </CardTitle>
                <span className="text-[10px] md:text-xs text-muted-foreground">
                  {startIndex + 1}-{Math.min(endIndex, filteredPersons.length)} de {filteredPersons.length}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-3 md:p-5 pt-0 md:pt-0 space-y-3 md:space-y-4">
              <div className="flex flex-col md:flex-row gap-2 md:gap-3">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre, ID, puesto o programa..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 md:pl-9 h-9 md:h-10 text-xs md:text-sm w-full"
                  />
                </div>
                <div className="flex flex-col md:flex-row gap-1.5 md:gap-3">
                  <Select value={selectedPrograma} onValueChange={setSelectedPrograma}>
                    <SelectTrigger className="h-9 md:h-10 text-xs md:text-sm w-full md:w-auto md:min-w-[180px]">
                      <SelectValue placeholder="Programa" className="truncate" />
                    </SelectTrigger>
                    <SelectContent className="max-w-[90vw] md:max-w-none">
                      <SelectItem value="todos" className="text-xs md:text-sm">Todos los programas</SelectItem>
                      {uniquePrograms.map((programa) => (
                        <SelectItem key={programa} value={programa} className="text-xs md:text-sm break-words whitespace-normal">{programa}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedCuposExtras} onValueChange={setSelectedCuposExtras}>
                    <SelectTrigger className="h-9 md:h-10 text-xs md:text-sm w-full md:w-auto md:min-w-[140px]">
                      <SelectValue placeholder="Cupos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="con-extras">Con extras</SelectItem>
                      <SelectItem value="sin-extras">Sin extras</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={String(itemsPerPage)} onValueChange={(v) => setItemsPerPage(Number(v))}>
                    <SelectTrigger className="h-9 md:h-10 text-xs md:text-sm w-full md:w-[80px]">
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
              </div>

              {/* Lista de personas */}
              <div className="space-y-1.5 md:space-y-2">
                {currentPersons.map((person) => {
                  const cupos = calculateCuposDisplay(person)
                  return (
                    <div key={person.id} className="flex items-start gap-1.5 md:gap-3 p-1.5 md:p-3 rounded-lg border border-uparsistem-100/50 dark:border-uparsistem-900/20 bg-white dark:bg-gray-900">
                      <div className="flex size-7 md:size-10 shrink-0 items-center justify-center rounded-full bg-uparsistem-100 dark:bg-uparsistem-900/30 mt-0.5">
                        <GraduationCap className="size-3.5 md:size-5 text-uparsistem-600 dark:text-uparsistem-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] md:text-sm font-semibold leading-tight">{person.nombre}</p>
                            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                              <span className="text-xs md:text-sm font-bold text-foreground">{person.identificacion}</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-0.5 shrink-0 mt-0.5">
                            <span className="text-[9px] md:text-xs font-bold text-uparsistem-700 dark:text-uparsistem-300 text-right leading-tight">{person.puesto}</span>
                            <div className="flex items-center gap-0.5">
                              <span className="text-[8px] md:text-[10px] font-semibold text-uparsistem-700 dark:text-uparsistem-300 bg-uparsistem-50 dark:bg-uparsistem-950/20 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                                {cupos.total} cupos
                              </span>
                              {cupos.extras > 0 && (
                                <span className="text-[8px] md:text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/20 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                                  +{cupos.extras}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {person.programa && (
                          <p className="text-[9px] md:text-xs text-muted-foreground leading-tight mt-0.5">{person.programa}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-1 pt-1 md:pt-2">
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
        </>
      )}

      {activeSection === "invitados" && (
        <>
          <div className="grid grid-cols-3 gap-2 md:gap-4">
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-b from-blue-100 to-blue-200 dark:from-blue-950/30 dark:to-blue-900/20 border border-blue-200 dark:border-blue-800/30 p-2.5 md:p-4">
              <span className="text-[9px] md:text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider">Total Invitados</span>
              <div className="text-lg md:text-2xl font-bold text-blue-800 dark:text-blue-200 mt-0.5">{invitados.length}</div>
            </div>
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-b from-amber-100 to-amber-200 dark:from-amber-950/30 dark:to-amber-900/20 border border-amber-200 dark:border-amber-800/30 p-2.5 md:p-4">
              <span className="text-[9px] md:text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider">Cupos</span>
              <div className="text-lg md:text-2xl font-bold text-amber-800 dark:text-amber-200 mt-0.5">{invitados.length}</div>
              <p className="text-[8px] md:text-[10px] text-amber-600/70 dark:text-amber-400/70">1 cupo por invitado</p>
            </div>
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-b from-purple-100 to-purple-200 dark:from-purple-950/30 dark:to-purple-900/20 border border-purple-200 dark:border-purple-800/30 p-2.5 md:p-4">
              <span className="text-[9px] md:text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wider">Por Entregar</span>
              <div className="text-lg md:text-2xl font-bold text-purple-800 dark:text-purple-200 mt-0.5">
                {invitados.reduce((sum, inv) => { const consumidos = inv.cuposConsumidos || 0; return sum + Math.max(0, 1 - consumidos) }, 0)}
              </div>
              <p className="text-[8px] md:text-[10px] text-purple-600/70 dark:text-purple-400/70">{invitados.filter((inv) => (inv.cuposConsumidos || 0) >= 1).length} ya consumieron</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 md:gap-2">
            <Button onClick={() => setIsImportInvitadosDialogOpen(true)} disabled={importingInvitados} size="sm" className="h-8 md:h-9 text-[10px] md:text-xs gap-1 bg-uparsistem-600 hover:bg-uparsistem-700 text-white">
              <Upload className="h-3 w-3 md:h-4 md:w-4" />
              Importar Invitados
            </Button>
            <Button onClick={handleDeleteAllInvitados} disabled={importing} variant="outline" size="sm" className="h-8 md:h-9 text-[10px] md:text-xs gap-1 border-red-300 text-red-700 hover:bg-red-50">
              <RotateCcw className="h-3 w-3 md:h-4 md:w-4" />
              Eliminar Todos
            </Button>
          </div>

          {/* Lista de invitados */}
          <Card className="border-uparsistem-100/50 dark:border-uparsistem-900/20 shadow-sm">
            <CardHeader className="p-3 md:p-5 pb-2 md:pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                  <UserPlus className="h-4 w-4 md:h-5 md:w-5 text-uparsistem-600" />
                  Invitados Registrados
                </CardTitle>
                <span className="text-[10px] md:text-xs text-muted-foreground">
                  {invitadosStartIndex + 1}-{Math.min(invitadosEndIndex, filteredInvitados.length)} de {filteredInvitados.length}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-3 md:p-5 pt-0 md:pt-0 space-y-3 md:space-y-4">
              <div className="flex flex-col md:flex-row gap-2 md:gap-3">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
                  <Input placeholder="Buscar por nombre, ID o puesto..." value={invitadosSearchTerm} onChange={(e) => setInvitadosSearchTerm(e.target.value)} className="pl-8 md:pl-9 h-9 md:h-10 text-xs md:text-sm w-full" />
                </div>
                <Select value={String(itemsPerPage)} onValueChange={(v) => setItemsPerPage(Number(v))}>
                    <SelectTrigger className="h-9 md:h-10 text-xs md:text-sm w-full md:w-[80px]">
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
              <div className="space-y-1.5 md:space-y-2">
                {currentInvitados.length === 0 ? (
                  <div className="text-center py-6 md:py-8 text-muted-foreground">
                    <UserPlus className="h-8 w-8 md:h-12 md:w-12 mx-auto mb-2 md:mb-3 opacity-30" />
                    <p className="text-xs md:text-sm font-medium">No hay invitados registrados</p>
                    <p className="text-[10px] md:text-sm">Importa un archivo Excel con los campos: puesto, identificacion, nombre</p>
                  </div>
                ) : (
                  currentInvitados.map((invitado) => (
                    <div key={invitado.id} className="flex items-start gap-1.5 md:gap-3 p-1.5 md:p-3 rounded-lg border border-purple-100/50 dark:border-purple-900/20 bg-white dark:bg-gray-900">
                      <div className="flex size-7 md:size-10 shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30 mt-0.5">
                        <UserPlus className="size-3.5 md:size-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] md:text-sm font-semibold truncate">{invitado.nombre}</p>
                            <div className="flex items-center gap-1 text-[8px] md:text-xs text-muted-foreground mt-0.5 flex-wrap">
                              <span className="font-mono font-bold text-foreground">{invitado.identificacion}</span>
                              <span className="opacity-50">·</span>
                              <span className="truncate max-w-[80px] md:max-w-none">{invitado.puesto}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                            <span className="text-[8px] md:text-[10px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/20 px-1.5 py-0.5 rounded-md whitespace-nowrap">Invitado</span>
                            <span className="text-[8px] md:text-[10px] font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-md whitespace-nowrap">1 cupo</span>
                            {(invitado.cuposConsumidos || 0) > 0 && (
                              <span className="text-[8px] md:text-[10px] font-semibold text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/20 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                                {invitado.cuposConsumidos} cons.
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Paginación de invitados */}
              {totalInvitadosPages > 1 && (
                <div className="flex items-center justify-center gap-1 pt-1 md:pt-2">
                  <Button variant="ghost" size="icon" onClick={() => setInvitadosCurrentPage(1)} disabled={invitadosCurrentPage === 1} className="size-7 md:size-8">
                    <ChevronsLeft className="size-3 md:size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setInvitadosCurrentPage((p) => Math.max(1, p - 1))} disabled={invitadosCurrentPage === 1} className="size-7 md:size-8">
                    <ChevronLeft className="size-3 md:size-3.5" />
                  </Button>
                  <span className="text-[10px] md:text-xs text-muted-foreground px-2 min-w-[80px] text-center">
                    {invitadosCurrentPage} / {totalInvitadosPages}
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => setInvitadosCurrentPage((p) => Math.min(totalInvitadosPages, p + 1))} disabled={invitadosCurrentPage === totalInvitadosPages} className="size-7 md:size-8">
                    <ChevronRight className="size-3 md:size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setInvitadosCurrentPage(totalInvitadosPages)} disabled={invitadosCurrentPage === totalInvitadosPages} className="size-7 md:size-8">
                    <ChevronsRight className="size-3 md:size-3.5" />
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
            {/* Updated description without cuposExtras */}
            <DialogDescription>
              Selecciona un archivo Excel con las columnas: puesto, identificacion, nombre, programa
              <br />
              <span className="text-xs text-muted-foreground mt-2 block">
                Los cupos extras se asignan por separado usando el botón "Asignar Cupos Extras".
              </span>
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

      {/* New dialog for importing extra cupos */}
      <Dialog open={isImportCuposExtrasDialogOpen} onOpenChange={setIsImportCuposExtrasDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-amber-500" />
              Asignar Cupos Extras desde Excel
            </DialogTitle>
            <DialogDescription>
              Selecciona un archivo Excel con las columnas: <strong>identificacion</strong>, <strong>nombre</strong>,{" "}
              <strong>cuposExtras</strong>
              <br />
              <span className="text-xs text-muted-foreground mt-2 block">
                Solo se actualizarán los estudiantes que ya existen en la base de datos.
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <input
              ref={cuposExtrasFileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleCuposExtrasFileUpload}
              className="hidden"
            />
            <Button
              onClick={() => cuposExtrasFileInputRef.current?.click()}
              disabled={importingCuposExtras}
              className="w-full"
            >
              {importingCuposExtras ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Seleccionar archivo
                </>
              )}
            </Button>
            {selectedCuposExtrasFileName && (
              <p className="text-sm text-muted-foreground">Archivo: {selectedCuposExtrasFileName}</p>
            )}

            {/* Show import results */}
            {cuposExtrasImportResult && (
              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="default" className="bg-green-500">
                    {cuposExtrasImportResult.actualizados}
                  </Badge>
                  <span>estudiantes actualizados correctamente</span>
                </div>

                {cuposExtrasImportResult.noEncontrados.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-amber-600">
                      <Badge variant="outline" className="border-amber-300 text-amber-600">
                        {cuposExtrasImportResult.noEncontrados.length}
                      </Badge>
                      <span>estudiantes no encontrados:</span>
                    </div>
                    <div className="max-h-32 overflow-y-auto bg-muted/50 rounded-md p-2">
                      {cuposExtrasImportResult.noEncontrados.map((item, index) => (
                        <p key={index} className="text-xs text-muted-foreground">
                          {item}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsImportCuposExtrasDialogOpen(false)
                setCuposExtrasImportResult(null)
                setSelectedCuposExtrasFileName("")
              }}
            >
              Cerrar
            </Button>
          </DialogFooter>
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
