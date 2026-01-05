'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    ArrowLeft,
    ArrowRight,
    Package,
    Scale,
    Check,
    Plus,
    Trash2,
    Factory,
    AlertCircle,
    Target
} from 'lucide-react'
import { toast } from 'sonner'
import {
    crearOrdenProduccionAction,
    agregarSalidaStockAction,
    agregarEntradaStockAction,
    completarOrdenProduccionAction,
    cancelarOrdenProduccionAction,
    obtenerLotesDisponiblesAction
} from '@/actions/produccion.actions'
import { obtenerDestinosProduccionListaAction, obtenerProductosPorDestinoAction } from '@/actions/destinos-produccion.actions'
import { obtenerProductosAction, buscarProductoPorCodigoBarrasAction } from '@/actions/almacen.actions'
import { ScanButton } from '@/components/barcode/BarcodeScanner'
import { parseBarcodeEAN13 } from '@/lib/barcode-parser'
import type { Producto, DestinoProduccion } from '@/types/domain.types'

// Tipos locales para el formulario
// NOTA: "Salida" = producto que SALE del stock (consumido)
//       "Entrada" = producto que ENTRA al stock (generado)
interface SalidaLocal {
    id?: string
    producto_id: string
    producto_nombre: string
    lote_id: string
    lote_numero: string
    cantidad: number
    peso_kg: number
}

interface EntradaLocal {
    id?: string
    producto_id: string
    producto_nombre: string
    destino_id: string
    destino_nombre: string
    peso_kg: number
    plu?: string
}

interface LoteDisponible {
    id: string
    numero_lote: string
    cantidad_disponible: number
    fecha_vencimiento?: string
}

