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
    Camera
} from 'lucide-react'
import { toast } from 'sonner'
import {
    crearOrdenProduccionAction,
    agregarEntradaProduccionAction,
    agregarSalidaProduccionAction,
    completarOrdenProduccionAction,
    cancelarOrdenProduccionAction,
    obtenerLotesDisponiblesAction
} from '@/actions/produccion.actions'
import { obtenerProductosAction, buscarProductoPorCodigoBarrasAction } from '@/actions/almacen.actions'
import { ScanButton } from '@/components/barcode/BarcodeScanner'
import { parseBarcodeEAN13 } from '@/lib/barcode-parser'
import type { Producto } from '@/types/domain.types'

// Tipos locales para el formulario
interface EntradaLocal {
    id?: string
    producto_id: string
    producto_nombre: string
    lote_id: string
    lote_numero: string
    cantidad: number
    peso_kg: number
}

interface SalidaLocal {
    id?: string
    producto_id: string
    producto_nombre: string
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
    const [entradas, setEntradas] = useState<EntradaLocal[]>([])
    const [salidas, setSalidas] = useState<SalidaLocal[]>([])

    // Datos para selección
    const [productos, setProductos] = useState<Producto[]>([])
    const [lotesDisponibles, setLotesDisponibles] = useState<LoteDisponible[]>([])

    // Campos temporales para agregar
    const [productoEntradaId, setProductoEntradaId] = useState('')
    const [loteEntradaId, setLoteEntradaId] = useState('')
    const [cantidadEntrada, setCantidadEntrada] = useState('')
    const [pesoEntrada, setPesoEntrada] = useState('')

    const [productoSalidaId, setProductoSalidaId] = useState('')
    const [pesoSalida, setPesoSalida] = useState('')
    const [pluSalida, setPluSalida] = useState('')

    // Cargar productos al montar
    useEffect(() => {
        async function cargarProductos() {
            const { data } = await obtenerProductosAction()
            if (data) {
                setProductos(data)
            }
        }
        cargarProductos()
    }, [])

    // Cargar lotes cuando cambia el producto de entrada
    useEffect(() => {
        async function cargarLotes() {
            if (productoEntradaId) {
                const { data } = await obtenerLotesDisponiblesAction(productoEntradaId)
                if (data) {
                    setLotesDisponibles(data)
                }
            } else {
                setLotesDisponibles([])
            }
        }
        cargarLotes()
    }, [productoEntradaId])

    // Manejar escaneo de código de barras para entradas
    const handleScanEntrada = useCallback(async (code: string) => {
        const parsed = parseBarcodeEAN13(code)
        console.log('[Producción] Código escaneado:', code, parsed)

        if (!parsed.plu) {
            toast.error('Código no válido')
            return
        }

        // Buscar producto por PLU
        const result = await buscarProductoPorCodigoBarrasAction(parsed.plu)

        if (!result.success || !result.data) {
            toast.error(result.error || 'Producto no encontrado')
            return
        }

        const producto = result.data.producto
        setProductoEntradaId(producto.id)

        // Si el código tiene peso embebido, pre-llenar
        if (parsed.isWeightCode && parsed.weight) {
            setPesoEntrada(parsed.weight.toFixed(3))
            setCantidadEntrada('1')
            toast.success(`${producto.nombre} - ${parsed.weight.toFixed(3)} kg`)
        } else {
            toast.success(`Producto: ${producto.nombre}`)
        }
    }, [])

    // Manejar escaneo de código de barras para salidas
    const handleScanSalida = useCallback(async (code: string) => {
        const parsed = parseBarcodeEAN13(code)
        console.log('[Producción] Código escaneado (salida):', code, parsed)

        if (!parsed.plu) {
            toast.error('Código no válido')
            return
        }

        // Buscar producto por PLU
        const result = await buscarProductoPorCodigoBarrasAction(parsed.plu)

        if (!result.success || !result.data) {
            toast.error(result.error || 'Producto no encontrado')
            return
        }

        const producto = result.data.producto
        setProductoSalidaId(producto.id)
        setPluSalida(parsed.plu)

        // Si el código tiene peso embebido, pre-llenar
        if (parsed.isWeightCode && parsed.weight) {
            setPesoSalida(parsed.weight.toFixed(3))
            toast.success(`${producto.nombre} - ${parsed.weight.toFixed(3)} kg`)
        } else {
            toast.success(`Producto: ${producto.nombre}`)
        }
    }, [])

    // Calcular totales
    const pesoTotalEntrada = entradas.reduce((sum, e) => sum + (e.peso_kg || 0), 0)
    const pesoTotalSalida = salidas.reduce((sum, s) => sum + (s.peso_kg || 0), 0)
    const mermaKg = pesoTotalEntrada - pesoTotalSalida
    const mermaPorcentaje = pesoTotalEntrada > 0 ? (mermaKg / pesoTotalEntrada) * 100 : 0

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

