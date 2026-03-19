'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
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
    Target,
    Droplets,
    Printer
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
import { obtenerPrediccionRendimientoAction, type PrediccionRendimiento } from '@/actions/rendimientos.actions'
import { ScanButton } from '@/components/barcode/BarcodeScanner'
import { parseBarcodeEAN13 } from '@/lib/barcode-parser'
import type { Producto, DestinoProduccion } from '@/types/domain.types'
import PrintDetalleProduccion from '@/components/almacen/PrintDetalleProduccion'

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
    destino_id: string
    destino_nombre: string
}

interface EntradaLocal {
    id?: string
    producto_id: string
    producto_nombre: string
    destino_id: string
    destino_nombre: string
    peso_kg: number
    peso_esperado?: number
    es_desperdicio_solido?: boolean
    plu?: string
}

interface LoteDisponible {
    id: string
    numero_lote: string
    cantidad_disponible: number
    fecha_vencimiento?: string
}

// Tipo para productos por destino (coincide con obtenerProductosPorDestinoAction)
interface ProductoDestino {
    id: string
    codigo: string
    nombre: string
    categoria?: string
    es_desperdicio: boolean
    es_desperdicio_solido: boolean
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
    const [productosPorDestino, setProductosPorDestino] = useState<Record<string, ProductoDestino[]>>({})
    const [prediccionesPorDestino, setPrediccionesPorDestino] = useState<Record<string, PrediccionRendimiento[]>>({})
    const [currentDestinationIndex, setCurrentDestinationIndex] = useState(0)

    // Campos temporales para agregar SALIDA (producto que sale del stock)
    const [productoSalidaId, setProductoSalidaId] = useState('')
    const [loteSalidaId, setLoteSalidaId] = useState('')
    const [cantidadSalida, setCantidadSalida] = useState('')
    const [pesoSalida, setPesoSalida] = useState('')
    const [busquedaSalida, setBusquedaSalida] = useState('') // Filtro de búsqueda
    const [destinoSalidaId, setDestinoSalidaId] = useState('') // Destino para este producto
    const [pesoSalidaManual, setPesoSalidaManual] = useState(false)

    // Campos temporales para agregar ENTRADA (producto que entra al stock)
    const [productoEntradaId, setProductoEntradaId] = useState('')

    const [pesoEntrada, setPesoEntrada] = useState('')
    const [pluEntrada, setPluEntrada] = useState('')
    const [busquedaEntrada, setBusquedaEntrada] = useState('') // Filtro de búsqueda

    // Obtener destinos únicos de las salidas agregadas
    const destinosUnicos = [...new Set(salidas.map(s => s.destino_id))].filter(Boolean)

    // Datos computados para la vista secuencial
    const activeDestinoIds = destinosUnicos
    const currentDestinoId = activeDestinoIds[currentDestinationIndex]
    const currentDestino = destinos.find(d => d.id === currentDestinoId)

    // Entradas para el destino actual
    const entradasActuales = entradas.filter(e => e.destino_id === currentDestinoId)
    const pesoGeneradoActual = entradasActuales.reduce((sum, e) => sum + e.peso_kg, 0)

    // Calcular peso entrante para el destino actual (suma de salidas asignadas a este destino)
    const pesoEntranteActual = salidas
        .filter(s => s.destino_id === currentDestinoId)
        .reduce((sum, s) => sum + (s.cantidad * s.peso_kg), 0)

    const mermaActualKg = pesoEntranteActual - pesoGeneradoActual
    const mermaActualPorcentaje = pesoEntranteActual > 0 ? (mermaActualKg / pesoEntranteActual) * 100 : 0

    // Productos disponibles para el destino actual
    const productosDisponiblesActual = productosPorDestino[currentDestinoId] || []

    // Productos filtrados para salidas (SOLO "CAJON POLLO" - no otros cajones como ALAS)
    const productosFiltradosSalida = productos
        .filter(p => p.venta_mayor_habilitada === true)  // Solo productos de venta por mayor (cajones)
        .filter(p => p.nombre.toUpperCase().includes('CAJON POLLO'))  // Solo CAJON POLLO
        .filter(p =>
            busquedaSalida === '' ||
            p.nombre.toLowerCase().includes(busquedaSalida.toLowerCase()) ||
            p.codigo.toLowerCase().includes(busquedaSalida.toLowerCase())
        )