export default function NuevaOrdenProduccionPage() {
    const router = useRouter()
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [ordenId, setOrdenId] = useState<string | null>(null)
    const [numeroOrden, setNumeroOrden] = useState<string>('')

    // Datos del formulario
    const [observaciones, setObservaciones] = useState('')
    const [salidas, setSalidas] = useState<SalidaLocal[]>([])   // Productos que SALEN del stock
    const [entradas, setEntradas] = useState<EntradaLocal[]>([]) // Productos que ENTRAN al stock

    // Datos para selección
    const [productos, setProductos] = useState<Producto[]>([])
    const [destinos, setDestinos] = useState<DestinoProduccion[]>([])
    const [lotesDisponibles, setLotesDisponibles] = useState<LoteDisponible[]>([])
    const [productosEntrada, setProductosEntrada] = useState<Array<{ id: string; codigo: string; nombre: string; es_desperdicio: boolean }>>([])

    // Campos temporales para agregar SALIDA (producto que sale del stock)
    const [productoSalidaId, setProductoSalidaId] = useState('')
    const [loteSalidaId, setLoteSalidaId] = useState('')
    const [cantidadSalida, setCantidadSalida] = useState('')
    const [pesoSalida, setPesoSalida] = useState('')
    const [busquedaSalida, setBusquedaSalida] = useState('') // Filtro de búsqueda

    // Campos temporales para agregar ENTRADA (producto que entra al stock)
    const [productoEntradaId, setProductoEntradaId] = useState('')
    const [destinoEntradaId, setDestinoEntradaId] = useState('')
    const [pesoEntrada, setPesoEntrada] = useState('')
    const [pluEntrada, setPluEntrada] = useState('')
    const [busquedaEntrada, setBusquedaEntrada] = useState('') // Filtro de búsqueda

    // Productos filtrados para salidas
    const productosFiltradosSalida = productos.filter(p =>
        p.nombre.toLowerCase().includes(busquedaSalida.toLowerCase()) ||
        p.codigo.toLowerCase().includes(busquedaSalida.toLowerCase())
    )

    // Productos filtrados para entradas
    const productosFiltradosEntrada = productosEntrada.filter(p =>
        p.nombre.toLowerCase().includes(busquedaEntrada.toLowerCase()) ||
        p.codigo.toLowerCase().includes(busquedaEntrada.toLowerCase())
    )

    // Cargar productos y destinos al montar
    useEffect(() => {
        async function cargarDatos() {
            const [productosRes, destinosRes] = await Promise.all([
                obtenerProductosAction(),
                obtenerDestinosProduccionListaAction()
            ])

            if (productosRes.data) {
                setProductos(productosRes.data)
            }
            if (destinosRes.data) {
                setDestinos(destinosRes.data)
            }
        }
        cargarDatos()
    }, [])

    // Cargar lotes cuando cambia el producto de salida
    useEffect(() => {
        async function cargarLotes() {
            if (productoSalidaId) {
                const { data } = await obtenerLotesDisponiblesAction(productoSalidaId)
                if (data) {
                    setLotesDisponibles(data)
                }
            } else {
                setLotesDisponibles([])
            }
        }
        cargarLotes()
    }, [productoSalidaId])

    // Cargar productos permitidos cuando cambia el destino de entrada
    useEffect(() => {
        async function cargarProductosDestino() {
            if (destinoEntradaId) {
                const { data } = await obtenerProductosPorDestinoAction(destinoEntradaId)
                if (data && data.length > 0) {
                    setProductosEntrada(data)
                } else {
                    // Si no hay productos asociados, mostrar todos
                    setProductosEntrada(productos.map(p => ({
                        id: p.id,
                        codigo: p.codigo,
                        nombre: p.nombre,
                        es_desperdicio: false
                    })))
                }
            } else {
                setProductosEntrada([])
            }
            // Limpiar producto seleccionado al cambiar destino
            setProductoEntradaId('')
        }
        cargarProductosDestino()
    }, [destinoEntradaId, productos])

    // Manejar escaneo de código de barras para salidas (productos que salen)
    const handleScanSalida = useCallback(async (code: string) => {
        const parsed = parseBarcodeEAN13(code)
        console.log('[Producción] Código escaneado (salida):', code, parsed)

        if (!parsed.plu) {
            toast.error('Código no válido')
            return
        }

        const result = await buscarProductoPorCodigoBarrasAction(parsed.plu)

        if (!result.success || !result.data) {
            toast.error(result.error || 'Producto no encontrado')
            return
        }

        const producto = result.data.producto
        setProductoSalidaId(producto.id)

        if (parsed.isWeightCode && parsed.weight) {
            setPesoSalida(parsed.weight.toFixed(3))
            setCantidadSalida('1')
            toast.success(`${producto.nombre} - ${parsed.weight.toFixed(3)} kg`)
        } else {
            toast.success(`Producto: ${producto.nombre}`)
        }
    }, [])

    // Manejar escaneo de código de barras para entradas (productos que entran)
    const handleScanEntrada = useCallback(async (code: string) => {
        const parsed = parseBarcodeEAN13(code)
        console.log('[Producción] Código escaneado (entrada):', code, parsed)

        if (!parsed.plu) {
            toast.error('Código no válido')
            return
        }

        const result = await buscarProductoPorCodigoBarrasAction(parsed.plu)

        if (!result.success || !result.data) {
            toast.error(result.error || 'Producto no encontrado')
            return
        }

        const producto = result.data.producto
        setProductoEntradaId(producto.id)
        setPluEntrada(parsed.plu)

        if (parsed.isWeightCode && parsed.weight) {
            setPesoEntrada(parsed.weight.toFixed(3))
            toast.success(`${producto.nombre} - ${parsed.weight.toFixed(3)} kg`)
        } else {
            toast.success(`Producto: ${producto.nombre}`)
        }
    }, [])

    // Calcular totales
    // NOTA: pesoTotalSalida = lo que SALE del stock (consumido)
    //       pesoTotalEntrada = lo que ENTRA al stock (generado)
    const pesoTotalSalida = salidas.reduce((sum, s) => sum + (s.peso_kg || 0), 0)
    const pesoTotalEntrada = entradas.reduce((sum, e) => sum + (e.peso_kg || 0), 0)
    const mermaKg = pesoTotalSalida - pesoTotalEntrada
    const mermaPorcentaje = pesoTotalSalida > 0 ? (mermaKg / pesoTotalSalida) * 100 : 0

    // Crear orden al avanzar del paso 1 al 2
    const handleIniciarOrden = async () => {
        setLoading(true)
        try {
            const result = await crearOrdenProduccionAction(observaciones || undefined)
            if (result.success && result.data) {
                setOrdenId(result.data.orden_id)
                setNumeroOrden(result.data.numero_orden)
                setStep(2)
                toast.success('Orden creada: ' + result.data.numero_orden)
            } else {
                toast.error(result.message || 'Error al crear orden')
            }
        } catch (error) {
            toast.error('Error al crear orden')
        } finally {
            setLoading(false)
        }
    }

    // Agregar SALIDA de stock (producto que SALE del inventario)
    const handleAgregarSalida = async () => {
        if (!ordenId || !productoSalidaId || !loteSalidaId || !cantidadSalida) {
            toast.error('Completa todos los campos')
            return
        }

        setLoading(true)
        try {
            const producto = productos.find(p => p.id === productoSalidaId)
            const lote = lotesDisponibles.find(l => l.id === loteSalidaId)

            const result = await agregarSalidaStockAction(
                ordenId,
                productoSalidaId,
                loteSalidaId,
                parseFloat(cantidadSalida),
                pesoSalida ? parseFloat(pesoSalida) : undefined
            )

            if (result.success) {
                setSalidas([...salidas, {
                    id: result.data?.salida_id,
                    producto_id: productoSalidaId,
                    producto_nombre: producto?.nombre || '',
                    lote_id: loteSalidaId,
                    lote_numero: lote?.numero_lote || '',
                    cantidad: parseFloat(cantidadSalida),
                    peso_kg: parseFloat(pesoSalida) || 0
                }])

                // Limpiar campos
                setProductoSalidaId('')
                setLoteSalidaId('')
                setCantidadSalida('')
                setPesoSalida('')
                setLotesDisponibles([])

                toast.success('Producto agregado (sale del stock)')
            } else {
                toast.error(result.message || 'Error al agregar')
            }
        } catch (error) {
            toast.error('Error al agregar')
        } finally {
            setLoading(false)
        }
    }

    // Agregar ENTRADA de stock (producto que ENTRA al inventario)
    const handleAgregarEntrada = async () => {
        if (!ordenId || !productoEntradaId || !destinoEntradaId || !pesoEntrada) {
            toast.error('Completa todos los campos (incluyendo destino de producción)')
            return
        }

        setLoading(true)
        try {
            const producto = productos.find(p => p.id === productoEntradaId)
            const destino = destinos.find(d => d.id === destinoEntradaId)

            const result = await agregarEntradaStockAction(
                ordenId,
                productoEntradaId,
                destinoEntradaId,
                parseFloat(pesoEntrada),
                1,
                pluEntrada || undefined
            )

            if (result.success) {
                setEntradas([...entradas, {
                    id: result.data?.entrada_id,
                    producto_id: productoEntradaId,
                    producto_nombre: producto?.nombre || '',
                    destino_id: destinoEntradaId,
                    destino_nombre: destino?.nombre || '',
                    peso_kg: parseFloat(pesoEntrada),
                    plu: pluEntrada
                }])

                // Limpiar campos
                setProductoEntradaId('')
                setPesoEntrada('')
                setPluEntrada('')
                // NO limpiar destino para mantener selección

                toast.success('Producto agregado (entra al stock)')
            } else {
                toast.error(result.message || 'Error al agregar')
            }
        } catch (error) {
            toast.error('Error al agregar')
        } finally {
            setLoading(false)
        }
    }

    // Completar orden
    const handleCompletarOrden = async () => {
        if (!ordenId) return

        if (entradas.length === 0) {
            toast.error('Agrega al menos un producto generado')
            return
        }

        setLoading(true)
        try {
            const result = await completarOrdenProduccionAction(ordenId)

            if (result.success) {
                toast.success(`Orden completada. ${result.data?.lotes_generados.length} lotes generados. Merma: ${result.data?.merma_porcentaje.toFixed(1)}%`)
                router.push('/almacen/produccion')
            } else {
                toast.error(result.message || 'Error al completar orden')
            }
        } catch (error) {
            toast.error('Error al completar orden')
        } finally {
            setLoading(false)
        }
    }

    // Cancelar orden
    const handleCancelarOrden = async () => {
        if (!ordenId) {
            router.push('/almacen/produccion')
            return
        }

        if (!confirm('¿Estás seguro de cancelar esta orden? Se revertirá el stock.')) {
            return
        }

        setLoading(true)
        try {
            const result = await cancelarOrdenProduccionAction(ordenId)

            if (result.success) {
                toast.success('Orden cancelada')
                router.push('/almacen/produccion')
            } else {
                toast.error(result.message || 'Error al cancelar orden')
            }
        } catch (error) {
            toast.error('Error al cancelar orden')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Nueva Orden de Producción</h1>
                    {numeroOrden && (
                        <p className="text-muted-foreground">
                            Orden: <span className="font-semibold text-primary">{numeroOrden}</span>
                        </p>
                    )}
                </div>
                <Button variant="ghost" onClick={() => router.push('/almacen/produccion')}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver
                </Button>
            </div>

            {/* Indicador de pasos */}
            <div className="flex items-center justify-center gap-2">
                {[1, 2, 3, 4].map((s) => (
                    <div
                        key={s}
                        className={`flex items-center ${s < 4 ? 'flex-1' : ''}`}
                    >
                        <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${s === step
                                ? 'bg-primary text-primary-foreground'
                                : s < step
                                    ? 'bg-green-500 text-white'
                                    : 'bg-muted text-muted-foreground'
                                }`}
                        >
                            {s < step ? <Check className="h-5 w-5" /> : s}
                        </div>
                        {s < 4 && (
                            <div
                                className={`h-1 flex-1 mx-2 ${s < step ? 'bg-green-500' : 'bg-muted'
                                    }`}
                            />
                        )}
                    </div>
                ))}
            </div>
            <div className="flex justify-between text-sm text-muted-foreground px-2">
                <span>Iniciar</span>
                <span>Salidas Stock</span>
                <span>Entradas Stock</span>
                <span>Completar</span>
            </div>

            {/* PASO 1: Iniciar orden */}
            {step === 1 && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Factory className="h-5 w-5 text-primary" />
                            <CardTitle>Iniciar Orden de Producción</CardTitle>
                        </div>
                        <CardDescription>
                            Ingresa observaciones opcionales para esta orden de desposte
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="observaciones">Observaciones (opcional)</Label>
                            <Textarea
                                id="observaciones"
                                placeholder="Notas adicionales sobre esta orden..."
                                value={observaciones}
                                onChange={(e) => setObservaciones(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-end">
                        <Button onClick={handleIniciarOrden} disabled={loading}>
                            {loading ? 'Creando...' : 'Iniciar Orden'}
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </CardFooter>
                </Card>
            )}

            {/* PASO 2: Agregar SALIDAS de stock (productos que SALEN - se consumen) */}
            {step === 2 && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Package className="h-5 w-5 text-orange-500" />
                            <CardTitle>Productos que SALEN del Stock</CardTitle>
                        </div>
                        <CardDescription>
                            Selecciona los lotes de producto origen que se van a procesar (ej: cajones de pollo entero)
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Lista de salidas agregadas */}
                        {salidas.length > 0 && (
                            <div className="space-y-2">
                                <Label>Productos a consumir:</Label>
                                {salidas.map((salida, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg"
                                    >
                                        <div>
                                            <span className="font-medium">{salida.producto_nombre}</span>
                                            <span className="text-muted-foreground ml-2">
                                                Lote: {salida.lote_numero}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span>{salida.cantidad} unidades</span>
                                            {salida.peso_kg > 0 && (
                                                <span className="font-semibold">{salida.peso_kg} kg</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                <div className="text-right font-semibold text-lg">
                                    Total a consumir: {pesoTotalSalida.toFixed(2)} kg
                                </div>
                            </div>
                        )}

                        {/* Formulario para agregar salida */}
                        <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <Label>Producto</Label>
                                    <ScanButton
                                        onScan={handleScanSalida}
                                        size="sm"
                                        variant="ghost"
                                        title="Escanear Producto"
                                        description="Escanea el código de barras de la etiqueta"
                                    />
                                </div>
                                <Select value={productoSalidaId} onValueChange={(val) => {
                                    setProductoSalidaId(val)
                                    setBusquedaSalida('') // Limpiar búsqueda al seleccionar
                                }}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar producto..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <div className="px-2 pb-2">
                                            <Input
                                                placeholder="Buscar producto..."
                                                value={busquedaSalida}
                                                onChange={(e) => setBusquedaSalida(e.target.value)}
                                                className="h-8"
                                                autoFocus
                                            />
                                        </div>
                                        {productosFiltradosSalida.length === 0 ? (
                                            <div className="p-2 text-sm text-muted-foreground text-center">
                                                No se encontraron productos
                                            </div>
                                        ) : (
                                            productosFiltradosSalida.map((p) => (
                                                <SelectItem key={p.id} value={p.id}>
                                                    {p.codigo} - {p.nombre}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Lote</Label>
                                <Select
                                    value={loteSalidaId}
                                    onValueChange={setLoteSalidaId}
                                    disabled={!productoSalidaId || lotesDisponibles.length === 0}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={
                                            !productoSalidaId
                                                ? "Selecciona producto primero"
                                                : lotesDisponibles.length === 0
                                                    ? "Sin lotes disponibles"
                                                    : "Seleccionar lote..."
                                        } />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {lotesDisponibles.map((l) => (
                                            <SelectItem key={l.id} value={l.id}>
                                                {l.numero_lote} ({l.cantidad_disponible} disp.)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Cantidad (unidades)</Label>
                                <Input
                                    type="number"
                                    placeholder="Ej: 10"
                                    value={cantidadSalida}
                                    onChange={(e) => setCantidadSalida(e.target.value)}
                                />
                            </div>

                            <div>
                                <Label>Peso (kg)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="Ej: 200"
                                    value={pesoSalida}
                                    onChange={(e) => setPesoSalida(e.target.value)}
                                />
                            </div>

                            <div className="col-span-2 flex justify-end">
                                <Button onClick={handleAgregarSalida} disabled={loading}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Agregar (Sale del Stock)
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-between">
                        <Button variant="outline" onClick={handleCancelarOrden} disabled={loading}>
                            Cancelar Orden
                        </Button>
                        <Button
                            onClick={() => setStep(3)}
                            disabled={salidas.length === 0}
                        >
                            Siguiente: Productos Generados
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </CardFooter>
                </Card>
            )}

            {/* PASO 3: Agregar ENTRADAS de stock (productos que ENTRAN - se generan) */}
            {step === 3 && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Scale className="h-5 w-5 text-green-500" />
                            <CardTitle>Productos que ENTRAN al Stock</CardTitle>
                        </div>
                        <CardDescription>
                            Registra cada producto generado con su peso y destino de producción
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Resumen de lo que sale del stock */}
                        <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Total consumido (sale del stock):</span>
                                <span className="font-semibold text-lg">{pesoTotalSalida.toFixed(2)} kg</span>
                            </div>
                        </div>

                        {/* Lista de entradas agregadas */}
                        {entradas.length > 0 && (
                            <div className="space-y-2">
                                <Label>Productos generados:</Label>
                                {entradas.map((entrada, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                                    >
                                        <div>
                                            <span className="font-medium">{entrada.producto_nombre}</span>
                                            <Badge variant="outline" className="ml-2">
                                                {entrada.destino_nombre}
                                            </Badge>
                                            {entrada.plu && (
                                                <Badge variant="secondary" className="ml-2">
                                                    PLU: {entrada.plu}
                                                </Badge>
                                            )}
                                        </div>
                                        <span className="font-semibold">{entrada.peso_kg} kg</span>
                                    </div>
                                ))}
                                <div className="flex justify-between text-lg">
                                    <span className="font-semibold">Total generado (entra al stock):</span>
                                    <span className="font-semibold text-green-600">{pesoTotalEntrada.toFixed(2)} kg</span>
                                </div>
                            </div>
                        )}

                        {/* Indicador de merma/desperdicio */}
                        <div className={`p-3 rounded-lg ${mermaPorcentaje > 50 ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    {mermaPorcentaje > 50 && <AlertCircle className="h-4 w-4 text-red-500" />}
                                    Desperdicio estimado:
                                </span>
                                <span className={`font-semibold ${mermaPorcentaje > 50 ? 'text-red-600' : 'text-orange-600'}`}>
                                    {mermaKg.toFixed(2)} kg ({mermaPorcentaje.toFixed(1)}%)
                                </span>
                            </div>
                        </div>

                        {/* Formulario para agregar entrada */}
                        <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30">
                            {/* Selector de DESTINO DE PRODUCCIÓN (obligatorio) */}
                            <div className="col-span-2">
                                <div className="flex items-center gap-2 mb-1">
                                    <Target className="h-4 w-4 text-primary" />
                                    <Label>Destino de Producción *</Label>
                                </div>
                                <Select value={destinoEntradaId} onValueChange={setDestinoEntradaId}>
                                    <SelectTrigger className={!destinoEntradaId ? 'border-primary' : ''}>
                                        <SelectValue placeholder="Seleccionar destino (Filet, Pechuga, Pollo Trozado)..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {destinos.map((d) => (
                                            <SelectItem key={d.id} value={d.id}>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{d.nombre}</span>
                                                    {d.descripcion && (
                                                        <span className="text-xs text-muted-foreground">{d.descripcion}</span>
                                                    )}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {!destinoEntradaId && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Selecciona el tipo de producción antes de agregar productos
                                    </p>
                                )}
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <Label>Producto</Label>
                                    <ScanButton
                                        onScan={handleScanEntrada}
                                        size="sm"
                                        variant="ghost"
                                        title="Escanear Producto"
                                        description="Escanea el código de barras de la etiqueta"
                                    />
                                </div>
                                <Select
                                    value={productoEntradaId}
                                    onValueChange={(val) => {
                                        setProductoEntradaId(val)
                                        setBusquedaEntrada('') // Limpiar búsqueda al seleccionar
                                    }}
                                    disabled={!destinoEntradaId}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={
                                            !destinoEntradaId
                                                ? "Selecciona destino primero"
                                                : productosEntrada.length === 0
                                                    ? "Sin productos configurados para este destino"
                                                    : "Seleccionar producto..."
                                        } />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <div className="px-2 pb-2">
                                            <Input
                                                placeholder="Buscar producto..."
                                                value={busquedaEntrada}
                                                onChange={(e) => setBusquedaEntrada(e.target.value)}
                                                className="h-8"
                                                autoFocus
                                            />
                                        </div>
                                        {productosFiltradosEntrada.length === 0 ? (
                                            <div className="p-2 text-sm text-muted-foreground text-center">
                                                No se encontraron productos
                                            </div>
                                        ) : (
                                            productosFiltradosEntrada.map((p) => (
                                                <SelectItem key={p.id} value={p.id}>
                                                    <span className={p.es_desperdicio ? 'text-orange-600' : ''}>
                                                        {p.codigo} - {p.nombre}
                                                        {p.es_desperdicio && ' (desperdicio)'}
                                                    </span>
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Peso (kg)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="Ej: 10.5"
                                    value={pesoEntrada}
                                    onChange={(e) => setPesoEntrada(e.target.value)}
                                    disabled={!destinoEntradaId}
                                />
                            </div>

                            <div className="col-span-2">
                                <Label>PLU (opcional)</Label>
                                <Input
                                    placeholder="Ej: 0148"
                                    value={pluEntrada}
                                    onChange={(e) => setPluEntrada(e.target.value)}
                                    disabled={!destinoEntradaId}
                                />
                            </div>

                            <div className="col-span-2 flex justify-end">
                                <Button
                                    onClick={handleAgregarEntrada}
                                    disabled={loading || !destinoEntradaId}
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Agregar (Entra al Stock)
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-between">
                        <Button variant="outline" onClick={() => setStep(2)}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Volver
                        </Button>
                        <Button
                            onClick={() => setStep(4)}
                            disabled={entradas.length === 0}
                        >
                            Siguiente: Completar
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </CardFooter>
                </Card>
            )}

            {/* PASO 4: Resumen y completar */}
            {step === 4 && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Check className="h-5 w-5 text-primary" />
                            <CardTitle>Resumen de la Orden</CardTitle>
                        </div>
                        <CardDescription>
                            Revisa los datos antes de completar la orden y generar los lotes
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Resumen de salidas (lo que se consume) */}
                        <div>
                            <h3 className="font-semibold mb-2 flex items-center gap-2">
                                <Package className="h-4 w-4 text-orange-500" />
                                Productos Consumidos (Salen del Stock)
                            </h3>
                            <div className="space-y-1">
                                {salidas.map((salida, idx) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                        <span>{salida.producto_nombre} (Lote: {salida.lote_numero})</span>
                                        <span>{salida.cantidad} und. / {salida.peso_kg} kg</span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-2 pt-2 border-t flex justify-between font-semibold">
                                <span>Total consumido:</span>
                                <span className="text-orange-600">{pesoTotalSalida.toFixed(2)} kg</span>
                            </div>
                        </div>

                        {/* Resumen de entradas (lo que se genera) */}
                        <div>
                            <h3 className="font-semibold mb-2 flex items-center gap-2">
                                <Scale className="h-4 w-4 text-green-500" />
                                Productos Generados (Entran al Stock)
                            </h3>
                            <div className="space-y-1">
                                {entradas.map((entrada, idx) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                        <span>
                                            {entrada.producto_nombre}
                                            <Badge variant="outline" className="ml-1 text-xs">
                                                {entrada.destino_nombre}
                                            </Badge>
                                        </span>
                                        <span>{entrada.peso_kg} kg</span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-2 pt-2 border-t flex justify-between font-semibold">
                                <span>Total generado:</span>
                                <span className="text-green-600">{pesoTotalEntrada.toFixed(2)} kg</span>
                            </div>
                        </div>

                        {/* Desperdicio final */}
                        <div className={`p-4 rounded-lg ${mermaPorcentaje > 50 ? 'bg-red-100' : 'bg-yellow-100'}`}>
                            <div className="flex justify-between text-lg">
                                <span className="font-semibold">Desperdicio Total:</span>
                                <span className={`font-bold ${mermaPorcentaje > 50 ? 'text-red-600' : 'text-orange-600'}`}>
                                    {mermaKg.toFixed(2)} kg ({mermaPorcentaje.toFixed(1)}%)
                                </span>
                            </div>
                        </div>

                        {observaciones && (
                            <div className="p-3 bg-muted rounded-lg">
                                <Label className="text-muted-foreground">Observaciones:</Label>
                                <p className="text-sm mt-1">{observaciones}</p>
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="flex justify-between">
                        <Button variant="outline" onClick={() => setStep(3)}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Volver
                        </Button>
                        <div className="flex gap-2">
                            <Button variant="destructive" onClick={handleCancelarOrden} disabled={loading}>
                                Cancelar Orden
                            </Button>
                            <Button onClick={handleCompletarOrden} disabled={loading}>
                                {loading ? 'Procesando...' : 'Completar y Generar Lotes'}
                                <Check className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </CardFooter>
                </Card>
            )}
        </div>
    )
}