    // Agregar entrada
    const handleAgregarEntrada = async () => {
        if (!ordenId || !productoEntradaId || !loteEntradaId || !cantidadEntrada) {
            toast.error('Completa todos los campos')
            return
        }

        setLoading(true)
        try {
            const producto = productos.find(p => p.id === productoEntradaId)
            const lote = lotesDisponibles.find(l => l.id === loteEntradaId)

            const result = await agregarEntradaProduccionAction(
                ordenId,
                productoEntradaId,
                loteEntradaId,
                parseFloat(cantidadEntrada),
                pesoEntrada ? parseFloat(pesoEntrada) : undefined
            )

            if (result.success) {
                setEntradas([...entradas, {
                    id: result.data?.entrada_id,
                    producto_id: productoEntradaId,
                    producto_nombre: producto?.nombre || '',
                    lote_id: loteEntradaId,
                    lote_numero: lote?.numero_lote || '',
                    cantidad: parseFloat(cantidadEntrada),
                    peso_kg: parseFloat(pesoEntrada) || 0
                }])

                // Limpiar campos
                setProductoEntradaId('')
                setLoteEntradaId('')
                setCantidadEntrada('')
                setPesoEntrada('')
                setLotesDisponibles([])

                toast.success('Entrada agregada')
            } else {
                toast.error(result.message || 'Error al agregar entrada')
            }
        } catch (error) {
            toast.error('Error al agregar entrada')
        } finally {
            setLoading(false)
        }
    }

    // Agregar salida
    const handleAgregarSalida = async () => {
        if (!ordenId || !productoSalidaId || !pesoSalida) {
            toast.error('Completa todos los campos')
            return
        }

        setLoading(true)
        try {
            const producto = productos.find(p => p.id === productoSalidaId)

            const result = await agregarSalidaProduccionAction(
                ordenId,
                productoSalidaId,
                parseFloat(pesoSalida),
                1,
                pluSalida || undefined
            )

            if (result.success) {
                setSalidas([...salidas, {
                    id: result.data?.salida_id,
                    producto_id: productoSalidaId,
                    producto_nombre: producto?.nombre || '',
                    peso_kg: parseFloat(pesoSalida),
                    plu: pluSalida
                }])

                // Limpiar campos
                setProductoSalidaId('')
                setPesoSalida('')
                setPluSalida('')

                toast.success('Salida agregada')
            } else {
                toast.error(result.message || 'Error al agregar salida')
            }
        } catch (error) {
            toast.error('Error al agregar salida')
        } finally {
            setLoading(false)
        }
    }

