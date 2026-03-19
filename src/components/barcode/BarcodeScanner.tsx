'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
    MultiFormatReader,
    BarcodeFormat,
    DecodeHintType,
    RGBLuminanceSource,
    BinaryBitmap,
    HybridBinarizer
} from '@zxing/library'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { X, Scan, Flashlight, FlashlightOff } from 'lucide-react'
import { useSoundAlert } from '@/components/ui/sound-alert'

interface BarcodeScannerProps {
    onScan: (code: string) => void | boolean | Promise<void | boolean>
    onClose: () => void
    title?: string
    description?: string
    autoStart?: boolean  // Si true, inicia cámara automáticamente sin botón
}

// Tiempo mínimo entre escaneos del mismo código (debounce)
const DEBOUNCE_MS = 2000
const REQUIRED_CONFIRMATIONS = 2
const CONFIRMATION_WINDOW_MS = 1200

export function BarcodeScanner({
    onScan,
    onClose,
    title = 'Escanear Código',
    description = 'Apunta la cámara al código de barras',
    autoStart = false
}: BarcodeScannerProps) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const workCanvasRef = useRef<HTMLCanvasElement | null>(null)
    const readerRef = useRef<MultiFormatReader | null>(null)
    const processingScanRef = useRef(false)

    // Hook de sonido para el beep de escáner
    const { playScannerBeep } = useSoundAlert(true)

    // Estado
    const [isScanning, setIsScanning] = useState(false)
    const [cameraStarted, setCameraStarted] = useState(false) // Control para user gesture
    const [error, setError] = useState<string | null>(null)
    const [torchEnabled, setTorchEnabled] = useState(false)
    const [torchSupported, setTorchSupported] = useState(false)
    const [showDebug, setShowDebug] = useState(false)
    const [debugLogs, setDebugLogs] = useState<string[]>([])
    const [videoSize, setVideoSize] = useState({ width: 0, height: 0 })

    // Debounce
    const lastScannedRef = useRef<{ code: string; time: number } | null>(null)
    const candidateScanRef = useRef<{ code: string; count: number; lastSeen: number } | null>(null)

    // Logging
    const logToServer = useCallback(async (level: 'info' | 'error' | 'warn', msg: string, details?: any) => {
        try {
            fetch('/api/debug/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ component: 'BarcodeScanner', level, message: msg, details })
            }).catch(() => { })
        } catch {
            // Ignorar
        }
    }, [])

    const addDebugLog = useCallback((msg: string, isError = false) => {
        const timestamp = new Date().toLocaleTimeString()
        setDebugLogs(prev => [...prev.slice(-4), `${timestamp}: ${msg}`])
        console.log('[BarcodeScanner]', msg)
        logToServer(isError ? 'error' : 'info', msg)
    }, [logToServer])

    const vibrate = useCallback(() => {
        if (navigator.vibrate) navigator.vibrate(100)
    }, [])

    // Inicializar Reader (una sola vez)
    useEffect(() => {
        const hints = new Map()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.EAN_13,
            BarcodeFormat.CODE_128,
            BarcodeFormat.QR_CODE,
            BarcodeFormat.UPC_A,
            BarcodeFormat.EAN_8,
        ])
        hints.set(DecodeHintType.TRY_HARDER, true)
        hints.set(DecodeHintType.ALSO_INVERTED, true)

        readerRef.current = new MultiFormatReader()
        readerRef.current.setHints(hints)

        // Crear canvas offscreen
        canvasRef.current = document.createElement('canvas')
        workCanvasRef.current = document.createElement('canvas')
    }, [])

    // Función para detener todo (declarada ANTES de startCamera para evitar TDZ)
    const stopAll = useCallback(() => {
        if (scanIntervalRef.current) {
            clearInterval(scanIntervalRef.current)
            scanIntervalRef.current = null
        }
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null
        processingScanRef.current = false
        candidateScanRef.current = null
        setIsScanning(false)
        readerRef.current?.reset()
    }, [])

    const decodeImageData = useCallback((
        imageData: ImageData,
        options?: { threshold?: number; autoContrast?: boolean; invert?: boolean }
    ): string | null => {
        if (!readerRef.current) return null

        const { width, height, data } = imageData
        const luminances = new Uint8ClampedArray(data.length / 4)
        let min = 255
        let max = 0

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i]
            const g = data[i + 1]
            const b = data[i + 2]
            const grayscale = ((r * 2 + g * 5 + b) >> 3) & 0xFF
            const index = i / 4
            luminances[index] = grayscale

            if (options?.autoContrast) {
                if (grayscale < min) min = grayscale
                if (grayscale > max) max = grayscale
            }
        }

        if (options?.autoContrast && max > min) {
            const scale = 255 / (max - min)
            for (let i = 0; i < luminances.length; i++) {
                luminances[i] = Math.max(0, Math.min(255, Math.round((luminances[i] - min) * scale)))
            }
        }

        for (let i = 0; i < luminances.length; i++) {
            let value = luminances[i]
            if (options?.invert) {
                value = 255 - value
            }
            if (typeof options?.threshold === 'number') {
                value = value >= options.threshold ? 255 : 0
            }
            luminances[i] = value
        }

        try {
            const source = new RGBLuminanceSource(luminances, width, height)
            const binaryBitmap = new BinaryBitmap(new HybridBinarizer(source))
            return readerRef.current.decode(binaryBitmap).getText()
        } catch {
            return null
        }
    }, [])

    const tryDecodeFrame = useCallback((): string | null => {
        if (!videoRef.current || !canvasRef.current || !workCanvasRef.current) return null
        if (videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) return null

        const video = videoRef.current
        const fullCanvas = canvasRef.current
        const workCanvas = workCanvasRef.current
        const fullCtx = fullCanvas.getContext('2d')
        const workCtx = workCanvas.getContext('2d')
        if (!fullCtx || !workCtx) return null

        // Attempt 1: full frame grayscale.
        fullCtx.drawImage(video, 0, 0, fullCanvas.width, fullCanvas.height)
        const fullImage = fullCtx.getImageData(0, 0, fullCanvas.width, fullCanvas.height)
        const fullDecoded = decodeImageData(fullImage)
        if (fullDecoded) return fullDecoded

        // Attempt 2: full frame with auto-contrast.
        const fullContrastDecoded = decodeImageData(fullImage, { autoContrast: true })
        if (fullContrastDecoded) return fullContrastDecoded

        // Attempt 3: central crop (barcode guide area), upscaled.
        const cropWidth = Math.floor(fullCanvas.width * 0.75)
        const cropHeight = Math.floor(fullCanvas.height * 0.36)
        const cropX = Math.floor((fullCanvas.width - cropWidth) / 2)
        const cropY = Math.floor((fullCanvas.height - cropHeight) / 2)

        workCanvas.width = cropWidth * 2
        workCanvas.height = cropHeight * 2
        workCtx.drawImage(
            video,
            cropX,
            cropY,
            cropWidth,
            cropHeight,
            0,
            0,
            workCanvas.width,
            workCanvas.height
        )
        const croppedImage = workCtx.getImageData(0, 0, workCanvas.width, workCanvas.height)
        const croppedDecoded = decodeImageData(croppedImage, { autoContrast: true })
        if (croppedDecoded) return croppedDecoded

        // Attempt 4: threshold variants.
        const thresholds = [95, 125, 155]
        for (const threshold of thresholds) {
            const thresholdDecoded = decodeImageData(croppedImage, { autoContrast: true, threshold })
            if (thresholdDecoded) return thresholdDecoded
        }

        // Attempt 5: inverted threshold for glare/reflections.
        const invertedDecoded = decodeImageData(croppedImage, {
            autoContrast: true,
            threshold: 125,
            invert: true,
        })
        if (invertedDecoded) return invertedDecoded

        return null
    }, [decodeImageData])

    // Funcion para iniciar camara (User Gesture Triggered)
    const startCamera = useCallback(async () => {
        if (!videoRef.current) return

        setCameraStarted(true)

        try {
            addDebugLog('Solicitando permisos...')

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            })

            addDebugLog('Stream obtenido')

            videoRef.current.srcObject = stream
            streamRef.current = stream

            videoRef.current.onloadedmetadata = () => {
                if (videoRef.current) {
                    setVideoSize({
                        width: videoRef.current.videoWidth,
                        height: videoRef.current.videoHeight
                    })
                    addDebugLog(`Video metadata: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`)

                    if (canvasRef.current) {
                        canvasRef.current.width = videoRef.current.videoWidth
                        canvasRef.current.height = videoRef.current.videoHeight
                    }
                }
            }

            await videoRef.current.play()
            addDebugLog('Video reproduciendo')

            const track = stream.getVideoTracks()[0]
            const caps = track.getCapabilities?.()
            // @ts-expect-error - torch es una capacidad no estandar
            if (caps?.torch) {
                setTorchSupported(true)
                addDebugLog('Antorcha disponible')
            }

            setIsScanning(true)
            setError(null)
            addDebugLog('Escaneando (modo robusto)...')

            let frameCount = 0
            scanIntervalRef.current = setInterval(() => {
                if (processingScanRef.current) return

                frameCount++
                if (frameCount % 200 === 0) {
                    addDebugLog(`Frame ${frameCount}`)
                }

                const code = tryDecodeFrame()
                if (!code) return

                const now = Date.now()
                const lastCandidate = candidateScanRef.current
                if (
                    !lastCandidate ||
                    lastCandidate.code !== code ||
                    now - lastCandidate.lastSeen > CONFIRMATION_WINDOW_MS
                ) {
                    candidateScanRef.current = { code, count: 1, lastSeen: now }
                    return
                }

                const nextCount = lastCandidate.count + 1
                candidateScanRef.current = { code, count: nextCount, lastSeen: now }
                if (nextCount < REQUIRED_CONFIRMATIONS) {
                    return
                }
                candidateScanRef.current = null

                if (
                    lastScannedRef.current &&
                    lastScannedRef.current.code === code &&
                    now - lastScannedRef.current.time < DEBOUNCE_MS
                ) {
                    return
                }

                processingScanRef.current = true

                addDebugLog(`CODIGO detectado: ${code}`)
                logToServer('info', 'Código detectado', { code })

                Promise.resolve(onScan(code))
                    .then((scanResult) => {
                        if (scanResult === false) {
                            addDebugLog(`Lectura rechazada, continuando: ${code}`)
                            logToServer('warn', 'Lectura rechazada por flujo', { code })
                            return
                        }

                        lastScannedRef.current = { code, time: Date.now() }
                        vibrate()
                        playScannerBeep()
                        stopAll()
                        onClose()
                    })
                    .catch((scanError: unknown) => {
                        const message = scanError instanceof Error ? scanError.message : 'Error desconocido'
                        addDebugLog(`Error procesando código: ${message}`, true)
                        logToServer('error', 'Error procesando código detectado', { code, message })
                    })
                    .finally(() => {
                        processingScanRef.current = false
                    })
            }, 100)
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error desconocido'
            addDebugLog(`Error: ${message}`, true)
            setError('No se pudo acceder a la camara: ' + message)
            setCameraStarted(false)
        }
    }, [addDebugLog, logToServer, onClose, onScan, playScannerBeep, stopAll, tryDecodeFrame, vibrate])

    // Auto-start cámara si autoStart es true
    useEffect(() => {
        if (autoStart && !cameraStarted) {
            startCamera()
        }
    }, [autoStart, cameraStarted, startCamera])

    // Cleanup
    useEffect(() => {
        return () => {
            stopAll()
        }
    }, [stopAll])

    // Toggle antorcha
    const toggleTorch = useCallback(async () => {
        if (!streamRef.current) return
        try {
            const track = streamRef.current.getVideoTracks()[0]
            const newState = !torchEnabled
            // @ts-expect-error - torch constraint no está en los tipos estándar
            await track.applyConstraints({ advanced: [{ torch: newState }] })
            setTorchEnabled(newState)
            addDebugLog(`💡 Antorcha: ${newState ? 'ON' : 'OFF'}`)
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error desconocido'
            addDebugLog(`Antorcha error: ${message}`, true)
        }
    }, [torchEnabled, addDebugLog])

    // Cerrar UI
    const handleClose = useCallback(() => {
        stopAll()
        onClose()
    }, [onClose, stopAll])

    return (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Scan className="h-5 w-5" />
                        {title}
                    </CardTitle>
                    <Button variant="ghost" size="icon" onClick={handleClose}>
                        <X className="h-5 w-5" />
                    </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{description}</p>

                    {error ? (
                        <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-center">
                            {error}
                            <Button
                                variant="outline"
                                className="mt-2 w-full"
                                onClick={() => {
                                    setError(null)
                                    void startCamera()
                                }}
                            >
                                Reintentar
                            </Button>
                        </div>
                    ) : (
                        <div
                            className="relative bg-black rounded-lg overflow-hidden"
                            style={{ width: '100%', height: '300px', position: 'relative' }}
                        >
                            {/* Video: Siempre montado, gestionado manualmente */}
                            <video
                                ref={videoRef}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    display: 'block'
                                }}
                                playsInline
                                muted
                                autoPlay
                            />

                            {/* Botón de Inicio (Overlay) */}
                            {!cameraStarted && (
                                <div className="absolute inset-0 z-20 bg-gray-100 flex flex-col items-center justify-center">
                                    <Scan className="h-16 w-16 text-gray-400 mb-4" />
                                    <p className="text-sm text-gray-600 mb-4 text-center px-4">
                                        Toca para activar la cámara
                                    </p>
                                    <Button onClick={startCamera} size="lg">
                                        <Scan className="h-5 w-5 mr-2" />
                                        Iniciar Cámara
                                    </Button>
                                </div>
                            )}

                            {/* Guía de escaneo */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-3/4 h-1/3 border-2 border-white/50 rounded-lg relative">
                                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-green-500 rounded-tl" />
                                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-green-500 rounded-tr" />
                                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-green-500 rounded-bl" />
                                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-green-500 rounded-br" />
                                    {isScanning && (
                                        <div className="absolute inset-x-0 top-1/2 h-0.5 bg-green-500 animate-pulse" />
                                    )}
                                </div>
                            </div>

                            {/* Info bar */}
                            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                                <span className={`text-xs px-2 py-1 rounded ${isScanning ? 'bg-green-500/80' : 'bg-gray-500/80'} text-white`}>
                                    {isScanning ? `● ${videoSize.width}x${videoSize.height}` : '○ Esperando'}
                                </span>

                                <div className="flex gap-1">
                                    {torchSupported && (
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className={`${torchEnabled ? 'bg-yellow-500/80' : 'bg-white/20'}`}
                                            onClick={toggleTorch}
                                        >
                                            {torchEnabled ? <Flashlight className="h-4 w-4" /> : <FlashlightOff className="h-4 w-4" />}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Logs de depuración */}
                    {showDebug && (
                        <div className="bg-black text-green-400 p-2 rounded text-xs font-mono max-h-32 overflow-y-auto">
                            {debugLogs.length > 0 ? (
                                debugLogs.map((log, i) => <div key={i}>{log}</div>)
                            ) : (
                                <div>Esperando logs...</div>
                            )}
                        </div>
                    )}

                    <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={handleClose}>
                            Cancelar
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowDebug(!showDebug)}
                        >
                            Debug
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

// Componente auxiliar
interface ScanButtonProps {
    onScan: (code: string) => void | boolean | Promise<void | boolean>
    className?: string
    variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive'
    size?: 'default' | 'sm' | 'lg' | 'icon'
    title?: string
    description?: string
    disabled?: boolean
}

export function ScanButton({
    onScan,
    className,
    variant = 'outline',
    size = 'default',
    title,
    description,
    disabled = false
}: ScanButtonProps) {
    const [isOpen, setIsOpen] = useState(false)

    const handleScan = useCallback((code: string) => {
        return onScan(code)
    }, [onScan])

    return (
        <>
            <Button
                variant={variant}
                size={size}
                className={className}
                onClick={() => setIsOpen(true)}
                disabled={disabled}
            >
                <Scan className="h-4 w-4 mr-2" />
                Escanear
            </Button>

            {isOpen && (
                <BarcodeScanner
                    onScan={handleScan}
                    onClose={() => setIsOpen(false)}
                    title={title}
                    description={description}
                    autoStart={true}  // Iniciar cámara automáticamente
                />
            )}
        </>
    )
}


