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
  onQRDetectedRef.current = onQRDetected

  const startCamera = useCallback(async () => {
    try {
      setCameraLoading(true)
      setError(null)
      setPermissionDenied(false)
      detectedQRRef.current = null
      lastScanTimeRef.current = 0
      detectionPausedRef.current = false

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      })

      streamRef.current = stream

      if (!videoRef.current) return

      videoRef.current.srcObject = stream

      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch(() => {
          setError("No se pudo iniciar la reproducción de video")
        })
      }

      videoRef.current.onplaying = () => {
        setCameraLoading(false)
        setIsScanning(true)
        scanningRef.current = true
        startScanLoop()
      }

      videoRef.current.onerror = () => {
        setCameraLoading(false)
        setError("Error al acceder a la cámara")
      }
    } catch (err: any) {
      setCameraLoading(false)
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
  }, [])

  const startCameraRef = useRef(startCamera)
  startCameraRef.current = startCamera

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

  const stopCamera = useCallback(() => {
    scanningRef.current = false
    setIsScanning(false)
    setIsDetecting(false)

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
    detectedQRRef.current = null
    detectionPausedRef.current = false
    setIsDetecting(false)
  }, [])

  useEffect(() => {
    return () => {
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
