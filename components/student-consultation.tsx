"use client"

import { useState, useEffect, useMemo } from "react"
import { collection, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Input } from "@/components/ui/input"
import { Search, CreditCard, BookOpen, Loader2, Users, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

const ITEMS_PER_PAGE = 20

interface StudentData {
  id: string
  puesto: string
  identificacion: string
  nombre: string
  programa: string
}

export function StudentConsultation() {
  const [students, setStudents] = useState<StudentData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)

  useEffect(() => {
    loadStudents()
  }, [])

  const loadStudents = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "personas"))
      const studentsData: StudentData[] = []
      querySnapshot.forEach((doc) => {
        const data = doc.data()
        studentsData.push({
          id: doc.id,
          puesto: data.puesto || "",
          identificacion: data.identificacion,
          nombre: data.nombre,
          programa: data.programa,
        })
      })
      setStudents(studentsData)
    } catch (error) {
      console.error("Error al cargar estudiantes:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students
    const query = searchQuery.toLowerCase()
    return students.filter(
      (s) =>
        s.nombre.toLowerCase().includes(query) ||
        s.identificacion.toLowerCase().includes(query) ||
        s.programa.toLowerCase().includes(query) ||
        s.puesto.toLowerCase().includes(query),
    )
  }, [students, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / ITEMS_PER_PAGE))
  const paginatedStudents = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE
    return filteredStudents.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredStudents, page])

  useEffect(() => {
    setPage(1)
  }, [searchQuery])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-purple-600" />
          <p className="text-muted-foreground text-sm">Cargando graduandos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Consulta de Graduandos</h1>
          <p className="text-sm text-muted-foreground">
            {students.length} graduandos registrados
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-200">
          <Users className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-semibold text-purple-700">{students.length}</span>
          <span className="text-xs text-purple-500">Total</span>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Buscar por nombre, identificación, programa o puesto..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Vista de escritorio: tabla */}
      <div className="hidden md:block rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Puesto</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Identificación</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Nombre</th>
                <th className="text-left p-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Programa</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    {searchQuery ? "No se encontraron graduandos con esa búsqueda" : "No hay graduandos registrados"}
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <span className="text-lg font-bold font-mono text-purple-700 bg-purple-50 px-3 py-1.5 rounded-lg inline-block">{student.puesto}</span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="font-mono text-xs">{student.identificacion}</span>
                      </div>
                    </td>
                    <td className="p-3 font-medium">{student.nombre}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs">{student.programa}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vista móvil: tarjetas */}
      <div className="md:hidden space-y-3">
        {paginatedStudents.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground border rounded-xl bg-white">
            <Users className="w-10 h-10 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm">{searchQuery ? "No se encontraron graduandos" : "No hay graduandos registrados"}</p>
          </div>
        ) : (
          paginatedStudents.map((student) => (
            <div key={student.id} className="flex items-stretch gap-0 rounded-xl border bg-white shadow-sm overflow-hidden">
              <div className="flex flex-col items-center justify-center min-w-[68px] bg-purple-50 px-2 py-3">
                <span className="text-xs text-purple-500 font-medium uppercase tracking-wide">Puesto</span>
                <span className="text-2xl font-bold font-mono text-purple-700 leading-none mt-1">{student.puesto}</span>
              </div>
              <div className="flex-1 min-w-0 px-3 py-3 flex flex-col justify-center gap-1.5">
                <p className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2">{student.nombre}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CreditCard className="w-3 h-3 shrink-0" />
                    <span className="font-mono">{student.identificacion}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3 h-3 shrink-0" />
                    <span className="truncate max-w-[140px]">{student.programa}</span>
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground hidden sm:block">
          Mostrando {(page - 1) * ITEMS_PER_PAGE + 1}-{Math.min(page * ITEMS_PER_PAGE, filteredStudents.length)} de {filteredStudents.length}
        </p>
        <div className="flex items-center gap-1 flex-1 sm:flex-none justify-center sm:justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            let p: number
            if (totalPages <= 5) {
              p = i + 1
            } else if (page <= 3) {
              p = i + 1
            } else if (page >= totalPages - 2) {
              p = totalPages - 4 + i
            } else {
              p = page - 2 + i
            }
            return (
              <Button
                key={p}
                variant={p === page ? "default" : "outline"}
                size="sm"
                onClick={() => setPage(p)}
                className={`h-8 min-w-[32px] px-2 text-xs ${p === page ? "bg-purple-600 hover:bg-purple-700" : ""}`}
              >
                {p}
              </Button>
            )
          })}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
