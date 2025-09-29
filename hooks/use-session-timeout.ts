"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useAuth } from "@/components/auth-provider"

interface UseSessionTimeoutOptions {
  timeoutMinutes?: number
  warningMinutes?: number
}

export function useSessionTimeout({ timeoutMinutes = 30, warningMinutes = 5 }: UseSessionTimeoutOptions = {}) {
  const { user, logout } = useAuth()
  const [showWarning, setShowWarning] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout>()
  const warningRef = useRef<NodeJS.Timeout>()
  const lastActivityRef = useRef<number>(Date.now())

  const resetTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (warningRef.current) clearTimeout(warningRef.current)

    lastActivityRef.current = Date.now()
    setShowWarning(false)

    if (!user) return

    // Timer para mostrar advertencia
    warningRef.current = setTimeout(
      () => {
        setShowWarning(true)
      },
      (timeoutMinutes - warningMinutes) * 60 * 1000,
    )

    // Timer para logout automático
    timeoutRef.current = setTimeout(
      () => {
        logout()
        setShowWarning(false)
      },
      timeoutMinutes * 60 * 1000,
    )
  }, [user, logout, timeoutMinutes, warningMinutes])

  const extendSession = useCallback(() => {
    resetTimers()
  }, [resetTimers])

  const closeWarning = useCallback(() => {
    setShowWarning(false)
  }, [])

  // Detectar actividad del usuario
  useEffect(() => {
    if (!user) return

    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart", "click"]

    const handleActivity = () => {
      const now = Date.now()
      // Solo resetear si han pasado al menos 30 segundos desde la última actividad
      if (now - lastActivityRef.current > 30000) {
        resetTimers()
      }
    }

    events.forEach((event) => {
      document.addEventListener(event, handleActivity, true)
    })

    // Inicializar timers
    resetTimers()

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity, true)
      })
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (warningRef.current) clearTimeout(warningRef.current)
    }
  }, [user, resetTimers])

  return {
    showWarning,
    extendSession,
    closeWarning,
  }
}
