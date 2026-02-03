'use client'

import { useState, useCallback, useEffect } from 'react'
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
    ArrowLeft,
    Clock,
    AlertTriangle,
    Info
} from 'lucide-react'
import { procesarConciliacionMejoradaAction, obtenerEstadoJobAction } from '@/actions/conciliacion-mejorada.actions'
import { ResumenConciliacion, AlertaValidacion } from '@/types/conciliacion'
import Link from 'next/link'

// Intervalo de polling para jobs async (5 segundos)
const POLLING_INTERVAL = 5000

export default function ImportarConciliacionPage() {
    const router = useRouter()
    const [sabanaPdf, setSabanaPdf] = useState<File | null>(null)
    const [comprobantes, setComprobantes] = useState<File[]>([])
    const [procesando, setProcesando] = useState(false)
    const [progreso, setProgreso] = useState(0)
    const [etapa, setEtapa] = useState('')
    const [resultado, setResultado] = useState<ResumenConciliacion | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [alertas, setAlertas] = useState<AlertaValidacion[]>([])
    const [jobId, setJobId] = useState<string | null>(null)
    const [requiereAsync, setRequiereAsync] = useState(false)
    const [duplicadosDetectados, setDuplicadosDetectados] = useState<Array<{ comprobante1: number; comprobante2: number; razon: string }> | null>(null)

    // Polling para jobs async
    useEffect(() => {
        if (!jobId || !requiereAsync) return

        const interval = setInterval(async () => {
            const estado = await obtenerEstadoJobAction(jobId)
            if (estado.success && estado.job) {
                setProgreso(estado.job.progreso)
                
                if (estado.job.estado === 'completado') {
                    setRequiereAsync(false)
                    setProcesando(false)
                    if (estado.job.resultado) {
                        setResultado(estado.job.resultado)
                    }
                    clearInterval(interval)
                } else if (estado.job.estado === 'error') {
                    setRequiereAsync(false)
                    setProcesando(false)
                    setError(estado.job.error || 'Error en procesamiento')
                    clearInterval(interval)
                }
            }
        }, POLLING_INTERVAL)

        return () => clearInterval(interval)
    }, [jobId, requiereAsync])

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

    // Calcular tamaño total
    const calcularTamañoTotal = () => {
        if (!sabanaPdf) return 0
        return sabanaPdf.size + comprobantes.reduce((acc, f) => acc + f.size, 0)
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
        setAlertas([])
        setDuplicadosDetectados(null)

        const sizeTotal = calcularTamañoTotal()
        const sizeTotalMB = (sizeTotal / (1024 * 1024)).toFixed(2)

        try {
            // Preparar FormData
            const formData = new FormData()
            formData.append('sabana', sabanaPdf)
            comprobantes.forEach((file) => {
                formData.append('comprobantes', file)
            })

            // Simular progreso inicial
            setEtapa('Subiendo archivos y verificando duplicados...')
            setProgreso(10)

            const timeouts: NodeJS.Timeout[] = []
            const intervalo = setInterval(() => {
                setProgreso(prev => Math.min(prev + 2, 85))
            }, 2000)

            timeouts.push(setTimeout(() => { setEtapa('Extrayendo datos con IA...') }, 3000))
            timeouts.push(setTimeout(() => { setEtapa('Validando comprobantes contra sábana...') }, 8000))
            timeouts.push(setTimeout(() => { setEtapa('Analizando matches dudosos con IA...') }, 12000))

            // Ejecutar acción mejorada
            const result = await procesarConciliacionMejoradaAction(formData)

            timeouts.forEach(clearTimeout)
            clearInterval(intervalo)

            if (result.requiereAsync && result.jobId) {
                // Procesamiento async iniciado
                setJobId(result.jobId)
                setRequiereAsync(true)
                setEtapa('Procesando en segundo plano...')
                setProgreso(15)
                return
            }

            setProgreso(100)
            setEtapa('¡Proceso completado!')

            if (result.success && result.resumen) {
                setResultado(result.resumen)
                if (result.alertas && result.alertas.length > 0) {
                    setAlertas(result.alertas)
                }
                if (result.duplicadosDetectados && result.duplicadosDetectados.length > 0) {
                    setDuplicadosDetectados(result.duplicadosDetectados)
                }
            } else {
                setError(result.error || 'Error desconocido')
                if (result.alertas && result.alertas.length > 0) {
                    setAlertas(result.alertas)
                }
            }

        } catch (err) {
            console.error('Error en conciliación:', err)
            setError(err instanceof Error ? err.message : 'Error al procesar la conciliación')
        } finally {
            if (!requiereAsync) {
                setProcesando(false)
            }
        }
    }

    // Renderizar alerta según tipo
    const renderAlerta = (alerta: AlertaValidacion, index: number) => {
        const iconos = {
            error: <AlertCircle className="h-4 w-4" />,
            warning: <AlertTriangle className="h-4 w-4" />,
            info: <Info className="h-4 w-4" />
        }

        const variantes = {
            error: 'destructive' as const,
            warning: 'default' as const,
            info: 'default' as const
        }

        const clases = {
            error: 'border-red-200 bg-red-50',
            warning: 'border-yellow-200 bg-yellow-50',
            info: 'border-blue-200 bg-blue-50'
        }

        return (
            <Alert key={index} variant={variantes[alerta.tipo]} className={clases[alerta.tipo]}>
                {iconos[alerta.tipo]}
                <AlertTitle className="capitalize">{alerta.tipo === 'error' ? 'Error' : alerta.tipo === 'warning' ? 'Advertencia' : 'Información'}</AlertTitle>
                <AlertDescription>{alerta.mensaje}</AlertDescription>
            </Alert>
        )
    }

    // Vista de procesamiento async
    if (requiereAsync && jobId) {
        return (
            <div className="container mx-auto py-6 space-y-6">
                <div className="flex items-center gap-4">
                    <Link href="/tesoreria/conciliacion">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold">Procesando Conciliación</h1>
                </div>

                <Card className="border-blue-200 bg-blue-50">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4 mb-4">
                            <Clock className="h-8 w-8 text-blue-600 animate-pulse" />
                            <div>
                                <h3 className="font-semibold text-blue-900">Procesamiento en Segundo Plano</h3>
                                <p className="text-sm text-blue-700">
                                    Los archivos son grandes. El procesamiento continuará en el servidor.
                                </p>
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-blue-700">Progreso</span>
                                <span className="font-medium text-blue-900">{progreso}%</span>
                            </div>
                            <Progress value={progreso} className="h-2" />
                        </div>

                        <p className="text-sm text-blue-600 mt-4">
                            Puedes cerrar esta página y volver más tarde. La sesión aparecerá en el historial cuando termine.
                        </p>
                    </CardContent>
                </Card>

                <div className="flex gap-4">
                    <Link href="/tesoreria/conciliacion">
                        <Button variant="outline">Ir al Dashboard</Button>
                    </Link>
                    <Button onClick={() => router.refresh()}>
                        Actualizar Estado
                    </Button>
                </div>
            </div>
        )
    }

    // Vista de resultado
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

                {/* Alertas de validación */}
                {alertas.length > 0 && (
                    <div className="space-y-2">
                        {alertas.map((alerta, idx) => renderAlerta(alerta, idx))}
                    </div>
                )}

                {/* Duplicados detectados */}
                {duplicadosDetectados && duplicadosDetectados.length > 0 && (
                    <Alert className="border-orange-200 bg-orange-50">
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                        <AlertTitle className="text-orange-800">Comprobantes Duplicados Detectados</AlertTitle>
                        <AlertDescription className="text-orange-700">
                            Se encontraron {duplicadosDetectados.length} posibles duplicados en el lote. 
                            Los duplicados fueron filtrados automáticamente antes del procesamiento.
                        </AlertDescription>
                    </Alert>
                )}

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
                <div className="flex flex-wrap gap-4">
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
                        setAlertas([])
                        setDuplicadosDetectados(null)
                    }}>
                        Nueva Conciliación
                    </Button>
                </div>
            </div>
        )
    }

    // Vista principal
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

            {/* Alertas informativas */}
            <Alert className="border-blue-200 bg-blue-50">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-800">Nuevas Mejoras Disponibles</AlertTitle>
                <AlertDescription className="text-blue-700">
                    El sistema ahora detecta duplicados automáticamente, valida montos cruzados y usa IA secundaria para matches dudosos.
                    Archivos mayores a 10 MB se procesan en segundo plano.
                </AlertDescription>
            </Alert>

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Tamaño total */}
            {sabanaPdf && comprobantes.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Tamaño total:</span>
                    <Badge variant="secondary">
                        {((calcularTamañoTotal() / (1024 * 1024))).toFixed(2)} MB
                    </Badge>
                    {calcularTamañoTotal() > 10 * 1024 * 1024 && (
                        <span className="text-yellow-600">(Se procesará en segundo plano)</span>
                    )}
                </div>
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
                                            <span className="text-xs text-muted-foreground">
                                                ({(file.size / 1024).toFixed(0)} KB)
                                            </span>
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
                            <p className="text-xs text-muted-foreground text-center">
                                El sistema está verificando duplicados, extrayendo datos con IA,
                                validando montos cruzados y analizando matches dudosos.
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
