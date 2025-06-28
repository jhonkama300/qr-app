"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { collection, getDocs, doc, writeBatch } from "firebase/firestore"
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

  // Estados para paginación
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  useEffect(() => {
    loadPersons()
  }, [])

  // Filtrar personas cuando cambie el término de búsqueda
  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredPersons(persons)
    } else {
      const filtered = persons.filter(
        (person) =>
          person.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
          person.identificacion.includes(searchTerm) ||
          person.puesto.toLowerCase().includes(searchTerm.toLowerCase()) ||
          person.programa.toLowerCase().includes(searchTerm.toLowerCase()),
      )
      setFilteredPersons(filtered)
    }
    // Resetear a la primera página cuando se filtra
    setCurrentPage(1)
  }, [searchTerm, persons])

  // Calcular datos de paginación
  const totalPages = Math.ceil(filteredPersons.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentPersons = filteredPersons.slice(startIndex, endIndex)

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
      const sortedPersons = personsData.sort((a, b) => a.puesto.localeCompare(b.puesto))
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

      setSuccess(`Se importaron ${previewData.length} registros exitosamente`)
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

  const clearSearch = () => {
    setSearchTerm("")
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
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Base de Datos</h1>
          <p className="text-muted-foreground">Gestiona la base de datos de personas del sistema</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Upload className="w-4 h-4 mr-2" />
                Importar Excel
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Importar Base de Datos desde Excel</DialogTitle>
                <DialogDescription>
                  Selecciona un archivo Excel (.xlsx) con las columnas: Puesto, Identificación, Nombre, Programa, Cupos
                  Extras
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="excel-file">Archivo Excel</Label>
                  <Input
                    id="excel-file"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    disabled={importing}
                  />
                </div>

                {previewData.length > 0 && (
                  <div className="space-y-2">
                    <Label>Vista Previa ({previewData.length} registros)</Label>
                    <div className="max-h-60 overflow-y-auto border rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-2 text-left">Puesto</th>
                            <th className="p-2 text-left">Identificación</th>
                            <th className="p-2 text-left">Nombre</th>
                            <th className="p-2 text-left">Programa</th>
                            <th className="p-2 text-left">Cupos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.slice(0, 10).map((person, index) => (
                            <tr key={index} className="border-t">
                              <td className="p-2">{person.puesto}</td>
                              <td className="p-2">{person.identificacion}</td>
                              <td className="p-2">{person.nombre}</td>
                              <td className="p-2">{person.programa}</td>
                              <td className="p-2">{person.cuposExtras}</td>
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
                <Button onClick={handleImportData} disabled={importing || previewData.length === 0} className="w-full">
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

          <Button variant="destructive" onClick={handleClearDatabase} className="w-full sm:w-auto">
            <Trash2 className="w-4 h-4 mr-2" />
            Limpiar BD
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50 text-green-800">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Barra de búsqueda */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Buscar en Base de Datos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nombre, identificación, puesto o programa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10 h-11"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSearch}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
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
                <SelectTrigger className="w-20">
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
          </div>
          {searchTerm && (
            <p className="text-sm text-muted-foreground mt-2">
              Mostrando {filteredPersons.length} de {persons.length} registros
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Registros</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{persons.length}</div>
            {searchTerm && <p className="text-xs text-muted-foreground">Filtrados: {filteredPersons.length}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Programas Únicos</CardTitle>
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{new Set(persons.map((p) => p.programa)).size}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cupos Extras</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{persons.reduce((sum, p) => sum + p.cuposExtras, 0)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Base de Datos ({filteredPersons.length} registros)
          </CardTitle>
          <CardDescription>
            {searchTerm ? `Resultados de búsqueda para "${searchTerm}"` : "Registros importados en el sistema"}
            {filteredPersons.length > 0 && (
              <span className="ml-2">
                • Página {currentPage} de {totalPages} • Mostrando {startIndex + 1}-
                {Math.min(endIndex, filteredPersons.length)} de {filteredPersons.length}
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
                  <p className="text-muted-foreground">No se encontraron resultados para "{searchTerm}"</p>
                  <p className="text-sm text-muted-foreground">Intenta con otros términos de búsqueda</p>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground">No hay registros en la base de datos</p>
                  <p className="text-sm text-muted-foreground">Importa un archivo Excel para comenzar</p>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {currentPersons.map((person) => (
                  <div
                    key={person.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg bg-muted/20 gap-3"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          {person.puesto}
                        </span>
                        <span className="text-sm text-muted-foreground">{person.identificacion}</span>
                      </div>
                      <p className="font-medium">{person.nombre}</p>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-muted-foreground">
                        <span>{person.programa}</span>
                        <span className="hidden sm:inline">•</span>
                        <span>Cupos extras: {person.cuposExtras}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {startIndex + 1} a {Math.min(endIndex, filteredPersons.length)} de{" "}
                    {filteredPersons.length} registros
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
