'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function TestCameraPage() {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [status, setStatus] = useState('Esperando...')
    const [videoSize, setVideoSize] = useState({ width: 0, height: 0 })

    const startCamera = async () => {
        setStatus('Solicitando permisos...')

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            })

            setStatus('Stream obtenido, asignando a video...')

            if (videoRef.current) {
                videoRef.current.srcObject = stream

                // Esperar a que el video cargue metadata
                videoRef.current.onloadedmetadata = () => {
                    setStatus('Metadata cargada, iniciando reproducción...')
                    setVideoSize({
                        width: videoRef.current?.videoWidth || 0,
                        height: videoRef.current?.videoHeight || 0
                    })
                }

                // Intentar reproducir
                try {
                    await videoRef.current.play()
                    setStatus('✅ Video reproduciendo')
                } catch (playError: any) {
                    setStatus(`❌ Error en play(): ${playError.message}`)
                }
            }
        } catch (err: any) {
            setStatus(`❌ Error: ${err.name} - ${err.message}`)
        }
    }

    return (
        <div className="p-4 max-w-lg mx-auto">
            <Card>
                <CardHeader>
                    <CardTitle>Test de Cámara</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="bg-gray-100 p-2 rounded text-sm">
                        <strong>Estado:</strong> {status}
                        <br />
                        <strong>Tamaño video:</strong> {videoSize.width}x{videoSize.height}
                    </div>

                    <Button onClick={startCamera} className="w-full">
                        Iniciar Cámara
                    </Button>

                    <div
                        className="bg-black rounded-lg overflow-hidden"
                        style={{
                            width: '100%',
                            height: '300px',
                            position: 'relative'
                        }}
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

                        {/* Indicador visual de que el video está ahí */}
                        <div
                            className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded"
                        >
                            Video Element
                        </div>
                    </div>

                    <div className="text-xs text-muted-foreground">
                        <p>User Agent: {typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
