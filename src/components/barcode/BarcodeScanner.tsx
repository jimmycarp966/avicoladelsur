'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { X, Scan, SwitchCamera, Flashlight, FlashlightOff } from 'lucide-react'

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
    const scannerRef = useRef<Html5Qrcode | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [isScanning, setIsScanning] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [cameras, setCameras] = useState<{ id: string; label: string }[]>([])
    const [currentCameraIndex, setCurrentCameraIndex] = useState(0)
    const [torchEnabled, setTorchEnabled] = useState(false)
    const [showDebug, setShowDebug] = useState(false)
    const [debugLogs, setDebugLogs] = useState<string[]>([])

    // Debounce: último código escaneado y timestamp
    const lastScannedRef = useRef<{ code: string; time: number } | null>(null)

    // Función para enviar logs a Vercel
    const logToServer = useCallback(async (level: 'info' | 'error' | 'warn', msg: string, details?: any) => {
        try {
            fetch('/api/debug/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    component: 'BarcodeScanner',
                    level,
                    message: msg,
                    details
                })
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

    // Vibrar el dispositivo (feedback táctil)
    const vibrate = useCallback(() => {
        if (navigator.vibrate) {
            navigator.vibrate(100)
        }
    }, [])

    // Inicializar el escáner
    useEffect(() => {
        const containerId = 'barcode-scanner-container'

        const initScanner = async () => {
            try {
                addDebugLog('Inicializando escáner...')

                // Obtener cámaras disponibles
                const devices = await Html5Qrcode.getCameras()

                if (devices && devices.length > 0) {
                    const cameraList = devices.map(d => ({ id: d.id, label: d.label || `Cámara ${d.id.slice(-4)}` }))
                    setCameras(cameraList)
                    addDebugLog(`${devices.length} cámaras encontradas`)

                    // Preferir cámara trasera
                    const backCameraIndex = devices.findIndex(d =>
                        d.label.toLowerCase().includes('back') ||
                        d.label.toLowerCase().includes('trasera') ||
                        d.label.toLowerCase().includes('rear') ||
                        d.label.toLowerCase().includes('environment')
                    )
                    const startIndex = backCameraIndex >= 0 ? backCameraIndex : 0
                    setCurrentCameraIndex(startIndex)

                    // Crear instancia del escáner
                    scannerRef.current = new Html5Qrcode(containerId, {
                        verbose: false,
                        formatsToSupport: [
                            Html5QrcodeSupportedFormats.EAN_13,
                            Html5QrcodeSupportedFormats.EAN_8,
                            Html5QrcodeSupportedFormats.CODE_128,
                            Html5QrcodeSupportedFormats.CODE_39,
                            Html5QrcodeSupportedFormats.QR_CODE,
                            Html5QrcodeSupportedFormats.UPC_A,
                            Html5QrcodeSupportedFormats.UPC_E,
                            Html5QrcodeSupportedFormats.ITF,
                        ]
                    })

                    // Iniciar escaneo
                    await startScanning(devices[startIndex].id)
                } else {
                    throw new Error('No se encontraron cámaras')
                }
            } catch (err: any) {
                addDebugLog(`❌ Error: ${err.message}`, true)
                setError('No se pudo acceder a la cámara: ' + err.message)
            }
        }

        const startScanning = async (cameraId: string) => {
            if (!scannerRef.current) return

            try {
                addDebugLog(`Iniciando cámara ${cameraId.slice(-8)}...`)

                await scannerRef.current.start(
                    cameraId,
                    {
                        fps: 10,
                        qrbox: { width: 280, height: 150 },
                        aspectRatio: 1.333, // 4:3
                    },
                    (decodedText) => {
                        const now = Date.now()

                        // Debounce
                        if (lastScannedRef.current &&
                            lastScannedRef.current.code === decodedText &&
                            now - lastScannedRef.current.time < DEBOUNCE_MS) {
                            return
                        }

                        lastScannedRef.current = { code: decodedText, time: now }

                        addDebugLog(`✅ CÓDIGO: ${decodedText}`)
                        logToServer('info', 'Código escaneado', { code: decodedText })

                        vibrate()

                        // Detener y notificar
                        scannerRef.current?.stop().then(() => {
                            onScan(decodedText)
                        }).catch(() => {
                            onScan(decodedText)
                        })
                    },
                    () => {
                        // Error de escaneo (normal cuando no hay código visible)
                    }
                )

                setIsScanning(true)
                setError(null)
                addDebugLog('📷 Escáner activo')

            } catch (err: any) {
                addDebugLog(`❌ Error iniciando: ${err.message}`, true)
                setError('Error al iniciar la cámara: ' + err.message)
            }
        }

        initScanner()

        return () => {
            if (scannerRef.current && scannerRef.current.isScanning) {
                scannerRef.current.stop().catch(() => { })
            }
        }
    }, [addDebugLog, logToServer, onScan, vibrate])

    // Cambiar cámara
    const switchCamera = useCallback(async () => {
        if (cameras.length <= 1 || !scannerRef.current) return

        const nextIndex = (currentCameraIndex + 1) % cameras.length

        try {
            if (scannerRef.current.isScanning) {
                await scannerRef.current.stop()
            }

            await scannerRef.current.start(
                cameras[nextIndex].id,
                {
                    fps: 10,
                    qrbox: { width: 280, height: 150 },
                    aspectRatio: 1.333,
                },
                (decodedText) => {
                    const now = Date.now()
                    if (lastScannedRef.current &&
                        lastScannedRef.current.code === decodedText &&
                        now - lastScannedRef.current.time < DEBOUNCE_MS) {
                        return
                    }
                    lastScannedRef.current = { code: decodedText, time: now }
                    addDebugLog(`✅ CÓDIGO: ${decodedText}`)
                    vibrate()
                    scannerRef.current?.stop().then(() => onScan(decodedText)).catch(() => onScan(decodedText))
                },
                () => { }
            )

            setCurrentCameraIndex(nextIndex)
            addDebugLog(`Cámara cambiada: ${cameras[nextIndex].label}`)
        } catch (err: any) {
            addDebugLog(`Error cambiando cámara: ${err.message}`, true)
        }
    }, [cameras, currentCameraIndex, addDebugLog, vibrate, onScan])

    // Toggle antorcha
    const toggleTorch = useCallback(async () => {
        if (!scannerRef.current) return

        try {
            const newState = !torchEnabled
            // @ts-ignore - applyVideoConstraints acepta torch
            await scannerRef.current.applyVideoConstraints({
                // @ts-ignore
                advanced: [{ torch: newState }]
            })
            setTorchEnabled(newState)
            addDebugLog(`💡 Antorcha: ${newState ? 'ON' : 'OFF'}`)
        } catch (err: any) {
            addDebugLog(`Antorcha no soportada: ${err.message}`, true)
        }
    }, [torchEnabled, addDebugLog])

    // Cerrar escáner
    const handleClose = useCallback(() => {
        if (scannerRef.current && scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(() => { })
        }
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
                        <div className="relative bg-black rounded-lg overflow-hidden">
                            {/* Contenedor del escáner - html5-qrcode requiere un div con ID */}
                            <div
                                id="barcode-scanner-container"
                                ref={containerRef}
                                style={{ width: '100%', minHeight: '300px' }}
                            />

                            {/* Controles de cámara */}
                            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                                <span className={`text-xs px-2 py-1 rounded ${isScanning ? 'bg-green-500/80' : 'bg-gray-500/80'} text-white`}>
                                    {isScanning ? '● Escaneando...' : '○ Iniciando...'}
                                </span>

                                <div className="flex gap-1">
                                    {/* Botón de antorcha */}
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

                                    {/* Botón cambiar cámara */}
                                    {cameras.length > 1 && (
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
