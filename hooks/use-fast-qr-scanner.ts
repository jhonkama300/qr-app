"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import jsQR from "jsqr"

interface UseFastQRScannerOptions {
  onQRDetected: (data: string) => void
  cooldown?: number
}

interface UseFastQRScannerReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  isScanning: boolean
  isDetecting: boolean
  cameraLoading: boolean
  error: string | null
  permissionDenied: boolean
  startCamera: () => Promise<void>
  stopCamera: () => void
  resetDetection: () => void
  setError: (err: string | null) => void
}

const CAMERA_TIMEOUT = 15000
const RESOLUTIONS = [
  { width: 640, height: 480 },
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
]

export function useFastQRScanner({
  onQRDetected,
  cooldown = 1500,
}: UseFastQRScannerOptions): UseFastQRScannerReturn {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [isDetecting, setIsDetecting] = useState(false)
  const [cameraLoading, setCameraLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)

  const scanLoopRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectedQRRef = useRef<string | null>(null)
  const lastScanTimeRef = useRef<number>(0)
  const scanningRef = useRef<boolean>(false)
  const detectionPausedRef = useRef<boolean>(false)
  const onQRDetectedRef = useRef(onQRDetected)
  const cameraTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  onQRDetectedRef.current = onQRDetected

  const clearCameraTimeout = () => {
    if (cameraTimeoutRef.current) {
      clearTimeout(cameraTimeoutRef.current)
      cameraTimeoutRef.current = null
    }
  }

  const startScanLoop = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d", { willReadFrequently: true })

    if (!ctx) return

    const scanFrame = () => {
      try {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight

          if (canvas.width === 0 || canvas.height === 0) {
            scanLoopRef.current = requestAnimationFrame(scanFrame)
            return
          }

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

          if (!detectionPausedRef.current) {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

            const code = jsQR(imageData.data, canvas.width, canvas.height, {
              inversionAttempts: "attemptBoth",
            })

            if (code && code.data) {
              const currentTime = Date.now()

              if (detectedQRRef.current !== code.data || currentTime - lastScanTimeRef.current > cooldown) {
                detectedQRRef.current = code.data
                lastScanTimeRef.current = currentTime
                setIsDetecting(true)
                detectionPausedRef.current = true

                if (navigator.vibrate) {
                  navigator.vibrate(200)
                }

                onQRDetectedRef.current(code.data)
              }
            } else {
              setIsDetecting(false)
            }
          }
        }

        if (scanningRef.current) {
          scanLoopRef.current = requestAnimationFrame(scanFrame)
        }
      } catch {
        if (scanningRef.current) {
          scanLoopRef.current = requestAnimationFrame(scanFrame)
        }
      }
    }

    scanLoopRef.current = requestAnimationFrame(scanFrame)
  }, [cooldown])

  const startCamera = useCallback(async () => {
    try {
      setCameraLoading(true)
      setError(null)
      setPermissionDenied(false)
      detectedQRRef.current = null
      lastScanTimeRef.current = 0
      detectionPausedRef.current = false
      clearCameraTimeout()

      let mediaStream: MediaStream | null = null
      let lastError: any = null

      for (const res of RESOLUTIONS) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: res.width },
              height: { ideal: res.height },
              frameRate: { ideal: 30 },
            },
            audio: false,
          })
          break
        } catch (err: any) {
          lastError = err
          await new Promise((resolve) => setTimeout(resolve, 200))
        }
      }

      if (!mediaStream) {
        throw lastError || new Error("No se pudo iniciar la cámara")
      }

      streamRef.current = mediaStream

      if (!videoRef.current) return

      videoRef.current.srcObject = mediaStream

      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch(() => {
          setCameraLoading(false)
          clearCameraTimeout()
          setError("No se pudo iniciar la reproducción de video")
        })
      }

      videoRef.current.onplaying = () => {
        clearCameraTimeout()
        setCameraLoading(false)
        setIsScanning(true)
        scanningRef.current = true
        startScanLoop()
      }

      videoRef.current.onerror = () => {
        clearCameraTimeout()
        setCameraLoading(false)
        setError("Error al acceder a la cámara")
      }

      cameraTimeoutRef.current = setTimeout(() => {
        setCameraLoading(false)
        setError("La cámara no pudo iniciarse. Verifica que ningún otro programa la esté usando.")
        stopCamera()
      }, CAMERA_TIMEOUT)
    } catch (err: any) {
      setCameraLoading(false)
      clearCameraTimeout()
      setPermissionDenied(err.name === "NotAllowedError")
      if (err.name === "NotAllowedError") {
        setError("Permiso de cámara denegado. Por favor, permite el acceso a la cámara.")
      } else if (err.name === "NotFoundError") {
        setError("No se encontró cámara en el dispositivo.")
      } else if (err.name === "NotReadableError") {
        setError("La cámara ya está siendo utilizada por otra aplicación.")
      } else {
        setError(`Error de cámara: ${err.message}`)
      }
    }
  }, [startScanLoop])

  const stopCamera = useCallback(() => {
    scanningRef.current = false
    setIsScanning(false)
    setIsDetecting(false)
    clearCameraTimeout()

    if (scanLoopRef.current !== null) {
      cancelAnimationFrame(scanLoopRef.current)
      scanLoopRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    detectedQRRef.current = null
    detectionPausedRef.current = false
  }, [])

  const resetDetection = useCallback(() => {
    lastScanTimeRef.current = Date.now()
    detectionPausedRef.current = false
    setIsDetecting(false)
  }, [])

  useEffect(() => {
    return () => {
      clearCameraTimeout()
      stopCamera()
    }
  }, [stopCamera])

  return {
    videoRef,
    canvasRef,
    isScanning,
    isDetecting,
    cameraLoading,
    error,
    permissionDenied,
    startCamera,
    stopCamera,
    resetDetection,
    setError,
  }
}
