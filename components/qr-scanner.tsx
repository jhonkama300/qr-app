"use client"

import { useState, useRef, useEffect } from "react"
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Loader2,
  Camera,
  CameraOff,
  CheckCircle,
  XCircle,
  Search,
  Globe,
  User,
  AlertTriangle,
  RefreshCw,
} from "lucide-react"

interface PersonData {
  id: string
  puesto: string
  identificacion: string
  nombre: string
  programa: string
  cuposExtras: number
}

interface ScanResult {
  url: string
  identificacion: string | null
  person: PersonData | null
  status: "success" | "not_found" | "error"
  timestamp: string
}

export function QRScanner() {
  const [isScanning, setIsScanning] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState("")
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [wasCameraRunning, setWasCameraRunning] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    return () => {
      if (stream) {
        console.log("[v0] Cleaning up camera stream on unmount")
        stream.getTracks().forEach((track) => {
          track.stop()
          console.log("[v0] Track stopped:", track.kind)
        })
      }
    }
  }, [stream])

  useEffect(() => {
    if (showResult && isScanning) {
      console.log("[v0] Modal opened, pausing camera")
      setWasCameraRunning(true)
      if (stream) {
        stream.getTracks().forEach((track) => {
          track.enabled = false
        })
      }
    } else if (!showResult && wasCameraRunning) {
      console.log("[v0] Modal closed, restarting camera")
      setWasCameraRunning(false)
      if (stream) {
        stream.getTracks().forEach((track) => {
          track.enabled = true
        })
      } else {
        startCamera()
      }
    }
  }, [showResult])

  const startCamera = async () => {
    try {
      setError("")
      console.log("[v0] Starting camera...")

      // Detener cualquier stream existente primero
      if (stream) {
        stream.getTracks().forEach((track) => {
          track.stop()
          console.log("[v0] Stopped existing track:", track.kind)
        })
        setStream(null)
      }

      // Esperar un momento para que la cámara se libere completamente
      await new Promise((resolve) => setTimeout(resolve, 300))

      // Intentar con diferentes configuraciones de restricciones
      const constraints = [
        // Intento 1: Restricciones ideales con cámara trasera
        {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        // Intento 2: Solo facingMode sin resolución específica
        {
          video: {
            facingMode: "environment",
          },
        },
        // Intento 3: Cualquier cámara disponible
        {
          video: true,
        },
      ]

      let mediaStream: MediaStream | null = null
      let lastError: any = null

      for (const constraint of constraints) {
        try {
          console.log("[v0] Trying camera with constraints:", constraint)
          mediaStream = await navigator.mediaDevices.getUserMedia(constraint)
          console.log("[v0] Camera started successfully with constraints:", constraint)
          break
        } catch (err: any) {
          console.warn("[v0] Failed with constraints:", constraint, err)
          lastError = err
          // Esperar antes del siguiente intento
          await new Promise((resolve) => setTimeout(resolve, 200))
        }
      }

      if (!mediaStream) {
        throw lastError || new Error("No se pudo iniciar la cámara")
      }

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        setStream(mediaStream)
        setIsScanning(true)
        console.log("[v0] Camera stream set successfully")
      }
    } catch (error: any) {
      console.error("[v0] Error al acceder a la cámara:", error)
      if (error.name === "NotAllowedError") {
        setError("Permiso de cámara denegado. Por favor, permite el acceso a la cámara.")
      } else if (error.name === "NotFoundError") {
        setError("No se encontró ninguna cámara en el dispositivo.")
      } else if (error.name === "NotReadableError" || error.name === "AbortError") {
        setError("La cámara está en uso. Intenta cerrar otras aplicaciones que usen la cámara o recarga la página.")
      } else {
        setError("No se pudo acceder a la cámara. Verifica los permisos o intenta recargar la página.")
      }
    }
  }

  const stopCamera = () => {
    console.log("[v0] Stopping camera...")
    if (stream) {
      stream.getTracks().forEach((track) => {
        track.stop()
        console.log("[v0] Track stopped:", track.kind)
      })
      setStream(null)
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsScanning(false)
    setScanning(false)
  }

  const captureAndProcessQR = async () => {
    if (!videoRef.current || !canvasRef.current) return

    setScanning(true)
    setProcessing(true)
    setError("")

    try {
      const video = videoRef.current
      const canvas = canvasRef.current
      const context = canvas.getContext("2d")

      if (!context) throw new Error("No se pudo obtener el contexto del canvas")

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      context.drawImage(video, 0, 0, canvas.width, canvas.height)

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height)

      await simulateQRProcessing()
    } catch (error) {
      console.error("Error al procesar QR:", error)
      setError("Error al procesar el código QR")
    } finally {
      setScanning(false)
      setProcessing(false)
    }
  }

  const simulateQRProcessing = async () => {
    const simulatedURL = "https://example.com/profile/119276897"

    await processQRUrl(simulatedURL)
  }

  const processQRUrl = async (url: string) => {
    try {
      setProcessing(true)

      const response = await fetch(`/api/scrape-page?url=${encodeURIComponent(url)}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Error al acceder a la página")
      }

      const identificacion = data.identificacion

      if (!identificacion) {
        setScanResult({
          url,
          identificacion: null,
          person: null,
          status: "error",
          timestamp: new Date().toISOString(),
        })
        setShowResult(true)
        return
      }

      const person = await searchPersonInDatabase(identificacion)

      setScanResult({
        url,
        identificacion,
        person,
        status: person ? "success" : "not_found",
        timestamp: new Date().toISOString(),
      })

      setShowResult(true)
      stopCamera()
    } catch (error) {
      console.error("Error al procesar URL:", error)
      setScanResult({
        url,
        identificacion: null,
        person: null,
        status: "error",
        timestamp: new Date().toISOString(),
      })
      setShowResult(true)
    } finally {
      setProcessing(false)
    }
  }

  const searchPersonInDatabase = async (identificacion: string): Promise<PersonData | null> => {
    try {
      const q = query(collection(db, "personas"), where("identificacion", "==", identificacion))
      const querySnapshot = await getDocs(q)

      if (querySnapshot.empty) {
        return null
      }

      const doc = querySnapshot.docs[0]
      return {
        id: doc.id,
        ...doc.data(),
      } as PersonData
    } catch (error) {
      console.error("Error al buscar en la base de datos:", error)
      return null
    }
  }

  const resetScanner = () => {
    console.log("[v0] Resetting scanner...")
    setScanResult(null)
    setShowResult(false)
    setError("")
    setScanning(false)
    setProcessing(false)
    setWasCameraRunning(false)

    // Reiniciar la cámara si no está activa
    if (!isScanning) {
      startCamera()
    } else if (stream) {
      // Si ya está activa, asegurarse de que los tracks estén habilitados
      stream.getTracks().forEach((track) => {
        track.enabled = true
      })
    }
  }

  const handleModalClose = (open: boolean) => {
    setShowResult(open)
    if (!open) {
      console.log("[v0] Modal closed by user")
      setScanResult(null)
      setError("")
      setScanning(false)
      setProcessing(false)
      setWasCameraRunning(false)

      // Reactivar la cámara después de cerrar el modal
      if (stream) {
        stream.getTracks().forEach((track) => {
          track.enabled = true
        })
      } else if (isScanning) {
        // Si se perdió el stream pero debería estar escaneando, reiniciar
        startCamera()
      }
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-col items-center gap-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Escanear QR</h1>
          <p className="text-muted-foreground">Escanea códigos QR para validar personas en la base de datos</p>
        </div>

        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Camera className="w-5 h-5" />
              Escáner QR
            </CardTitle>
            <CardDescription>Apunta la cámara hacia el código QR</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="relative">
              {isScanning ? (
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-64 object-cover rounded-lg bg-black"
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-48 h-48 border-2 border-white border-dashed rounded-lg flex items-center justify-center">
                      {scanning && (
                        <div className="text-white text-center">
                          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                          <p className="text-sm">Procesando...</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full h-64 bg-muted rounded-lg flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <CameraOff className="w-12 h-12 mx-auto mb-2" />
                    <p>Cámara desactivada</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {!isScanning ? (
                <Button onClick={startCamera} className="flex-1">
                  <Camera className="w-4 h-4 mr-2" />
                  Iniciar Cámara
                </Button>
              ) : (
                <>
                  <Button onClick={captureAndProcessQR} disabled={scanning || processing} className="flex-1">
                    {processing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4 mr-2" />
                        Escanear QR
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={stopCamera}>
                    <CameraOff className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showResult} onOpenChange={handleModalClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {scanResult?.status === "success" && <CheckCircle className="w-5 h-5 text-green-600" />}
              {scanResult?.status === "not_found" && <XCircle className="w-5 h-5 text-red-600" />}
              {scanResult?.status === "error" && <AlertTriangle className="w-5 h-5 text-yellow-600" />}
              Resultado del Escaneo
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {scanResult && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">URL escaneada:</span>
                  </div>
                  <p className="text-xs text-muted-foreground break-all bg-muted p-2 rounded">{scanResult.url}</p>
                </div>

                {scanResult.identificacion && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Identificación encontrada:</span>
                    </div>
                    <Badge variant="outline" className="text-sm">
                      {scanResult.identificacion}
                    </Badge>
                  </div>
                )}

                {scanResult.status === "success" && scanResult.person && (
                  <Card className="border-green-200 bg-green-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-green-800">✅ Persona Encontrada</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="font-medium">Puesto:</span>
                          <p>{scanResult.person.puesto}</p>
                        </div>
                        <div>
                          <span className="font-medium">Identificación:</span>
                          <p>{scanResult.person.identificacion}</p>
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-sm">Nombre:</span>
                        <p className="text-sm">{scanResult.person.nombre}</p>
                      </div>
                      <div>
                        <span className="font-medium text-sm">Programa:</span>
                        <p className="text-sm">{scanResult.person.programa}</p>
                      </div>
                      <div>
                        <span className="font-medium text-sm">Cupos Extras:</span>
                        <p className="text-sm">{scanResult.person.cuposExtras}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {scanResult.status === "not_found" && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      La identificación {scanResult.identificacion} no se encuentra en la base de datos.
                    </AlertDescription>
                  </Alert>
                )}

                {scanResult.status === "error" && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>Error al procesar el código QR o acceder a la página web.</AlertDescription>
                  </Alert>
                )}

                <div className="text-xs text-muted-foreground text-center">
                  Escaneado el {new Date(scanResult.timestamp).toLocaleString()}
                </div>
              </>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={resetScanner} className="flex-1">
              <RefreshCw className="w-4 h-4 mr-2" />
              Escanear Otro
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
