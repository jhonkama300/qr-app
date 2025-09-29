"use client"

import type React from "react"

import { useSessionTimeout } from "@/hooks/use-session-timeout"
import { SessionTimeoutModal } from "@/components/session-timeout-modal"

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { showWarning, extendSession, closeWarning } = useSessionTimeout({
    timeoutMinutes: 30, // 30 minutos de inactividad
    warningMinutes: 5, // Advertir 5 minutos antes
  })

  return (
    <>
      {children}
      <SessionTimeoutModal isOpen={showWarning} onClose={closeWarning} onExtendSession={extendSession} />
    </>
  )
}
