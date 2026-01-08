'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
    FileText,
    Image as ImageIcon,
    Upload,
    X,
    CheckCircle,
    AlertCircle,
    Loader2,
    ArrowLeft
} from 'lucide-react'
import { procesarConciliacionCompletaAction } from '@/actions/conciliacion.actions'
import { ResumenConciliacion } from '@/types/conciliacion'
import Link from 'next/link'

export default function ImportarConciliacionPage() {
    const router = useRouter()
    const [sabanaPdf, setSabanaPdf] = useState<File | null>(null)
    const [comprobantes, setComprobantes] = useState<File[]>([])
    const [procesando, setProcesando] = useState(false)
    const [progreso, setProgreso] = useState(0)
    const [etapa, setEtapa] = useState('')
    const [resultado, setResultado] = useState<ResumenConciliacion | null>(null)
    const [error, setError] = useState<string | null>(null)

    // Dropzone para el PDF de sábana
    const onDropSabana = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            setSabanaPdf(acceptedFiles[0])
            setError(null)
        }
    }, [])

    const { getRootProps: getSabanaRootProps, getInputProps: getSabanaInputProps, isDragActive: isSabanaDragActive } = useDropzone({
        onDrop: onDropSabana,
        accept: {
            'application/pdf': ['.pdf']
        },
        maxFiles: 1
    })

    // Dropzone para comprobantes (imágenes)
    const onDropComprobantes = useCallback((acceptedFiles: File[]) => {
        setComprobantes(prev => [...prev, ...acceptedFiles])
        setError(null)
    }, [])

    const { getRootProps: getComprobantesRootProps, getInputProps: getComprobantesInputProps, isDragActive: isComprobantesDragActive } = useDropzone({
        onDrop: onDropComprobantes,
        accept: {
            'image/*': ['.png', '.jpg', '.jpeg', '.webp']
        },
        multiple: true
    })

    // Remover archivo
    const removerComprobante = (index: number) => {
        setComprobantes(prev => prev.filter((_, i) => i !== index))
    }

    // Procesar conciliación
    const procesarConciliacion = async () => {
        if (!sabanaPdf || comprobantes.length === 0) {
            setError('Debe subir el PDF de la sábana y al menos un comprobante')
            return
        }

        setProcesando(true)
        setError(null)
        setProgreso(0)

        try {
            // Preparar FormData
            const formData = new FormData()
            formData.append('sabana', sabanaPdf)
            comprobantes.forEach(file => {
                formData.append('comprobantes', file)
            })

            // Simular progreso mientras procesa
            setEtapa('Extrayendo datos de la sábana bancaria...')
            setProgreso(10)

            const intervalo = setInterval(() => {
                setProgreso(prev => {
                    if (prev >= 90) {
                        clearInterval(intervalo)
                        return 90
                    }
                    return prev + 5
                })
            }, 1000)

            setTimeout(() => setEtapa('Procesando comprobantes con IA...'), 3000)
            setTimeout(() => setEtapa('Validando comprobantes contra sábana...'), 6000)
            setTimeout(() => setEtapa('Buscando clientes por DNI...'), 9000)
            setTimeout(() => setEtapa('Acreditando saldos...'), 12000)

            // Ejecutar acción
            const result = await procesarConciliacionCompletaAction(formData)

            clearInterval(intervalo)
            setProgreso(100)
            setEtapa('¡Proceso completado!')

            if (result.success && result.resumen) {
                setResultado(result.resumen)
            } else {
                setError(result.error || 'Error desconocido')
            }

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al procesar la conciliación')
        } finally {
            setProcesando(false)
        }
    }

    // Si hay resultado, mostrar resumen
    if (resultado) {
        return (
            <div className="container mx-auto py-6 space-y-6">
                <div className="flex items-center gap-4">
                    <Link href="/tesoreria/conciliacion">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold">Resultado de Conciliación</h1>
                </div>

                <Alert className="bg-green-50 border-green-200">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <AlertTitle className="text-green-800">¡Conciliación Completada!</AlertTitle>
                    <AlertDescription className="text-green-700">
                        Se procesaron {resultado.total_comprobantes} comprobantes correctamente.
                    </AlertDescription>
                </Alert>

                {/* Cards de resumen */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Total Comprobantes</CardDescription>
                            <CardTitle className="text-3xl">{resultado.total_comprobantes}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card className="border-green-200 bg-green-50">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-green-700">Validados</CardDescription>
                            <CardTitle className="text-3xl text-green-700">✅ {resultado.validados}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card className="border-red-200 bg-red-50">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-red-700">No Encontrados</CardDescription>
                            <CardTitle className="text-3xl text-red-700">❌ {resultado.no_encontrados}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card className="border-yellow-200 bg-yellow-50">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-yellow-700">Sin Cliente</CardDescription>
                            <CardTitle className="text-3xl text-yellow-700">⚠️ {resultado.sin_cliente}</CardTitle>
                        </CardHeader>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            💰 Monto Total Acreditado
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-4xl font-bold text-green-600">
                            {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(resultado.monto_total_acreditado)}
                        </p>
                    </CardContent>
                </Card>

                {/* Acciones */}
                <div className="flex gap-4">
                    {resultado.reporte_url && (
                        <a href={resultado.reporte_url} target="_blank" rel="noopener noreferrer">
                            <Button>
                                <FileText className="mr-2 h-4 w-4" />
                                Descargar Reporte PDF
                            </Button>
                        </a>
                    )}
                    <Link href={`/tesoreria/conciliacion/revisar?sesion=${resultado.sesion_id}`}>
                        <Button variant="outline">
                            Ver Detalle de Comprobantes
                        </Button>
                    </Link>
                    <Button variant="ghost" onClick={() => {
                        setResultado(null)
                        setSabanaPdf(null)
                        setComprobantes([])
                        setProgreso(0)
                    }}>
                        Nueva Conciliación
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/tesoreria/conciliacion">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold">Importar Conciliación</h1>
                    <p className="text-muted-foreground">
                        Suba el PDF de la sábana bancaria y los comprobantes de pago
                    </p>
                </div>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <div className="grid md:grid-cols-2 gap-6">
                {/* Dropzone Sábana */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Sábana Bancaria (PDF)
                        </CardTitle>
                        <CardDescription>
                            Suba el extracto bancario en formato PDF
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div
                            {...getSabanaRootProps()}
                            className={`
                                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                                transition-colors
                                ${isSabanaDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
                                ${sabanaPdf ? 'bg-green-50 border-green-300' : 'hover:border-primary/50'}
                            `}
                        >
                            <input {...getSabanaInputProps()} />
                            {sabanaPdf ? (
                                <div className="flex items-center justify-center gap-3">
                                    <CheckCircle className="h-8 w-8 text-green-600" />
                                    <div className="text-left">
                                        <p className="font-medium">{sabanaPdf.name}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {(sabanaPdf.size / 1024 / 1024).toFixed(2)} MB
                                        </p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setSabanaPdf(null)
                                        }}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                    <p className="text-lg font-medium">
                                        Arrastre el PDF aquí
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        o haga clic para seleccionar
                                    </p>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Dropzone Comprobantes */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ImageIcon className="h-5 w-5" />
                            Comprobantes de Pago
                            {comprobantes.length > 0 && (
                                <Badge variant="secondary">{comprobantes.length}</Badge>
                            )}
                        </CardTitle>
                        <CardDescription>
                            Suba las imágenes de los comprobantes (capturas de transferencia)
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div
                            {...getComprobantesRootProps()}
                            className={`
                                border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
                                transition-colors
                                ${isComprobantesDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
                                hover:border-primary/50
                            `}
                        >
                            <input {...getComprobantesInputProps()} />
                            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                            <p className="font-medium">Arrastre las imágenes aquí</p>
                            <p className="text-sm text-muted-foreground">
                                PNG, JPG, JPEG, WEBP
                            </p>
                        </div>

                        {/* Lista de comprobantes */}
                        {comprobantes.length > 0 && (
                            <div className="max-h-60 overflow-y-auto space-y-2">
                                {comprobantes.map((file, index) => (
                                    <div
                                        key={`${file.name}-${index}`}
                                        className="flex items-center justify-between p-2 bg-muted rounded-lg"
                                    >
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <ImageIcon className="h-4 w-4 flex-shrink-0" />
                                            <span className="text-sm truncate">{file.name}</span>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => removerComprobante(index)}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Progress y Botón */}
            {procesando && (
                <Card>
                    <CardContent className="pt-6">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                <span className="font-medium">{etapa}</span>
                            </div>
                            <Progress value={progreso} className="h-2" />
                            <p className="text-sm text-muted-foreground text-center">
                                {progreso}% completado
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="flex justify-end gap-4">
                <Link href="/tesoreria/conciliacion">
                    <Button variant="outline" disabled={procesando}>
                        Cancelar
                    </Button>
                </Link>
                <Button
                    onClick={procesarConciliacion}
                    disabled={!sabanaPdf || comprobantes.length === 0 || procesando}
                    size="lg"
                >
                    {procesando ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Procesando...
                        </>
                    ) : (
                        <>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Procesar Conciliación
                        </>
                    )}
                </Button>
            </div>
        </div>
    )
}
