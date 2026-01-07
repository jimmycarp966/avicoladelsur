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

// Intervalo de escaneo optimizado (ms)
const SCAN_INTERVAL_MS = 100

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

    // Debounce: último código escaneado y timestamp
    const lastScannedRef = useRef<{ code: string; time: number } | null>(null)

    // Debug logs para mostrar en pantalla (móvil)
    const [debugLogs, setDebugLogs] = useState<string[]>([])
    const addDebugLog = (msg: string) => {
        const timestamp = new Date().toLocaleTimeString()
        setDebugLogs(prev => [...prev.slice(-4), `${timestamp}: ${msg}`])
        console.log('[BarcodeScanner]', msg)
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

    // Inicializar lector y solicitar permisos de cámara
    useEffect(() => {
        const hints = new Map()
        // Formatos de código de barras soportados - Ampliado para mayor compatibilidad
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.EAN_13,
            BarcodeFormat.CODE_128,
            BarcodeFormat.QR_CODE,
            BarcodeFormat.UPC_A,
            BarcodeFormat.EAN_8,
            BarcodeFormat.CODE_39,
            BarcodeFormat.ITF,
        ])
        // Configuraciones adicionales para mejor detección
        hints.set(DecodeHintType.TRY_HARDER, true)
        hints.set(DecodeHintType.PURE_BARCODE, false)
        // @ts-ignore
        hints.set(DecodeHintType.ALSO_INVERTED, true)

        readerRef.current = new BrowserMultiFormatReader(hints, SCAN_INTERVAL_MS)


        // Función para obtener cámaras después de tener permisos
        const getCameras = async () => {
            try {
                // IMPORTANTE: En iOS y algunos Android, necesitamos solicitar permisos
                // con getUserMedia ANTES de poder enumerar dispositivos
                addDebugLog('Solicitando permisos cámara...')

                // Solicitar permiso de cámara con configuración más compatible
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { ideal: 'environment' },
                        // Usar ideal en lugar de min/max estrictos para evitar OverconstrainedError
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        // @ts-ignore
                        focusMode: { ideal: 'continuous' },
                        // @ts-ignore
                        exposureMode: { ideal: 'continuous' },
                        // @ts-ignore
                        whiteBalanceMode: { ideal: 'continuous' },
                    }
                })

                // Verificar si la antorcha está soportada
                const track = stream.getVideoTracks()[0]
                if (track) {
                    const capabilities = track.getCapabilities?.()
                    // @ts-ignore
                    if (capabilities?.torch) {
                        setTorchSupported(true)
                        addDebugLog('💡 Antorcha disponible')
                    }
                }

                // Detener el stream temporal (solo lo usamos para obtener permisos)
                stream.getTracks().forEach(track => track.stop())

                // Ahora sí podemos enumerar los dispositivos correctamente
                const deviceList = await navigator.mediaDevices.enumerateDevices()
                const videoDevices = deviceList.filter(d => d.kind === 'videoinput')

                addDebugLog(`Permisos OK - ${videoDevices.length} cámaras`)
                setDevices(videoDevices)

                // Preferir cámara trasera si está disponible
                // Buscar por varios términos comunes en diferentes idiomas/dispositivos
                const backCamera = videoDevices.find(d => {
                    const label = d.label.toLowerCase()
                    return label.includes('back') ||
                        label.includes('trasera') ||
                        label.includes('rear') ||
                        label.includes('environment') ||
                        label.includes('posterior') ||
                        label.includes('main') ||
                        label.includes('0') // En algunos dispositivos, cámara 0 es la trasera
                })
                setSelectedDevice(backCamera?.deviceId || videoDevices[0]?.deviceId || null)

            } catch (err: any) {
                addDebugLog(`❌ Error: ${err.name} - ${err.message}`)

                if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                    setError('Permisos de cámara denegados. Por favor, habilita el acceso a la cámara en la configuración de tu navegador.')
                } else if (err.name === 'NotFoundError') {
                    setError('No se encontró ninguna cámara en este dispositivo.')
                } else if (err.name === 'NotReadableError') {
                    setError('La cámara está siendo usada por otra aplicación.')
                } else if (err.name === 'OverconstrainedError') {
                    setError('La cámara no soporta la configuración solicitada. Intentando con configuración básica...')
                } else {
                    setError('No se pudo acceder a la cámara: ' + err.message)
                }
            }
        }

        getCameras()

        return () => {
            readerRef.current?.reset()
            streamRef.current?.getTracks().forEach(track => track.stop())
        }
    }, [])

    // Iniciar escaneo cuando se selecciona un dispositivo
    useEffect(() => {
        if (!selectedDevice || !videoRef.current || !readerRef.current) return

        let isMounted = true

        const startScanning = async () => {
            if (!readerRef.current || !videoRef.current) return

            try {
                await readerRef.current.decodeFromVideoDevice(
                    selectedDevice,
                    videoRef.current,
                    (result, err) => {
                        if (!isMounted) return

                        if (result) {
                            const code = result.getText()
                            const now = Date.now()

                            // Debounce: evitar escaneos duplicados del mismo código
                            if (lastScannedRef.current &&
                                lastScannedRef.current.code === code &&
                                now - lastScannedRef.current.time < DEBOUNCE_MS) {
                                return // Ignorar escaneo duplicado
                            }

                            // Guardar último escaneo
                            lastScannedRef.current = { code, time: now }

                            addDebugLog(`✅ Código: ${code}`)

                            // Feedback táctil
                            vibrate()

                            // Notificar al componente padre
                            onScan(code)
                            readerRef.current?.reset()
                            setIsScanning(false)
                        }
                        // Filtrar errores normales del proceso de escaneo
                        // Estos ocurren constantemente cuando no hay código visible en el frame
                        if (err && ![
                            'NotFoundException',
                            'ChecksumException',
                            'FormatException'
                        ].includes(err.name) && !err.message?.includes('No MultiFormat Readers')) {
                            addDebugLog(`❌ ${err.name}: ${err.message}`)
                        }
                    }

                )

                // Guardar referencia al stream para control de antorcha
                if (videoRef.current.srcObject) {
                    streamRef.current = videoRef.current.srcObject as MediaStream

                    // Verificar soporte de antorcha con el stream activo
                    const track = streamRef.current.getVideoTracks()[0]
                    if (track) {
                        const settings = track.getSettings()
                        addDebugLog(`📷 Res: ${settings.width}x${settings.height}`)

                        const capabilities = track.getCapabilities?.()
                        // @ts-ignore
                        if (capabilities?.torch) {
                            setTorchSupported(true)
                        }
                    }
                }

                if (isMounted) {
                    setIsScanning(true)
                    setError(null)
                }
            } catch (err: any) {
                addDebugLog(`❌ No se pudo iniciar cámara: ${err.message}`)
                if (isMounted) {
                    setError('No se pudo iniciar la cámara. Verifica los permisos.')
                    setIsScanning(false)
                }
            }
        }

        startScanning()

        return () => {
            isMounted = false
            readerRef.current?.reset()
        }
    }, [selectedDevice, onScan, vibrate])

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
                        <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden">
                            <video
                                ref={videoRef}
                                className="w-full h-full object-cover"
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
