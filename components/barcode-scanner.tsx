"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Webcam from "react-webcam"
import { BrowserMultiFormatReader } from "@zxing/library"
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
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("")
  const [scanResultDisplay, setScanResultDisplay] = useState<ScanResultDisplay | null>(null)
  const [manualIdInput, setManualIdInput] = useState<string>("")
  const [isManualProcessing, setIsManualProcessing] = useState(false)
  const [manualInputError, setManualInputError] = useState<string | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const lastScanTime = useRef<number>(0)
  const SCAN_COOLDOWN = 2000
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const activeStreamRef = useRef<MediaStream | null>(null)

  const router = useRouter()
  const webcamRef = useRef<Webcam>(null)
  const codeReader = useRef<BrowserMultiFormatReader | null>(null)

  useEffect(() => {
    setIsClient(true)
  }, [])

  const stopCamera = useCallback(() => {
    console.log("[v0] Stopping camera completely...")

    if (codeReader.current) {
      try {
        codeReader.current.reset()
      } catch (e) {
        console.error("[v0] Error resetting code reader:", e)
      }
    }

    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => {
        track.stop()
        console.log("[v0] Track stopped:", track.kind, track.label)
      })
      activeStreamRef.current = null
    }

    if (webcamRef.current?.video?.srcObject) {
      const stream = webcamRef.current.video.srcObject as MediaStream
      stream.getTracks().forEach((track) => {
        track.stop()
        console.log("[v0] Webcam track stopped:", track.kind)
      })
      webcamRef.current.video.srcObject = null
    }
  }, [])

  useEffect(() => {
    if (!isClient) return

    codeReader.current = new BrowserMultiFormatReader()
    console.log("[v0] ZXing reader initialized")

    return () => {
      console.log("[v0] Component unmounting, cleaning up...")
      stopCamera()
    }
  }, [isClient, stopCamera])

  const handleDevices = useCallback((mediaDevices: MediaDeviceInfo[]) => {
    const videoDevices = mediaDevices.filter(({ kind }) => kind === "videoinput")
    console.log("[v0] Available video devices:", videoDevices.length)
    setDevices(videoDevices)

    const backCamera = videoDevices.find(
      (device) =>
        device.label.toLowerCase().includes("back") ||
        device.label.toLowerCase().includes("trasera") ||
        device.label.toLowerCase().includes("rear") ||
        device.label.toLowerCase().includes("environment") ||
        device.label.toLowerCase().includes("posterior"),
    )

    if (backCamera) {
      console.log("[v0] Back camera found:", backCamera.label)
      setSelectedDeviceId(backCamera.deviceId)
    } else if (videoDevices.length > 0) {
      console.log("[v0] Using first available camera:", videoDevices[0].label)
      setSelectedDeviceId(videoDevices[0].deviceId)
    }
  }, [])

  useEffect(() => {
    if (!isClient) return

    const requestCamera = async () => {
      try {
        stopCamera()
        await new Promise((resolve) => setTimeout(resolve, 100))
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        })
        activeStreamRef.current = stream
        setHasPermission(true)
        const devices = await navigator.mediaDevices.enumerateDevices()
        handleDevices(devices)
        stream.getTracks().forEach((track) => track.stop())
        activeStreamRef.current = null
      } catch (err) {
        console.error("Error al acceder a la cámara:", err)
        setError("No se pudo acceder a la cámara. Por favor, concede permisos e inténtalo de nuevo.")
        setHasPermission(false)
      }
    }

    requestCamera()
  }, [handleDevices, isClient, stopCamera])

  const processScanResult = useCallback(
    async (scannedContent: string, source: "direct" | "q10" | "manual") => {
      const now = Date.now()
      if (now - lastScanTime.current < SCAN_COOLDOWN) {
        console.log("[v0] Scan cooldown active, ignoring")
        return
      }

      if (isScanning) {
        console.log("[v0] Scan already in progress, ignoring")
        return
      }

      lastScanTime.current = now
      setIsScanning(true)
      let currentScanResult: ScanResultDisplay

      const userInfo = user
        ? {
            userId: user.id,
            userName: fullName || user.email || "Usuario",
            userEmail: user.email || undefined,
            userRole: activeRole || "Usuario",
          }
        : undefined

      console.log("[v0] UserInfo creado en barcode-scanner:", userInfo)

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
    },
    [getStudentById, markStudentAccess, processQ10Url, user, checkIfAlreadyScanned, isScanning, fullName, activeRole],
  )

  useEffect(() => {
    if (!isClient || !hasPermission || !selectedDeviceId || isProcessingQ10 || isScanning || isManualProcessing) {
      return
    }

    const video = webcamRef.current?.video
    if (!video) {
      console.warn("[v0] Video element not ready")
      return
    }

    if (!codeReader.current) {
      console.error("[v0] Code reader not initialized")
      setError("El lector de códigos no está inicializado.")
      return
    }

    setError(null)

    console.log("[v0] Starting continuous scan with device:", selectedDeviceId)

    const initTimeout = setTimeout(() => {
      console.error("[v0] Scanner initialization timeout")
      setError("Tiempo de espera agotado al iniciar la cámara. Intenta recargar la página.")
    }, 10000)

    codeReader.current
      .decodeFromVideoDevice(selectedDeviceId, video, (result, err) => {
        clearTimeout(initTimeout)

        if (result) {
          if (!isScanning && !isProcessingQ10 && !isManualProcessing) {
            console.log("[v0] QR detected:", result.getText())
            processScanResult(result.getText(), "direct")
          }
        }
        if (
          err &&
          err.name !== "NotFoundException" &&
          err.name !== "AbortException" &&
          !err.message.includes("No MultiFormat Readers were able to detect the code")
        ) {
          console.error("[v0] Scanner error:", err)
          if (err.name === "NotReadableError") {
            setError("La cámara está siendo usada por otra aplicación. Cierra otras apps y recarga la página.")
          }
        }
      })
      .then((controls) => {
        if (video.srcObject) {
          activeStreamRef.current = video.srcObject as MediaStream
        }
      })
      .catch((err) => {
        clearTimeout(initTimeout)
        console.error("[v0] Error starting continuous scan:", err)
        if (err.name === "NotAllowedError") {
          setError("Permiso de cámara denegado.")
        } else if (err.name === "NotFoundError") {
          setError("No se encontró la cámara.")
        } else if (err.name === "NotReadableError") {
          setError("La cámara está en uso. Cierra otras aplicaciones e intenta de nuevo.")
        } else if (!err.message.includes("No MultiFormat Readers")) {
          setError("Error al iniciar el escáner. Intenta recargar la página.")
        }
        stopCamera()
      })

    return () => {
      clearTimeout(initTimeout)
      console.log("[v0] Cleaning up scanner in useEffect...")
      stopCamera()
    }
  }, [
    isClient,
    hasPermission,
    selectedDeviceId,
    isProcessingQ10,
    isScanning,
    isManualProcessing,
    processScanResult,
    stopCamera,
  ])

  useEffect(() => {
    return () => {
      console.log("[v0] BarcodeScanner unmounting, final cleanup...")
      stopCamera()
    }
  }, [stopCamera])

  const requestCameraPermission = () => {
    if (!isClient) return
    stopCamera()
    setTimeout(() => {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "environment" } })
        .then((stream) => {
          activeStreamRef.current = stream
          setHasPermission(true)
          setError(null)
          navigator.mediaDevices.enumerateDevices().then(handleDevices)
          stream.getTracks().forEach((track) => track.stop())
          activeStreamRef.current = null
        })
        .catch((err) => {
          console.error("Error al acceder a la cámara:", err)
          setError("No se pudo acceder a la cámara. Por favor, concede permisos e inténtalo de nuevo.")
          setHasPermission(false)
        })
    }, 200)
  }

  const handleManualSubmit = async () => {
    if (!manualIdInput.trim()) {
      setManualInputError("Por favor, ingresa una identificación.")
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
      console.error("Error al procesar identificación manual:", err)
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
    console.log("[v0] Resetting scanner...")
    setScanResultDisplay(null)
    setShowResult(false)
    setError(null)
    setManualIdInput("")
    setManualInputError(null)
    setIsScanning(false)
    lastScanTime.current = 0

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
  }

  const handleModalClose = (open: boolean) => {
    setShowResult(open)
    if (!open) {
      console.log("[v0] Modal closed, resetting scanner state")
      setScanResultDisplay(null)
      setIsScanning(false)
      lastScanTime.current = 0

      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
    }
  }

  return (
    <div className="w-full max-w-md @container">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <CameraIcon className="w-5 h-5" />
            Escáner QR/Código
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="relative w-full pt-[100%] overflow-hidden rounded-lg bg-card shadow-lg border border-border">
            {selectedDeviceId && (
              <Webcam
                ref={webcamRef}
                audio={false}
                videoConstraints={{
                  deviceId: selectedDeviceId,
                  facingMode: "environment",
                }}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[50%] border-4 border-primary rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
              <div className="absolute top-1/2 left-[5%] right-[5%] h-[2px] bg-primary animate-scan"></div>
            </div>
          </div>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              {isScanning ? "Procesando..." : "Escaneando... Apunta al código"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Keyboard className="w-5 h-5" />
            Entrada Manual
          </CardTitle>
          <CardDescription>Ingresa la identificación si el escaneo no es posible</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {manualInputError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{manualInputError}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="manual-id">Número de Identificación</Label>
            <Input
              id="manual-id"
              type="text"
              placeholder="Ej: 123456789"
              value={manualIdInput}
              onChange={(e) => setManualIdInput(e.target.value)}
              disabled={isManualProcessing || isProcessingQ10}
              className="h-11 text-base"
            />
          </div>
          <Button
            onClick={handleManualSubmit}
            disabled={isManualProcessing || isProcessingQ10 || !manualIdInput.trim()}
            className="w-full h-11 text-base"
          >
            {isManualProcessing ? (
              <>
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                Validando...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Validar Identificación
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showResult} onOpenChange={handleModalClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {scanResultDisplay?.type === "success" && <CheckCircle className="w-5 h-5 text-green-600" />}
              {scanResultDisplay?.type === "already_scanned" && <AlertTriangle className="w-5 h-5 text-yellow-600" />}
              {scanResultDisplay?.type === "denied" && <XCircle className="w-5 h-5 text-red-600" />}
              {scanResultDisplay?.type === "error" && <AlertTriangle className="h-4 w-4 text-red-600" />}
              {scanResultDisplay?.type === "info" && <Loader2Icon className="w-5 h-5 animate-spin text-blue-600" />}
              Resultado del Control de Acceso
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {scanResultDisplay && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Identificación:</span>
                  </div>
                  <Badge variant="outline" className="text-sm">
                    {scanResultDisplay.identificacion}
                  </Badge>
                </div>

                {scanResultDisplay.type === "success" && scanResultDisplay.person && (
                  <Card className="border-green-200 bg-green-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-green-800">✅ Acceso Concedido al Evento</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div>
                        <span className="font-medium text-sm">Nombre:</span>
                        <p className="text-sm">{scanResultDisplay.person.nombre}</p>
                      </div>
                      <div>
                        <span className="font-medium text-sm">Programa:</span>
                        <p className="text-sm">{scanResultDisplay.person.programa}</p>
                      </div>
                      <div>
                        <span className="font-medium text-sm">Puesto:</span>
                        <p className="text-sm">{scanResultDisplay.person.puesto}</p>
                      </div>
                      <div>
                        <span className="font-medium text-sm">Cupos Extras:</span>
                        <p className="text-sm">{scanResultDisplay.person.cuposExtras || 0}</p>
                      </div>
                      <div className="text-xs text-green-700 bg-green-100 p-2 rounded">Bienvenido al evento</div>
                    </CardContent>
                  </Card>
                )}

                {scanResultDisplay.type === "already_scanned" && scanResultDisplay.person && (
                  <Card className="border-yellow-300 bg-yellow-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-yellow-800">⚠️ Ya Registrado Anteriormente</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div>
                        <span className="font-medium text-sm text-yellow-900">Nombre:</span>
                        <p className="text-sm text-yellow-800">{scanResultDisplay.person.nombre}</p>
                      </div>
                      <div>
                        <span className="font-medium text-sm text-yellow-900">Programa:</span>
                        <p className="text-sm text-yellow-800">{scanResultDisplay.person.programa}</p>
                      </div>
                      <div>
                        <span className="font-medium text-sm text-yellow-900">Puesto:</span>
                        <p className="text-sm text-yellow-800">{scanResultDisplay.person.puesto}</p>
                      </div>
                      <div>
                        <span className="font-medium text-sm text-yellow-900">Cupos Extras:</span>
                        <p className="text-sm text-yellow-800">{scanResultDisplay.person.cuposExtras || 0}</p>
                      </div>
                      <div className="text-xs text-yellow-800 bg-yellow-100 p-2 rounded border border-yellow-300">
                        Este estudiante ya ingresó al evento previamente
                      </div>
                    </CardContent>
                  </Card>
                )}

                {scanResultDisplay.type === "already_scanned" && !scanResultDisplay.person && (
                  <Alert className="border-yellow-300 bg-yellow-50">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800">{scanResultDisplay.message}</AlertDescription>
                  </Alert>
                )}

                {scanResultDisplay.type === "error" && (
                  <Alert className="border-orange-200 bg-orange-50">
                    <XCircle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-orange-800">{scanResultDisplay.message}</AlertDescription>
                  </Alert>
                )}

                {scanResultDisplay.type === "denied" && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>{scanResultDisplay.message}</AlertDescription>
                  </Alert>
                )}

                {scanResultDisplay.type === "info" && (
                  <Alert className="border-blue-200 bg-blue-50">
                    <Loader2Icon className="h-4 w-4 text-blue-600 animate-spin" />
                    <AlertDescription className="text-blue-800">{scanResultDisplay.message}</AlertDescription>
                  </Alert>
                )}

                <div className="text-xs text-muted-foreground text-center">
                  Procesado el {new Date(scanResultDisplay.timestamp).toLocaleString()}
                </div>
              </>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={resetScanner} className="flex-1">
              <RefreshCw className="w-4 h-4 mr-2" />
              Procesar Otro
            </Button>
            <Button variant="outline" onClick={() => handleModalClose(false)}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