    // Productos filtrados para entradas (del destino actual)
    const productosFiltradosEntrada = productosDisponiblesActual.filter(p =>
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

    // Autocalcular peso para cajones (venta mayor) si no está habilitado el modo manual
    useEffect(() => {
        if (pesoSalidaManual) return
        const producto = productos.find(p => p.id === productoSalidaId)
        if (!producto?.venta_mayor_habilitada) return

        // Si el campo está vacío o es 0, limpiar peso y salir
        const cantidadNum = parseFloat(cantidadSalida)
        if (!cantidadSalida || isNaN(cantidadNum) || cantidadNum <= 0) {
            setPesoSalida('')
            return
        }

        const kgUnidad = (producto as any).kg_por_unidad_mayor ?? 20
        const pesoAuto = cantidadNum * kgUnidad
        setPesoSalida(pesoAuto.toFixed(3))
    }, [productoSalidaId, cantidadSalida, pesoSalidaManual, productos])



    // Cargar productos permitidos basándose en los destinos de las salidas
    useEffect(() => {
        async function cargarProductosPorDestinos() {
            if (destinosUnicos.length === 0) {
                setProductosPorDestino({})
                return
            }

            const nuevoMap: Record<string, ProductoDestino[]> = {}

            for (const destinoId of destinosUnicos) {
                const { data } = await obtenerProductosPorDestinoAction(destinoId)
                if (data) {
                    nuevoMap[destinoId] = data
                }
            }

            setProductosPorDestino(nuevoMap)
        }
        cargarProductosPorDestinos()
    }, [destinosUnicos.join(',')])

    // Cargar predicciones de rendimiento para cada destino
    useEffect(() => {
        async function cargarPredicciones() {
            if (destinosUnicos.length === 0 || salidas.length === 0) {
                setPrediccionesPorDestino({})
                return
            }

            const prediccionesMap: Record<string, PrediccionRendimiento[]> = {}

            for (const destinoId of destinosUnicos) {
                // Calcular peso de entrada para este destino
                const pesoEntradaDestino = salidas
                    .filter(s => s.destino_id === destinoId)
                    .reduce((sum, s) => sum + (s.cantidad * s.peso_kg), 0)

                if (pesoEntradaDestino > 0) {
                    const { data } = await obtenerPrediccionRendimientoAction(
                        destinoId,
                        pesoEntradaDestino,
                        'GENERICO' // TODO: Detectar proveedor del lote
                    )
                    if (data) {
                        prediccionesMap[destinoId] = data
                    }
                }
            }

            setPrediccionesPorDestino(prediccionesMap)
        }
        cargarPredicciones()
    }, [destinosUnicos.join(','), salidas.length])

    // Obtener predicción para un producto específico del destino actual
    const obtenerPrediccionProducto = useCallback((productoId: string): PrediccionRendimiento | undefined => {
        const predicciones = prediccionesPorDestino[currentDestinoId] || []
        return predicciones.find(p => p.producto_id === productoId)
    }, [prediccionesPorDestino, currentDestinoId])


    // Manejar escaneo de código de barras para salidas (productos que salen)
    const handleScanSalida = useCallback(async (code: string) => {
        const parsed = parseBarcodeEAN13(code)
        console.log('[Produccion] Codigo escaneado (salida):', code, parsed)

        if (!parsed.isValid || !parsed.plu) {
            toast.error(parsed.error || 'Código no válido')
            return false
        }

        const result = await buscarProductoPorCodigoBarrasAction(parsed.rawCode)

        if (!result.success || !result.data) {
            toast.error(result.error || 'Producto no encontrado')
            return false
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

        return true
    }, [])

    // Manejar escaneo de código de barras para entradas (productos que entran)
    const handleScanEntrada = useCallback(async (code: string) => {
        const parsed = parseBarcodeEAN13(code)
        console.log('[Produccion] Codigo escaneado (entrada):', code, parsed)

        if (!parsed.isValid || !parsed.plu) {
            toast.error(parsed.error || 'Código no válido')
            return false
        }

        const result = await buscarProductoPorCodigoBarrasAction(parsed.rawCode)

        if (!result.success || !result.data) {
            toast.error(result.error || 'Producto no encontrado')
            return false
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

        return true
    }, [])

    // Calcular totales
    // NOTA: pesoTotalSalida = lo que SALE del stock (consumido)
    //       pesoTotalEntrada = lo que ENTRA al stock (generado)
    //       peso_kg en salidas = peso por unidad, se multiplica por cantidad
    const pesoTotalSalida = salidas.reduce((sum, s) => sum + (s.cantidad * (s.peso_kg || 0)), 0)

    // Separar productos reales de desperdicios sólidos
    const pesoTotalProducto = entradas
        .filter(e => !e.es_desperdicio_solido)
        .reduce((sum, e) => sum + (e.peso_kg || 0), 0)

    const pesoTotalDesperdicioSolido = entradas
        .filter(e => e.es_desperdicio_solido)
        .reduce((sum, e) => sum + (e.peso_kg || 0), 0)

    const pesoTotalEntrada = pesoTotalProducto + pesoTotalDesperdicioSolido

    // Merma Líquida/Proceso = Lo que falta para llegar al total de salida
    const mermaLiquidaKg = pesoTotalSalida - pesoTotalEntrada
    const mermaLiquidaPorcentaje = pesoTotalSalida > 0 ? (mermaLiquidaKg / pesoTotalSalida) * 100 : 0

    // Validación: Verificar si todos los destinos tienen productos cargados
    const validarDestinosCompletos = useCallback(() => {
        const destinosSinProductos: string[] = []

        for (const destinoId of activeDestinoIds) {
            const entradasDestino = entradas.filter(e => e.destino_id === destinoId)
            if (entradasDestino.length === 0) {
                const destino = destinos.find(d => d.id === destinoId)
                destinosSinProductos.push(destino?.nombre || destinoId)
            }
        }

        return {
            esValido: destinosSinProductos.length === 0,
            destinosSinProductos
        }
    }, [activeDestinoIds, entradas, destinos])

    // Calcular si la orden está lista para finalizar
    const { esValido: ordenCompleta, destinosSinProductos } = validarDestinosCompletos()

    // Validación: Verificar que todas las salidas tengan peso > 0
    const validarPesosSalida = useCallback(() => {
        const salidasSinPeso = salidas.filter(s => s.peso_kg <= 0)
        if (salidasSinPeso.length > 0) {
            const nombres = salidasSinPeso.map(s => s.producto_nombre).join(', ')
            toast.error(`Faltan kilos en: ${nombres}`)
            return false
        }
        return true
    }, [salidas])

    // Handler para avanzar del paso 2 al 3 con validación
    const handleAvanzarPaso3 = useCallback(() => {
        if (!validarPesosSalida()) return
        setStep(3)
    }, [validarPesosSalida])


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
        if (!ordenId || !productoSalidaId || !loteSalidaId || !cantidadSalida || !destinoSalidaId) {
            toast.error('Completa todos los campos (incluyendo destino)')
            return
        }

        setLoading(true)
        try {
            const producto = productos.find(p => p.id === productoSalidaId)
            const lote = lotesDisponibles.find(l => l.id === loteSalidaId)
            const destino = destinos.find(d => d.id === destinoSalidaId)

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
                    peso_kg: parseFloat(pesoSalida) || 0,
                    destino_id: destinoSalidaId,
                    destino_nombre: destino?.nombre || ''
                }])

                // Limpiar campos (pero mantener destino para agregar más del mismo tipo)
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
        // Usar currentDestinoId en lugar de destinoEntradaId
        if (!ordenId || !productoEntradaId || !currentDestinoId || !pesoEntrada) {
            toast.error('Completa todos los campos')
            return
        }

        setLoading(true)
        try {
            const producto = productos.find(p => p.id === productoEntradaId)
            const destino = destinos.find(d => d.id === currentDestinoId)

            // Buscar datos de predicción/configuración
            const prediccion = prediccionesPorDestino[currentDestinoId]?.find(p => p.producto_id === productoEntradaId)

            const result = await agregarEntradaStockAction(
                ordenId,
                productoEntradaId,
                currentDestinoId,
                parseFloat(pesoEntrada),
                1,
                pluEntrada || undefined,
                undefined, // Fecha vencimiento
                undefined, // Pesaje ID
                0, // Merma esperada (legacy)
                prediccion?.peso_predicho_kg || undefined,
                prediccion?.es_desperdicio_solido || false
            )

            if (result.success) {
                setEntradas([...entradas, {
                    id: result.data?.entrada_id,
                    producto_id: productoEntradaId,
                    producto_nombre: producto?.nombre || '',
                    destino_id: currentDestinoId,
                    destino_nombre: destino?.nombre || '',
                    peso_kg: parseFloat(pesoEntrada),
                    plu: pluEntrada,
                    peso_esperado: prediccion?.peso_predicho_kg,
                    es_desperdicio_solido: prediccion?.es_desperdicio_solido
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
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{salida.producto_nombre}</span>
                                                <Badge variant="outline" className="text-xs">
                                                    Lote: {salida.lote_numero}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Target className="h-3 w-3 text-primary" />
                                                <Badge variant="secondary" className="text-xs">
                                                    → {salida.destino_nombre}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 text-right">
                                            <span>{salida.cantidad} unidades</span>
                                            {salida.peso_kg > 0 && (
                                                <span className="font-semibold">
                                                    {(salida.cantidad * salida.peso_kg).toFixed(2)} kg
                                                </span>
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
                                    setPesoSalidaManual(false)
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
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    placeholder="Ej: 10"
                                    value={cantidadSalida}
                                    onChange={(e) => {
                                        // Solo permitir números
                                        const val = e.target.value.replace(/[^0-9]/g, '')
                                        setCantidadSalida(val)
                                    }}
                                    onFocus={(e) => e.target.select()}
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
                                    disabled={!pesoSalidaManual && productos.find(p => p.id === productoSalidaId)?.venta_mayor_habilitada === true}
                                />
                                <div className="mt-1 flex flex-col gap-1 text-xs text-muted-foreground">
                                    {productos.find(p => p.id === productoSalidaId)?.venta_mayor_habilitada && (
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline">
                                                1 {(productos.find(p => p.id === productoSalidaId)?.unidad_mayor_nombre || 'caja')} = {(productos.find(p => p.id === productoSalidaId) as any)?.kg_por_unidad_mayor ?? 20} kg
                                            </Badge>
                                            <span>Auto: {pesoSalida || '0'} kg</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <span>Editar peso manualmente</span>
                                        <Switch
                                            checked={pesoSalidaManual}
                                            onCheckedChange={(checked) => setPesoSalidaManual(checked)}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Selector de destino para esta salida */}
                            <div className="col-span-2">
                                <div className="flex items-center gap-2 mb-1">
                                    <Target className="h-4 w-4 text-primary" />
                                    <Label>Destino de Producción *</Label>
                                </div>
                                <Select value={destinoSalidaId} onValueChange={setDestinoSalidaId}>
                                    <SelectTrigger className={!destinoSalidaId ? 'border-primary' : ''}>
                                        <SelectValue placeholder="¿Para qué se usará este producto? (Filet, Pechuga, etc.)" />
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
                            onClick={handleAvanzarPaso3}
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
                            <CardTitle>Paso 3: Productos Generados</CardTitle>
                        </div>
                        <CardDescription>
                            Procesa cada destino de producción secuencialmente. Completa los kilos para cada uno.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">

                        {/* Navegación de Destinos (Tabs) - LIBRE */}
                        <div className="flex flex-wrap gap-2 mb-4">
                            {activeDestinoIds.map((destId, idx) => {
                                const dest = destinos.find(d => d.id === destId)
                                const entradasDestino = entradas.filter(e => e.destino_id === destId)
                                const pesoDestinoGenerado = entradasDestino.reduce((sum, e) => sum + e.peso_kg, 0)
                                const isActive = idx === currentDestinationIndex
                                const tieneProductos = entradasDestino.length > 0

                                return (
                                    <button
                                        key={destId}
                                        type="button"
                                        onClick={() => setCurrentDestinationIndex(idx)}
                                        className={`px-3 py-1.5 rounded-full text-sm font-medium border flex items-center gap-2 cursor-pointer transition-all hover:shadow-md
                                            ${isActive
                                                ? 'bg-primary text-primary-foreground border-primary ring-2 ring-primary/30'
                                                : tieneProductos
                                                    ? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
                                                    : 'bg-muted text-muted-foreground border-gray-300 hover:bg-gray-200'
                                            }`}
                                    >
                                        {tieneProductos && <Check className="h-3 w-3" />}
                                        {idx + 1}. {dest?.nombre}
                                        {tieneProductos && (
                                            <span className="text-xs opacity-75">({pesoDestinoGenerado.toFixed(1)}kg)</span>
                                        )}
                                    </button>
                                )
                            })}
                        </div>

                        {/* Panel del Destino Actual */}
                        {currentDestino && (
                            <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-900/50 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                                        <Target className="h-5 w-5" />
                                        Procesando: {currentDestino.nombre}
                                    </h3>
                                    <Badge variant={mermaActualPorcentaje > 20 ? "destructive" : "outline"}>
                                        Merma: {mermaActualPorcentaje.toFixed(1)}%
                                    </Badge>
                                </div>

                                {/* Barra de Progreso de Kilos */}
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>Generado: <strong>{pesoGeneradoActual.toFixed(2)} kg</strong></span>
                                        <span>Meta (Entrante): <strong>{pesoEntranteActual.toFixed(2)} kg</strong></span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-green-500 transition-all duration-500"
                                            style={{ width: `${Math.min((pesoGeneradoActual / pesoEntranteActual) * 100, 100)}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground text-right">
                                        Faltan procesar: {Math.max(0, pesoEntranteActual - pesoGeneradoActual).toFixed(2)} kg
                                    </p>
                                </div>

                                {/* Lista de productos a cargar (TODOS los del destino) */}
                                <div className="space-y-3">
                                    <Label className="text-sm font-medium">Productos a generar:</Label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {(prediccionesPorDestino[currentDestinoId] || productosDisponiblesActual.map(p => ({
                                            producto_id: p.id,
                                            producto_nombre: p.nombre,
                                            producto_codigo: p.codigo,
                                            porcentaje_esperado: 0,
                                            peso_predicho_kg: 0,
                                            tolerancia: 5,
                                            peso_min_kg: 0,
                                            peso_max_kg: 0,
                                            es_desperdicio_solido: false
                                        }))).map((pred) => {
                                            const entradaExistente = entradasActuales.find(e => e.producto_id === pred.producto_id)
                                            const pesoReal = entradaExistente?.peso_kg || 0
                                            const desviacion = pred.peso_predicho_kg > 0
                                                ? ((pesoReal - pred.peso_predicho_kg) / pred.peso_predicho_kg) * 100
                                                : 0
                                            const dentroTolerancia = Math.abs(desviacion) <= (pred.tolerancia || 5)

                                            return (
                                                <div
                                                    key={pred.producto_id}
                                                    className={`p-3 rounded-lg border-2 transition-all ${entradaExistente
                                                        ? dentroTolerancia
                                                            ? 'bg-green-50 border-green-300'
                                                            : 'bg-yellow-50 border-yellow-400'
                                                        : 'bg-white border-gray-200 hover:border-primary/50'
                                                        } ${pred.es_desperdicio_solido ? 'ring-1 ring-orange-300' : ''}`}
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <span className="font-medium">{pred.producto_nombre}</span>
                                                            {pred.es_desperdicio_solido && (
                                                                <Badge variant="outline" className="ml-2 text-xs border-orange-400 text-orange-600">
                                                                    Desperdicio
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        {entradaExistente && (
                                                            <Badge variant={dentroTolerancia ? 'default' : 'secondary'} className={!dentroTolerancia ? 'bg-yellow-500' : ''}>
                                                                {pesoReal.toFixed(2)} kg
                                                            </Badge>
                                                        )}
                                                    </div>

                                                    {pred.peso_predicho_kg > 0 && (
                                                        <div className="text-xs text-muted-foreground mb-2">
                                                            Sugerido: <strong>{pred.peso_predicho_kg.toFixed(2)} kg</strong>
                                                            <span className="ml-2">({pred.porcentaje_esperado}% ± {pred.tolerancia}%)</span>
                                                        </div>
                                                    )}

                                                    {!entradaExistente && (
                                                        <div className="flex gap-2 mt-2">
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                placeholder={pred.peso_predicho_kg > 0 ? pred.peso_predicho_kg.toFixed(2) : "Peso kg"}
                                                                className="h-8 text-sm"
                                                                value={productoEntradaId === pred.producto_id ? pesoEntrada : ''}
                                                                onFocus={() => setProductoEntradaId(pred.producto_id)}
                                                                onChange={(e) => {
                                                                    setProductoEntradaId(pred.producto_id)
                                                                    setPesoEntrada(e.target.value)
                                                                }}
                                                            />
                                                            <Button
                                                                size="sm"
                                                                disabled={productoEntradaId !== pred.producto_id || !pesoEntrada}
                                                                onClick={handleAgregarEntrada}
                                                            >
                                                                <Plus className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    )}

                                                    {entradaExistente && !dentroTolerancia && (
                                                        <div className="text-xs text-yellow-700 mt-1 flex items-center gap-1">
                                                            <AlertCircle className="h-3 w-3" />
                                                            Desviación: {desviacion > 0 ? '+' : ''}{desviacion.toFixed(1)}%
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                            </div>
                        )}

                    </CardContent>
                    <CardFooter className="flex justify-between">
                        <Button variant="outline" onClick={() => {
                            if (currentDestinationIndex > 0) {
                                setCurrentDestinationIndex(prev => prev - 1)
                            } else {
                                setStep(2)
                            }
                        }}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            {currentDestinationIndex > 0 ? 'Destino Anterior' : 'Volver a Stock'}
                        </Button>

                        <div className="flex flex-col gap-2 items-end">
                            {/* Alerta si hay destinos sin productos */}
                            {!ordenCompleta && (
                                <div className="flex items-center gap-2 text-yellow-600 text-sm bg-yellow-50 px-3 py-1.5 rounded-md">
                                    <AlertCircle className="h-4 w-4" />
                                    <span>Faltan productos en: {destinosSinProductos.join(', ')}</span>
                                </div>
                            )}

                            {currentDestinationIndex < activeDestinoIds.length - 1 ? (
                                <Button onClick={() => setCurrentDestinationIndex(prev => prev + 1)}>
                                    Siguiente Destino
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            ) : (
                                <Button
                                    onClick={() => {
                                        if (!ordenCompleta) {
                                            toast.error(`Debes cargar productos en todos los destinos: ${destinosSinProductos.join(', ')}`)
                                            return
                                        }
                                        setStep(4)
                                    }}
                                    className={ordenCompleta ? "bg-green-600 hover:bg-green-700" : "bg-gray-400 cursor-not-allowed"}
                                    disabled={!ordenCompleta}
                                >
                                    Finalizar Producción
                                    <Check className="ml-2 h-4 w-4" />
                                </Button>
                            )}
                        </div>
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
                        {/* Resumen de salidas (lo que se consume) - CARDS */}
                        <div>
                            <h3 className="font-semibold mb-3 flex items-center gap-2">
                                <Package className="h-4 w-4 text-orange-500" />
                                Productos Consumidos (Salen del Stock)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {salidas.map((salida, idx) => (
                                    <div
                                        key={idx}
                                        className="p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-between"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium truncate">{salida.producto_nombre}</div>
                                            <div className="text-xs text-muted-foreground">Lote: {salida.lote_numero}</div>
                                            <div className="text-sm">{salida.cantidad} und. × {salida.peso_kg} kg = <strong>{(salida.cantidad * salida.peso_kg).toFixed(2)} kg</strong></div>
                                        </div>
                                        <Badge variant="secondary" className="ml-2 shrink-0 bg-primary/10 text-primary">
                                            <Target className="h-3 w-3 mr-1" />
                                            {salida.destino_nombre}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-3 pt-3 border-t flex justify-between font-semibold text-lg">
                                <span>Total consumido:</span>
                                <span className="text-orange-600">{pesoTotalSalida.toFixed(2)} kg</span>
                            </div>
                        </div>

                        {/* Resumen de entradas (lo que se genera) - CARDS con ALERTAS */}
                        <div>
                            <h3 className="font-semibold mb-3 flex items-center gap-2">
                                <Scale className="h-4 w-4 text-green-500" />
                                Productos Generados (Entran al Stock)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {entradas.map((entrada, idx) => {
                                    // Calcular desviación si hay peso esperado
                                    let desviacion = 0
                                    let mostrarAlerta = false
                                    if (entrada.peso_esperado && entrada.peso_esperado > 0) {
                                        desviacion = ((entrada.peso_kg - entrada.peso_esperado) / entrada.peso_esperado) * 100
                                        mostrarAlerta = Math.abs(desviacion) > 5 // Umbral fijo visual del 5% o usar tolerancia si la tuviéramos
                                    }

                                    return (
                                        <div
                                            key={idx}
                                            className={`p-3 border rounded-lg flex items-center justify-between ${mostrarAlerta ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'
                                                }`}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium truncate">{entrada.producto_nombre}</span>
                                                    {entrada.es_desperdicio_solido && (
                                                        <Badge variant="outline" className="text-[10px] border-orange-400 text-orange-600 px-1 py-0 h-4">
                                                            Desp.
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 text-sm mt-1">
                                                    <strong>{entrada.peso_kg.toFixed(2)} kg</strong>
                                                    {entrada.peso_esperado && (
                                                        <span className="text-xs text-muted-foreground">
                                                            (Esp: {entrada.peso_esperado.toFixed(2)}kg)
                                                        </span>
                                                    )}
                                                </div>
                                                {mostrarAlerta && (
                                                    <div className="text-xs text-yellow-700 mt-1 flex items-center gap-1 font-medium">
                                                        <AlertCircle className="h-3 w-3" />
                                                        Desviación: {desviacion > 0 ? '+' : ''}{desviacion.toFixed(1)}%
                                                    </div>
                                                )}
                                            </div>
                                            <Badge variant="secondary" className="ml-2 shrink-0 bg-primary/10 text-primary">
                                                <Target className="h-3 w-3 mr-1" />
                                                {entrada.destino_nombre}
                                            </Badge>
                                        </div>
                                    )
                                })}
                            </div>
                            <div className="mt-3 pt-3 border-t">
                                <div className="flex justify-between mb-1 text-sm text-muted-foreground">
                                    <span>Producto Terminado:</span>
                                    <span>{pesoTotalProducto.toFixed(2)} kg</span>
                                </div>
                                <div className="flex justify-between mb-2 text-sm text-orange-600">
                                    <span>Desperdicio Sólido (Hueso/Piel):</span>
                                    <span>{pesoTotalDesperdicioSolido.toFixed(2)} kg</span>
                                </div>
                                <div className="flex justify-between font-semibold text-lg border-t pt-2">
                                    <span>Total generado:</span>
                                    <span className="text-green-600">{pesoTotalEntrada.toFixed(2)} kg</span>
                                </div>
                            </div>
                        </div>

                        {/* Merma Líquida / Proceso */}
                        <div className={`p-4 rounded-lg ${mermaLiquidaPorcentaje > 10 ? 'bg-red-100' : 'bg-blue-50'}`}>
                            <div className="flex justify-between items-center mb-1">
                                <span className="font-semibold flex items-center gap-2">
                                    <Droplets className="h-4 w-4" />
                                    Merma de Proceso / Líquida:
                                </span>
                                <span className={`font-bold ${mermaLiquidaPorcentaje > 10 ? 'text-red-600' : 'text-blue-700'}`}>
                                    {mermaLiquidaKg.toFixed(2)} kg ({mermaLiquidaPorcentaje.toFixed(1)}%)
                                </span>
                            </div>
                            <div className="text-xs text-muted-foreground ml-6">
                                (Diferencia invisible entre Salida y entradas)
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
                            <Button variant="outline" onClick={() => window.print()} disabled={loading}>
                                <Printer className="mr-2 h-4 w-4" />
                                Imprimir Resumen
                            </Button>
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