    // Completar orden
    const handleCompletarOrden = async () => {
        if (!ordenId) return

        if (salidas.length === 0) {
            toast.error('Agrega al menos una salida')
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
                <span>Entradas</span>
                <span>Salidas</span>
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

            {/* PASO 2: Agregar entradas (producto a consumir) */}
            {step === 2 && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Package className="h-5 w-5 text-orange-500" />
                            <CardTitle>Productos a Consumir (Entradas)</CardTitle>
                        </div>
                        <CardDescription>
                            Selecciona los lotes de producto origen que se van a despostar
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Lista de entradas agregadas */}
                        {entradas.length > 0 && (
                            <div className="space-y-2">
                                <Label>Entradas agregadas:</Label>
                                {entradas.map((entrada, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg"
                                    >
                                        <div>
                                            <span className="font-medium">{entrada.producto_nombre}</span>
                                            <span className="text-muted-foreground ml-2">
                                                Lote: {entrada.lote_numero}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span>{entrada.cantidad} unidades</span>
                                            {entrada.peso_kg > 0 && (
                                                <span className="font-semibold">{entrada.peso_kg} kg</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                <div className="text-right font-semibold text-lg">
                                    Total entrada: {pesoTotalEntrada.toFixed(2)} kg
                                </div>
                            </div>
                        )}

                        {/* Formulario para agregar entrada */}
                        <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30">
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
                                <Select value={productoEntradaId} onValueChange={setProductoEntradaId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar producto..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {productos.map((p) => (
                                            <SelectItem key={p.id} value={p.id}>
                                                {p.codigo} - {p.nombre}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Lote</Label>
                                <Select
                                    value={loteEntradaId}
                                    onValueChange={setLoteEntradaId}
                                    disabled={!productoEntradaId || lotesDisponibles.length === 0}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={
                                            !productoEntradaId
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
                                    value={cantidadEntrada}
                                    onChange={(e) => setCantidadEntrada(e.target.value)}
                                />
                            </div>

                            <div>
                                <Label>Peso (kg)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="Ej: 200"
                                    value={pesoEntrada}
                                    onChange={(e) => setPesoEntrada(e.target.value)}
                                />
                            </div>

                            <div className="col-span-2 flex justify-end">
                                <Button onClick={handleAgregarEntrada} disabled={loading}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Agregar Entrada
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
                            disabled={entradas.length === 0}
                        >
                            Siguiente: Salidas
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </CardFooter>
                </Card>
            )}

            {/* PASO 3: Agregar salidas (productos generados) */}
            {step === 3 && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Scale className="h-5 w-5 text-green-500" />
                            <CardTitle>Productos Generados (Salidas)</CardTitle>
                        </div>
                        <CardDescription>
                            Registra cada producto que sale del desposte con su peso
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Resumen de entrada */}
                        <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Total entrada:</span>
                                <span className="font-semibold text-lg">{pesoTotalEntrada.toFixed(2)} kg</span>
                            </div>
                        </div>

                        {/* Lista de salidas agregadas */}
                        {salidas.length > 0 && (
                            <div className="space-y-2">
                                <Label>Salidas agregadas:</Label>
                                {salidas.map((salida, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                                    >
                                        <div>
                                            <span className="font-medium">{salida.producto_nombre}</span>
                                            {salida.plu && (
                                                <Badge variant="outline" className="ml-2">
                                                    PLU: {salida.plu}
                                                </Badge>
                                            )}
                                        </div>
                                        <span className="font-semibold">{salida.peso_kg} kg</span>
                                    </div>
                                ))}
                                <div className="flex justify-between text-lg">
                                    <span className="font-semibold">Total salida:</span>
                                    <span className="font-semibold text-green-600">{pesoTotalSalida.toFixed(2)} kg</span>
                                </div>
                            </div>
                        )}

                        {/* Indicador de merma */}
                        <div className={`p-3 rounded-lg ${mermaPorcentaje > 50 ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    {mermaPorcentaje > 50 && <AlertCircle className="h-4 w-4 text-red-500" />}
                                    Merma estimada:
                                </span>
                                <span className={`font-semibold ${mermaPorcentaje > 50 ? 'text-red-600' : 'text-orange-600'}`}>
                                    {mermaKg.toFixed(2)} kg ({mermaPorcentaje.toFixed(1)}%)
                                </span>
                            </div>
                        </div>

                        {/* Formulario para agregar salida */}
                        <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/30">
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
                                <Select value={productoSalidaId} onValueChange={setProductoSalidaId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar producto..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {productos.map((p) => (
                                            <SelectItem key={p.id} value={p.id}>
                                                {p.codigo} - {p.nombre}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Peso (kg)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="Ej: 10.5"
                                    value={pesoSalida}
                                    onChange={(e) => setPesoSalida(e.target.value)}
                                />
                            </div>

                            <div>
                                <Label>PLU (opcional)</Label>
                                <Input
                                    placeholder="Ej: 0148"
                                    value={pluSalida}
                                    onChange={(e) => setPluSalida(e.target.value)}
                                />
                            </div>

                            <div className="col-span-3 flex justify-end">
                                <Button onClick={handleAgregarSalida} disabled={loading}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Agregar Salida
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-between">
                        <Button variant="outline" onClick={() => setStep(2)}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Volver a Entradas
                        </Button>
                        <Button
                            onClick={() => setStep(4)}
                            disabled={salidas.length === 0}
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
                        {/* Resumen de entradas */}
                        <div>
                            <h3 className="font-semibold mb-2 flex items-center gap-2">
                                <Package className="h-4 w-4 text-orange-500" />
                                Productos Consumidos
                            </h3>
                            <div className="space-y-1">
                                {entradas.map((entrada, idx) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                        <span>{entrada.producto_nombre} (Lote: {entrada.lote_numero})</span>
                                        <span>{entrada.cantidad} und. / {entrada.peso_kg} kg</span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-2 pt-2 border-t flex justify-between font-semibold">
                                <span>Total consumido:</span>
                                <span className="text-orange-600">{pesoTotalEntrada.toFixed(2)} kg</span>
                            </div>
                        </div>

                        {/* Resumen de salidas */}
                        <div>
                            <h3 className="font-semibold mb-2 flex items-center gap-2">
                                <Scale className="h-4 w-4 text-green-500" />
                                Productos Generados
                            </h3>
                            <div className="space-y-1">
                                {salidas.map((salida, idx) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                        <span>{salida.producto_nombre}</span>
                                        <span>{salida.peso_kg} kg</span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-2 pt-2 border-t flex justify-between font-semibold">
                                <span>Total generado:</span>
                                <span className="text-green-600">{pesoTotalSalida.toFixed(2)} kg</span>
                            </div>
                        </div>

                        {/* Merma final */}
                        <div className={`p-4 rounded-lg ${mermaPorcentaje > 50 ? 'bg-red-100' : 'bg-yellow-100'}`}>
                            <div className="flex justify-between text-lg">
                                <span className="font-semibold">Merma Total:</span>
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
                            Volver a Salidas
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
