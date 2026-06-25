"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useFastQRScanner } from "@/hooks/use-fast-qr-scanner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { useAuth } from "@/components/auth-provider"
import { useStudentStoreContext } from "@/components/providers/student-store-provider"
import { useQ10Validation } from "@/hooks/use-q10-validation"
import {
  CameraIcon,
  Loader2,
  CameraOff,
  CheckCircle,
  XCircle,
  Search,
  User,
  AlertTriangle,
  RefreshCw,
  Utensils,
  Hash,
  QrCode,
  Ticket,
  Clock,
} from "lucide-react"
import { db } from "@/lib/firebase"
import { doc, onSnapshot } from "firebase/firestore"

interface ScanResult {
  identificacion: string
  student: any
  status: "success" | "error" | "no_cupos"
  message: string
  timestamp: string
  source?: "direct" | "q10" | "manual"
}

export function BuffeteScanner() {
  const { user, fullName, activeRole, loading: authLoading } = useAuth()
  const studentStore = useStudentStoreContext()
  const { processQ10Url, isProcessingQ10, q10Message } = useQ10Validation()

  const [isClient, setIsClient] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState("")
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [manualId, setManualId] = useState("")
  const [activeTab, setActiveTab] = useState<"qr" | "manual">("qr")
  const [realtimeStudentData, setRealtimeStudentData] = useState<any>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const manualInputRef = useRef<HTMLInputElement>(null)

  const scanner = useFastQRScanner({
    onQRDetected: (data) => processScanResult(data, "direct"),
    cooldown: 800,
  })

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient) return
    const timer = setTimeout(() => scanner.startCamera(), 500)
    return () => clearTimeout(timer)
  }, [isClient])

  useEffect(() => {
    if (activeTab === "manual" && manualInputRef.current) {
      manualInputRef.current.focus()
    }
  }, [activeTab])

  useEffect(() => {
    if (!scanResult?.identificacion || !showResult) {
      return
    }

    if (typeof scanResult.identificacion !== "string" || scanResult.identificacion.trim() === "") {
      return
    }

    try {
      const studentDocRef = doc(db, "personas", scanResult.identificacion)

      unsubscribeRef.current = onSnapshot(
        studentDocRef,
        (docSnapshot) => {
          if (docSnapshot.exists()) {
            const updatedData = docSnapshot.data()
            setRealtimeStudentData(updatedData)
          }
        },
        (error) => {
          console.error("[v0] Error in realtime listener:", error)
        },
      )
    } catch (error) {
      console.error("[v0] Error setting up realtime listener:", error)
    }

    return () => {
      if (unsubscribeRef.current) {
        try {
          unsubscribeRef.current()
        } catch (error) {
          console.error("[v0] Error cleaning up listener:", error)
        }
        unsubscribeRef.current = null
      }
    }
  }, [scanResult?.identificacion, showResult])

  const processScanResult = useCallback(
    async (scannedContent: string, source: "direct" | "q10" | "manual") => {
      if (processing) {
        return
      }

      setProcessing(true)
      setError("")

      if (
        source !== "q10" &&
        !scannedContent.startsWith("https://site2.q10.com/CertificadosAcademicos/") &&
        !scannedContent.startsWith("https://uparsistemvalledupar.q10.com/CertificadosAcademicos/")
      ) {
        const len = scannedContent.trim().length
        if (len < 3 || len > 10) {
          setError(`La identificación debe tener entre 3 y 10 caracteres. (Ingresaste ${len})`)
          setProcessing(false)
          scanner.resetDetection()
          return
        }
      }

      try {
        if (!user) {
          throw new Error("Usuario no autenticado")
        }

        if (!user.mesaAsignada) {
          setScanResult({
            identificacion: scannedContent,
            student: null,
            status: "error",
            message: "Usuario sin mesa asignada",
            timestamp: new Date().toISOString(),
            source,
          })
          setShowResult(true)
          setProcessing(false)
          scanner.resetDetection()
          return
        }

        if (!studentStore) {
          throw new Error("Store de estudiantes no disponible")
        }

        if (
          scannedContent.startsWith("https://site2.q10.com/CertificadosAcademicos/") ||
          scannedContent.startsWith("https://uparsistemvalledupar.q10.com/CertificadosAcademicos/")
        ) {
          setScanResult({
            identificacion: scannedContent,
            student: null,
            status: "success",
            message: "Procesando certificado Q10...",
            timestamp: new Date().toISOString(),
            source: "q10",
          })
          setShowResult(true)

          try {
            const q10Result = await processQ10Url(scannedContent)

            if (q10Result.success && q10Result.student) {
              const validation = await studentStore.validateMesaAccess(q10Result.identificacion!, user.mesaAsignada)

              if (!validation.valid) {
                if (!validation.noAccessLog) {
                  const userInfo = {
                    userId: user.id,
                    userName: fullName || user.fullName || "Usuario Bufete",
                    userEmail: user.idNumber + "@sistema.com",
                    userRole: activeRole || "bufete",
                    mesaAsignada: user.mesaAsignada,
                  }

                  await studentStore.markStudentAccess(
                    q10Result.identificacion!,
                    false,
                    validation.message,
                    "q10",
                    userInfo,
                  )
                }

                setScanResult({
                  identificacion: q10Result.identificacion!,
                  student: q10Result.student,
                  status: "no_cupos",
                  message: validation.message,
                  timestamp: new Date().toISOString(),
                  source: "q10",
                })
                setShowResult(true)
                setProcessing(false)
                scanner.resetDetection()
                return
              }

              const userInfo = {
                userId: user.id,
                userName: fullName || user.fullName || "Usuario Bufete",
                userEmail: user.idNumber + "@sistema.com",
                userRole: activeRole || "bufete",
                mesaAsignada: user.mesaAsignada,
              }

              await studentStore.markStudentAccess(
                q10Result.identificacion!,
                true,
                `Comida entregada en Mesa ${user.mesaAsignada}`,
                "q10",
                userInfo,
              )

              await new Promise((resolve) => setTimeout(resolve, 500))
              const updatedStudent = await studentStore.getStudentById(q10Result.identificacion!)

              setScanResult({
                identificacion: q10Result.identificacion!,
                student: updatedStudent || q10Result.student,
                status: "success",
                message: validation.message,
                timestamp: new Date().toISOString(),
                source: "q10",
              })
            } else {
              setScanResult({
                identificacion: q10Result.identificacion || scannedContent,
                student: null,
                status: q10Result.type as "denied" | "error",
                message: q10Result.message,
                timestamp: new Date().toISOString(),
                source: "q10",
              })
            }
            setShowResult(true)
            setProcessing(false)
            scanner.resetDetection()
            return
          } catch (q10Error) {
            setScanResult({
              identificacion: scannedContent,
              student: null,
              status: "error",
              message: "Error al procesar certificado Q10",
              timestamp: new Date().toISOString(),
              source: "q10",
            })
            setShowResult(true)
            setProcessing(false)
            scanner.resetDetection()
            return
          }
        }

        const identificacion = scannedContent

        const validation = await studentStore.validateMesaAccess(identificacion, user.mesaAsignada)

        if (!validation.valid) {
          if (!validation.noAccessLog) {
            const userInfo = {
              userId: user.id,
              userName: fullName || user.fullName || "Usuario Bufete",
              userEmail: user.idNumber + "@sistema.com",
              userRole: activeRole || "bufete",
              mesaAsignada: user.mesaAsignada,
            }

            await studentStore.markStudentAccess(identificacion, false, validation.message, source, userInfo)
          }

          setScanResult({
            identificacion,
            student: null,
            status: "no_cupos",
            message: validation.message,
            timestamp: new Date().toISOString(),
            source,
          })
          setShowResult(true)
          setProcessing(false)
          scanner.resetDetection()
          return
        }

        const student = await studentStore.getStudentById(identificacion)

        if (!student) {
          setScanResult({
            identificacion,
            student: null,
            status: "error",
            message: "Estudiante no encontrado en la base de datos",
            timestamp: new Date().toISOString(),
            source,
          })
          setShowResult(true)
          setProcessing(false)
          scanner.resetDetection()
          return
        }

        const userInfo = {
          userId: user.id,
          userName: fullName || user.fullName || "Usuario Bufete",
          userEmail: user.idNumber + "@sistema.com",
          userRole: activeRole || "bufete",
          mesaAsignada: user.mesaAsignada,
        }

        await studentStore.markStudentAccess(
          identificacion,
          true,
          `Comida entregada en Mesa ${user.mesaAsignada}`,
          source === "q10" ? "q10" : "manual",
          userInfo,
        )

        await new Promise((resolve) => setTimeout(resolve, 500))
        const updatedStudent = await studentStore.getStudentById(identificacion)

        setScanResult({
          identificacion,
          student: updatedStudent || student,
          status: "success",
          message: validation.message,
          timestamp: new Date().toISOString(),
          source,
        })
        setShowResult(true)
        setProcessing(false)
        scanner.resetDetection()
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido al procesar el acceso"
        setScanResult({
          identificacion: scannedContent,
          student: null,
          status: "error",
          message: errorMessage,
          timestamp: new Date().toISOString(),
          source,
        })
        setShowResult(true)
      } finally {
        setProcessing(false)
      }
    },
    [processing, user, studentStore, fullName, activeRole, processQ10Url],
  )

  const resetScanner = () => {
    if (unsubscribeRef.current) {
      try {
        unsubscribeRef.current()
      } catch (error) {
        console.error("[v0] Error cleaning up listener:", error)
      }
      unsubscribeRef.current = null
    }
    setScanResult(null)
    setRealtimeStudentData(null)
    setShowResult(false)
    setError("")
    setManualId("")
    setProcessing(false)
    scanner.resetDetection()
  }

  const handleModalClose = (open: boolean) => {
    setShowResult(open)
    if (!open) {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
      setScanResult(null)
      setRealtimeStudentData(null)
      setProcessing(false)
      scanner.resetDetection()
    }
  }

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <Loader2 className="text-amber-600 mb-4 size-12 animate-spin" />
        <p className="text-muted-foreground">Cargando autenticación...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center p-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>No se pudo cargar la información del usuario</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (activeRole !== "bufete") {
    return (
      <div className="flex items-center justify-center p-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Esta funcionalidad solo está disponible para usuarios con rol "Bufete"</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!isClient) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <Loader2 className="text-amber-600 mb-4 size-12 animate-spin" />
        <p className="text-muted-foreground">Cargando escáner...</p>
      </div>
    )
  }

  if (scanner.permissionDenied && activeTab === "qr") {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <CameraOff className="text-amber-600 mb-6 size-16" />
        <h3 className="text-xl font-bold text-amber-900">Entrega de Comida</h3>
        <p className="text-sm text-amber-700 mt-1">Mesa {user?.mesaAsignada || "N/A"}</p>
        <p className="text-sm text-muted-foreground mt-3">Se necesita acceso a la cámara para escanear códigos QR</p>
        <Button onClick={() => scanner.startCamera()} className="mt-4 bg-amber-600 hover:bg-amber-700 text-white">
          <CameraIcon className="w-4 h-4 mr-2" />
          Permitir cámara
        </Button>
      </div>
    )
  }

  const displayStudent = realtimeStudentData || scanResult?.student
  const cuposDisponibles = displayStudent
    ? 2 + (displayStudent.cuposExtras || 0) - (displayStudent.cuposConsumidos || 0)
    : 0

  return (
    <div className="flex flex-1 flex-col gap-2 md:gap-4 p-2 md:p-4 bg-gradient-to-br from-amber-50/50 via-white to-orange-50/30">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="flex size-8 md:size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-600 to-orange-500 shadow-md shadow-amber-600/20">
            <Utensils className="size-4 md:size-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm md:text-lg font-bold leading-tight text-amber-900">Entrega de Comida</h1>
            <p className="text-[10px] md:text-xs text-amber-600/70 leading-tight">
              Mesa {user?.mesaAsignada || "N/A"} · Escanea QR o ingresa ID
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] md:text-xs">
            <Utensils className="w-3 h-3 mr-1" />
            Mesa {user?.mesaAsignada || "N/A"}
          </Badge>
        </div>
      </div>

      {(error || scanner.error) && activeTab === "qr" && (
        <div className="flex items-center gap-2 p-2 md:p-3 rounded-lg bg-red-50 border border-red-200">
          <AlertTriangle className="size-3 md:size-4 text-red-600 shrink-0" />
          <p className="text-[11px] md:text-sm text-red-700">{error || scanner.error}</p>
        </div>
      )}

      {/* Mobile Mode Tabs */}
      <div className="flex lg:hidden rounded-xl overflow-hidden border border-amber-200 bg-white/50 p-0.5">
        <button
          onClick={() => setActiveTab("qr")}
          className={`flex-1 py-2 md:py-2.5 text-[10px] md:text-xs font-medium rounded-lg transition-all ${
            activeTab === "qr"
              ? "bg-amber-600 text-white shadow-sm shadow-amber-600/30"
              : "text-amber-600/70 hover:text-amber-700"
          }`}
        >
          <CameraIcon className="size-3 md:size-3.5 inline mr-1 -mt-0.5" />
          Escanear QR
        </button>
        <button
          onClick={() => setActiveTab("manual")}
          className={`flex-1 py-2 md:py-2.5 text-[10px] md:text-xs font-medium rounded-lg transition-all ${
            activeTab === "manual"
              ? "bg-amber-600 text-white shadow-sm shadow-amber-600/30"
              : "text-amber-600/70 hover:text-amber-700"
          }`}
        >
          <Hash className="size-3 md:size-3.5 inline mr-1 -mt-0.5" />
          Ingreso Manual
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0">
        <div className="h-full lg:grid lg:grid-cols-3 lg:gap-4">
          {/* Scanner column */}
          <div className={`relative rounded-xl overflow-hidden bg-black shadow-lg border border-white/10
            lg:col-span-2
            max-lg:h-[calc(100vh-220px)]
            ${activeTab !== "qr" ? "max-lg:hidden" : ""}
          `}>
            <video
              ref={scanner.videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
            <canvas ref={scanner.canvasRef} className="hidden" />
            {scanner.cameraLoading && !scanner.isScanning && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  <p className="text-amber-400 text-sm font-medium">Iniciando cámara...</p>
                </div>
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-[85%] max-w-[320px] aspect-[4/3]">
                <div className="absolute inset-0 rounded-xl border-2 border-amber-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]" />
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-amber-300 rounded-tl" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-amber-300 rounded-tr" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-amber-300 rounded-bl" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-amber-300 rounded-br" />
                <div className="absolute top-1/2 left-[8%] right-[8%] h-[1.5px] bg-amber-300/80 animate-scan shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 max-lg:p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`size-2 rounded-full ${scanner.isDetecting ? "bg-green-400 animate-ping" : processing || isProcessingQ10 ? "bg-yellow-400 animate-pulse" : "bg-amber-400 animate-pulse"}`} />
                  <span className="text-sm max-lg:text-[11px] text-white/90">
                    {scanner.isDetecting ? "QR Detectado" : processing ? "Procesando..." : isProcessingQ10 ? "Procesando Q10..." : "Escaneando..."}
                  </span>
                </div>
                <span className="text-xs max-lg:text-[10px] text-white/50">Apunta al código QR</span>
              </div>
            </div>
          </div>

          {/* Manual - desktop only */}
          <div className="hidden lg:block rounded-xl border border-amber-200 bg-white/80 backdrop-blur-xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex size-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <Search className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold leading-tight">Ingreso Manual</h3>
                <p className="text-xs text-muted-foreground leading-tight">Escribe la identificación</p>
              </div>
            </div>

            {error && activeTab === "manual" && (
              <div className="flex items-center gap-1.5 p-2 mb-3 rounded-lg bg-red-50 border border-red-200">
                <AlertTriangle className="size-3.5 text-red-600 shrink-0" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            <div className="space-y-3">
              <Input
                id="manual-id"
                type="text"
                placeholder="Número de identificación"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && manualId.trim() && !processing && !isProcessingQ10) {
                    const id = manualId.trim()
                    if (id.length >= 3 && id.length <= 10) {
                      processScanResult(id, "manual")
                      setManualId("")
                    }
                  }
                }}
                disabled={processing || isProcessingQ10}
                className="h-11 text-base border-amber-200 focus-visible:ring-amber-500"
              />
              <Button
                onClick={() => {
                  const id = manualId.trim()
                  if (!id) return
                  if (id.length < 3 || id.length > 10) {
                    setError(`La identificación debe tener entre 3 y 10 caracteres. (Ingresaste ${id.length})`)
                    return
                  }
                  processScanResult(id, "manual")
                  setManualId("")
                }}
                disabled={processing || isProcessingQ10 || !manualId.trim()}
                className="w-full h-11 text-sm bg-amber-600 hover:bg-amber-700 text-white"
              >
                {processing || isProcessingQ10 ? (
                  <><Loader2 className="mr-2 size-4 animate-spin" /> Procesando...</>
                ) : (
                  <><Search className="mr-2 size-4" /> Validar</>
                )}
              </Button>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-amber-50/50 border border-amber-100">
              <p className="text-xs text-amber-700 leading-tight">
                <span className="font-semibold">Tip:</span> Verifica el documento de identidad del estudiante antes de ingresar el número.
              </p>
            </div>

            {scanner.permissionDenied && (
              <Button onClick={() => scanner.startCamera()} variant="outline" className="w-full mt-3 h-11 text-sm border-amber-300 text-amber-700 hover:bg-amber-50">
                <CameraIcon className="mr-2 size-4" />
                Reintentar cámara
              </Button>
            )}
          </div>

          {/* Manual - mobile only */}
          {activeTab === "manual" && (
            <div className="lg:hidden rounded-xl border border-amber-200 bg-white/80 backdrop-blur-xl shadow-sm p-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex size-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                  <Search className="size-3.5" />
                </div>
                <div>
                  <h3 className="text-[11px] font-semibold leading-tight">Ingreso Manual</h3>
                  <p className="text-[9px] text-muted-foreground leading-tight">Escribe la identificación</p>
                </div>
              </div>

              {error && activeTab === "manual" && (
                <div className="flex items-center gap-1.5 p-1.5 mb-2 rounded-lg bg-red-50 border border-red-200">
                  <AlertTriangle className="size-3 text-red-600 shrink-0" />
                  <p className="text-[10px] text-red-700">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <Input
                  id="manual-id-mobile"
                  type="text"
                  placeholder="Número de identificación"
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && manualId.trim() && !processing && !isProcessingQ10) {
                      const id = manualId.trim()
                      if (id.length >= 3 && id.length <= 10) {
                        processScanResult(id, "manual")
                        setManualId("")
                      }
                    }
                  }}
                  disabled={processing || isProcessingQ10}
                  className="h-10 text-sm border-amber-200 focus-visible:ring-amber-500"
                />
                <Button
                  onClick={() => {
                    const id = manualId.trim()
                    if (!id) return
                    if (id.length < 3 || id.length > 10) {
                      setError(`La identificación debe tener entre 3 y 10 caracteres. (Ingresaste ${id.length})`)
                      return
                    }
                    processScanResult(id, "manual")
                    setManualId("")
                  }}
                  disabled={processing || isProcessingQ10 || !manualId.trim()}
                  className="w-full h-10 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {processing || isProcessingQ10 ? (
                    <><Loader2 className="mr-1.5 size-3.5 animate-spin" /> Procesando...</>
                  ) : (
                    <><Search className="mr-1.5 size-3.5" /> Validar</>
                  )}
                </Button>
              </div>

              <div className="mt-3 p-2 rounded-lg bg-amber-50/50 border border-amber-100">
                <p className="text-[9px] text-amber-700 leading-tight">
                  <span className="font-semibold">Tip:</span> Verifica el documento de identidad del estudiante.
                </p>
              </div>

              {scanner.permissionDenied && (
                <Button onClick={() => scanner.startCamera()} variant="outline" className="w-full mt-2 h-10 text-xs border-amber-300 text-amber-700 hover:bg-amber-50">
                  <CameraIcon className="mr-1.5 size-3.5" />
                  Reintentar cámara
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Result Dialog */}
      <Dialog open={showResult} onOpenChange={handleModalClose}>
        <DialogContent className="sm:max-w-md !rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm md:text-base">
              {scanResult?.status === "success" && <CheckCircle className="size-5 text-amber-600" />}
              {scanResult?.status === "no_cupos" && <XCircle className="size-5 text-red-600" />}
              {scanResult?.status === "error" && <AlertTriangle className="size-5 text-orange-600" />}
              Resultado
              {realtimeStudentData && (
                <Badge variant="outline" className="ml-auto bg-amber-50 text-amber-700 border-amber-200 animate-pulse text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  En vivo
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {scanResult && (
              <>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                  <User className="size-3.5 md:size-4 text-muted-foreground shrink-0" />
                  <span className="text-[11px] md:text-sm font-medium">ID:</span>
                  <Badge variant="secondary" className="text-[10px] md:text-xs font-mono">
                    {scanResult.identificacion}
                  </Badge>
                </div>

                {scanResult.status === "success" && displayStudent && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/80 overflow-hidden">
                    <div className="bg-amber-600 p-2.5 md:p-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="size-4 md:size-5 text-white" />
                        <p className="text-[11px] md:text-sm font-semibold text-white">Comida Entregada Exitosamente</p>
                      </div>
                    </div>
                    <div className="p-3 md:p-4 space-y-2">
                      <div className="grid grid-cols-2 gap-2 md:gap-3">
                        <div>
                          <p className="text-[9px] md:text-xs text-muted-foreground">Nombre</p>
                          <p className="text-[11px] md:text-sm font-medium truncate">{displayStudent.nombre}</p>
                        </div>
                        <div>
                          <p className="text-[9px] md:text-xs text-muted-foreground">Programa</p>
                          <p className="text-[11px] md:text-sm font-medium truncate">{displayStudent.programa}</p>
                        </div>
                        {displayStudent.puesto && (
                          <div>
                            <p className="text-[9px] md:text-xs text-muted-foreground">Puesto</p>
                            <p className="text-[11px] md:text-sm font-medium">{displayStudent.puesto}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-[9px] md:text-xs text-muted-foreground">Mesa</p>
                          <Badge className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs">Mesa {user.mesaAsignada}</Badge>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-3 border border-amber-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Ticket className="w-3.5 h-3.5 text-amber-600" />
                            <span className="text-xs md:text-sm font-semibold text-gray-700">Cupos Disponibles</span>
                          </div>
                          <span className="text-xl md:text-2xl font-bold text-amber-600">{cuposDisponibles}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 text-[10px] md:text-xs">
                          <div className="bg-gray-50 rounded p-1.5">
                            <p className="text-gray-600">Total</p>
                            <p className="font-bold text-gray-900 text-sm">{2 + (displayStudent.cuposExtras || 0)}</p>
                          </div>
                          <div className="bg-orange-50 rounded p-1.5">
                            <p className="text-orange-600">Consumidos</p>
                            <p className="font-bold text-orange-700 text-sm">{displayStudent.cuposConsumidos || 0}</p>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                          <div
                            className="bg-gradient-to-r from-amber-500 to-orange-500 h-1.5 rounded-full transition-all duration-500"
                            style={{
                              width: `${(cuposDisponibles / (2 + (displayStudent.cuposExtras || 0))) * 100}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="text-[10px] md:text-xs text-amber-700 bg-amber-100 p-2 rounded-lg font-medium text-center">
                        {scanResult.message}
                        {scanResult.source === "q10" && (
                          <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                            Q10
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {scanResult.status === "no_cupos" && (
                  <div className="flex items-center gap-2 p-2 md:p-3 rounded-lg bg-red-50 border border-red-200">
                    <XCircle className="size-3.5 md:size-4 text-red-600 shrink-0" />
                    <p className="text-[11px] md:text-sm text-red-800">{scanResult.message}</p>
                  </div>
                )}

                {scanResult.status === "error" && (
                  <div className="flex items-center gap-2 p-2 md:p-3 rounded-lg bg-orange-50 border border-orange-200">
                    <AlertTriangle className="size-3.5 md:size-4 text-orange-600 shrink-0" />
                    <p className="text-[11px] md:text-sm text-orange-800">{scanResult.message}</p>
                  </div>
                )}

                <p className="text-[9px] md:text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                  <Clock className="w-3 h-3" />
                  Procesado el {new Date(scanResult.timestamp).toLocaleString()}
                </p>
              </>
            )}
          </div>

          <div className="flex gap-2 mt-1">
            <Button onClick={resetScanner} className="flex-1 h-9 md:h-10 text-xs md:text-sm bg-amber-600 hover:bg-amber-700 text-white">
              <RefreshCw className="size-3.5 md:size-4 mr-1.5" />
              Procesar Otro
            </Button>
            <Button variant="outline" onClick={() => handleModalClose(false)} className="h-9 md:h-10 text-xs md:text-sm">
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
