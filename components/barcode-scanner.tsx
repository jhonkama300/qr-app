"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Webcam from "react-webcam"
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from "@zxing/library"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  CameraIcon,
  RefreshCcwIcon,
  Loader2Icon,
  CheckCircle,
  XCircle,
  User,
  AlertTriangle,
  Keyboard,
  Search,
  AlertCircle,
} from "lucide-react"
import { useStudentStoreContext } from "@/components/providers/student-store-provider"
import { useQ10Validation } from "@/hooks/use-q10-validation"
import { useAuth } from "@/components/auth-provider"

interface ScanResultDisplay {
  type: "success" | "denied" | "error" | "info"
  identificacion: string
  person?: any
  message: string
  source?: "direct" | "q10" | "manual"
  timestamp: string
}

export function BarcodeScanner() {
  const { getStudentById, markStudentAccess, checkIfAlreadyScanned } = useStudentStoreContext()
  const { processQ10Url, isProcessingQ10, q10Message } = useQ10Validation()
  const { user } = useAuth()

  const [isClient, setIsClient] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("")
  const [scanResultDisplay, setScanResultDisplay] = useState<ScanResultDisplay | null>(null)
  const [manualIdInput, setManualIdInput] = useState<string>("")
  const [isManualProcessing, setIsManualProcessing] = useState(false)
  const [manualInputError, setManualInputError] = useState<string | null>(null)

  const router = useRouter()
  const webcamRef = useRef<Webcam>(null)
  const codeReader = useRef<BrowserMultiFormatReader | null>(null)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient) return

    const hints = new Map<DecodeHintType, any>()
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODE_128,
      BarcodeFormat.EAN_13,
      BarcodeFormat.QR_CODE,
      BarcodeFormat.DATA_MATRIX,
      BarcodeFormat.AZTEC,
      BarcodeFormat.PDF_417,
    ])
    codeReader.current = new BrowserMultiFormatReader(hints)

    return () => {
      if (codeReader.current) {
        codeReader.current.reset()
      }
    }
  }, [isClient])

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
      let currentScanResult: ScanResultDisplay

      const userInfo = user
        ? {
            userId: user.id,
            userName: user.email || "Usuario",
            userEmail: user.email || undefined,
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
        await processQ10Url(scannedContent)
        setScanResultDisplay(null)
        return
      } else {
        const alreadyScanned = await checkIfAlreadyScanned(scannedContent)

        if (alreadyScanned) {
          currentScanResult = {
            type: "error",
            identificacion: scannedContent,
            message: `Este usuario ya fue escaneado anteriormente. No se puede volver a escanear.`,
            source: source,
            timestamp: new Date().toISOString(),
          }
          setScanResultDisplay(currentScanResult)

          setTimeout(() => {
            setScanResultDisplay(null)
          }, 4000)
          return
        }

        const student = await getStudentById(scannedContent)
        if (student) {
          await markStudentAccess(scannedContent, true, undefined, source, userInfo)
          currentScanResult = {
            type: "success",
            identificacion: scannedContent,
            person: student,
            message: `Acceso concedido para ${student.nombre}.`,
            source: source,
            timestamp: new Date().toISOString(),
          }
        } else {
          await markStudentAccess(scannedContent, false, undefined, source, userInfo)
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

      setTimeout(() => {
        if (currentScanResult.type === "success") {
          router.push(`/access-granted?id=${currentScanResult.identificacion}&source=${currentScanResult.source}`)
        } else if (currentScanResult.type === "denied") {
          router.push(`/access-denied?id=${currentScanResult.identificacion}&source=${currentScanResult.source}`)
        }
      }, 2500)
    },
    [getStudentById, markStudentAccess, processQ10Url, router, user, checkIfAlreadyScanned],
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

  const switchCamera = () => {
    if (!isClient || devices.length <= 1) return

    if (codeReader.current) {
      codeReader.current.reset()
    }

    const currentIndex = devices.findIndex((device) => device.deviceId === selectedDeviceId)
    const nextIndex = (currentIndex + 1) % devices.length
    setSelectedDeviceId(devices[nextIndex].deviceId)
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
    } finally {
      setIsManualProcessing(false)
      setManualIdInput("")
    }
  }

  return (
    <div className="w-full max-w-md mx-auto @container">
      <Card>
        <CardHeader className="text-center pb-3 px-3 sm:px-6">
          <CardTitle className="flex items-center justify-center gap-2 text-base sm:text-xl">
            <CameraIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            Escáner QR/Código
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-3 sm:px-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs sm:text-sm text-destructive">{error}</AlertDescription>
            </Alert>
          )}

          <div className="relative w-full pt-[100%] overflow-hidden rounded-lg bg-card shadow-lg border border-border">
            {selectedDeviceId && (
              <Webcam
                ref={webcamRef}
                audio={false}
                videoConstraints={{
                  deviceId: selectedDeviceId,
                  facingMode: "environment",
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                }}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] sm:w-[90%] h-[45%] sm:h-[50%] border-2 sm:border-4 border-primary rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
              <div className="absolute top-1/2 left-[5%] right-[5%] h-[1px] sm:h-[2px] bg-primary animate-scan"></div>
            </div>
            {devices.length > 1 && (
              <button
                onClick={switchCamera}
                className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-secondary/80 text-foreground p-2 sm:p-3 rounded-full hover:bg-secondary transition-colors shadow-md min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Cambiar cámara"
              >
                <RefreshCcwIcon className="size-4 sm:size-6" />
              </button>
            )}
          </div>

          <div className="text-center py-2">
            <p className="text-xs sm:text-sm text-muted-foreground">Escaneando... Apunta al código</p>
          </div>
        </CardContent>
      </Card>

      {scanResultDisplay && (
        <div
          className={`mt-3 sm:mt-4 p-3 sm:p-4 rounded-lg border ${
            scanResultDisplay.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : scanResultDisplay.type === "denied"
                ? "bg-red-50 border-red-200 text-red-800"
                : scanResultDisplay.type === "error"
                  ? "bg-yellow-50 border-yellow-200 text-yellow-800"
                  : "bg-blue-50 border-blue-200 text-blue-800"
          }`}
        >
          <div className="flex items-start gap-2 mb-2">
            {scanResultDisplay.type === "success" && (
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5" />
            )}
            {scanResultDisplay.type === "denied" && <XCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5" />}
            {scanResultDisplay.type === "error" && (
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5" />
            )}
            {scanResultDisplay.type === "info" && (
              <Loader2Icon className="w-4 h-4 sm:w-5 sm:h-5 animate-spin flex-shrink-0 mt-0.5" />
            )}
            <p className="font-semibold text-xs sm:text-base leading-tight">{scanResultDisplay.message}</p>
          </div>
          {scanResultDisplay.identificacion && scanResultDisplay.identificacion !== "N/A" && (
            <p className="text-xs sm:text-sm mb-2">
              <span className="font-medium">Identificación:</span>{" "}
              <Badge variant="outline" className="text-xs">
                {scanResultDisplay.identificacion}
              </Badge>
            </p>
          )}
          {scanResultDisplay.person && (
            <div className="mt-2 text-xs sm:text-sm space-y-1">
              <div className="flex items-center gap-2">
                <User className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                <span className="font-medium truncate">{scanResultDisplay.person.nombre}</span>
              </div>
              <p className="text-xs">
                <span className="font-medium">Puesto:</span> {scanResultDisplay.person.puesto}
              </p>
              <p className="text-xs">
                <span className="font-medium">Programa:</span> {scanResultDisplay.person.programa}
              </p>
              <p className="text-xs">
                <span className="font-medium">Cupos Extras:</span> {scanResultDisplay.person.cuposExtras}
              </p>
            </div>
          )}
          <p className="text-xs text-right mt-2 text-muted-foreground">
            Escaneado: {new Date(scanResultDisplay.timestamp).toLocaleTimeString()}
          </p>
        </div>
      )}

      <Card className="mt-3 sm:mt-6">
        <CardHeader className="text-center pb-3 px-3 sm:px-6">
          <CardTitle className="flex items-center justify-center gap-2 text-sm sm:text-lg">
            <Keyboard className="w-4 h-4 sm:w-5 sm:h-5" />
            Entrada Manual
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Ingresa la identificación si el escaneo no es posible
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-3 sm:px-6">
          {manualInputError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs sm:text-sm text-destructive">{manualInputError}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="manual-id" className="text-xs sm:text-sm">
              Número de Identificación
            </Label>
            <Input
              id="manual-id"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Ej: 123456789"
              value={manualIdInput}
              onChange={(e) => setManualIdInput(e.target.value)}
              disabled={isManualProcessing || isProcessingQ10}
              className="h-11 sm:h-12 text-base mobile-optimized"
            />
          </div>
          <Button
            onClick={handleManualSubmit}
            disabled={isManualProcessing || isProcessingQ10 || !manualIdInput.trim()}
            className="w-full h-11 sm:h-12 text-sm sm:text-base min-h-[44px] clickable"
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

      {hasPermission === false && (
        <Card className="mt-3 sm:mt-4">
          <CardContent className="text-center py-4 px-3 sm:px-6">
            <AlertTriangle className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-3 text-yellow-500" />
            <h3 className="text-sm sm:text-base font-semibold mb-2">Permisos de Cámara Requeridos</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mb-4">
              Para usar el escáner, necesitamos acceso a tu cámara.
            </p>
            <Button onClick={requestCameraPermission} className="w-full h-11 sm:h-12 min-h-[44px] clickable">
              <CameraIcon className="mr-2 h-4 w-4" />
              Permitir Acceso a Cámara
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
