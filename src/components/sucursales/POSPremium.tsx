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
                toast.success('Venta realizada con éxito')
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

                </div>

                {/* Resultados de búsqueda o Placeholder */}
                {!busqueda && (
                    <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200 text-slate-400">
                        <Package className="w-16 h-16 mb-4 opacity-20" />
                        <p className="text-lg font-bold uppercase tracking-widest text-slate-300">Esperando búsqueda</p>
                        <p className="text-sm">Escribe el nombre o escanea el producto para comenzar</p>
                    </div>
                )}

                {busqueda && productosFiltrados.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-3xl border border-slate-100">
                        <Search className="w-16 h-16 mb-4 opacity-20" />
                        <p className="text-lg font-medium">No se encontraron productos</p>
                        <p className="text-sm">Intenta con otro nombre o código</p>
                    </div>
                )}

                {busqueda && productosFiltrados.length > 0 && (
                    <div className="flex-1 space-y-2 overflow-y-auto pr-2">
                        {productosFiltrados.map(p => (
                            <button
                                key={p.id}
                                onClick={() => agregarAlCarrito(p)}
                                className="w-full flex items-center justify-between p-5 bg-white border border-slate-100 rounded-2xl hover:border-emerald-400 hover:shadow-md transition-all active:scale-[0.99] group/item"
                            >
                                <div className="flex items-center gap-4 text-left">
                                    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 font-bold group-hover/item:bg-emerald-100 group-hover/item:text-emerald-600 transition-colors">
                                        {p.nombre[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-900 text-lg leading-tight">{p.nombre}</p>
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mt-1">{p.codigo}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-right">
                                        <p className="text-2xl font-black text-slate-900 tracking-tighter">${p.precioVenta.toFixed(2)}</p>
                                        <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">{p.stockDisponible} {p.unidadMedida} DISP.</p>
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-all">
                                        <Plus className="w-6 h-6" />
                                    </div>
                                </div>
                            </button>
                        ))}
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
                            <div className="flex items-center justify-between px-3 py-3 bg-slate-900 rounded-2xl shadow-inner">
                                <div className="flex items-center gap-2">
                                    <User className="w-4 h-4 text-slate-500" />
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cliente</span>
                                </div>
                                <span className="text-xs font-black text-white uppercase">Consumidor Final</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
