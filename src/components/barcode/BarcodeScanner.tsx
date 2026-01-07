'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { X, Scan, Flashlight, FlashlightOff } from 'lucide-react'

interface BarcodeScannerProps {
    onScan: (code: string) => void
    onClose: () => void
    title?: string
    description?: string
}

// Tiempo mínimo entre escaneos del mismo código (debounce)
const DEBOUNCE_MS = 2000

export function BarcodeScanner({
    onScan,
    onClose,
    title = 'Escanear Código',
    description = 'Apunta la cámara al código de barras'
}: BarcodeScannerProps) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const readerRef = useRef<BrowserMultiFormatReader | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const [isScanning, setIsScanning] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [torchEnabled, setTorchEnabled] = useState(false)
    const [torchSupported, setTorchSupported] = useState(false)
    const [showDebug, setShowDebug] = useState(false)
    const [debugLogs, setDebugLogs] = useState<string[]>([])
    const [videoSize, setVideoSize] = useState({ width: 0, height: 0 })

    // Debounce
    const lastScannedRef = useRef<{ code: string; time: number } | null>(null)

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

    // Iniciar cámara y escaneo
    useEffect(() => {
        let isMounted = true

        const startCamera = async () => {
            if (!videoRef.current) return

            try {
                addDebugLog('Solicitando permisos...')

                // Obtener stream (igual que en test-camera que funcionó)
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'environment',
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    }
                })

                if (!isMounted) {
                    stream.getTracks().forEach(t => t.stop())
                    return
                }

                addDebugLog('Stream obtenido')

                // Asignar stream al video
                videoRef.current.srcObject = stream
                streamRef.current = stream

                // Esperar metadata
                videoRef.current.onloadedmetadata = () => {
                    if (videoRef.current) {
                        setVideoSize({
                            width: videoRef.current.videoWidth,
                            height: videoRef.current.videoHeight
                        })
                        addDebugLog(`📷 Video: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`)
                    }
                }

                // Reproducir
                await videoRef.current.play()
                addDebugLog('Video reproduciendo')

                // Verificar antorcha
                const track = stream.getVideoTracks()[0]
                const caps = track.getCapabilities?.()
                // @ts-ignore
                if (caps?.torch) {
                    setTorchSupported(true)
                    addDebugLog('💡 Antorcha disponible')
                }

                // Configurar lector de códigos
                const hints = new Map()
                hints.set(DecodeHintType.POSSIBLE_FORMATS, [
                    BarcodeFormat.EAN_13,
                    BarcodeFormat.CODE_128,
                    BarcodeFormat.QR_CODE,
                    BarcodeFormat.UPC_A,
                    BarcodeFormat.EAN_8,
                ])
                hints.set(DecodeHintType.TRY_HARDER, true)

                readerRef.current = new BrowserMultiFormatReader(hints)

                setIsScanning(true)
                setError(null)
                addDebugLog('🔍 Escaneando...')

                // Loop de escaneo
                let frameCount = 0
                scanIntervalRef.current = setInterval(async () => {
                    if (!isMounted || !readerRef.current || !videoRef.current) return

                    frameCount++

                    // Log cada 200 frames
                    if (frameCount % 200 === 0) {
                        addDebugLog(`🔍 Frame ${frameCount}...`)
                    }

                    try {
                        const result = await readerRef.current.decodeFromVideoElement(videoRef.current)

                        if (result) {
                            const code = result.getText()
                            const now = Date.now()

                            // Debounce
                            if (lastScannedRef.current &&
                                lastScannedRef.current.code === code &&
                                now - lastScannedRef.current.time < DEBOUNCE_MS) {
                                return
                            }

                            lastScannedRef.current = { code, time: now }

                            addDebugLog(`✅ CÓDIGO: ${code}`)
                            logToServer('info', 'Código escaneado', { code })

                            vibrate()

                            // Limpiar y notificar
                            if (scanIntervalRef.current) clearInterval(scanIntervalRef.current)
                            stream.getTracks().forEach(t => t.stop())

                            onScan(code)
                        }
                    } catch {
                        // NotFoundException es normal
                    }
                }, 100)

            } catch (err: any) {
                addDebugLog(`❌ Error: ${err.message}`, true)
                setError('No se pudo acceder a la cámara: ' + err.message)
            }
        }

        startCamera()

        return () => {
            isMounted = false
            if (scanIntervalRef.current) clearInterval(scanIntervalRef.current)
            readerRef.current?.reset()
            streamRef.current?.getTracks().forEach(t => t.stop())
        }
    }, [addDebugLog, logToServer, onScan, vibrate])

    // Toggle antorcha
    const toggleTorch = useCallback(async () => {
        if (!streamRef.current) return

        try {
            const track = streamRef.current.getVideoTracks()[0]
            const newState = !torchEnabled
            // @ts-ignore
            await track.applyConstraints({ advanced: [{ torch: newState }] })
            setTorchEnabled(newState)
            addDebugLog(`💡 Antorcha: ${newState ? 'ON' : 'OFF'}`)
        } catch (err: any) {
            addDebugLog(`Antorcha error: ${err.message}`, true)
        }
    }, [torchEnabled, addDebugLog])

    // Cerrar
    const handleClose = useCallback(() => {
        if (scanIntervalRef.current) clearInterval(scanIntervalRef.current)
        streamRef.current?.getTracks().forEach(t => t.stop())
        onClose()
    }, [onClose])

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
                                onClick={() => window.location.reload()}
                            >
                                Reintentar
                            </Button>
                        </div>
                    ) : (
                        <div
                            className="relative bg-black rounded-lg overflow-hidden"
                            style={{ width: '100%', height: '300px' }}
                        >
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

                            {/* Controles */}
                            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                                <span className={`text-xs px-2 py-1 rounded ${isScanning ? 'bg-green-500/80' : 'bg-gray-500/80'} text-white`}>
                                    {isScanning ? `● ${videoSize.width}x${videoSize.height}` : '○ Iniciando...'}
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

                    {/* Debug panel */}
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

// Componente auxiliar para el botón de escaneo
interface ScanButtonProps {
    onScan: (code: string) => void
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

    const handleScan = (code: string) => {
        setIsOpen(false)
        onScan(code)
    }

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
                />
            )}
        </>
    )
}
