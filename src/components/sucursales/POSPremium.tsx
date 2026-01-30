'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import {
    ShoppingCart,
    Plus,
    Minus,
    Trash2,
    Search,
    User,
    DollarSign,
    CheckCircle,
    Loader2,
    Trash,
    CreditCard,
    Banknote,
    Sparkles,
    Zap,
    Package,
    ArrowRight
} from 'lucide-react'
import {
    registrarVentaSucursalConControlAction,
} from '@/actions/ventas-sucursal.actions'
import { cn } from '@/lib/utils'
import { ProductosFrecuentes } from './ProductosFrecuentes'

// ===========================================
// TIPOS
// ===========================================

interface Producto {
    id: string
    nombre: string
    codigo: string
    precioVenta: number
    unidadMedida: string
    stockDisponible: number
}

interface ItemCarrito {
    productoId: string
    producto: Producto
    cantidad: number
    precioUnitario: number
    subtotal: number
}

interface POSPremiumProps {
    productos: Producto[]
    clientes: any[]
    sucursalId: string
    onVentaCompletada?: () => void
}

export function POSPremium({
    productos,
    clientes,
    sucursalId,
    onVentaCompletada,
}: POSPremiumProps) {
    const [busqueda, setBusqueda] = useState('')
    const [carrito, setCarrito] = useState<ItemCarrito[]>([])
    const [procesando, setProcesando] = useState(false)
    const [clienteId, setClienteId] = useState<string>('consumidor_final')

    // Filtrado de productos inteligente
    const productosFiltrados = useMemo(() => {
        if (!busqueda) return []
        const term = busqueda.toLowerCase()
        return productos
            .filter(p => p.nombre.toLowerCase().includes(term) || p.codigo.toLowerCase().includes(term))
            .slice(0, 5)
    }, [busqueda, productos])

    const total = carrito.reduce((sum, item) => sum + item.subtotal, 0)
    const itemsCount = carrito.reduce((sum, item) => sum + item.cantidad, 0)

    const agregarAlCarrito = useCallback((p: Producto, cant = 1) => {
        if (p.stockDisponible <= 0) {
            toast.error('Sin stock disponible')
            return
        }

        setCarrito(prev => {
            const existente = prev.find(item => item.productoId === p.id)
            if (existente) {
                const nuevaCant = existente.cantidad + cant
                if (nuevaCant > p.stockDisponible) {
                    toast.error('Stock insuficiente')
                    return prev
                }
                return prev.map(item =>
                    item.productoId === p.id
                        ? { ...item, cantidad: nuevaCant, subtotal: nuevaCant * item.precioUnitario }
                        : item
                )
            }
            return [...prev, {
                productoId: p.id,
                producto: p,
                cantidad: cant,
                precioUnitario: p.precioVenta,
                subtotal: cant * p.precioVenta
            }]
        })

        // Clear search if it was an exact match from frequent or search
        setBusqueda('')
    }, [])

    const actualizarCantidad = (id: string, delta: number) => {
        setCarrito(prev => prev.map(item => {
            if (item.productoId !== id) return item
            const nuevaCant = Math.max(0, item.cantidad + delta)
            if (nuevaCant > item.producto.stockDisponible) {
                toast.error('Stock insuficiente')
                return item
            }
            return { ...item, cantidad: nuevaCant, subtotal: nuevaCant * item.precioUnitario }
        }).filter(item => item.cantidad > 0))
    }

    const handleCobrar = async (metodo: 'efectivo' | 'otros') => {
        if (carrito.length === 0) return
        setProcesando(true)
        try {
            const result = await registrarVentaSucursalConControlAction({
                sucursalId,
                clienteId: clienteId === 'consumidor_final' ? undefined : clienteId,
                items: carrito.map(i => ({
                    productoId: i.productoId,
                    cantidad: i.cantidad,
                    precioUnitario: i.precioUnitario
                })),
                pago: {
                    pagos: [{ metodoPago: metodo === 'efectivo' ? 'efectivo' : 'transferencia', monto: total }]
                }
            })

            if (result.success) {
                toast.success('¡Venta realizada con éxito!')
                setCarrito([])
                setBusqueda('')
                onVentaCompletada?.()
            } else {
                toast.error(result.error || 'Error al procesar la venta')
            }
        } catch (e) {
            toast.error('Error de conexión')
        } finally {
            setProcesando(false)
        }
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full min-h-[700px]">
            {/* Panel Izquierdo: Selección de Productos (8 cols) */}
            <div className="lg:col-span-8 flex flex-col gap-4">

                {/* Buscador Premium */}
                <div className="relative group">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                        <Search className="w-6 h-6 text-emerald-500 transition-transform group-focus-within:scale-110" />
                    </div>
                    <Input
                        placeholder="Buscar por nombre o escanear..."
                        className="pl-14 h-16 text-xl rounded-2xl border-2 border-emerald-100 focus:border-emerald-400 focus:ring-emerald-400/20 shadow-sm transition-all"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                    />

                    {/* Resultados flotantes */}
                    {productosFiltrados.length > 0 && (
                        <Card className="absolute top-full left-0 right-0 z-50 mt-2 shadow-2xl rounded-2xl overflow-hidden border-emerald-100">
                            <div className="p-2 space-y-1">
                                {productosFiltrados.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => agregarAlCarrito(p)}
                                        className="w-full flex items-center justify-between p-4 hover:bg-emerald-50 rounded-xl transition-colors group/item"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-bold">
                                                {p.nombre[0]}
                                            </div>
                                            <div className="text-left">
                                                <p className="font-bold text-slate-800">{p.nombre}</p>
                                                <p className="text-xs text-slate-500">{p.codigo}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className="font-black text-emerald-600 text-lg">${p.precioVenta.toFixed(2)}</p>
                                                <p className="text-[10px] text-slate-400 uppercase font-bold">{p.stockDisponible} {p.unidadMedida} disp.</p>
                                            </div>
                                            <Plus className="w-6 h-6 text-emerald-300 group-hover/item:text-emerald-500 transition-colors" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </Card>
                    )}
                </div>

                {/* Productos Frecuentes (Grid de Botones) */}
                {!busqueda && (
                    <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-2 px-2">
                            <Sparkles className="w-5 h-5 text-amber-500 fill-amber-500" />
                            <h3 className="font-bold text-slate-700 uppercase tracking-wider text-sm">Productos Frecuentes</h3>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                            {productos.filter(p => p.stockDisponible > 0).slice(0, 12).map(p => (
                                <Button
                                    key={p.id}
                                    variant="outline"
                                    className="h-auto p-4 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-slate-100 hover:border-emerald-400 hover:bg-emerald-50/50 hover:shadow-md transition-all active:scale-95 group relative overflow-hidden"
                                    onClick={() => agregarAlCarrito(p)}
                                >
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Plus className="w-4 h-4 text-emerald-600" />
                                    </div>
                                    <Package className="w-8 h-8 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                                    <div className="text-center">
                                        <p className="font-bold text-slate-700 text-sm leading-tight line-clamp-2">{p.nombre}</p>
                                        <p className="font-black text-emerald-600 mt-1">${p.precioVenta.toFixed(0)}</p>
                                    </div>
                                    <Badge variant="secondary" className="text-[9px] bg-slate-100 text-slate-500 border-none">
                                        {p.stockDisponible.toFixed(0)} {p.unidadMedida}
                                    </Badge>
                                </Button>
                            ))}
                        </div>
                    </div>
                )}

                {busqueda && productosFiltrados.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <Search className="w-16 h-16 mb-4 opacity-20" />
                        <p className="text-lg font-medium">No se encontraron productos</p>
                        <p className="text-sm">Intenta con otro nombre o código</p>
                    </div>
                )}
            </div>

            {/* Panel Derecho: Carrito y Cobro (4 cols) */}
            <div className="lg:col-span-4 flex flex-col h-full bg-slate-50/50 rounded-3xl border border-slate-100 p-1">
                <Card className="flex flex-col h-full shadow-none border-none bg-transparent">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-emerald-500 rounded-xl shadow-lg shadow-emerald-500/20">
                                    <ShoppingCart className="w-5 h-5 text-white" />
                                </div>
                                <CardTitle className="text-xl">Carrito</CardTitle>
                            </div>
                            {carrito.length > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-slate-400 hover:text-red-500"
                                    onClick={() => setCarrito([])}
                                >
                                    Vaciar
                                </Button>
                            )}
                        </div>
                    </CardHeader>

                    <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
                        <ScrollArea className="flex-1 -mx-2 pr-2">
                            <div className="space-y-3 p-2">
                                {carrito.map(item => (
                                    <div key={item.productoId} className="group bg-white rounded-2xl p-3 border border-slate-100 shadow-sm hover:border-emerald-200 transition-all">
                                        <div className="flex justify-between items-start mb-2">
                                            <p className="font-bold text-slate-800 text-sm leading-none">{item.producto.nombre}</p>
                                            <button onClick={() => setCarrito(c => c.filter(i => i.productoId !== item.productoId))} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all">
                                                <Trash className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-1">
                                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-md" onClick={() => actualizarCantidad(item.productoId, -1)} disabled={item.cantidad <= 1 && item.producto.unidadMedida !== 'kg'}>
                                                    <Minus className="w-4 h-4" />
                                                </Button>
                                                <span className="w-10 text-center font-black text-sm">{item.cantidad.toFixed(item.producto.unidadMedida === 'kg' ? 1 : 0)}</span>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-md" onClick={() => actualizarCantidad(item.productoId, 1)}>
                                                    <Plus className="w-4 h-4" />
                                                </Button>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-black text-slate-800 text-md">${item.subtotal.toFixed(2)}</p>
                                                <p className="text-[10px] text-slate-400 font-bold">${item.precioUnitario} x {item.producto.unidadMedida}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {carrito.length === 0 && (
                                    <div className="text-center py-20 opacity-30 select-none">
                                        <Zap className="w-12 h-12 mx-auto mb-4" />
                                        <p className="font-bold uppercase tracking-widest text-xs">Esperando productos</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>

                        <Separator className="bg-slate-200/50" />

                        {/* Totales y Pago */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-end px-2">
                                <p className="text-slate-400 font-bold uppercase text-[10px] pb-1">Total a pagar</p>
                                <p className="text-4xl font-black text-slate-900 leading-none tracking-tighter">
                                    ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    disabled={carrito.length === 0 || procesando}
                                    onClick={() => handleCobrar('efectivo')}
                                    className="h-24 rounded-3xl bg-emerald-500 hover:bg-emerald-600 shadow-xl shadow-emerald-500/30 flex flex-col gap-2 group transition-all"
                                >
                                    {procesando ? (
                                        <Loader2 className="w-8 h-8 animate-spin" />
                                    ) : (
                                        <>
                                            <Banknote className="w-8 h-8 group-hover:scale-110 transition-transform" />
                                            <div className="text-center">
                                                <p className="font-black text-lg leading-none">EFECTIVO</p>
                                                <p className="text-[10px] opacity-70 font-bold">PAGO RÁPIDO</p>
                                            </div>
                                        </>
                                    )}
                                </Button>

                                <Button
                                    disabled={carrito.length === 0 || procesando}
                                    onClick={() => handleCobrar('otros')}
                                    variant="outline"
                                    className="h-24 rounded-3xl border-2 border-slate-200 hover:border-slate-300 hover:bg-white flex flex-col gap-2 group transition-all"
                                >
                                    <CreditCard className="w-8 h-8 text-slate-400 group-hover:text-slate-600 transition-colors" />
                                    <div className="text-center">
                                        <p className="font-bold text-lg leading-none text-slate-700">OTROS</p>
                                        <p className="text-[10px] text-slate-400 font-bold">BANCO/TRANSF.</p>
                                    </div>
                                </Button>
                            </div>

                            {/* Selector de Cliente Minimalista */}
                            <div className="flex items-center justify-between px-2 pt-2 bg-slate-100/50 p-2 rounded-2xl">
                                <div className="flex items-center gap-2">
                                    <User className="w-4 h-4 text-slate-400" />
                                    <span className="text-xs font-bold text-slate-600">CLIENTE:</span>
                                </div>
                                <select
                                    className="bg-transparent text-xs font-black text-emerald-600 outline-none cursor-pointer uppercase"
                                    value={clienteId}
                                    onChange={(e) => setClienteId(e.target.value)}
                                >
                                    <option value="consumidor_final">Consumidor Final</option>
                                    {clientes.map(c => (
                                        <option key={c.id} value={c.id}>{c.nombre}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
