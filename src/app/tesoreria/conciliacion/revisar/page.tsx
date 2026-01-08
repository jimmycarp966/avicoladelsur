'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    ArrowLeft,
    Search,
    CheckCircle,
    XCircle,
    AlertTriangle,
    User,
    FileText,
    Loader2
} from 'lucide-react'
import {
    obtenerDetalleSesionAction,
    asignarClienteComprobanteAction,
    descartarComprobanteAction
} from '@/actions/conciliacion.actions'
import { ComprobanteConciliacion, SesionConciliacion, EstadoValidacion } from '@/types/conciliacion'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// Wrapper para Suspense
export default function RevisarConciliacionPageWrapper() {
    return (
        <Suspense fallback={
            <div className="container mx-auto py-6 flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        }>
            <RevisarConciliacionPage />
        </Suspense>
    )
}

function RevisarConciliacionPage() {
    const searchParams = useSearchParams()
    const sesionId = searchParams.get('sesion')

    const [sesion, setSesion] = useState<SesionConciliacion | null>(null)
    const [comprobantes, setComprobantes] = useState<ComprobanteConciliacion[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [filtro, setFiltro] = useState('')
    const [filtroEstado, setFiltroEstado] = useState<EstadoValidacion | 'todos'>('todos')

    // Modal de asignación
    const [modalAbierto, setModalAbierto] = useState(false)
    const [comprobanteSeleccionado, setComprobanteSeleccionado] = useState<ComprobanteConciliacion | null>(null)
    const [clienteIdInput, setClienteIdInput] = useState('')
    const [procesandoAsignacion, setProcesandoAsignacion] = useState(false)

    useEffect(() => {
        if (sesionId) {
            cargarDatos()
        }
    }, [sesionId])

    const cargarDatos = async () => {
        if (!sesionId) return

        setLoading(true)
        try {
            const result = await obtenerDetalleSesionAction(sesionId)
            if (result.success) {
                setSesion(result.sesion || null)
                setComprobantes(result.comprobantes || [])
            } else {
                setError(result.error || 'Error al cargar datos')
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido')
        } finally {
            setLoading(false)
        }
    }

    const abrirModalAsignacion = (comprobante: ComprobanteConciliacion) => {
        setComprobanteSeleccionado(comprobante)
        setClienteIdInput('')
        setModalAbierto(true)
    }

    const asignarCliente = async () => {
        if (!comprobanteSeleccionado || !clienteIdInput) return

        setProcesandoAsignacion(true)
        try {
            const result = await asignarClienteComprobanteAction(
                comprobanteSeleccionado.id!,
                clienteIdInput,
                true
            )

            if (result.success) {
                setModalAbierto(false)
                cargarDatos() // Recargar datos
            } else {
                alert(result.error)
            }
        } catch (err) {
            alert('Error al asignar cliente')
        } finally {
            setProcesandoAsignacion(false)
        }
    }

    const descartarComprobante = async (id: string) => {
        if (!confirm('¿Está seguro de descartar este comprobante?')) return

        const result = await descartarComprobanteAction(id, 'Descartado manualmente')
        if (result.success) {
            cargarDatos()
        } else {
            alert(result.error)
        }
    }

    // Filtrar comprobantes
    const comprobantesFiltrados = comprobantes.filter(c => {
        const matchFiltro =
            !filtro ||
            c.dni_cuit?.includes(filtro) ||
            c.referencia?.toLowerCase().includes(filtro.toLowerCase()) ||
            c.cliente?.nombre?.toLowerCase().includes(filtro.toLowerCase())

        const matchEstado = filtroEstado === 'todos' || c.estado_validacion === filtroEstado

        return matchFiltro && matchEstado
    })

    const getEstadoBadge = (estado: EstadoValidacion) => {
        switch (estado) {
            case 'validado':
                return <Badge className="bg-green-100 text-green-800">✅ Validado</Badge>
            case 'no_encontrado':
                return <Badge variant="destructive">❌ No encontrado</Badge>
            case 'sin_cliente':
                return <Badge className="bg-yellow-100 text-yellow-800">⚠️ Sin cliente</Badge>
            case 'error':
                return <Badge variant="outline" className="text-red-600">🚫 Error</Badge>
            default:
                return <Badge variant="secondary">⏳ Pendiente</Badge>
        }
    }

    if (loading) {
        return (
            <div className="container mx-auto py-6 flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (error || !sesion) {
        return (
            <div className="container mx-auto py-6">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center text-muted-foreground">
                            <XCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                            <p>{error || 'Sesión no encontrada'}</p>
                            <Link href="/tesoreria/conciliacion">
                                <Button variant="outline" className="mt-4">
                                    Volver al inicio
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
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
                <div className="flex-1">
                    <h1 className="text-2xl font-bold">Revisar Conciliación</h1>
                    <p className="text-muted-foreground">
                        {sesion.sabana_archivo} - {format(new Date(sesion.created_at!), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
                    </p>
                </div>
                {sesion.reporte_url && (
                    <a href={sesion.reporte_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline">
                            <FileText className="mr-2 h-4 w-4" />
                            Descargar Reporte
                        </Button>
                    </a>
                )}
            </div>

            {/* Resumen */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total</CardDescription>
                        <CardTitle className="text-2xl">{sesion.total_comprobantes}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="border-green-200 bg-green-50">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-green-700">Validados</CardDescription>
                        <CardTitle className="text-2xl text-green-700">{sesion.validados}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="border-red-200 bg-red-50">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-red-700">No encontrados</CardDescription>
                        <CardTitle className="text-2xl text-red-700">{sesion.no_encontrados}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="border-yellow-200 bg-yellow-50">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-yellow-700">Sin cliente</CardDescription>
                        <CardTitle className="text-2xl text-yellow-700">
                            {comprobantes.filter(c => c.estado_validacion === 'sin_cliente').length}
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Acreditado</CardDescription>
                        <CardTitle className="text-2xl text-green-600">
                            {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(sesion.monto_total_acreditado)}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Filtros */}
            <Card>
                <CardHeader>
                    <CardTitle>Detalle de Comprobantes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-4 flex-wrap">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por DNI, referencia o cliente..."
                                value={filtro}
                                onChange={(e) => setFiltro(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <div className="flex gap-2">
                            {(['todos', 'validado', 'no_encontrado', 'sin_cliente'] as const).map(estado => (
                                <Button
                                    key={estado}
                                    variant={filtroEstado === estado ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setFiltroEstado(estado)}
                                >
                                    {estado === 'todos' ? 'Todos' : estado === 'validado' ? '✅' : estado === 'no_encontrado' ? '❌' : '⚠️'}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Tabla */}
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Monto</TableHead>
                                    <TableHead>DNI/CUIT</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Referencia</TableHead>
                                    <TableHead>Score</TableHead>
                                    <TableHead>Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {comprobantesFiltrados.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                            No hay comprobantes que coincidan con el filtro
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    comprobantesFiltrados.map(comp => (
                                        <TableRow key={comp.id}>
                                            <TableCell>{getEstadoBadge(comp.estado_validacion)}</TableCell>
                                            <TableCell className="font-medium">
                                                {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(comp.monto)}
                                            </TableCell>
                                            <TableCell className="font-mono text-sm">
                                                {comp.dni_cuit || '-'}
                                            </TableCell>
                                            <TableCell>
                                                {comp.cliente ? (
                                                    <div className="flex items-center gap-2">
                                                        <User className="h-4 w-4 text-muted-foreground" />
                                                        {comp.cliente.nombre}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {comp.referencia || '-'}
                                            </TableCell>
                                            <TableCell>
                                                {comp.confianza_score ? (
                                                    <span className={`font-medium ${comp.confianza_score >= 0.7 ? 'text-green-600' : comp.confianza_score >= 0.4 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                        {Math.round(comp.confianza_score * 100)}%
                                                    </span>
                                                ) : '-'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-2">
                                                    {comp.estado_validacion === 'sin_cliente' && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => abrirModalAsignacion(comp)}
                                                        >
                                                            Asignar Cliente
                                                        </Button>
                                                    )}
                                                    {comp.estado_validacion !== 'validado' && !comp.acreditado && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="text-red-600"
                                                            onClick={() => descartarComprobante(comp.id!)}
                                                        >
                                                            Descartar
                                                        </Button>
                                                    )}
                                                    {comp.acreditado && (
                                                        <Badge variant="outline" className="text-green-600">
                                                            <CheckCircle className="h-3 w-3 mr-1" />
                                                            Acreditado
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Modal Asignar Cliente */}
            <Dialog open={modalAbierto} onOpenChange={setModalAbierto}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Asignar Cliente al Comprobante</DialogTitle>
                        <DialogDescription>
                            Ingrese el ID del cliente para vincular y acreditar el pago.
                        </DialogDescription>
                    </DialogHeader>

                    {comprobanteSeleccionado && (
                        <div className="space-y-4 py-4">
                            <div className="bg-muted p-4 rounded-lg space-y-2">
                                <p><strong>Monto:</strong> {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(comprobanteSeleccionado.monto)}</p>
                                <p><strong>DNI/CUIT:</strong> {comprobanteSeleccionado.dni_cuit || 'No detectado'}</p>
                                <p><strong>Referencia:</strong> {comprobanteSeleccionado.referencia || 'Sin referencia'}</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">ID del Cliente</label>
                                <Input
                                    placeholder="UUID del cliente..."
                                    value={clienteIdInput}
                                    onChange={(e) => setClienteIdInput(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Puede buscar el cliente en la sección de clientes y copiar su ID
                                </p>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalAbierto(false)}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={asignarCliente}
                            disabled={!clienteIdInput || procesandoAsignacion}
                        >
                            {procesandoAsignacion ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Procesando...
                                </>
                            ) : (
                                'Asignar y Acreditar'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
