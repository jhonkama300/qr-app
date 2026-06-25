"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useFastQRScanner } from "@/hooks/use-fast-qr-scanner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  CameraIcon,
  Loader2Icon,
  CheckCircle,
  XCircle,
  User,
  AlertTriangle,
  Keyboard,
  Search,
  RefreshCw,
} from "lucide-react"
import { useStudentStoreContext } from "@/components/providers/student-store-provider"
import { useQ10Validation } from "@/hooks/use-q10-validation"
import { useAuth } from "@/components/auth-provider"

interface ScanResultDisplay {
  type: "success" | "denied" | "error" | "info" | "already_scanned"
  identificacion: string
  person?: any
  message: string
  source?: "direct" | "q10" | "manual"
  timestamp: string
}

export function BarcodeScanner() {
  const { getStudentById, markStudentAccess, checkIfAlreadyScanned } = useStudentStoreContext()
  const { processQ10Url, isProcessingQ10, q10Message } = useQ10Validation()
  const { user, fullName, activeRole } = useAuth()

  const [isClient, setIsClient] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scanResultDisplay, setScanResultDisplay] = useState<ScanResultDisplay | null>(null)
  const [manualIdInput, setManualIdInput] = useState<string>("")
  const [isManualProcessing, setIsManualProcessing] = useState(false)
  const [manualInputError, setManualInputError] = useState<string | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [scanMode, setScanMode] = useState<"qr" | "manual">("qr")

  const router = useRouter()

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

  const processScanResult = useCallback(
    async (scannedContent: string, source: "direct" | "q10" | "manual") => {
      const now = Date.now()

      if (isScanning) {
        return
      }

      setIsScanning(true)

      if (
        source !== "q10" &&
        !scannedContent.startsWith("https://site2.q10.com/CertificadosAcademicos/") &&
        !scannedContent.startsWith("https://uparsistemvalledupar.q10.com/CertificadosAcademicos/")
      ) {
        const trimmed = scannedContent.trim()
        const len = trimmed.length
        const isNumeric = /^\d+$/.test(trimmed)

        if (source === "direct") {
          if (!isNumeric) {
            setScanResultDisplay({
              type: "error",
              identificacion: scannedContent,
              message: `El código QR no contiene un número de identificación válido. Asegúrate de escanear el QR correcto.`,
              source: source,
              timestamp: new Date().toISOString(),
            })
            setShowResult(true)
            setIsScanning(false)
            scanner.resetDetection()
            return
          }
          if (len < 7 || len > 10) {
            setScanResultDisplay({
              type: "error",
              identificacion: scannedContent,
              message: `La identificación debe tener entre 7 y 10 caracteres. (Escaneaste ${len})`,
              source: source,
              timestamp: new Date().toISOString(),
            })
            setShowResult(true)
            setIsScanning(false)
            scanner.resetDetection()
            return
          }
        }

        if (len < 3 || len > 10) {
          setScanResultDisplay({
            type: "error",
            identificacion: scannedContent,
            message: `La identificación debe tener entre 3 y 10 caracteres. (Ingresaste ${len})`,
            source: source,
            timestamp: new Date().toISOString(),
          })
          setShowResult(true)
          setIsScanning(false)
          scanner.resetDetection()
          return
        }
      }

      let currentScanResult: ScanResultDisplay

      const userInfo = user
        ? {
            userId: user.id,
            userName: fullName || user.email || "Usuario",
            userEmail: user.email || undefined,
            userRole: activeRole || "Usuario",
          }
        : undefined

      if (
        scannedContent.startsWith("https://site2.q10.com/CertificadosAcademicos/") ||
        scannedContent.startsWith("https://uparsistemvalledupar.q10.com/CertificadosAcademicos/")
      ) {
        currentScanResult = {
          type: "info",
          identificacion: scannedContent,
          message: "Procesando certificado Q10...",
          source: "q10",
          timestamp: new Date().toISOString(),
        }
        setScanResultDisplay(currentScanResult)
        setShowResult(true)

        const q10Result = await processQ10Url(scannedContent)

        if (q10Result.success && q10Result.student) {
          const alreadyScanned = await checkIfAlreadyScanned(q10Result.identificacion!)

          if (alreadyScanned) {
            currentScanResult = {
              type: "already_scanned",
              identificacion: q10Result.identificacion!,
              person: q10Result.student,
              message: `Este código ya fue escaneado anteriormente. Mostrando información del estudiante.`,
              source: "q10",
              timestamp: new Date().toISOString(),
            }
            setScanResultDisplay(currentScanResult)
            setShowResult(true)
            setIsScanning(false)
            scanner.resetDetection()
            return
          }

          await markStudentAccess(q10Result.identificacion!, true, "Acceso concedido al evento", "q10", userInfo)
          currentScanResult = {
            type: "success",
            identificacion: q10Result.identificacion!,
            person: q10Result.student,
            message: q10Result.message,
            source: "q10",
            timestamp: new Date().toISOString(),
          }
        } else {
          currentScanResult = {
            type: q10Result.type as "denied" | "error",
            identificacion: q10Result.identificacion || scannedContent,
            message: q10Result.message,
            source: "q10",
            timestamp: new Date().toISOString(),
          }
        }

        setScanResultDisplay(currentScanResult)
        setShowResult(true)
        setIsScanning(false)
        scanner.resetDetection()
        return
      } else {
        const alreadyScanned = await checkIfAlreadyScanned(scannedContent)

        if (alreadyScanned) {
          const student = await getStudentById(scannedContent)
          currentScanResult = {
            type: "already_scanned",
            identificacion: scannedContent,
            person: student,
            message: student
              ? `Este código ya fue escaneado anteriormente. Mostrando información del estudiante.`
              : `Este código ya fue escaneado anteriormente. No se encontró información adicional.`,
            source: source,
            timestamp: new Date().toISOString(),
          }
          setScanResultDisplay(currentScanResult)
          setShowResult(true)
          setIsScanning(false)
          scanner.resetDetection()
          return
        }

        const student = await getStudentById(scannedContent)
        if (student) {
          await markStudentAccess(scannedContent, true, "Acceso concedido al evento", source, userInfo)
          currentScanResult = {
            type: "success",
            identificacion: scannedContent,
            person: student,
            message: `Acceso concedido al evento para ${student.nombre}.`,
            source: source,
            timestamp: new Date().toISOString(),
          }
        } else {
          await markStudentAccess(scannedContent, false, "Persona no encontrada", source, userInfo)
          currentScanResult = {
            type: "denied",
            identificacion: scannedContent,
            message: `Identificación ${scannedContent} no encontrada en la base de datos.`,
            source: source,
            timestamp: new Date().toISOString(),
          }
        }
      }

      setScanResultDisplay(currentScanResult)
      setShowResult(true)
      setIsScanning(false)
      scanner.resetDetection()
    },
    [getStudentById, markStudentAccess, processQ10Url, user, checkIfAlreadyScanned, isScanning, fullName, activeRole],
  )

  const handleManualSubmit = async () => {
    const id = manualIdInput.trim()
    if (!id) {
      setManualInputError("Por favor, ingresa una identificación.")
      return
    }

    if (id.length < 3 || id.length > 10) {
      setManualInputError(`La identificación debe tener entre 3 y 10 caracteres. (Ingresaste ${id.length})`)
      return
    }

    setIsManualProcessing(true)
    setManualInputError(null)
    setScanResultDisplay({
      type: "info",
      identificacion: manualIdInput,
      message: "Validando identificación manual...",
      timestamp: new Date().toISOString(),
    })
    setShowResult(true)
    setError(null)

    try {
      await processScanResult(manualIdInput.trim(), "manual")
    } catch (err) {
      setScanResultDisplay({
        type: "error",
        identificacion: manualIdInput,
        message: "Error al validar la identificación manual.",
        timestamp: new Date().toISOString(),
      })
      setShowResult(true)
    } finally {
      setIsManualProcessing(false)
      setManualIdInput("")
    }
  }

  const resetScanner = () => {
    setScanResultDisplay(null)
    setShowResult(false)
    setError(null)
    setManualIdInput("")
    setManualInputError(null)
    setIsScanning(false)
    scanner.resetDetection()
  }

  const handleModalClose = (open: boolean) => {
    setShowResult(open)
    if (!open) {
      setScanResultDisplay(null)
      setIsScanning(false)
      scanner.resetDetection()
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-2 md:gap-4 p-2 md:p-4 bg-gradient-to-br from-uparsistem-50/50 via-white to-uparsistem-100/30 dark:from-gray-950 dark:via-gray-900 dark:to-uparsistem-950/20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="flex size-8 md:size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-uparsistem-600 to-uparsistem-500 shadow-md shadow-uparsistem-600/20">
            <CameraIcon className="size-4 md:size-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm md:text-lg font-bold leading-tight text-uparsistem-800 dark:text-uparsistem-200">Control de Acceso</h1>
            <p className="text-[10px] md:text-xs text-uparsistem-600/70 dark:text-uparsistem-400/70 leading-tight">
              {activeRole === "bufete" ? "Entrega de Comida · Escanea el QR" : activeRole === "operativo" ? "Control de Ingreso · Escanea el QR" : "Administración · Escanea el QR"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          <span className="hidden md:inline text-[10px] md:text-xs text-uparsistem-600/70 dark:text-uparsistem-400/70 truncate max-w-[100px]">
            {fullName || ""}
          </span>
          <div className="flex size-7 md:size-8 items-center justify-center rounded-full bg-gradient-to-br from-uparsistem-600 to-uparsistem-500 text-white text-[10px] md:text-xs font-bold shadow-md shadow-uparsistem-600/20 shrink-0">
            {(fullName || "U")[0].toUpperCase()}
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-2 md:p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
          <AlertTriangle className="size-3 md:size-4 text-red-600 shrink-0" />
          <p className="text-[11px] md:text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {scanner.error && scanner.error !== error && (
        <div className="flex items-center gap-2 p-2 md:p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
          <AlertTriangle className="size-3 md:size-4 text-red-600 shrink-0" />
          <p className="text-[11px] md:text-sm text-red-700 dark:text-red-400">{scanner.error}</p>
        </div>
      )}

      {/* Mobile Mode Tabs */}
      <div className="flex lg:hidden rounded-xl overflow-hidden border border-uparsistem-200 dark:border-uparsistem-800/30 bg-white/50 dark:bg-gray-900/50 p-0.5">
        <button
          onClick={() => setScanMode("qr")}
          className={`flex-1 py-2 md:py-2.5 text-[10px] md:text-xs font-medium rounded-lg transition-all ${
            scanMode === "qr"
              ? "bg-uparsistem-600 text-white shadow-sm shadow-uparsistem-600/30"
              : "text-uparsistem-600/70 dark:text-uparsistem-400/70 hover:text-uparsistem-700 dark:hover:text-uparsistem-300"
          }`}
        >
          <CameraIcon className="size-3 md:size-3.5 inline mr-1 -mt-0.5" />
          Escanear QR
        </button>
        <button
          onClick={() => setScanMode("manual")}
          className={`flex-1 py-2 md:py-2.5 text-[10px] md:text-xs font-medium rounded-lg transition-all ${
            scanMode === "manual"
              ? "bg-uparsistem-600 text-white shadow-sm shadow-uparsistem-600/30"
              : "text-uparsistem-600/70 dark:text-uparsistem-400/70 hover:text-uparsistem-700 dark:hover:text-uparsistem-300"
          }`}
        >
          <Search className="size-3 md:size-3.5 inline mr-1 -mt-0.5" />
          Ingreso Manual
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0">
          <div className="h-full lg:grid lg:grid-cols-3 lg:gap-4">
          {/* Scanner column - full width on mobile when active, col-span-2 on desktop */}
          <div className={`relative rounded-xl overflow-hidden bg-black shadow-lg border border-white/10
            lg:col-span-2
            max-lg:h-[calc(100vh-220px)]
            ${scanMode !== "qr" ? "max-lg:hidden" : ""}
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
                  <div className="w-8 h-8 border-3 border-uparsistem-400 border-t-transparent rounded-full animate-spin" />
                  <p className="text-uparsistem-400 text-sm font-medium">Iniciando cámara...</p>
                </div>
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-[85%] max-w-[320px] aspect-[4/3]">
                <div className="absolute inset-0 rounded-xl border-2 border-uparsistem-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]" />
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-uparsistem-300 rounded-tl" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-uparsistem-300 rounded-tr" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-uparsistem-300 rounded-bl" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-uparsistem-300 rounded-br" />
                <div className="absolute top-1/2 left-[8%] right-[8%] h-[1.5px] bg-uparsistem-300/80 animate-scan shadow-[0_0_8px_rgba(168,207,69,0.5)]" />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 max-lg:p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`size-2 rounded-full ${scanner.isDetecting ? "bg-green-400 animate-ping" : isScanning ? "bg-yellow-400 animate-pulse" : scanner.cameraLoading ? "bg-uparsistem-400 animate-pulse" : "bg-uparsistem-400 animate-pulse"}`} />
                  <span className="text-sm max-lg:text-[11px] text-white/90">
                    {scanner.isDetecting ? "QR Detectado" : isScanning ? "Procesando..." : scanner.cameraLoading ? "Iniciando..." : "Escaneando..."}
                  </span>
                </div>
                <span className="text-xs max-lg:text-[10px] text-white/50">Apunta al código QR</span>
              </div>
            </div>
          </div>

          {/* Manual - desktop only */}
          <div className="hidden lg:block rounded-xl border border-uparsistem-200 dark:border-uparsistem-800/30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex size-8 items-center justify-center rounded-lg bg-uparsistem-100 dark:bg-uparsistem-900/30 text-uparsistem-700 dark:text-uparsistem-300">
                <Search className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold leading-tight">Ingreso Manual</h3>
                <p className="text-xs text-muted-foreground leading-tight">Escribe la identificación</p>
              </div>
            </div>

            {manualInputError && (
              <div className="flex items-center gap-1.5 p-2 mb-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                <AlertTriangle className="size-3.5 text-red-600 shrink-0" />
                <p className="text-xs text-red-700 dark:text-red-400">{manualInputError}</p>
              </div>
            )}

            <div className="space-y-3">
              <Input
                id="manual-id"
                type="text"
                placeholder="Número de identificación"
                value={manualIdInput}
                onChange={(e) => setManualIdInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && manualIdInput.trim() && !isManualProcessing && !isProcessingQ10) {
                    handleManualSubmit()
                  }
                }}
                disabled={isManualProcessing || isProcessingQ10}
                className="h-11 text-base border-uparsistem-200 dark:border-uparsistem-800 focus-visible:ring-uparsistem-500"
              />
              <Button
                onClick={handleManualSubmit}
                disabled={isManualProcessing || isProcessingQ10 || !manualIdInput.trim()}
                className="w-full h-11 text-sm bg-uparsistem-600 hover:bg-uparsistem-700 text-white"
              >
                {isManualProcessing ? (
                  <><Loader2Icon className="mr-2 size-4 animate-spin" /> Validando...</>
                ) : (
                  <><Search className="mr-2 size-4" /> Validar</>
                )}
              </Button>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-uparsistem-50/50 dark:bg-uparsistem-950/10 border border-uparsistem-100 dark:border-uparsistem-900/20">
              <p className="text-xs text-uparsistem-700 dark:text-uparsistem-300 leading-tight">
                <span className="font-semibold">Tip:</span> Verifica el documento de identidad del estudiante antes de ingresar el número manualmente.
              </p>
            </div>

            {scanner.permissionDenied && (
              <Button
                onClick={() => scanner.startCamera()}
                variant="outline"
                className="w-full mt-3 h-11 text-sm border-uparsistem-300 text-uparsistem-700 hover:bg-uparsistem-50"
              >
                <CameraIcon className="mr-2 size-4" />
                Reintentar cámara
              </Button>
            )}
          </div>

          {/* Manual - mobile only */}
          {scanMode === "manual" && (
            <div className="lg:hidden rounded-xl border border-uparsistem-200 dark:border-uparsistem-800/30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl shadow-sm p-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex size-7 items-center justify-center rounded-lg bg-uparsistem-100 dark:bg-uparsistem-900/30 text-uparsistem-700 dark:text-uparsistem-300">
                  <Search className="size-3.5" />
                </div>
                <div>
                  <h3 className="text-[11px] font-semibold leading-tight">Ingreso Manual</h3>
                  <p className="text-[9px] text-muted-foreground leading-tight">Escribe la identificación</p>
                </div>
              </div>

              {manualInputError && (
                <div className="flex items-center gap-1.5 p-1.5 mb-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                  <AlertTriangle className="size-3 text-red-600 shrink-0" />
                  <p className="text-[10px] text-red-700 dark:text-red-400">{manualInputError}</p>
                </div>
              )}

              <div className="space-y-2">
                <Input
                  id="manual-id-mobile"
                  type="text"
                  placeholder="Número de identificación"
                  value={manualIdInput}
                  onChange={(e) => setManualIdInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && manualIdInput.trim() && !isManualProcessing && !isProcessingQ10) {
                      handleManualSubmit()
                    }
                  }}
                  disabled={isManualProcessing || isProcessingQ10}
                  className="h-10 text-sm border-uparsistem-200 dark:border-uparsistem-800 focus-visible:ring-uparsistem-500"
                />
                <Button
                  onClick={handleManualSubmit}
                  disabled={isManualProcessing || isProcessingQ10 || !manualIdInput.trim()}
                  className="w-full h-10 text-xs bg-uparsistem-600 hover:bg-uparsistem-700 text-white"
                >
                  {isManualProcessing ? (
                    <><Loader2Icon className="mr-1.5 size-3.5 animate-spin" /> Validando...</>
                  ) : (
                    <><Search className="mr-1.5 size-3.5" /> Validar</>
                  )}
                </Button>
              </div>

              <div className="mt-3 p-2 rounded-lg bg-uparsistem-50/50 dark:bg-uparsistem-950/10 border border-uparsistem-100 dark:border-uparsistem-900/20">
                <p className="text-[9px] text-uparsistem-700 dark:text-uparsistem-300 leading-tight">
                  <span className="font-semibold">Tip:</span> Verifica el documento de identidad del estudiante.
                </p>
              </div>

              {scanner.permissionDenied && (
                <Button onClick={() => scanner.startCamera()} variant="outline" className="w-full mt-2 h-10 text-xs border-uparsistem-300 text-uparsistem-700 hover:bg-uparsistem-50">
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
              {scanResultDisplay?.type === "success" && <CheckCircle className="size-5 text-uparsistem-600" />}
              {scanResultDisplay?.type === "already_scanned" && <AlertTriangle className="size-5 text-amber-600" />}
              {scanResultDisplay?.type === "denied" && <XCircle className="size-5 text-red-600" />}
              {scanResultDisplay?.type === "error" && <AlertTriangle className="size-5 text-red-600" />}
              {scanResultDisplay?.type === "info" && <Loader2Icon className="size-5 animate-spin text-uparsistem-600" />}
              Resultado
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {scanResultDisplay && (
              <>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                  <User className="size-3.5 md:size-4 text-muted-foreground shrink-0" />
                  <span className="text-[11px] md:text-sm font-medium">ID:</span>
                  <Badge variant="secondary" className="text-[10px] md:text-xs font-mono">
                    {scanResultDisplay.identificacion}
                  </Badge>
                </div>

                {scanResultDisplay.type === "success" && scanResultDisplay.person && (
                  <div className="rounded-xl border border-uparsistem-200 bg-uparsistem-50/80 dark:bg-uparsistem-950/20 overflow-hidden">
                    <div className="bg-uparsistem-600 p-2.5 md:p-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="size-4 md:size-5 text-white" />
                        <p className="text-[11px] md:text-sm font-semibold text-white">Acceso Concedido</p>
                      </div>
                    </div>
                    <div className="p-3 md:p-4 space-y-2">
                      <div className="grid grid-cols-2 gap-2 md:gap-3">
                        <div>
                          <p className="text-[9px] md:text-xs text-muted-foreground">Nombre</p>
                          <p className="text-[11px] md:text-sm font-medium truncate">{scanResultDisplay.person.nombre}</p>
                        </div>
                        <div>
                          <p className="text-[9px] md:text-xs text-muted-foreground">Programa</p>
                          <p className="text-[11px] md:text-sm font-medium truncate">{scanResultDisplay.person.programa}</p>
                        </div>
                        <div>
                          <p className="text-[9px] md:text-xs text-muted-foreground">Puesto</p>
                          <p className="text-[11px] md:text-sm font-medium">{scanResultDisplay.person.puesto}</p>
                        </div>
                        <div>
                          <p className="text-[9px] md:text-xs text-muted-foreground">Cupos Extra</p>
                          <p className="text-[11px] md:text-sm font-medium">{scanResultDisplay.person.cuposExtras || 0}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 p-1.5 md:p-2 rounded-lg bg-uparsistem-100/70 dark:bg-uparsistem-900/30 mt-1">
                        <CheckCircle className="size-3 md:size-3.5 text-uparsistem-600 shrink-0" />
                        <p className="text-[9px] md:text-xs text-uparsistem-700 dark:text-uparsistem-300">Bienvenido al evento</p>
                      </div>
                    </div>
                  </div>
                )}

                {scanResultDisplay.type === "already_scanned" && scanResultDisplay.person && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/80 dark:bg-amber-950/20 overflow-hidden">
                    <div className="bg-amber-500 p-2.5 md:p-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="size-4 md:size-5 text-white" />
                        <p className="text-[11px] md:text-sm font-semibold text-white">Ya Registrado</p>
                      </div>
                    </div>
                    <div className="p-3 md:p-4 space-y-2">
                      <div className="grid grid-cols-2 gap-2 md:gap-3">
                        <div>
                          <p className="text-[9px] md:text-xs text-muted-foreground">Nombre</p>
                          <p className="text-[11px] md:text-sm font-medium truncate">{scanResultDisplay.person.nombre}</p>
                        </div>
                        <div>
                          <p className="text-[9px] md:text-xs text-muted-foreground">Programa</p>
                          <p className="text-[11px] md:text-sm font-medium truncate">{scanResultDisplay.person.programa}</p>
                        </div>
                        <div>
                          <p className="text-[9px] md:text-xs text-muted-foreground">Puesto</p>
                          <p className="text-[11px] md:text-sm font-medium">{scanResultDisplay.person.puesto}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 p-1.5 md:p-2 rounded-lg bg-amber-100/70 dark:bg-amber-900/30 mt-1">
                        <AlertTriangle className="size-3 md:size-3.5 text-amber-600 shrink-0" />
                        <p className="text-[9px] md:text-xs text-amber-700 dark:text-amber-300">Este estudiante ya ingresó previamente</p>
                      </div>
                    </div>
                  </div>
                )}

                {scanResultDisplay.type === "already_scanned" && !scanResultDisplay.person && (
                  <div className="flex items-center gap-2 p-2 md:p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <AlertTriangle className="size-3.5 md:size-4 text-amber-600 shrink-0" />
                    <p className="text-[11px] md:text-sm text-amber-800">{scanResultDisplay.message}</p>
                  </div>
                )}

                {scanResultDisplay.type === "error" && (
                  <div className="flex items-center gap-2 p-2 md:p-3 rounded-lg bg-red-50 border border-red-200">
                    <XCircle className="size-3.5 md:size-4 text-red-600 shrink-0" />
                    <p className="text-[11px] md:text-sm text-red-800">{scanResultDisplay.message}</p>
                  </div>
                )}

                {scanResultDisplay.type === "denied" && (
                  <div className="flex items-center gap-2 p-2 md:p-3 rounded-lg bg-red-50 border border-red-200">
                    <XCircle className="size-3.5 md:size-4 text-red-600 shrink-0" />
                    <p className="text-[11px] md:text-sm text-red-800">{scanResultDisplay.message}</p>
                  </div>
                )}

                {scanResultDisplay.type === "info" && (
                  <div className="flex items-center gap-2 p-2 md:p-3 rounded-lg bg-uparsistem-50 border border-uparsistem-200">
                    <Loader2Icon className="size-3.5 md:size-4 text-uparsistem-600 animate-spin shrink-0" />
                    <p className="text-[11px] md:text-sm text-uparsistem-800">{scanResultDisplay.message}</p>
                  </div>
                )}

                <p className="text-[9px] md:text-xs text-muted-foreground text-center">
                  {new Date(scanResultDisplay.timestamp).toLocaleString()}
                </p>
              </>
            )}
          </div>

          <div className="flex gap-2 mt-1">
            <Button onClick={resetScanner} className="flex-1 h-9 md:h-10 text-xs md:text-sm bg-uparsistem-600 hover:bg-uparsistem-700 text-white">
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
