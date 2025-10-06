"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Webcam from "react-webcam"
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from "@zxing/library"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/components/auth-provider"
import { useStudentStoreContext } from "@/components/providers/student-store-provider"
import { useQ10Validation } from "@/hooks/use-q10-validation"
import {
  CameraOff,
  CheckCircle,
  XCircle,
  Search,
  User,
  AlertTriangle,
  RefreshCw,
  Shield,
  CameraIcon,
  Loader2Icon,
  Keyboard,
  AlertCircle,
} from "lucide-react"

interface ScanResult {
  identificacion: string
  student: any
  status: "success" | "error" | "not_found" | "already_scanned"
  message: string
  timestamp: string
}

interface ScanResultDisplay {
  type: "success" | "denied" | "error" | "info"
  identificacion: string
  person?: any
  message: string
  source?: "direct" | "q10" | "manual"
  timestamp: string
}

export function OperativoScanner() {
  const { user, fullName, activeRole } = useAuth()
  const { getStudentById, markStudentAccess, checkIfAlreadyScanned } = useStudentStoreContext()
  const { processQ10Url, isProcessingQ10, q10Message } = useQ10Validation()

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

  const webcamRef = useRef<Webcam>(null)
  const codeReader = useRef<BrowserMultiFormatReader | null>(null)
  const scannerActive = useRef(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient) return

    if (!codeReader.current) {
      const hints = new Map<DecodeHintType, any>()
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE])
      hints.set(DecodeHintType.TRY_HARDER, true)
      codeReader.current = new BrowserMultiFormatReader(hints)
      console.log("[v0] ZXing reader initialized")
    }

    return () => {
      console.log("[v0] OperativoScanner unmounting, cleaning up camera...")
      if (codeReader.current && scannerActive.current) {
        codeReader.current.reset()
        scannerActive.current = false
      }
      if (webcamRef.current?.video?.srcObject) {
        const stream = webcamRef.current.video.srcObject as MediaStream
        stream.getTracks().forEach((track) => {
          track.stop()
          console.log("[v0] Track stopped on unmount:", track.kind)
        })
        webcamRef.current.video.srcObject = null
      }
    }
  }, [])

  useEffect(() => {
    if (!isClient || !hasPermission || !selectedDeviceId || isProcessingQ10 || isScanning || !codeReader.current) {
      return
    }

    const video = webcamRef.current?.video
    if (!video) {
      console.log("[v0] Video element not ready")
      return
    }

    if (scannerActive.current) {
      console.log("[v0] Scanner already active")
      return
    }

    console.log("[v0] Starting scanner with device:", selectedDeviceId)
    scannerActive.current = true
    setError(null)

    const startScanning = async () => {
      try {
        await codeReader.current!.decodeFromVideoDevice(selectedDeviceId, video, (result, err) => {
          if (result && !isScanning) {
            console.log("[v0] Scan successful:", result.getText())
            processScanResult(result.getText(), "direct")
          }
          if (err && err.name !== "NotFoundException") {
            console.log("[v0] Scanner error:", err.name)
          }
        })
      } catch (err) {
        console.error("[v0] Error starting scanner:", err)
        setError("Error al iniciar el escáner")
        scannerActive.current = false
      }
    }

    startScanning()

    return () => {
      console.log("[v0] Cleaning up scanner")
      if (codeReader.current && scannerActive.current) {
        codeReader.current.reset()
        scannerActive.current = false
      }
    }
  }, [isClient, hasPermission, selectedDeviceId, isProcessingQ10, isScanning])

  const handleDevices = useCallback((mediaDevices: MediaDeviceInfo[]) => {
    const videoDevices = mediaDevices.filter(({ kind }) => kind === "videoinput")
    setDevices(videoDevices)
    const backCamera = videoDevices.find(
      (device) =>
        device.label.toLowerCase().includes("back") ||
        device.label.toLowerCase().includes("trasera") ||
        device.label.toLowerCase().includes("rear") ||
        device.label.toLowerCase().includes("environment"),
    )
    if (backCamera) {
      setSelectedDeviceId(backCamera.deviceId)
    } else if (videoDevices.length > 0) {
      setSelectedDeviceId(videoDevices[0].deviceId)
    }
  }, [])

  useEffect(() => {
    if (!isClient) return

    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then(() => {
        setHasPermission(true)
        navigator.mediaDevices.enumerateDevices().then(handleDevices)
      })
      .catch((err) => {
        console.error("Error al acceder a la cámara:", err)
        setError("No se pudo acceder a la cámara. Por favor, conceda permisos e inténtelo de nuevo.")
        setHasPermission(false)
      })
  }, [handleDevices, isClient])

  const processScanResult = useCallback(
    async (scannedContent: string, source: "direct" | "q10" | "manual") => {
      if (isScanning) {
        console.log("[v0] Scan already in progress, ignoring")
        return
      }

      setIsScanning(true)
      let currentScanResult: ScanResultDisplay

      const userInfo = user
        ? {
            userId: user.id,
            userName: fullName || user.fullName || "Usuario Operativo",
            userEmail: user.idNumber + "@sistema.com",
            userRole: activeRole || "operativo",
          }
        : undefined

      console.log("[v0] UserInfo creado en operativo-scanner:", userInfo)

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

        setTimeout(() => {
          setShowResult(false)
          setScanResultDisplay(null)
          setIsScanning(false)
        }, 5000)
        return
      } else {
        const alreadyScanned = await checkIfAlreadyScanned(scannedContent)

        if (alreadyScanned) {
          currentScanResult = {
            type: "error",
            identificacion: scannedContent,
            message: `Esta persona ya ingresó al evento anteriormente. No se puede volver a escanear.`,
            source: source,
            timestamp: new Date().toISOString(),
          }
          setScanResultDisplay(currentScanResult)
          setShowResult(true)

          setTimeout(() => {
            setScanResultDisplay(null)
            setShowResult(false)
            setIsScanning(false)
          }, 4000)
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

      setTimeout(() => {
        setShowResult(false)
        setScanResultDisplay(null)
        setIsScanning(false)
      }, 5000)
    },
    [getStudentById, markStudentAccess, processQ10Url, user, checkIfAlreadyScanned, isScanning],
  )

  const requestCameraPermission = () => {
    if (!isClient) return
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then(() => {
        setHasPermission(true)
        setError(null)
        navigator.mediaDevices.enumerateDevices().then(handleDevices)
      })
      .catch((err) => {
        console.error("Error al acceder a la cámara:", err)
        setError("No se pudo acceder a la cámara. Por favor, conceda permisos e inténtelo de nuevo.")
        setHasPermission(false)
      })
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
    setScanResultDisplay(null)
    setShowResult(false)
    setError(null)
    setManualIdInput("")
    setManualInputError(null)
    setIsScanning(false)
  }

  if (activeRole !== "operativo") {
    return (
      <div className="flex items-center justify-center p-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Esta funcionalidad solo está disponible para usuarios con rol "Operativo"</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!isClient) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-card rounded-lg border border-border shadow-sm">
        <Loader2Icon className="text-primary mb-4 size-16 animate-spin" />
        <p className="text-muted-foreground text-lg">Cargando escáner...</p>
      </div>
    )
  }

  if (hasPermission === false) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-card rounded-lg border border-border shadow-sm">
        <CameraOff className="text-destructive mb-6 size-20" />
        <h3 className="text-2xl font-bold mb-3 text-foreground">Acceso a la cámara denegado</h3>
        <p className="text-muted-foreground mb-8 text-base">
          {error || "Se requiere acceso a la cámara para escanear códigos de barras."}
        </p>
        <Button
          onClick={requestCameraPermission}
          className="bg-primary text-primary-foreground h-12 px-6 text-base rounded-md"
        >
          <CameraIcon className="mr-2 size-5" />
          Permitir acceso a la cámara
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-col items-center gap-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Control de Acceso al Evento</h1>
          <p className="text-muted-foreground">Escanea QR o ingresa identificación para dar acceso al evento</p>
        </div>

        <div className="flex gap-2 mb-4">
          <Badge variant="outline" className="bg-blue-50 text-blue-700">
            <Shield className="w-4 h-4 mr-1" />
            Control de Acceso
          </Badge>
          <Badge variant="outline">Escáner Avanzado</Badge>
        </div>

        <div className="w-full max-w-md @container">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                <CameraIcon className="w-5 h-5" />
                Escáner QR/Código Operativo
              </CardTitle>
              <CardDescription>Escáner avanzado para control de acceso al evento</CardDescription>
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
                    onUserMedia={() => {
                      console.log("[v0] Camera stream ready")
                    }}
                  />
                )}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[50%] border-4 border-primary rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                  <div className="absolute top-1/2 left-[5%] right-[5%] h-[2px] bg-primary animate-scan"></div>
                </div>
              </div>

              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  {isScanning ? "Procesando..." : "Escaneando automáticamente... Apunta al código"}
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
                  <AlertCircle className="h-4 w-4" />
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
        </div>
      </div>

      <Dialog open={showResult} onOpenChange={setShowResult}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {scanResultDisplay?.type === "success" && <CheckCircle className="w-5 h-5 text-green-600" />}
              {scanResultDisplay?.type === "denied" && <XCircle className="w-5 h-5 text-red-600" />}
              {scanResultDisplay?.type === "error" && <AlertTriangle className="w-5 h-5 text-red-600" />}
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
            <Button variant="outline" onClick={() => setShowResult(false)}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
