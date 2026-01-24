'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
    Sun,
    Moon,
    Package,
    AlertTriangle,
    Clock,
    CheckCircle,
    XCircle,
    Search,
    Factory,
    FileText,
    History,
    Printer
} from 'lucide-react'
import { toast } from 'sonner'
import {
    verificarProduccionEnCursoAction,
    iniciarConteoStockAction,
    obtenerConteoEnProgresoAction,
    obtenerItemsConteoAction,
    registrarConteoItemAction,
    finalizarConteoStockAction,
    obtenerHistorialConteosAction,
    cancelarConteoStockAction,
    type ConteoStock,
    type ConteoStockItem,
    type ProduccionEnCurso
} from '@/actions/control-stock.actions'
import { formatDate } from '@/lib/utils'

const TIEMPO_LIMITE_MINUTOS = 60

export default function ControlStockPage() {
    const [loading, setLoading] = useState(true)
    const [conteoActivo, setConteoActivo] = useState<ConteoStock | null>(null)
    const [items, setItems] = useState<ConteoStockItem[]>([])
    const [historial, setHistorial] = useState<ConteoStock[]>([])
    const [produccionEnCurso, setProduccionEnCurso] = useState<ProduccionEnCurso | null>(null)
    const [busqueda, setBusqueda] = useState('')
    const [tiempoTranscurrido, setTiempoTranscurrido] = useState(0)
    const [observaciones, setObservaciones] = useState('')

    // Cargar datos iniciales
    useEffect(() => {
        async function cargarDatos() {
            setLoading(true)
            try {
                const [conteoRes, historialRes, produccionRes] = await Promise.all([
                    obtenerConteoEnProgresoAction(),
                    obtenerHistorialConteosAction(20),
                    verificarProduccionEnCursoAction()
                ])

                if (conteoRes.data) {
                    setConteoActivo(conteoRes.data)
                    // Cargar items si hay conteo activo
                    const itemsRes = await obtenerItemsConteoAction(conteoRes.data.id)
                    if (itemsRes.data) {
                        setItems(itemsRes.data)
                    }
                }

                if (historialRes.data) {
                    setHistorial(historialRes.data)
                }

                if (produccionRes.data) {
                    setProduccionEnCurso(produccionRes.data)
                }
            } catch (error) {
                console.error('Error cargando datos:', error)
            } finally {
                setLoading(false)
            }
        }
        cargarDatos()
    }, [])

    // Timer para conteo activo
    useEffect(() => {
        if (!conteoActivo || conteoActivo.estado !== 'en_progreso') return

        const calcularTiempo = () => {
            const inicio = new Date(conteoActivo.hora_inicio).getTime()
            const ahora = Date.now()
            const minutos = Math.floor((ahora - inicio) / 60000)
            setTiempoTranscurrido(minutos)
        }

        calcularTiempo()
        const interval = setInterval(calcularTiempo, 30000) // Actualizar cada 30 seg

        return () => clearInterval(interval)
    }, [conteoActivo])

    // Iniciar conteo
    const handleIniciarConteo = async (turno: 'mañana' | 'noche') => {
        setLoading(true)
        try {
            const result = await iniciarConteoStockAction(turno)

            if (result.success && result.data) {
                toast.success(`Conteo turno ${turno} iniciado`)

                // Recargar datos
                const conteoRes = await obtenerConteoEnProgresoAction()
                if (conteoRes.data) {
                    setConteoActivo(conteoRes.data)
                    const itemsRes = await obtenerItemsConteoAction(conteoRes.data.id)
                    if (itemsRes.data) {
                        setItems(itemsRes.data)
                    }
                }

                if (result.data.produccion_en_curso) {
                    toast.warning(`¡Atención! Hay producción en curso con ${result.data.cajones_faltantes} cajones faltantes`)
                }
            } else {
                toast.error(result.message || 'Error al iniciar conteo')
            }
        } catch (error) {
            toast.error('Error al iniciar conteo')
        } finally {
            setLoading(false)
        }
    }

    // Registrar cantidad física
    const handleRegistrarConteo = async (item: ConteoStockItem, cantidadFisica: number) => {
        if (!conteoActivo) return

        const result = await registrarConteoItemAction(
            conteoActivo.id,
            item.producto_id,
            cantidadFisica
        )

        if (result.success) {
            // Actualizar item en estado local
            setItems(prev => prev.map(i =>
                i.id === item.id
                    ? {
                        ...i,
                        cantidad_fisica: cantidadFisica,
                        diferencia: result.data!.diferencia,
                        diferencia_valor: result.data!.diferencia_valor
                    }
                    : i
            ))
        } else {
            toast.error(result.message || 'Error al registrar')
        }
    }

    // Finalizar conteo
    const handleFinalizarConteo = async () => {
        if (!conteoActivo) return

        if (!confirm('¿Estás seguro de finalizar el conteo? No podrás modificarlo después.')) {
            return
        }

        setLoading(true)
        try {
            const result = await finalizarConteoStockAction(
                conteoActivo.id,
                observaciones,
                tiempoTranscurrido > TIEMPO_LIMITE_MINUTOS
            )

            if (result.success && result.data) {
                toast.success(
                    `Conteo finalizado. ${result.data.total_diferencias} diferencias encontradas.`
                )

                if (result.data.excedio_tiempo) {
                    toast.warning('El conteo excedió el tiempo límite de 1 hora')
                }

                // Recargar historial
                setConteoActivo(null)
                setItems([])
                const historialRes = await obtenerHistorialConteosAction(20)
                if (historialRes.data) {
                    setHistorial(historialRes.data)
                }
            } else {
                toast.error(result.message || 'Error al finalizar')
            }
        } catch (error) {
            toast.error('Error al finalizar conteo')
        } finally {
            setLoading(false)
        }
    }

    // Cancelar conteo
    const handleCancelarConteo = async () => {
        if (!conteoActivo) return

        if (!confirm('¿Estás seguro de cancelar el conteo? Se perderán los datos ingresados.')) {
            return
        }

        setLoading(true)
        try {
            const result = await cancelarConteoStockAction(conteoActivo.id)

            if (result.success) {
                toast.success('Conteo cancelado')
                setConteoActivo(null)
                setItems([])
            } else {
                toast.error(result.message || 'Error al cancelar')
            }
        } catch (error) {
            toast.error('Error al cancelar conteo')
        } finally {
            setLoading(false)
        }
    }

    // Filtrar items
    const itemsFiltrados = items.filter(item =>
        item.producto?.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        item.producto?.codigo.toLowerCase().includes(busqueda.toLowerCase())
    )

    // Estadísticas
    const itemsContados = items.filter(i => i.cantidad_fisica !== null).length
    const itemsConDiferencia = items.filter(i => i.diferencia !== 0).length
    const progreso = items.length > 0 ? (itemsContados / items.length) * 100 : 0

    // Determinar hora actual para sugerir turno
    const horaActual = new Date().getHours()
    const turnoSugerido: 'mañana' | 'noche' = horaActual < 14 ? 'mañana' : 'noche'

    if (loading && !conteoActivo) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground animate-pulse mb-4" />
                    <p className="text-muted-foreground">Cargando control de stock...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Control de Stock</h1>
                    <p className="text-muted-foreground">
                        Conteo físico de inventario por turnos
                    </p>
                </div>
            </div>

            {/* Alerta de producción en curso */}
            {produccionEnCurso?.en_curso && (
                <Alert variant="destructive">
                    <Factory className="h-4 w-4" />
                    <AlertTitle>Producción en Curso</AlertTitle>
                    <AlertDescription>
                        Hay {produccionEnCurso.cantidad_ordenes} orden(es) de producción activa(s) con aproximadamente{' '}
                        <strong>{produccionEnCurso.cajones_faltantes} cajones</strong> pendientes de procesar.
                        El stock puede variar durante el conteo.
                    </AlertDescription>
                </Alert>
            )}

            <Tabs defaultValue={conteoActivo ? 'conteo' : 'inicio'} className="space-y-4">
                <TabsList>
                    <TabsTrigger value="inicio" disabled={!!conteoActivo}>
                        <Sun className="h-4 w-4 mr-2" />
                        Iniciar Conteo
                    </TabsTrigger>
                    <TabsTrigger value="conteo" disabled={!conteoActivo}>
                        <Package className="h-4 w-4 mr-2" />
                        Conteo Activo
                    </TabsTrigger>
                    <TabsTrigger value="historial">
                        <History className="h-4 w-4 mr-2" />
                        Historial
                    </TabsTrigger>
                </TabsList>

                {/* TAB: Iniciar Conteo */}
                <TabsContent value="inicio" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Iniciar Nuevo Conteo</CardTitle>
                            <CardDescription>
                                Selecciona el turno para comenzar el conteo de stock.
                                Solo se permite un conteo por turno por día.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card
                                    className={`cursor-pointer hover:border-primary transition-colors ${turnoSugerido === 'mañana' ? 'border-primary' : ''}`}
                                    onClick={() => handleIniciarConteo('mañana')}
                                >
                                    <CardContent className="flex items-center gap-4 p-6">
                                        <div className="p-4 bg-yellow-100 rounded-full">
                                            <Sun className="h-8 w-8 text-yellow-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-lg">Turno Mañana</h3>
                                            <p className="text-sm text-muted-foreground">
                                                06:00 - 14:00
                                            </p>
                                            {turnoSugerido === 'mañana' && (
                                                <Badge variant="default" className="mt-2">Sugerido</Badge>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card
                                    className={`cursor-pointer hover:border-primary transition-colors ${turnoSugerido === 'noche' ? 'border-primary' : ''}`}
                                    onClick={() => handleIniciarConteo('noche')}
                                >
                                    <CardContent className="flex items-center gap-4 p-6">
                                        <div className="p-4 bg-indigo-100 rounded-full">
                                            <Moon className="h-8 w-8 text-indigo-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-lg">Turno Noche</h3>
                                            <p className="text-sm text-muted-foreground">
                                                14:00 - 22:00
                                            </p>
                                            {turnoSugerido === 'noche' && (
                                                <Badge variant="default" className="mt-2">Sugerido</Badge>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </CardContent>
                        <CardFooter className="text-sm text-muted-foreground">
                            <Clock className="h-4 w-4 mr-2" />
                            El conteo tiene un tiempo límite recomendado de 1 hora
                        </CardFooter>
                    </Card>
                </TabsContent>

                {/* TAB: Conteo Activo */}
                <TabsContent value="conteo" className="space-y-4">
                    {conteoActivo && (
                        <>
                            {/* Stats del conteo */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardDescription>Turno</CardDescription>
                                        <CardTitle className="flex items-center gap-2">
                                            {conteoActivo.turno === 'mañana' ? (
                                                <Sun className="h-5 w-5 text-yellow-500" />
                                            ) : (
                                                <Moon className="h-5 w-5 text-indigo-500" />
                                            )}
                                            {conteoActivo.turno.charAt(0).toUpperCase() + conteoActivo.turno.slice(1)}
                                        </CardTitle>
                                    </CardHeader>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardDescription>Tiempo</CardDescription>
                                        <CardTitle className={tiempoTranscurrido > TIEMPO_LIMITE_MINUTOS ? 'text-orange-500' : ''}>
                                            {tiempoTranscurrido} min
                                            {tiempoTranscurrido > TIEMPO_LIMITE_MINUTOS && (
                                                <Badge variant="outline" className="ml-2 text-orange-500">
                                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                                    Excedido
                                                </Badge>
                                            )}
                                        </CardTitle>
                                    </CardHeader>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardDescription>Progreso</CardDescription>
                                        <CardTitle>{itemsContados} / {items.length}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                        <Progress value={progreso} className="h-2" />
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardDescription>Diferencias</CardDescription>
                                        <CardTitle className={itemsConDiferencia > 0 ? 'text-red-500' : 'text-green-500'}>
                                            {itemsConDiferencia}
                                        </CardTitle>
                                    </CardHeader>
                                </Card>
                            </div>

                            {/* Lista de productos para contar */}
                            <Card>
                                <CardHeader>
                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                        <div>
                                            <CardTitle>Productos</CardTitle>
                                            <CardDescription>
                                                Ingresa la cantidad física de cada producto
                                            </CardDescription>
                                        </div>
                                        <div className="relative w-full md:w-64">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Buscar producto..."
                                                value={busqueda}
                                                onChange={(e) => setBusqueda(e.target.value)}
                                                className="pl-10"
                                            />
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                                        {itemsFiltrados.map((item) => (
                                            <div
                                                key={item.id}
                                                className={`flex flex-col md:flex-row md:items-center gap-3 p-3 rounded-lg border transition-colors ${item.diferencia !== 0
                                                    ? item.diferencia > 0
                                                        ? 'bg-green-50 border-green-200'
                                                        : 'bg-red-50 border-red-200'
                                                    : item.cantidad_fisica !== null
                                                        ? 'bg-muted/30'
                                                        : ''
                                                    }`}
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium truncate">
                                                            {item.producto?.nombre}
                                                        </span>
                                                        <Badge variant="outline" className="text-xs">
                                                            {item.producto?.codigo}
                                                        </Badge>
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">
                                                        Stock sistema: <strong>{item.cantidad_sistema}</strong> {item.producto?.unidad}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <div className="w-32">
                                                        <Input
                                                            type="text"
                                                            inputMode="decimal"
                                                            placeholder="Cantidad"
                                                            value={item.cantidad_fisica ?? ''}
                                                            onChange={(e) => {
                                                                const val = parseFloat(e.target.value.replace(',', '.'))
                                                                if (!isNaN(val) || e.target.value === '') {
                                                                    handleRegistrarConteo(item, isNaN(val) ? 0 : val)
                                                                }
                                                            }}
                                                            onFocus={(e) => e.target.select()}
                                                            className="text-center"
                                                        />
                                                    </div>

                                                    {item.cantidad_fisica !== null && (
                                                        <div className="w-24 text-center">
                                                            {item.diferencia === 0 ? (
                                                                <Badge variant="outline" className="bg-green-100">
                                                                    <CheckCircle className="h-3 w-3 mr-1" />
                                                                    OK
                                                                </Badge>
                                                            ) : (
                                                                <Badge
                                                                    variant={item.diferencia > 0 ? 'default' : 'destructive'}
                                                                    className={item.diferencia > 0 ? 'bg-green-500' : ''}
                                                                >
                                                                    {item.diferencia > 0 ? '+' : ''}{item.diferencia.toFixed(2)}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                                <CardFooter className="flex flex-col gap-4">
                                    <div className="w-full">
                                        <Label htmlFor="observaciones">Observaciones del conteo</Label>
                                        <Textarea
                                            id="observaciones"
                                            placeholder="Notas adicionales..."
                                            value={observaciones}
                                            onChange={(e) => setObservaciones(e.target.value)}
                                            rows={2}
                                        />
                                    </div>
                                    <div className="flex flex-wrap gap-2 justify-end w-full">
                                        <Button
                                            variant="outline"
                                            onClick={handleCancelarConteo}
                                            disabled={loading}
                                        >
                                            <XCircle className="h-4 w-4 mr-2" />
                                            Cancelar
                                        </Button>
                                        <Button
                                            onClick={handleFinalizarConteo}
                                            disabled={loading || itemsContados === 0}
                                        >
                                            <CheckCircle className="h-4 w-4 mr-2" />
                                            Finalizar Conteo
                                        </Button>
                                    </div>
                                </CardFooter>
                            </Card>
                        </>
                    )}
                </TabsContent>

                {/* TAB: Historial */}
                <TabsContent value="historial" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Historial de Conteos</CardTitle>
                            <CardDescription>
                                Registro de conteos anteriores
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {historial.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p>No hay conteos registrados</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {historial.map((conteo) => (
                                        <div
                                            key={conteo.id}
                                            className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg border hover:bg-muted/30 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                {conteo.turno === 'mañana' ? (
                                                    <Sun className="h-5 w-5 text-yellow-500" />
                                                ) : (
                                                    <Moon className="h-5 w-5 text-indigo-500" />
                                                )}
                                                <div>
                                                    <div className="font-medium">
                                                        {formatDate(conteo.fecha)} - Turno {conteo.turno}
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">
                                                        Por: {conteo.usuario?.nombre} {conteo.usuario?.apellido || ''}
                                                        {conteo.duracion_minutos && ` • ${conteo.duracion_minutos} min`}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 mt-2 md:mt-0">
                                                <div className="text-right">
                                                    <div className="text-sm">
                                                        {conteo.total_productos_contados} contados
                                                    </div>
                                                    {conteo.total_diferencias > 0 && (
                                                        <div className="text-sm text-red-500">
                                                            {conteo.total_diferencias} diferencias
                                                        </div>
                                                    )}
                                                </div>
                                                <Badge
                                                    variant={
                                                        conteo.estado === 'completado' ? 'default' :
                                                            conteo.estado === 'timeout' ? 'secondary' :
                                                                'destructive'
                                                    }
                                                    className={conteo.estado === 'completado' ? 'bg-green-500' : ''}
                                                >
                                                    {conteo.estado === 'completado' && <CheckCircle className="h-3 w-3 mr-1" />}
                                                    {conteo.estado === 'timeout' && <Clock className="h-3 w-3 mr-1" />}
                                                    {conteo.estado === 'cancelado' && <XCircle className="h-3 w-3 mr-1" />}
                                                    {conteo.estado}
                                                </Badge>
                                                <Button variant="ghost" size="sm">
                                                    <FileText className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
