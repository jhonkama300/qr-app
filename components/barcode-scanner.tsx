"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Webcam from "react-webcam"
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from "@zxing/library"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input" // Importar Input
import { Label } from "@/components/ui/label" // Importar Label
import {
  CameraOffIcon,
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
import { Alert, AlertDescription } from "@/components/ui/alert" // Importar Alert y AlertDescription

interface ScanResultDisplay {
  type: "success" | "denied" | "error" | "info" // 'info' para estados de procesamiento
  identificacion: string
  person?: any
  message: string
  source?: "direct" | "q10" | "manual" // Añadir 'manual'
  timestamp: string
}

export function BarcodeScanner() {
  const { getStudentById, markStudentAccess } = useStudentStoreContext()
  const { processQ10Url, isProcessingQ10, q10Message } = useQ10Validation()

  const [isClient, setIsClient] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("")
  const [scanResultDisplay, setScanResultDisplay] = useState<ScanResultDisplay | null>(null) // Para mostrar feedback en la misma página
  const [manualIdInput, setManualIdInput] = useState<string>("") // Estado para la entrada manual
  const [isManualProcessing, setIsManualProcessing] = useState(false) // Estado para el procesamiento manual
  const [manualInputError, setManualInputError] = useState<string | null>(null) // Nuevo estado para errores de entrada manual

  const router = useRouter()
  const webcamRef = useRef<Webcam>(null)
  const codeReader = useRef<BrowserMultiFormatReader | null>(null)

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Inicializar el lector de códigos de barras una vez
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

    // Cleanup para el lector
    return () => {
      if (codeReader.current) {
        codeReader.current.reset()
      }
    }
  }, [isClient])

  // Manejar la enumeración de dispositivos de cámara
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

  // Solicitar permisos de cámara y enumerar dispositivos al cargar
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
        setScanResultDisplay(null) // Limpiar el mensaje temporal después de la redirección de Q10
        return
      } else {
        const student = await getStudentById(scannedContent)
        if (student) {
          await markStudentAccess(scannedContent, true)
          currentScanResult = {
            type: "success",
            identificacion: scannedContent,
            person: student,
            message: `Acceso concedido para ${student.nombre}.`,
            source: source,
            timestamp: new Date().toISOString(),
          }
        } else {
          await markStudentAccess(scannedContent, false)
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

      // Redirigir después de un breve retraso
      setTimeout(() => {
        if (currentScanResult.type === "success") {
          router.push(`/access-granted?id=${currentScanResult.identificacion}&source=${currentScanResult.source}`)
        } else if (currentScanResult.type === "denied") {
          router.push(`/access-denied?id=${currentScanResult.identificacion}&source=${currentScanResult.source}`)
        }
        // Para el tipo 'error', simplemente se mostrará el mensaje y no se redirigirá automáticamente.
      }, 2500) // 2.5 segundos de retraso
    },
    [getStudentById, markStudentAccess, processQ10Url, router],
  )

  // Efecto principal para iniciar y detener el escaneo continuo
  useEffect(() => {
    // Solo iniciar el escaneo si el cliente está listo, tiene permisos, hay un dispositivo seleccionado,
    // no se está procesando Q10, no se está mostrando un resultado de escaneo temporal, y no se está procesando manualmente.
    if (
      !isClient ||
      !hasPermission ||
      !selectedDeviceId ||
      isProcessingQ10 ||
      scanResultDisplay ||
      isManualProcessing
    ) {
      if (codeReader.current) {
        console.log("Reseteando lector (condiciones no cumplidas)...")
        codeReader.current.reset()
      }
      return
    }

    const video = webcamRef.current?.video
    if (!video) {
      console.warn("Elemento de video no listo para escanear.")
      return
    }

    if (!codeReader.current) {
      setError("El lector de códigos no está inicializado.")
      return
    }

    setError(null) // Limpiar errores previos

    console.log("Iniciando escaneo continuo con dispositivo:", selectedDeviceId)
    codeReader.current
      .decodeFromVideoDevice(selectedDeviceId, video, (result, err) => {
        if (result) {
          // Solo procesar si no se está mostrando un resultado temporal y no se está procesando Q10 o manualmente
          if (!scanResultDisplay && !isProcessingQ10 && !isManualProcessing) {
            processScanResult(result.getText(), "direct")
          }
        }
        if (err && err.name !== "NotFoundException" && err.name !== "AbortException") {
          console.error("Error al escanear:", err)
          setError("Error en el escáner: " + err.message)
        }
      })
      .catch((err) => {
        console.error("Error al iniciar el escaneo continuo:", err)
        setError("Error al iniciar el escáner: " + err.message)
        codeReader.current?.reset()
      })

    return () => {
      if (codeReader.current) {
        console.log("Reseteando lector en cleanup...")
        codeReader.current.reset()
      }
    }
  }, [
    isClient,
    hasPermission,
    selectedDeviceId,
    isProcessingQ10,
    scanResultDisplay,
    isManualProcessing,
    processScanResult,
  ])

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

    // Detener el escaneo actual antes de cambiar de cámara
    if (codeReader.current) {
      codeReader.current.reset()
    }

    const currentIndex = devices.findIndex((device) => device.deviceId === selectedDeviceId)
    const nextIndex = (currentIndex + 1) % devices.length
    setSelectedDeviceId(devices[nextIndex].deviceId)
    // El useEffect principal se encargará de reiniciar el escaneo con la nueva cámara
  }

  const handleManualSubmit = async () => {
    if (!manualIdInput.trim()) {
      setManualInputError("Por favor, ingresa una identificación.")
      return
    }

    setIsManualProcessing(true)
    setManualInputError(null) // Limpiar errores previos de entrada manual
    setScanResultDisplay({
      type: "info",
      identificacion: manualIdInput,
      message: "Validando identificación manual...",
      timestamp: new Date().toISOString(),
    })
    setError(null) // Limpiar errores de cámara si los hubiera

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
      setManualIdInput("") // Limpiar el input después de procesar
    }
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
        <CameraOffIcon className="text-destructive mb-6 size-20" />
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

  if (isProcessingQ10) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-card rounded-lg border border-border shadow-sm">
        <Loader2Icon className="text-primary mb-4 size-16 animate-spin" />
        <p className="text-muted-foreground text-lg">Procesando certificado Q10...</p>
        {q10Message && <p className="text-sm text-muted-foreground mt-2">{q10Message.text}</p>}
      </div>
    )
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
            {devices.length > 1 && (
              <button
                onClick={switchCamera}
                className="absolute top-4 right-4 bg-secondary/70 text-foreground p-3 rounded-full hover:bg-secondary transition-colors shadow-md"
                aria-label="Cambiar cámara"
              >
                <RefreshCcwIcon className="size-6" />
              </button>
            )}
          </div>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">Escaneando... Apunta al código</p>
          </div>
        </CardContent>
      </Card>

      {/* Área de visualización de resultados temporales */}
      {scanResultDisplay && (
        <div
          className={`mt-4 p-4 rounded-lg border ${
            scanResultDisplay.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : scanResultDisplay.type === "denied"
                ? "bg-red-50 border-red-200 text-red-800"
                : scanResultDisplay.type === "error"
                  ? "bg-yellow-50 border-yellow-200 text-yellow-800"
                  : "bg-blue-50 border-blue-200 text-blue-800" // Para 'info' type
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            {scanResultDisplay.type === "success" && <CheckCircle className="w-5 h-5" />}
            {scanResultDisplay.type === "denied" && <XCircle className="w-5 h-5" />}
            {scanResultDisplay.type === "error" && <AlertTriangle className="w-5 h-5" />}
            {scanResultDisplay.type === "info" && <Loader2Icon className="w-5 h-5 animate-spin" />}
            <p className="font-semibold text-lg">{scanResultDisplay.message}</p>
          </div>
          {scanResultDisplay.identificacion && scanResultDisplay.identificacion !== "N/A" && (
            <p className="text-sm">
              <span className="font-medium">Identificación:</span>{" "}
              <Badge variant="outline">{scanResultDisplay.identificacion}</Badge>
            </p>
          )}
          {scanResultDisplay.person && (
            <div className="mt-2 text-sm space-y-1">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{scanResultDisplay.person.nombre}</span>
              </div>
              <p>
                <span className="font-medium">Puesto:</span> {scanResultDisplay.person.puesto}
              </p>
              <p>
                <span className="font-medium">Programa:</span> {scanResultDisplay.person.programa}
              </p>
              <p>
                <span className="font-medium">Cupos Extras:</span> {scanResultDisplay.person.cuposExtras}
              </p>
            </div>
          )}
          <p className="text-xs text-right mt-2 text-muted-foreground">
            Escaneado: {new Date(scanResultDisplay.timestamp).toLocaleTimeString()}
          </p>
        </div>
      )}

      {/* Sección de entrada manual */}
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
  )
}
