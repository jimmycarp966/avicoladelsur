'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { X, Camera, SwitchCamera, Scan, Flashlight, FlashlightOff } from 'lucide-react'

interface BarcodeScannerProps {
    onScan: (code: string) => void
    onClose: () => void
    title?: string
    description?: string
}

// Intervalo de escaneo optimizado (ms) - más rápido = más intentos
const SCAN_INTERVAL_MS = 50

// Tiempo mínimo entre escaneos del mismo código (debounce)
const DEBOUNCE_MS = 1500

export function BarcodeScanner({
    onScan,
    onClose,
    title = 'Escanear Código',
    description = 'Apunta la cámara al código de barras'
}: BarcodeScannerProps) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [isScanning, setIsScanning] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
    const [selectedDevice, setSelectedDevice] = useState<string | null>(null)
    const [torchEnabled, setTorchEnabled] = useState(false)
    const [torchSupported, setTorchSupported] = useState(false)
    const [showDebug, setShowDebug] = useState(false)
    const readerRef = useRef<BrowserMultiFormatReader | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const frameCountRef = useRef<number>(0)

    // Debounce: último código escaneado y timestamp
    const lastScannedRef = useRef<{ code: string; time: number } | null>(null)

    // Debug logs para mostrar en pantalla (móvil)
    const [debugLogs, setDebugLogs] = useState<string[]>([])

    // Función para enviar logs a Vercel
    const logToServer = useCallback(async (level: 'info' | 'error' | 'warn', msg: string, details?: any) => {
        try {
            // No esperar respuesta para no bloquear UI
            fetch('/api/debug/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    component: 'BarcodeScanner',
                    level,
                    message: msg,
                    details
                })
            }).catch(e => console.error('Error enviando log remoto:', e))
        } catch (e) {
            // Ignorar errores de logging
        }
    }, [])

    const addDebugLog = (msg: string, isError = false) => {
        const timestamp = new Date().toLocaleTimeString()
        setDebugLogs(prev => [...prev.slice(-4), `${timestamp}: ${msg}`])
        console.log('[BarcodeScanner]', msg)

        // Enviar también al servidor para debugging remoto
        logToServer(isError ? 'error' : 'info', msg)
    }

    // Vibrar el dispositivo (feedback táctil)
    const vibrate = useCallback(() => {
        if ('vibrate' in navigator) {
            navigator.vibrate([100, 50, 100]) // Patrón: vibrar 100ms, pausa 50ms, vibrar 100ms
        }
    }, [])

    // Toggle antorcha/flash
    const toggleTorch = useCallback(async () => {
        if (!streamRef.current) return

        const track = streamRef.current.getVideoTracks()[0]
        if (!track) return

        try {
            // La API de torch no está en los tipos de TS pero funciona en Chrome/Android
            const constraints = { advanced: [{ torch: !torchEnabled }] } as MediaTrackConstraints
            await track.applyConstraints(constraints)
            setTorchEnabled(!torchEnabled)
            addDebugLog(`💡 Antorcha: ${!torchEnabled ? 'ON' : 'OFF'}`)
        } catch (err) {
            console.warn('Torch not supported:', err)
        }
    }, [torchEnabled])

    // SOLUCIÓN DEFINITIVA: Un solo useEffect que maneja todo el flujo
    useEffect(() => {
        if (!videoRef.current) return

        let isMounted = true
        let scanInterval: ReturnType<typeof setInterval> | null = null

        // Configurar el lector
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

        const startCamera = async () => {
            try {
                addDebugLog('Iniciando cámara...')

                // Obtener stream con resolución alta
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { ideal: 'environment' },
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                    }
                })

                if (!isMounted || !videoRef.current) {
                    stream.getTracks().forEach(t => t.stop())
                    return
                }

                // Asignar stream al video y mostrarlo
                videoRef.current.srcObject = stream
                streamRef.current = stream
                addDebugLog('Stream asignado al video')

                // Esperar a que el video esté listo para reproducir
                try {
                    await videoRef.current.play()
                    addDebugLog('Video reproduciendo')
                } catch (playError: any) {
                    addDebugLog(`⚠️ Play error: ${playError.message}`, true)
                }

                const track = stream.getVideoTracks()[0]
                const settings = track.getSettings()
                addDebugLog(`📷 Cámara: ${settings.width}x${settings.height}`)

                // Verificar antorcha
                const caps = track.getCapabilities?.()
                // @ts-ignore
                if (caps?.torch) {
                    setTorchSupported(true)
                    addDebugLog('💡 Antorcha disponible')
                }

                // Enumerar dispositivos para el selector
                const devices = await navigator.mediaDevices.enumerateDevices()
                const videoDevices = devices.filter(d => d.kind === 'videoinput')
                setDevices(videoDevices)
                setSelectedDevice(track.getSettings().deviceId || null)

                setIsScanning(true)
                setError(null)

                // Iniciar loop de escaneo
                addDebugLog('🔍 Escaneando...')
                scanInterval = setInterval(async () => {
                    if (!isMounted || !readerRef.current || !videoRef.current) return

                    frameCountRef.current++

                    // Log cada 200 frames (~10 segundos)
                    if (frameCountRef.current % 200 === 0) {
                        addDebugLog(`🔍 Buscando... (${frameCountRef.current})`)
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
                            logToServer('info', 'Código escaneado', { code, frames: frameCountRef.current })

                            vibrate()

                            // Limpiar antes de notificar
                            if (scanInterval) clearInterval(scanInterval)
                            stream.getTracks().forEach(t => t.stop())

                            onScan(code)
                        }
                    } catch {
                        // NotFoundException es normal - ignorar
                    }
                }, SCAN_INTERVAL_MS)

            } catch (err: any) {
                addDebugLog(`❌ Error: ${err.message}`, true)
                setError('No se pudo acceder a la cámara: ' + err.message)
                setIsScanning(false)
            }
        }

        startCamera()

        return () => {
            isMounted = false
            if (scanInterval) clearInterval(scanInterval)
            readerRef.current?.reset()
            streamRef.current?.getTracks().forEach(t => t.stop())
        }
    }, [onScan, vibrate, logToServer])

    const switchCamera = useCallback(() => {
        if (devices.length <= 1) return

        const currentIndex = devices.findIndex(d => d.deviceId === selectedDevice)
        const nextIndex = (currentIndex + 1) % devices.length
        setSelectedDevice(devices[nextIndex].deviceId)
        // Resetear estado de antorcha al cambiar cámara
        setTorchEnabled(false)
    }, [devices, selectedDevice])

    return (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Scan className="h-5 w-5" />
                        {title}
                    </CardTitle>
                    <Button variant="ghost" size="icon" onClick={onClose}>
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
                                    setSelectedDevice(devices[0]?.deviceId || null)
                                }}
                            >
                                Reintentar
                            </Button>
                        </div>
                    ) : (
                        <div className="relative bg-black rounded-lg overflow-hidden" style={{ minHeight: '300px' }}>
                            <video
                                ref={videoRef}
                                className="w-full h-full object-cover"
                                style={{ minHeight: '300px' }}
                                playsInline
                                muted
                                autoPlay
                            />

                            {/* Overlay con guía de escaneo */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-3/4 h-1/3 border-2 border-white/50 rounded-lg relative">
                                    {/* Esquinas destacadas */}
                                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-green-500 rounded-tl" />
                                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-green-500 rounded-tr" />
                                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-green-500 rounded-bl" />
                                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-green-500 rounded-br" />
                                    {/* Indicador de escaneo animado */}
                                    {isScanning && (
                                        <div className="absolute inset-x-0 top-1/2 h-0.5 bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
                                    )}
                                </div>
                            </div>

                            {/* Controles de cámara */}
                            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                                <span className={`text-xs px-2 py-1 rounded ${isScanning ? 'bg-green-500/80' : 'bg-gray-500/80'} text-white`}>
                                    {isScanning ? '● Escaneando...' : '○ Detenido'}
                                </span>

                                <div className="flex gap-1">
                                    {/* Botón de antorcha */}
                                    {torchSupported && (
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className={`${torchEnabled ? 'bg-yellow-500/80 hover:bg-yellow-600/80' : 'bg-white/20 hover:bg-white/30'}`}
                                            onClick={toggleTorch}
                                        >
                                            {torchEnabled ? (
                                                <Flashlight className="h-4 w-4" />
                                            ) : (
                                                <FlashlightOff className="h-4 w-4" />
                                            )}
                                        </Button>
                                    )}

                                    {/* Botón cambiar cámara */}
                                    {devices.length > 1 && (
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className="bg-white/20 hover:bg-white/30"
                                            onClick={switchCamera}
                                        >
                                            <SwitchCamera className="h-4 w-4 mr-1" />
                                            Cambiar
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Panel de Debug (visible en móvil) */}
                    {showDebug && debugLogs.length > 0 && (
                        <div className="bg-black/80 rounded-lg p-2 text-xs font-mono text-green-400 max-h-24 overflow-y-auto">
                            <div className="text-white/50 mb-1">Debug:</div>
                            {debugLogs.map((log, i) => (
                                <div key={i} className="truncate">{log}</div>
                            ))}
                        </div>
                    )}

                    <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={onClose}>
                                Cancelar
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs text-muted-foreground"
                                onClick={() => setShowDebug(!showDebug)}
                            >
                                {showDebug ? 'Ocultar Debug' : 'Debug'}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

// Botón para abrir el escáner (componente auxiliar)
interface ScanButtonProps {
    onScan: (code: string) => void
    variant?: 'default' | 'outline' | 'ghost'
    size?: 'default' | 'sm' | 'lg' | 'icon'
    className?: string
    title?: string
    description?: string
}

export function ScanButton({
    onScan,
    variant = 'outline',
    size = 'icon',
    className = '',
    title,
    description
}: ScanButtonProps) {
    const [isOpen, setIsOpen] = useState(false)

    const handleScan = useCallback((code: string) => {
        setIsOpen(false)
        onScan(code)
    }, [onScan])

    return (
        <>
            <Button
                variant={variant}
                size={size}
                className={className}
                onClick={() => setIsOpen(true)}
                type="button"
            >
                <Camera className="h-4 w-4" />
                {size !== 'icon' && <span className="ml-2">Escanear</span>}
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
