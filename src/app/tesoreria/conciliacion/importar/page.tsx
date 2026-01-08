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
        console.log('[DEBUG Conciliación] onDropSabana - Archivos recibidos:', acceptedFiles.map(f => ({ name: f.name, size: f.size, type: f.type })))
        if (acceptedFiles.length > 0) {
            console.log('[DEBUG Conciliación] Sábana PDF seleccionada:', acceptedFiles[0].name, 'Tamaño:', (acceptedFiles[0].size / 1024).toFixed(2), 'KB')
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
        console.log('[DEBUG Conciliación] onDropComprobantes - Nuevos comprobantes:', acceptedFiles.map(f => ({ name: f.name, size: f.size, type: f.type })))
        setComprobantes(prev => {
            const nuevaLista = [...prev, ...acceptedFiles]
            console.log('[DEBUG Conciliación] Total comprobantes ahora:', nuevaLista.length)
            return nuevaLista
        })
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
        console.log('[DEBUG Conciliación] ========== INICIO DE CONCILIACIÓN ==========')
        console.log('[DEBUG Conciliación] Sábana PDF:', sabanaPdf ? { name: sabanaPdf.name, size: sabanaPdf.size, type: sabanaPdf.type } : null)
        console.log('[DEBUG Conciliación] Comprobantes:', comprobantes.map(f => ({ name: f.name, size: f.size, type: f.type })))

        if (!sabanaPdf || comprobantes.length === 0) {
            console.error('[DEBUG Conciliación] ERROR: Faltan archivos requeridos')
            setError('Debe subir el PDF de la sábana y al menos un comprobante')
            return
        }

        setProcesando(true)
        setError(null)
        setProgreso(0)

        const tiempoInicio = performance.now()
        console.log('[DEBUG Conciliación] Tiempo inicio:', new Date().toISOString())

        // Calcular tamaño total
        const sizeSabana = sabanaPdf.size
        const sizeComprobantes = comprobantes.reduce((acc, curr) => acc + curr.size, 0)
        const totalSize = sizeSabana + sizeComprobantes
        const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2)

        console.log(`[DEBUG Conciliación] Tamaño total payload: ${totalSizeMB} MB`)

        if (totalSize > 45 * 1024 * 1024) { // 45MB límite seguridad
            console.error('[DEBUG Conciliación] ERROR: El tamaño total excede el límite seguro (45MB).')
            setError(`El tamaño total de los archivos (${totalSizeMB} MB) es demasiado grande. Intente subir menos comprobantes a la vez (máx 45MB).`)
            setProcesando(false)
            return
        }

        try {
            // Preparar FormData
            console.log('[DEBUG Conciliación] Paso 1: Preparando FormData...')
            const formData = new FormData()
            formData.append('sabana', sabanaPdf)
            console.log('[DEBUG Conciliación] - Sábana agregada al FormData')

            comprobantes.forEach((file, idx) => {
                formData.append('comprobantes', file)
                console.log(`[DEBUG Conciliación] - Comprobante ${idx + 1}/${comprobantes.length} agregado: ${file.name}`)
            })

            const timeouts: NodeJS.Timeout[] = []

            // Simular progreso mientras procesa
            setEtapa('Extrayendo datos de la sábana bancaria...')
            setProgreso(10)
            console.log('[DEBUG Conciliación] Paso 2: Iniciando llamada al servidor...')

            const intervalo = setInterval(() => {
                setProgreso(prev => {
                    if (prev >= 90) {
                        return 90
                    }
                    return prev + 5
                })
            }, 1000)

            timeouts.push(setTimeout(() => { setEtapa('Procesando comprobantes con IA...'); console.log('[DEBUG Conciliación] Etapa: Procesando comprobantes con IA') }, 3000))
            timeouts.push(setTimeout(() => { setEtapa('Validando comprobantes contra sábana...'); console.log('[DEBUG Conciliación] Etapa: Validando comprobantes') }, 6000))
            timeouts.push(setTimeout(() => { setEtapa('Buscando clientes por DNI...'); console.log('[DEBUG Conciliación] Etapa: Buscando clientes') }, 9000))
            timeouts.push(setTimeout(() => { setEtapa('Acreditando saldos...'); console.log('[DEBUG Conciliación] Etapa: Acreditando saldos') }, 12000))

            // Ejecutar acción
            console.log('[DEBUG Conciliación] Llamando a procesarConciliacionCompletaAction...')

            try {
                const result = await procesarConciliacionCompletaAction(formData)

                // Limpiar timeouts si termina antes
                timeouts.forEach(clearTimeout)
                clearInterval(intervalo)

                const tiempoFin = performance.now()
                console.log('[DEBUG Conciliación] ========== RESPUESTA DEL SERVIDOR ==========')
                console.log('[DEBUG Conciliación] Tiempo de ejecución:', ((tiempoFin - tiempoInicio) / 1000).toFixed(2), 'segundos')
                console.log('[DEBUG Conciliación] Resultado success:', result.success)
                console.log('[DEBUG Conciliación] Resultado error:', result.error)
                console.log('[DEBUG Conciliación] Sesión ID:', result.sesionId)
                console.log('[DEBUG Conciliación] Resumen completo:', JSON.stringify(result.resumen, null, 2))

                setProgreso(100)
                setEtapa('¡Proceso completado!')

                if (result.success && result.resumen) {
                    console.log('[DEBUG Conciliación] ✅ Conciliación exitosa')
                    console.log('[DEBUG Conciliación] - Total comprobantes:', result.resumen.total_comprobantes)
                    console.log('[DEBUG Conciliación] - Validados:', result.resumen.validados)
                    console.log('[DEBUG Conciliación] - No encontrados:', result.resumen.no_encontrados)
                    console.log('[DEBUG Conciliación] - Sin cliente:', result.resumen.sin_cliente)
                    console.log('[DEBUG Conciliación] - Errores:', result.resumen.errores)
                    console.log('[DEBUG Conciliación] - Monto acreditado:', result.resumen.monto_total_acreditado)
                    console.log('[DEBUG Conciliación] - Detalles:', result.resumen.detalles)
                    setResultado(result.resumen)
                } else {
                    console.error('[DEBUG Conciliación] ❌ Error en conciliación:', result.error)
                    setError(result.error || 'Error desconocido')
                }
            } catch (actionError) {
                // Capturar error específico de la acción si ocurre
                throw actionError
            } finally {
                timeouts.forEach(clearTimeout)
                clearInterval(intervalo)
            }

        } catch (err) {
            console.error('[DEBUG Conciliación] ❌ EXCEPCIÓN CAPTURADA:', err)
            const mensaje = err instanceof Error ? err.message : 'Error al procesar la conciliación'

            if (mensaje.includes('Failed to fetch')) {
                const msgReinicio = 'Error de conexión (Payload Too Large). Por favor REINICIE EL SERVIDOR (npm run dev) para aplicar el nuevo límite de tamaño de 50MB.'
                console.error('[DEBUG Conciliación] SUGERENCIA: ' + msgReinicio)
                setError(msgReinicio)
            } else {
                setError(mensaje)
            }
        } finally {
            setProcesando(false)
            console.log('[DEBUG Conciliación] ========== FIN DE CONCILIACIÓN ==========')
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
