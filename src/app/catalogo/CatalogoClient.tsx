'use client'

import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    ShoppingCart,
    Search,
    Plus,
    Minus,
    X,
    Scale,
    Package,
    Send,
    Trash2,
    Phone,
    XCircle,
    CheckCircle2,
    Sparkles
} from 'lucide-react'
import { toast } from 'sonner'
import { AnimatePresence, motion } from 'framer-motion'

interface Producto {
    id: string
    codigo: string
    nombre: string
    descripcion?: string
    precio_minorista: number
    precio_mayorista?: number
    unidad: string
    es_pesable: boolean
    venta_mayor_habilitada: boolean
    kg_por_unidad_mayor?: number
    imagen_url?: string
    categoria?: {
        id: string
        nombre: string
    }
}

interface Categoria {
    id: string
    nombre: string
}

interface ItemCarrito {
    producto: Producto
    cantidad: number
    pesoAprox?: number
}

interface CatalogoClientProps {
    productos: Producto[]
    categorias: Categoria[]
}

const CARRITO_KEY = 'avicola_carrito'

export default function CatalogoClient({ productos, categorias }: CatalogoClientProps) {
    const [busqueda, setBusqueda] = useState('')
    const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>('todas')
    const [carrito, setCarrito] = useState<ItemCarrito[]>([])
    const [carritoAbierto, setCarritoAbierto] = useState(false)
    const [telefonoCliente, setTelefonoCliente] = useState('')
    const [mostrarFormConfirmar, setMostrarFormConfirmar] = useState(false)
    const [enviando, setEnviando] = useState(false)
    const [productoExpandido, setProductoExpandido] = useState<string | null>(null)

    // Cargar carrito de localStorage
    useEffect(() => {
        const carritoGuardado = localStorage.getItem(CARRITO_KEY)
        if (carritoGuardado) {
            try {
                setCarrito(JSON.parse(carritoGuardado))
            } catch (e) {
                console.error('Error cargando carrito:', e)
            }
        }
    }, [])

    // Guardar carrito en localStorage
    useEffect(() => {
        localStorage.setItem(CARRITO_KEY, JSON.stringify(carrito))
    }, [carrito])

    // Filtrar productos
    const productosFiltrados = useMemo(() => {
        return productos.filter(p => {
            const matchBusqueda = p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
                p.codigo.toLowerCase().includes(busqueda.toLowerCase())
            const matchCategoria = categoriaSeleccionada === 'todas' ||
                p.categoria?.id === categoriaSeleccionada
            return matchBusqueda && matchCategoria
        })
    }, [productos, busqueda, categoriaSeleccionada])

    // Total del carrito
    const totalCarrito = useMemo(() => {
        return carrito.reduce((sum, item) => {
            const precio = item.producto.precio_minorista || 0
            if (item.producto.es_pesable && item.pesoAprox) {
                return sum + (precio * item.pesoAprox)
            }
            return sum + (precio * item.cantidad)
        }, 0)
    }, [carrito])

    const cantidadItems = carrito.reduce((sum, item) => sum + item.cantidad, 0)

    // Agregar al carrito con animación
    const agregarAlCarrito = (producto: Producto, cantidad: number = 1, pesoAprox?: number) => {
        setCarrito(prev => {
            const existente = prev.find(item => item.producto.id === producto.id)
            if (existente) {
                return prev.map(item =>
                    item.producto.id === producto.id
                        ? { ...item, cantidad: item.cantidad + cantidad, pesoAprox: pesoAprox ? (item.pesoAprox || 0) + pesoAprox : item.pesoAprox }
                        : item
                )
            }
            return [...prev, { producto, cantidad, pesoAprox }]
        })
        toast.success(`${producto.nombre} agregado`, {
            icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
        })
    }

    const quitarDelCarrito = (productoId: string) => {
        setCarrito(prev => prev.filter(item => item.producto.id !== productoId))
    }

    const actualizarCantidad = (productoId: string, cantidad: number) => {
        if (cantidad <= 0) {
            quitarDelCarrito(productoId)
            return
        }
        setCarrito(prev => prev.map(item =>
            item.producto.id === productoId ? { ...item, cantidad } : item
        ))
    }

    const vaciarCarrito = () => {
        setCarrito([])
        toast.success('Carrito vaciado')
    }

    // Confirmar pedido por WhatsApp
    const confirmarPedido = async () => {
        if (carrito.length === 0) {
            toast.error('El carrito está vacío')
            return
        }
        if (!telefonoCliente || telefonoCliente.length < 10) {
            toast.error('Ingresa tu número de teléfono')
            return
        }

        setEnviando(true)

        try {
            const response = await fetch('/api/catalogo/carrito', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    telefono: telefonoCliente,
                    items: carrito.map(item => ({
                        producto_id: item.producto.id,
                        producto_nombre: item.producto.nombre,
                        cantidad: item.cantidad,
                        peso_aprox: item.pesoAprox,
                        precio_unitario: item.producto.precio_minorista,
                    })),
                    total_estimado: totalCarrito,
                }),
            })

            const result = await response.json()

            if (!result.success) {
                toast.error('Error al guardar el carrito')
                setEnviando(false)
                return
            }

            const codigoCarrito = result.codigo

            let mensaje = `🛒 *Nuevo Pedido - Avícola del Sur*\n\n`
            mensaje += `📱 Cliente: ${telefonoCliente}\n`
            mensaje += `🛒 Código: *${codigoCarrito}*\n\n`
            mensaje += `*Productos:*\n`
            carrito.forEach(item => {
                const precio = item.producto.precio_minorista
                if (item.producto.es_pesable && item.pesoAprox) {
                    mensaje += `• ${item.producto.nombre} - ${item.pesoAprox} kg aprox - $${(precio * item.pesoAprox).toFixed(2)}\n`
                } else {
                    mensaje += `• ${item.producto.nombre} x${item.cantidad} - $${(precio * item.cantidad).toFixed(2)}\n`
                }
            })
            mensaje += `\n💰 *Total: $${totalCarrito.toFixed(2)}*`

            const whatsappUrl = `https://wa.me/5493815123456?text=${encodeURIComponent(mensaje)}`
            window.open(whatsappUrl, '_blank')

            setCarrito([])
            setMostrarFormConfirmar(false)
            setCarritoAbierto(false)
            toast.success(`¡Pedido enviado! Código: ${codigoCarrito}`, {
                icon: <Sparkles className="h-5 w-5 text-amber-500" />,
            })

        } catch (error) {
            console.error('Error al enviar pedido:', error)
            toast.error('Error al enviar el pedido. Intenta nuevamente.')
        } finally {
            setEnviando(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-white">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-amber-100 shadow-sm">
                <div className="container mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                                <Package className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-gray-900">Avícola del Sur</h1>
                                <p className="text-[10px] text-gray-500 -mt-0.5">Productos frescos de calidad</p>
                            </div>
                        </div>

                        <Button
                            variant="ghost"
                            size="sm"
                            className="relative hover:bg-amber-50"
                            onClick={() => setCarritoAbierto(!carritoAbierto)}
                        >
                            <ShoppingCart className="h-5 w-5" />
                            {cantidadItems > 0 && (
                                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-amber-500 border-amber-500">
                                    {cantidadItems > 9 ? '9+' : cantidadItems}
                                </Badge>
                            )}
                        </Button>
                    </div>
                </div>
            </header>

            <div className="container mx-auto px-4 py-4 pb-20 flex flex-col lg:flex-row gap-4">
                {/* Catálogo */}
                <main className="flex-1 min-w-0">
                    {/* Búsqueda y filtros */}
                    <div className="mb-4 space-y-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Buscar productos..."
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                className="pl-10 bg-white border-amber-200 focus:border-amber-500 focus:ring-amber-500"
                            />
                            {busqueda && (
                                <button
                                    onClick={() => setBusqueda('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    <XCircle className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        <Tabs value={categoriaSeleccionada} onValueChange={setCategoriaSeleccionada}>
                            <TabsList className="flex flex-wrap h-auto gap-1.5 bg-transparent p-0">
                                <TabsTrigger
                                    value="todas"
                                    className="data-[state=active]:bg-amber-500 data-[state=active]:text-white bg-white border border-amber-200 rounded-full px-4"
                                >
                                    Todos
                                </TabsTrigger>
                                {categorias.map(cat => (
                                    <TabsTrigger
                                        key={cat.id}
                                        value={cat.id}
                                        className="data-[state=active]:bg-amber-500 data-[state=active]:text-white bg-white border border-amber-200 rounded-full px-4 text-sm"
                                    >
                                        {cat.nombre}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
                    </div>

                    {/* Contador de resultados */}
                    {productosFiltrados.length > 0 && (
                        <p className="text-sm text-gray-500 mb-3">
                            {productosFiltrados.length} producto{productosFiltrados.length !== 1 ? 's' : ''}
                        </p>
                    )}

                    {/* Productos */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        <AnimatePresence mode="popLayout">
                            {productosFiltrados.map(producto => (
                                <ProductoCard
                                    key={producto.id}
                                    producto={producto}
                                    onAgregar={agregarAlCarrito}
                                    enCarrito={carrito.some(i => i.producto.id === producto.id)}
                                    expandido={productoExpandido === producto.id}
                                    onToggleExpand={() => setProductoExpandido(
                                        productoExpandido === producto.id ? null : producto.id
                                    )}
                                />
                            ))}
                        </AnimatePresence>
                    </div>

                    {productosFiltrados.length === 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center py-12"
                        >
                            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Search className="h-8 w-8 text-gray-400" />
                            </div>
                            <p className="text-gray-500">No se encontraron productos</p>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setBusqueda(''); setCategoriaSeleccionada('todas'); }}
                                className="mt-2 text-amber-600 hover:text-amber-700"
                            >
                                Limpiar filtros
                            </Button>
                        </motion.div>
                    )}
                </main>

                {/* Carrito Sidebar - Mobile Bottom Sheet */}
                <AnimatePresence>
                    {carritoAbierto && (
                        <>
                            {/* Overlay */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setCarritoAbierto(false)}
                                className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                            />

                            {/* Sidebar */}
                            <motion.aside
                                initial={{ x: '100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                className="fixed right-0 top-0 h-full w-full max-w-sm bg-white z-50 lg:hidden shadow-2xl flex flex-col"
                            >
                                <CarritoContent
                                    carrito={carrito}
                                    totalCarrito={totalCarrito}
                                    cantidadItems={cantidadItems}
                                    telefonoCliente={telefonoCliente}
                                    setTelefonoCliente={setTelefonoCliente}
                                    mostrarFormConfirmar={mostrarFormConfirmar}
                                    setMostrarFormConfirmar={setMostrarFormConfirmar}
                                    onCerrar={() => setCarritoAbierto(false)}
                                    onVaciar={vaciarCarrito}
                                    onQuitar={quitarDelCarrito}
                                    onActualizar={actualizarCantidad}
                                    onConfirmar={confirmarPedido}
                                    enviando={enviando}
                                />
                            </motion.aside>
                        </>
                    )}
                </AnimatePresence>

                {/* Carrito Sidebar - Desktop */}
                <aside className="hidden lg:block lg:w-80 xl:w-96">
                    <div className="sticky top-24">
                        <CarritoContent
                            carrito={carrito}
                            totalCarrito={totalCarrito}
                            cantidadItems={cantidadItems}
                            telefonoCliente={telefonoCliente}
                            setTelefonoCliente={setTelefonoCliente}
                            mostrarFormConfirmar={mostrarFormConfirmar}
                            setMostrarFormConfirmar={setMostrarFormConfirmar}
                            onCerrar={() => {}}
                            onVaciar={vaciarCarrito}
                            onQuitar={quitarDelCarrito}
                            onActualizar={actualizarCantidad}
                            onConfirmar={confirmarPedido}
                            enviando={enviando}
                        />
                    </div>
                </aside>
            </div>

            {/* Botón flotante del carrito (mobile) */}
            <AnimatePresence>
                {cantidadItems > 0 && !carritoAbierto && (
                    <motion.div
                        initial={{ scale: 0, y: 100 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0, y: 100 }}
                        className="lg:hidden fixed bottom-4 right-4 z-30"
                    >
                        <Button
                            size="lg"
                            className="rounded-full h-14 w-14 bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-lg shadow-amber-500/30"
                            onClick={() => setCarritoAbierto(true)}
                        >
                            <ShoppingCart className="h-6 w-6" />
                            <Badge className="absolute -top-1 -right-1 h-6 w-6 flex items-center justify-center p-0 bg-white text-amber-600 border-0">
                                {cantidadItems > 9 ? '9+' : cantidadItems}
                            </Badge>
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// Componente de contenido del carrito
interface CarritoContentProps {
    carrito: ItemCarrito[]
    totalCarrito: number
    cantidadItems: number
    telefonoCliente: string
    setTelefonoCliente: (tel: string) => void
    mostrarFormConfirmar: boolean
    setMostrarFormConfirmar: (show: boolean) => void
    onCerrar: () => void
    onVaciar: () => void
    onQuitar: (id: string) => void
    onActualizar: (id: string, cant: number) => void
    onConfirmar: () => Promise<void>
    enviando: boolean
}

function CarritoContent({
    carrito,
    totalCarrito,
    cantidadItems,
    telefonoCliente,
    setTelefonoCliente,
    mostrarFormConfirmar,
    setMostrarFormConfirmar,
    onCerrar,
    onVaciar,
    onQuitar,
    onActualizar,
    onConfirmar,
    enviando
}: CarritoContentProps) {
    return (
        <Card className="border-amber-200 shadow-lg">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-4 rounded-t-lg">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5" />
                        <span className="font-semibold">Tu Carrito</span>
                        {cantidadItems > 0 && (
                            <Badge className="bg-white/20 border-white/30 text-white">
                                {cantidadItems}
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        {carrito.length > 0 && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-white hover:bg-white/20"
                                onClick={onVaciar}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-white hover:bg-white/20 lg:hidden"
                            onClick={onCerrar}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Items */}
            <CardContent className="p-3">
                {carrito.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                        <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">El carrito está vacío</p>
                        <p className="text-xs mt-1">Agregá productos para comenzar</p>
                    </div>
                ) : (
                    <div className="space-y-2 max-h-[350px] overflow-y-auto -mx-1 px-1">
                        <AnimatePresence initial={false}>
                            {carrito.map(item => (
                                <motion.div
                                    key={item.producto.id}
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg border border-amber-100"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate">
                                            {item.producto.nombre}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            ${item.producto.precio_minorista} / {item.producto.unidad}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-7 w-7 bg-white"
                                            onClick={() => onActualizar(item.producto.id, item.cantidad - 1)}
                                        >
                                            <Minus className="h-3 w-3" />
                                        </Button>
                                        <span className="w-7 text-center text-sm font-semibold">
                                            {item.cantidad}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-7 w-7 bg-white"
                                            onClick={() => onActualizar(item.producto.id, item.cantidad + 1)}
                                        >
                                            <Plus className="h-3 w-3" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => onQuitar(item.producto.id)}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </CardContent>

            {/* Footer con total y acciones */}
            {carrito.length > 0 && (
                <div className="border-t border-amber-200 bg-amber-50/50 p-4 rounded-b-lg space-y-3">
                    <div className="flex justify-between items-center py-2">
                        <span className="font-medium text-gray-700">Total:</span>
                        <span className="text-xl font-bold text-amber-600">
                            ${totalCarrito.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>

                    {!mostrarFormConfirmar ? (
                        <Button
                            className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-md"
                            onClick={() => setMostrarFormConfirmar(true)}
                        >
                            <Send className="h-4 w-4 mr-2" />
                            Confirmar Pedido
                        </Button>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-2">
                                <div className="p-2 bg-green-100 rounded-lg">
                                    <Phone className="h-4 w-4 text-green-600" />
                                </div>
                                <Input
                                    placeholder="Tu WhatsApp"
                                    type="tel"
                                    value={telefonoCliente}
                                    onChange={(e) => setTelefonoCliente(e.target.value.replace(/\D/g, ''))}
                                    className="flex-1 border-0 focus-visible:ring-0"
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => setMostrarFormConfirmar(false)}
                                    disabled={enviando}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                                    onClick={onConfirmar}
                                    disabled={enviando || !telefonoCliente || telefonoCliente.length < 10}
                                >
                                    {enviando ? (
                                        <>
                                            <motion.div
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                                className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full mr-2"
                                            />
                                            Enviando...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="h-4 w-4 mr-1" />
                                            Enviar
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Card>
    )
}

// Componente de Card de Producto
interface ProductoCardProps {
    producto: Producto
    onAgregar: (producto: Producto, cantidad: number, pesoAprox?: number) => void
    enCarrito: boolean
    expandido: boolean
    onToggleExpand: () => void
}

function ProductoCard({ producto, onAgregar, enCarrito, expandido, onToggleExpand }: ProductoCardProps) {
    const [cantidad, setCantidad] = useState(1)
    const [pesoAprox, setPesoAprox] = useState<number | undefined>(undefined)

    const handleAgregar = () => {
        onAgregar(producto, cantidad, producto.es_pesable ? pesoAprox : undefined)
        setCantidad(1)
        setPesoAprox(undefined)
        setCantidad(1)
    }

    const subtotal = producto.es_pesable && pesoAprox
        ? producto.precio_minorista * pesoAprox
        : producto.precio_minorista * cantidad

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
        >
            <Card className={`overflow-hidden transition-all duration-300 hover:shadow-lg ${
                enCarrito ? 'ring-2 ring-amber-500 shadow-md' : 'hover:border-amber-300'
            }`}>
                {/* Header del producto */}
                <div className="relative bg-gradient-to-br from-amber-50 to-orange-50 p-4">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-gray-900">{producto.nombre}</h3>
                                {producto.es_pesable && (
                                    <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">
                                        <Scale className="h-3 w-3 mr-0.5" />
                                        Pesable
                                    </Badge>
                                )}
                            </div>
                            <p className="text-xs text-gray-500">{producto.categoria?.nombre}</p>
                        </div>
                        {producto.imagen_url ? (
                            <img
                                src={producto.imagen_url}
                                alt={producto.nombre}
                                className="w-16 h-16 object-cover rounded-lg"
                            />
                        ) : (
                            <div className="w-16 h-16 bg-gradient-to-br from-amber-200 to-orange-200 rounded-lg flex items-center justify-center">
                                <Package className="h-8 w-8 text-amber-400" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Precio y selector de cantidad */}
                <CardContent className="p-3 space-y-3">
                    <div className="flex items-baseline justify-between">
                        <div>
                            <span className="text-2xl font-bold text-amber-600">
                                ${producto.precio_minorista.toLocaleString('es-AR')}
                            </span>
                            <span className="text-sm text-gray-500 ml-1">/{producto.unidad}</span>
                        </div>
                        {expandido && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-sm text-gray-600"
                            >
                                Subtotal: <span className="font-semibold text-amber-600">${subtotal.toFixed(2)}</span>
                            </motion.div>
                        )}
                    </div>

                    {expandido && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-2"
                        >
                            {producto.es_pesable ? (
                                <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg">
                                    <Scale className="h-4 w-4 text-amber-600" />
                                    <span className="text-sm text-gray-600">Peso:</span>
                                    <Input
                                        type="number"
                                        step="0.1"
                                        min="0.1"
                                        placeholder="kg"
                                        value={pesoAprox || ''}
                                        onChange={(e) => setPesoAprox(parseFloat(e.target.value) || undefined)}
                                        className="w-20 h-8 text-sm"
                                    />
                                    <span className="text-sm text-gray-500">kg</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg">
                                    <span className="text-sm text-gray-600">Cantidad:</span>
                                    <div className="flex items-center gap-1 ml-auto">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-7 w-7 bg-white"
                                            onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                                        >
                                            <Minus className="h-3 w-3" />
                                        </Button>
                                        <span className="w-8 text-center font-semibold">{cantidad}</span>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-7 w-7 bg-white"
                                            onClick={() => setCantidad(cantidad + 1)}
                                        >
                                            <Plus className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </CardContent>

                {/* Botón de acción */}
                <CardFooter className="p-3 pt-0">
                    {!expandido ? (
                        <Button
                            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                            onClick={onToggleExpand}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Agregar al carrito
                        </Button>
                    ) : (
                        <div className="flex gap-2 w-full">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={onToggleExpand}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                            <Button
                                className="flex-[3] bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
                                onClick={handleAgregar}
                                disabled={producto.es_pesable && (!pesoAprox || pesoAprox <= 0)}
                            >
                                <ShoppingCart className="h-4 w-4 mr-2" />
                                Confirmar
                            </Button>
                        </div>
                    )}
                </CardFooter>
            </Card>
        </motion.div>
    )
}
