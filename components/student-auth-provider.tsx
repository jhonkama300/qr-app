"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import type { StudentUser } from "@/lib/student-auth-service"

interface StudentAuthContextType {
  student: StudentUser | null
  loading: boolean
  login: (student: StudentUser) => void
  logout: () => void
}

const StudentAuthContext = createContext<StudentAuthContextType>({
  student: null,
  loading: true,
  login: () => {},
  logout: () => {},
})

export const useStudentAuth = () => {
  const context = useContext(StudentAuthContext)
  if (!context) {
    throw new Error("useStudentAuth debe usarse dentro de StudentAuthProvider")
  }
  return context
}

export function StudentAuthProvider({ children }: { children: React.ReactNode }) {
  const [student, setStudent] = useState<StudentUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedStudent = localStorage.getItem("currentStudent")
    if (savedStudent) {
      try {
        const studentData = JSON.parse(savedStudent)
        setStudent(studentData)
      } catch (error) {
        console.error("Error al cargar sesión de estudiante:", error)
        localStorage.removeItem("currentStudent")
      }
    }
    setLoading(false)
  }, [])

  const login = (studentData: StudentUser) => {
    setStudent(studentData)
    localStorage.setItem("currentStudent", JSON.stringify(studentData))
  }

  const logout = () => {
    setStudent(null)
    localStorage.removeItem("currentStudent")
  }

  return (
    <StudentAuthContext.Provider value={{ student, loading, login, logout }}>{children}</StudentAuthContext.Provider>
  )
}
