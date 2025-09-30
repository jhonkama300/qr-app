"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { collection, getDocs, doc, writeBatch, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Loader2,
  Upload,
  Database,
  Trash2,
  FileSpreadsheet,
  Users,
  CheckCircle,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RotateCcw,
  UtensilsCrossed,
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

export function DatabaseManagement() {
  const [persons, setPersons] = useState<PersonData[]>([])
  const [filteredPersons, setFilteredPersons] = useState<PersonData[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [previewData, setPreviewData] = useState<PersonData[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  const [selectedPrograma, setSelectedPrograma] = useState<string>("")
  const [selectedCuposExtras, setSelectedCuposExtras] = useState<string>("")

  // Estados para paginación
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Estados para el diálogo de reinicio de bufetes
  const [isResetBufetesDialogOpen, setIsResetBufetesDialogOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [mesas, setMesas] = useState<Array<{ id: string; numero: number; nombre: string; activa: boolean }>>([])

  const totalPages = Math.ceil(filteredPersons.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentPersons = filteredPersons.slice(startIndex, endIndex)
  const uniquePrograms = Array.from(new Set(persons.map((person) => person.programa)))

  useEffect(() => {
    loadPersons()
    loadMesas() // Cargar mesas al iniciar
  }, [])

  useEffect(() => {
    let filtered = persons

    // Filtro por término de búsqueda
    if (searchTerm.trim() !== "") {
      filtered = filtered.filter(
        (person) =>
          (person.nombre || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          (person.identificacion || "").includes(searchTerm) ||
          (person.puesto || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          (person.programa || "").toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    // Filtro por programa
    if (selectedPrograma && selectedPrograma !== "todos") {
      filtered = filtered.filter((person) => person.programa === selectedPrograma)
    }

    // Filtro por cupos extras
    if (selectedCuposExtras && selectedCuposExtras !== "todos") {
      if (selectedCuposExtras === "con-extras") {
        filtered = filtered.filter((person) => (person.cuposExtras || 0) > 0)
      } else if (selectedCuposExtras === "sin-extras") {
        filtered = filtered.filter((person) => (person.cuposExtras || 0) === 0)
      }
    }

    setFilteredPersons(filtered)
    // Resetear a la primera página cuando se filtra
    setCurrentPage(1)
  }, [searchTerm, selectedPrograma, selectedCuposExtras, persons])

  const clearAllFilters = () => {
    setSearchTerm("")
    setSelectedPrograma("")
    setSelectedCuposExtras("")
  }

  const hasActiveFilters = searchTerm || selectedPrograma || selectedCuposExtras

  const loadPersons = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "personas"))
      const personsData: PersonData[] = []
      querySnapshot.forEach((doc) => {
        personsData.push({
          id: doc.id,
          ...doc.data(),
        } as PersonData)
      })
      const sortedPersons = personsData.sort((a, b) => {
        const puestoA = a.puesto || ""
        const puestoB = b.puesto || ""
        return puestoA.localeCompare(puestoB)
      })
      setPersons(sortedPersons)
      setFilteredPersons(sortedPersons)
    } catch (error) {
      console.error("Error al cargar personas:", error)
      setError("Error al cargar la base de datos")
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      processExcelFile(selectedFile)
    }
  }

  const processExcelFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: "array" })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

        // Procesar los datos (saltar la primera fila que son los headers)
        const processedData: PersonData[] = []
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[]
          if (row.length >= 5 && row[0] && row[1] && row[2]) {
            processedData.push({
              puesto: String(row[0] || "").trim(),
              identificacion: String(row[1] || "").trim(),
              nombre: String(row[2] || "").trim(),
              programa: String(row[3] || "").trim(),
              cuposExtras: Number(row[4]) || 0,
            })
          }
        }

        setPreviewData(processedData)
        setError("")
      } catch (error) {
        console.error("Error al procesar archivo:", error)
        setError("Error al procesar el archivo Excel. Verifica el formato.")
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleImportData = async () => {
    if (previewData.length === 0) {
      setError("No hay datos para importar")
      return
    }

    setImporting(true)
    setError("")
    setSuccess("")

    try {
      // Obtener todas las identificaciones existentes en la base de datos
      const existingPersonsSnapshot = await getDocs(collection(db, "personas"))
      const existingIdentificaciones = new Set<string>()

      existingPersonsSnapshot.forEach((doc) => {
        const data = doc.data()
        if (data.identificacion) {
          existingIdentificaciones.add(data.identificacion.trim())
        }
      })

      // Verificar duplicados en los datos a importar
      const duplicatesInFile = new Set<string>()
      const identificacionesInFile = new Set<string>()
      const duplicatesWithDB: string[] = []

      previewData.forEach((person) => {
        const id = person.identificacion.trim()

        // Verificar duplicados dentro del archivo
        if (identificacionesInFile.has(id)) {
          duplicatesInFile.add(id)
        } else {
          identificacionesInFile.add(id)
        }

        // Verificar duplicados con la base de datos
        if (existingIdentificaciones.has(id)) {
          duplicatesWithDB.push(id)
        }
      })

      // Si hay duplicados, mostrar error y no importar
      if (duplicatesInFile.size > 0 || duplicatesWithDB.length > 0) {
        let errorMessage = "❌ No se puede importar debido a identificaciones duplicadas:\n\n"

        if (duplicatesWithDB.length > 0) {
          errorMessage += `• ${duplicatesWithDB.length} identificación(es) ya existe(n) en la base de datos: ${duplicatesWithDB.slice(0, 5).join(", ")}${duplicatesWithDB.length > 5 ? "..." : ""}\n`
        }

        if (duplicatesInFile.size > 0) {
          errorMessage += `• ${duplicatesInFile.size} identificación(es) duplicada(s) dentro del archivo: ${Array.from(duplicatesInFile).slice(0, 5).join(", ")}${duplicatesInFile.size > 5 ? "..." : ""}\n`
        }

        errorMessage += "\nPor favor, corrige el archivo Excel y vuelve a intentar."
        setError(errorMessage)
        setImporting(false)
        return
      }

      const batch = writeBatch(db)
      const collectionRef = collection(db, "personas")

      // Agregar cada persona al batch
      previewData.forEach((person) => {
        const docRef = doc(collectionRef)
        batch.set(docRef, {
          ...person,
          fechaImportacion: new Date().toISOString(),
        })
      })

      // Ejecutar el batch
      await batch.commit()

      const totalCuposExtrasImportados = previewData.reduce((sum, p) => sum + p.cuposExtras, 0)
      const programasUnicos = new Set(previewData.map((p) => p.programa)).size

      setSuccess(
        `✅ Importación exitosa: ${previewData.length} registros • ${programasUnicos} programas únicos • ${totalCuposExtrasImportados} cupos extras totales`,
      )

      setPreviewData([])
      setFile(null)
      setIsDialogOpen(false)
      loadPersons()

      // Limpiar el input file
      const fileInput = document.getElementById("excel-file") as HTMLInputElement
      if (fileInput) fileInput.value = ""
    } catch (error) {
      console.error("Error al importar datos:", error)
      setError("Error al importar los datos. Intenta nuevamente")
    } finally {
      setImporting(false)
    }
  }

  const handleClearDatabase = async () => {
    if (!confirm("¿Estás seguro de eliminar TODA la base de datos? Esta acción no se puede deshacer.")) {
      return
    }

    try {
      const batch = writeBatch(db)
      persons.forEach((person) => {
        if (person.id) {
          batch.delete(doc(db, "personas", person.id))
        }
      })
      await batch.commit()
      setSuccess("Base de datos limpiada exitosamente")
      loadPersons()
    } catch (error) {
      console.error("Error al limpiar base de datos:", error)
      setError("Error al limpiar la base de datos")
    }
  }

  const handleResetMetrics = async () => {
    if (
      !confirm(
        "¿Estás seguro de reiniciar todas las métricas? Esto eliminará todos los registros de acceso (access_logs). Esta acción no se puede deshacer.",
      )
    ) {
      return
    }

    setImporting(true)
    setError("")
    setSuccess("")

    try {
      // Obtener todos los documentos de access_logs
      const accessLogsSnapshot = await getDocs(collection(db, "access_logs"))

      if (accessLogsSnapshot.empty) {
        setSuccess("No hay métricas para reiniciar")
        return
      }

      // Crear batch para eliminar todos los access_logs
      const batch = writeBatch(db)
      accessLogsSnapshot.forEach((doc) => {
        batch.delete(doc.ref)
      })

      // Ejecutar el batch
      await batch.commit()

      setSuccess(`✅ Métricas reiniciadas exitosamente: ${accessLogsSnapshot.size} registros de acceso eliminados`)
    } catch (error) {
      console.error("Error al reiniciar métricas:", error)
      setError("Error al reiniciar las métricas")
    } finally {
      setImporting(false)
    }
  }

  const clearSearch = () => {
    setSearchTerm("")
  }

  const loadMesas = async () => {
    try {
      const mesasSnapshot = await getDocs(collection(db, "mesas_config"))
      const mesasData = mesasSnapshot.docs.map((doc) => ({
        id: doc.id,
        numero: doc.data().numero,
        nombre: doc.data().nombre,
        activa: doc.data().activa,
      }))
      setMesas(mesasData.sort((a, b) => a.numero - b.numero))
    } catch (error) {
      console.error("Error al cargar mesas:", error)
    }
  }

  const handleResetAllBufetes = async () => {
    setResetting(true)
    setError("")
    setSuccess("")

    try {
      const batch = writeBatch(db)

      // Reiniciar cuposConsumidos de todas las personas
      persons.forEach((person) => {
        if (person.id) {
          batch.update(doc(db, "personas", person.id), {
            cuposConsumidos: 0,
          })
        }
      })

      await batch.commit()

      setSuccess(`✅ Todos los bufetes han sido reiniciados exitosamente. ${persons.length} registros actualizados.`)
      setIsResetBufetesDialogOpen(false)
      loadPersons()
    } catch (error) {
      console.error("Error al reiniciar bufetes:", error)
      setError("Error al reiniciar los bufetes. Intenta nuevamente")
    } finally {
      setResetting(false)
    }
  }

  const handleResetBufeteByMesa = async (mesaNumero: number) => {
    setResetting(true)
    setError("")
    setSuccess("")

    try {
      // Obtener todos los access_logs de la mesa específica con status "granted"
      const logsQuery = query(
        collection(db, "access_logs"),
        where("mesaUsada", "==", mesaNumero),
        where("status", "==", "granted"),
      )
      const logsSnapshot = await getDocs(logsQuery)

      // Extraer identificaciones únicas de los estudiantes que consumieron en esta mesa
      const identificacionesSet = new Set<string>()
      logsSnapshot.forEach((doc) => {
        const data = doc.data()
        if (data.identificacion) {
          identificacionesSet.add(data.identificacion)
        }
      })

      const identificaciones = Array.from(identificacionesSet)

      if (identificaciones.length === 0) {
        setSuccess(`No hay consumos registrados para la Mesa ${mesaNumero}`)
        setIsResetBufetesDialogOpen(false)
        return
      }

      // Obtener los documentos de personas con esas identificaciones
      const batch = writeBatch(db)
      let updatedCount = 0

      for (const identificacion of identificaciones) {
        const personQuery = query(collection(db, "personas"), where("identificacion", "==", identificacion))
        const personSnapshot = await getDocs(personQuery)

        if (!personSnapshot.empty) {
          const personDoc = personSnapshot.docs[0]
          const currentCuposConsumidos = personDoc.data().cuposConsumidos || 0

          // Decrementar en 1 el cupo consumido (ya que cada escaneo en esa mesa consumió 1 cupo)
          const newCuposConsumidos = Math.max(0, currentCuposConsumidos - 1)

          batch.update(doc(db, "personas", personDoc.id), {
            cuposConsumidos: newCuposConsumidos,
          })
          updatedCount++
        }
      }

      await batch.commit()

      setSuccess(
        `✅ Bufete de Mesa ${mesaNumero} reiniciado exitosamente. ${updatedCount} estudiante(s) actualizado(s).`,
      )
      setIsResetBufetesDialogOpen(false)
      loadPersons()
    } catch (error) {
      console.error("Error al reiniciar bufete por mesa:", error)
      setError("Error al reiniciar el bufete. Intenta nuevamente")
    } finally {
      setResetting(false)
    }
  }

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
            <p className="text-muted-foreground">Cargando base de datos...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-3 sm:p-4 lg:p-6">
      <header className="space-y-3">
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-balance">Base de Datos</h1>
            <p className="text-sm text-muted-foreground text-pretty">
              Gestiona la base de datos de personas del sistema
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto justify-center">
                  <Upload className="w-4 h-4 mr-2" />
                  Importar Excel
                </Button>
              </DialogTrigger>
              <DialogContent className="mx-4 sm:mx-0 sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-lg">Importar Base de Datos desde Excel</DialogTitle>
                  <DialogDescription className="text-sm">
                    Selecciona un archivo Excel (.xlsx) con las columnas: Puesto, Identificación, Nombre, Programa,
                    Cupos Extras
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="excel-file" className="text-sm font-medium">
                      Archivo Excel
                    </Label>
                    <Input
                      id="excel-file"
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileChange}
                      disabled={importing}
                      className="h-11"
                    />
                  </div>

                  {previewData.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Vista Previa ({previewData.length} registros)</Label>
                      <div className="max-h-48 sm:max-h-60 overflow-auto border rounded-lg">
                        <div className="block sm:hidden">
                          {previewData.slice(0, 5).map((person, index) => (
                            <div key={index} className="p-3 border-b last:border-b-0 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-medium">
                                  {person.puesto}
                                </span>
                                {person.cuposExtras > 0 && (
                                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded font-medium">
                                    +{person.cuposExtras}
                                  </span>
                                )}
                              </div>
                              <p className="font-medium text-sm">{person.nombre}</p>
                              <p className="text-xs text-muted-foreground">{person.identificacion}</p>
                              <p className="text-xs text-muted-foreground">{person.programa}</p>
                            </div>
                          ))}
                          {previewData.length > 5 && (
                            <div className="p-2 text-center text-muted-foreground text-xs">
                              ... y {previewData.length - 5} registros más
                            </div>
                          )}
                        </div>

                        <table className="hidden sm:table w-full text-sm">
                          <thead className="bg-muted">
                            <tr>
                              <th className="p-2 text-left text-xs font-medium">Puesto</th>
                              <th className="p-2 text-left text-xs font-medium">Identificación</th>
                              <th className="p-2 text-left text-xs font-medium">Nombre</th>
                              <th className="p-2 text-left text-xs font-medium">Programa</th>
                              <th className="p-2 text-left text-xs font-medium">Cupos</th>
                            </tr>
                          </thead>
                          <tbody>
                            {previewData.slice(0, 10).map((person, index) => (
                              <tr key={index} className="border-t">
                                <td className="p-2 text-xs">{person.puesto}</td>
                                <td className="p-2 text-xs">{person.identificacion}</td>
                                <td className="p-2 text-xs">{person.nombre}</td>
                                <td className="p-2 text-xs">{person.programa}</td>
                                <td className="p-2 text-xs">{person.cuposExtras}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {previewData.length > 10 && (
                          <div className="p-2 text-center text-muted-foreground text-xs">
                            ... y {previewData.length - 10} registros más
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button
                    onClick={handleImportData}
                    disabled={importing || previewData.length === 0}
                    className="w-full h-11"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Importando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Importar {previewData.length} Registros
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button variant="destructive" onClick={handleClearDatabase} className="w-full sm:w-auto justify-center">
              <Trash2 className="w-4 h-4 mr-2" />
              Limpiar BD
            </Button>

            <Button
              variant="outline"
              onClick={handleResetMetrics}
              disabled={importing}
              className="w-full sm:w-auto justify-center border-orange-200 text-orange-700 hover:bg-orange-50 bg-transparent"
            >
              {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
              Reiniciar Métricas
            </Button>

            <Dialog open={isResetBufetesDialogOpen} onOpenChange={setIsResetBufetesDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto justify-center border-green-200 text-green-700 hover:bg-green-50 bg-transparent"
                >
                  <UtensilsCrossed className="w-4 h-4 mr-2" />
                  Reiniciar Bufetes
                </Button>
              </DialogTrigger>
              <DialogContent className="mx-4 sm:mx-0 sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-lg">Reiniciar Bufetes</DialogTitle>
                  <DialogDescription className="text-sm">
                    Restaura las comidas consumidas para permitir nuevas entregas
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-3">
                    <Button
                      onClick={handleResetAllBufetes}
                      disabled={resetting}
                      className="w-full h-11 justify-start bg-transparent"
                      variant="outline"
                    >
                      {resetting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <RotateCcw className="w-4 h-4 mr-2" />
                      )}
                      Reiniciar Todos los Bufetes
                    </Button>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">O por mesa</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Reiniciar por Mesa</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {mesas.map((mesa) => (
                          <Button
                            key={mesa.id}
                            onClick={() => handleResetBufeteByMesa(mesa.numero)}
                            disabled={resetting || !mesa.activa}
                            variant="outline"
                            className="h-11 justify-start"
                          >
                            {resetting ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <UtensilsCrossed className="w-4 h-4 mr-2" />
                            )}
                            Mesa {mesa.numero}
                          </Button>
                        ))}
                      </div>
                      {mesas.some((m) => !m.activa) && (
                        <p className="text-xs text-muted-foreground">* Las mesas inactivas no se pueden reiniciar</p>
                      )}
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="ghost"
                    onClick={() => setIsResetBufetesDialogOpen(false)}
                    disabled={resetting}
                    className="w-full"
                  >
                    Cancelar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {error && (
        <Alert variant="destructive" className="mx-1">
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50 text-green-800 mx-1">
          <AlertDescription className="text-sm">{success}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="w-4 h-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por nombre, identificación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10 h-11"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchTerm("")}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Programa</Label>
              <Select value={selectedPrograma} onValueChange={setSelectedPrograma}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Todos los programas" />
                </SelectTrigger>
                <SelectContent className="max-h-60 w-[var(--radix-select-trigger-width)] min-w-[300px] max-w-[90vw]">
                  <SelectItem value="todos">Todos los programas</SelectItem>
                  {uniquePrograms.map((programa) => (
                    <SelectItem
                      key={programa}
                      value={programa}
                      className="whitespace-normal break-words py-3 px-3 leading-relaxed min-h-[2.5rem] cursor-pointer"
                    >
                      <span className="block text-sm">{programa}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Cupos Extras</Label>
              <Select value={selectedCuposExtras} onValueChange={setSelectedCuposExtras}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="con-extras">Con cupos extras</SelectItem>
                  <SelectItem value="sin-extras">Sin cupos extras</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Acciones</Label>
              <Button
                variant="outline"
                onClick={clearAllFilters}
                disabled={!hasActiveFilters}
                className="w-full h-11 justify-center bg-transparent"
              >
                <X className="w-4 h-4 mr-2" />
                Limpiar Filtros
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="items-per-page" className="text-sm whitespace-nowrap">
                Mostrar:
              </Label>
              <Select
                value={itemsPerPage.toString()}
                onValueChange={(value) => {
                  setItemsPerPage(Number(value))
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="w-20 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {hasActiveFilters && (
              <p className="text-sm text-muted-foreground">
                {filteredPersons.length} de {persons.length} registros
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Registros</CardTitle>
            <Users className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold">{filteredPersons.length}</div>
            {hasActiveFilters && <p className="text-xs text-muted-foreground">de {persons.length} total</p>}
            <p className="text-xs text-muted-foreground mt-1">Estudiantes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Programas</CardTitle>
            <FileSpreadsheet className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold">{new Set(filteredPersons.map((p) => p.programa)).size}</div>
            {hasActiveFilters && (
              <p className="text-xs text-muted-foreground">de {new Set(persons.map((p) => p.programa)).size} total</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Únicos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Cupos Extras</CardTitle>
            <Database className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold">
              {filteredPersons.reduce((sum, p) => sum + (Number(p.cuposExtras) || 0), 0)}
            </div>
            {hasActiveFilters && (
              <p className="text-xs text-muted-foreground">
                de {persons.reduce((sum, p) => sum + (Number(p.cuposExtras) || 0), 0)} total
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Adicionales</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Bufete Disponible</CardTitle>
            <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold">
              {filteredPersons.reduce((sum, p) => sum + 2 + (Number(p.cuposExtras) || 0), 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {filteredPersons.length * 2} base +{" "}
              {filteredPersons.reduce((sum, p) => sum + (Number(p.cuposExtras) || 0), 0)} extras
            </p>
            {hasActiveFilters && (
              <p className="text-xs text-muted-foreground">
                de {persons.reduce((sum, p) => sum + 2 + (Number(p.cuposExtras) || 0), 0)} total
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Database className="w-4 h-4" />
            Registros ({filteredPersons.length})
          </CardTitle>
          <CardDescription className="text-sm">
            {searchTerm ? `Resultados para "${searchTerm}"` : "Registros en el sistema"}
            {filteredPersons.length > 0 && (
              <span className="block sm:inline sm:ml-2">
                Página {currentPage} de {totalPages} • {startIndex + 1}-{Math.min(endIndex, filteredPersons.length)} de{" "}
                {filteredPersons.length}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {currentPersons.length === 0 ? (
            <div className="text-center py-8">
              <Database className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              {searchTerm ? (
                <>
                  <p className="text-muted-foreground">No se encontraron resultados</p>
                  <p className="text-sm text-muted-foreground">Intenta con otros términos</p>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground">No hay registros</p>
                  <p className="text-sm text-muted-foreground">Importa un archivo Excel</p>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {currentPersons.map((person) => (
                  <div key={person.id} className="p-3 sm:p-4 border rounded-lg bg-muted/20 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          #{person.puesto}
                        </span>
                        {person.cuposExtras > 0 && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded font-medium">
                            +{person.cuposExtras} extra{person.cuposExtras !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">{person.identificacion}</span>
                    </div>

                    <div>
                      <p className="font-medium text-sm sm:text-base">{person.nombre}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground break-words">{person.programa}</p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs">
                      <span className="font-medium text-green-600">
                        🎫 {2 + (Number(person.cuposExtras) || 0)} cupos total
                      </span>
                      <span className="text-muted-foreground">
                        (
                        {(Number(person.cuposExtras) || 0) > 0
                          ? `2 base + ${Number(person.cuposExtras) || 0} extra${(Number(person.cuposExtras) || 0) !== 1 ? "s" : ""}`
                          : "2 base"}
                        )
                      </span>
                      {person.fechaImportacion && (
                        <span className="text-muted-foreground">
                          📅 {new Date(person.fechaImportacion).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex flex-col gap-3 mt-6 pt-4 border-t">
                  <div className="text-xs text-center text-muted-foreground">
                    {startIndex + 1} - {Math.min(endIndex, filteredPersons.length)} de {filteredPersons.length}{" "}
                    registros
                  </div>

                  <div className="flex items-center justify-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToFirstPage}
                      disabled={currentPage === 1}
                      className="h-8 w-8 p-0 bg-transparent"
                    >
                      <ChevronsLeft className="h-3 w-3" />
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToPreviousPage}
                      disabled={currentPage === 1}
                      className="h-8 w-8 p-0 bg-transparent"
                    >
                      <ChevronLeft className="h-3 w-3" />
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
                            className="h-8 w-8 p-0 text-xs"
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
                      <ChevronRight className="h-3 w-3" />
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToLastPage}
                      disabled={currentPage === totalPages}
                      className="h-8 w-8 p-0 bg-transparent"
                    >
                      <ChevronsRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
