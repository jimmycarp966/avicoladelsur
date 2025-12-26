'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { X, Camera, SwitchCamera, Scan } from 'lucide-react'

interface BarcodeScannerProps {
    onScan: (code: string) => void
    onClose: () => void
    title?: string
    description?: string
}

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
    const readerRef = useRef<BrowserMultiFormatReader | null>(null)

    // Inicializar lector y solicitar permisos de cámara
    useEffect(() => {
        const hints = new Map()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.EAN_13,
            BarcodeFormat.EAN_8,
            BarcodeFormat.CODE_128,
            BarcodeFormat.CODE_39,
            BarcodeFormat.QR_CODE,
            BarcodeFormat.UPC_A,
            BarcodeFormat.UPC_E,
        ])
        hints.set(DecodeHintType.TRY_HARDER, true)

        readerRef.current = new BrowserMultiFormatReader(hints)

        // Función para obtener cámaras después de tener permisos
        const getCameras = async () => {
            try {
                // IMPORTANTE: En iOS y algunos Android, necesitamos solicitar permisos
                // con getUserMedia ANTES de poder enumerar dispositivos
                console.log('[BarcodeScanner] Solicitando permisos de cámara...')

                // Solicitar permiso de cámara primero (esto dispara el popup de permisos)
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'environment' // Preferir cámara trasera
                    }
                })

                // Detener el stream temporal (solo lo usamos para obtener permisos)
                stream.getTracks().forEach(track => track.stop())

                console.log('[BarcodeScanner] Permisos de cámara otorgados')

                // Ahora sí podemos enumerar los dispositivos correctamente
                const deviceList = await navigator.mediaDevices.enumerateDevices()
                const videoDevices = deviceList.filter(d => d.kind === 'videoinput')

                console.log('[BarcodeScanner] Cámaras encontradas:', videoDevices.length)
                setDevices(videoDevices)

                // Preferir cámara trasera si está disponible
                const backCamera = videoDevices.find(d =>
                    d.label.toLowerCase().includes('back') ||
                    d.label.toLowerCase().includes('trasera') ||
                    d.label.toLowerCase().includes('rear') ||
                    d.label.toLowerCase().includes('environment')
                )
                setSelectedDevice(backCamera?.deviceId || videoDevices[0]?.deviceId || null)

            } catch (err: any) {
                console.error('[BarcodeScanner] Error al obtener cámaras:', err)

                if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                    setError('Permisos de cámara denegados. Por favor, habilita el acceso a la cámara en la configuración de tu navegador.')
                } else if (err.name === 'NotFoundError') {
                    setError('No se encontró ninguna cámara en este dispositivo.')
                } else if (err.name === 'NotReadableError') {
                    setError('La cámara está siendo usada por otra aplicación.')
                } else {
                    setError('No se pudo acceder a la cámara: ' + err.message)
                }
            }
        }

        getCameras()

        return () => {
            readerRef.current?.reset()
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
                            console.log('[BarcodeScanner] Código detectado:', code)
                            onScan(code)
                            readerRef.current?.reset()
                            setIsScanning(false)
                        }
                        if (err && !(err.name === 'NotFoundException')) {
                            // Ignorar NotFoundException (es normal cuando no hay código visible)
                            console.error('[BarcodeScanner] Error:', err)
                        }
                    }
                )

                if (isMounted) {
                    setIsScanning(true)
                    setError(null)
                }
            } catch (err) {
                console.error('[BarcodeScanner] Error al iniciar cámara:', err)
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
    }, [selectedDevice, onScan])

    const switchCamera = useCallback(() => {
        if (devices.length <= 1) return

        const currentIndex = devices.findIndex(d => d.deviceId === selectedDevice)
        const nextIndex = (currentIndex + 1) % devices.length
        setSelectedDevice(devices[nextIndex].deviceId)
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
                            />

                            {/* Overlay con guía de escaneo */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-3/4 h-1/3 border-2 border-white/50 rounded-lg relative">
                                    {/* Indicador de escaneo */}
                                    {isScanning && (
                                        <div className="absolute inset-x-0 top-1/2 h-0.5 bg-green-500 animate-pulse" />
                                    )}
                                </div>
                            </div>

                            {/* Estado de escaneo */}
                            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                                <span className={`text-xs px-2 py-1 rounded ${isScanning ? 'bg-green-500/80' : 'bg-gray-500/80'} text-white`}>
                                    {isScanning ? '● Escaneando...' : '○ Detenido'}
                                </span>

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
                    )}

                    <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={onClose}>
                            Cancelar
                        </Button>
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
