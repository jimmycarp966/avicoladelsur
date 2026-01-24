'use client'

import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
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
    ChevronDown,
    ChevronUp
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

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
    pesoAprox?: number // Para productos pesables
}

interface CatalogoClientProps {
    productos: Producto[]
    categorias: Categoria[]
}

// Key para localStorage
const CARRITO_KEY = 'avicola_carrito'

export default function CatalogoClient({ productos, categorias }: CatalogoClientProps) {
    const [busqueda, setBusqueda] = useState('')
    const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>('todas')
    const [carrito, setCarrito] = useState<ItemCarrito[]>([])
    const [carritoAbierto, setCarritoAbierto] = useState(false)
    const [telefonoCliente, setTelefonoCliente] = useState('')
    const [mostrarFormConfirmar, setMostrarFormConfirmar] = useState(false)

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

    // Agregar al carrito
    const agregarAlCarrito = (producto: Producto, cantidad: number = 1, pesoAprox?: number) => {
        setCarrito(prev => {
            const existente = prev.find(item => item.producto.id === producto.id)

            if (existente) {
                return prev.map(item =>
                    item.producto.id === producto.id
                        ? {
                            ...item,
                            cantidad: item.cantidad + cantidad,
                            pesoAprox: pesoAprox ? (item.pesoAprox || 0) + pesoAprox : item.pesoAprox
                        }
                        : item
                )
            }

            return [...prev, { producto, cantidad, pesoAprox }]
        })

        toast.success(`${producto.nombre} agregado al carrito`)
    }

    // Quitar del carrito
    const quitarDelCarrito = (productoId: string) => {
        setCarrito(prev => prev.filter(item => item.producto.id !== productoId))
    }

    // Actualizar cantidad
    const actualizarCantidad = (productoId: string, cantidad: number) => {
        if (cantidad <= 0) {
            quitarDelCarrito(productoId)
            return
        }

        setCarrito(prev => prev.map(item =>
            item.producto.id === productoId
                ? { ...item, cantidad }
                : item
        ))
    }

    // Vaciar carrito
    const vaciarCarrito = () => {
        if (confirm('¿Estás seguro de vaciar el carrito?')) {
            setCarrito([])
            toast.success('Carrito vaciado')
        }
    }

    // Confirmar pedido por WhatsApp
    const confirmarPedido = () => {
        if (carrito.length === 0) {
            toast.error('El carrito está vacío')
            return
        }

        if (!telefonoCliente || telefonoCliente.length < 10) {
            toast.error('Ingresa tu número de teléfono')
            return
        }

        // Generar mensaje
        let mensaje = `🛒 *Nuevo Pedido - Avícola del Sur*\n\n`
        mensaje += `📱 Cliente: ${telefonoCliente}\n\n`
        mensaje += `*Productos:*\n`

        carrito.forEach(item => {
            const precio = item.producto.precio_minorista
            if (item.producto.es_pesable && item.pesoAprox) {
                mensaje += `• ${item.producto.nombre} - ${item.pesoAprox} kg aprox - $${(precio * item.pesoAprox).toFixed(2)}\n`
            } else {
                mensaje += `• ${item.producto.nombre} x${item.cantidad} - $${(precio * item.cantidad).toFixed(2)}\n`
            }
        })

        mensaje += `\n💰 *Total Aproximado: $${totalCarrito.toFixed(2)}*`
        mensaje += `\n\n_Nota: El precio final puede variar según el peso exacto de los productos pesables._`

        // Abrir WhatsApp
        const whatsappUrl = `https://wa.me/5493815123456?text=${encodeURIComponent(mensaje)}`
        window.open(whatsappUrl, '_blank')

        // Limpiar carrito
        setCarrito([])
        setMostrarFormConfirmar(false)
        toast.success('Pedido enviado por WhatsApp')
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b shadow-sm">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
                                <Package className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">Avícola del Sur</h1>
                                <p className="text-xs text-gray-500">Productos frescos de calidad</p>
                            </div>
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            className="relative"
                            onClick={() => setCarritoAbierto(!carritoAbierto)}
                        >
                            <ShoppingCart className="h-5 w-5" />
                            {cantidadItems > 0 && (
                                <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
                                    {cantidadItems}
                                </Badge>
                            )}
                        </Button>
                    </div>
                </div>
            </header>

            <div className="container mx-auto px-4 py-6 flex flex-col lg:flex-row gap-6">
                {/* Catálogo */}
                <main className="flex-1">
                    {/* Búsqueda y filtros */}
                    <div className="mb-6 space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Buscar productos..."
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                className="pl-10 bg-white"
                            />
                        </div>

                        <Tabs value={categoriaSeleccionada} onValueChange={setCategoriaSeleccionada}>
                            <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent">
                                <TabsTrigger
                                    value="todas"
                                    className="data-[state=active]:bg-amber-500 data-[state=active]:text-white"
                                >
                                    Todos
                                </TabsTrigger>
                                {categorias.map(cat => (
                                    <TabsTrigger
                                        key={cat.id}
                                        value={cat.id}
                                        className="data-[state=active]:bg-amber-500 data-[state=active]:text-white"
                                    >
                                        {cat.nombre}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </Tabs>
                    </div>

                    {/* Productos */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {productosFiltrados.map(producto => (
                            <ProductoCard
                                key={producto.id}
                                producto={producto}
                                onAgregar={agregarAlCarrito}
                                enCarrito={carrito.some(i => i.producto.id === producto.id)}
                            />
                        ))}
                    </div>

                    {productosFiltrados.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            <Package className="h-16 w-16 mx-auto mb-4 opacity-30" />
                            <p>No se encontraron productos</p>
                        </div>
                    )}
                </main>

                {/* Carrito Sidebar en Desktop */}
                <aside className={`lg:w-96 ${carritoAbierto ? 'block' : 'hidden lg:block'}`}>
                    <div className="sticky top-24">
                        <Card>
                            <CardHeader className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-t-lg">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-2">
                                        <ShoppingCart className="h-5 w-5" />
                                        Tu Carrito
                                    </CardTitle>
                                    {carrito.length > 0 && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={vaciarCarrito}
                                            className="text-white hover:bg-white/20"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="p-4">
                                {carrito.length === 0 ? (
                                    <div className="text-center py-8 text-gray-400">
                                        <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-30" />
                                        <p>El carrito está vacío</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                                        {carrito.map(item => (
                                            <div
                                                key={item.producto.id}
                                                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm truncate">
                                                        {item.producto.nombre}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        ${item.producto.precio_minorista} / {item.producto.unidad}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-7 w-7"
                                                        onClick={() => actualizarCantidad(item.producto.id, item.cantidad - 1)}
                                                    >
                                                        <Minus className="h-3 w-3" />
                                                    </Button>
                                                    <span className="w-6 text-center text-sm font-medium">
                                                        {item.cantidad}
                                                    </span>
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-7 w-7"
                                                        onClick={() => actualizarCantidad(item.producto.id, item.cantidad + 1)}
                                                    >
                                                        <Plus className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-red-500 hover:text-red-700"
                                                        onClick={() => quitarDelCarrito(item.producto.id)}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>

                            {carrito.length > 0 && (
                                <CardFooter className="flex-col gap-4 border-t bg-gray-50 rounded-b-lg">
                                    <div className="flex justify-between w-full py-2">
                                        <span className="font-medium">Total Aproximado:</span>
                                        <span className="text-xl font-bold text-amber-600">
                                            ${totalCarrito.toFixed(2)}
                                        </span>
                                    </div>

                                    {!mostrarFormConfirmar ? (
                                        <Button
                                            className="w-full bg-green-600 hover:bg-green-700"
                                            onClick={() => setMostrarFormConfirmar(true)}
                                        >
                                            <Send className="h-4 w-4 mr-2" />
                                            Confirmar Pedido
                                        </Button>
                                    ) : (
                                        <div className="w-full space-y-3">
                                            <div className="flex gap-2">
                                                <div className="p-2 bg-gray-200 rounded-lg">
                                                    <Phone className="h-5 w-5 text-gray-500" />
                                                </div>
                                                <Input
                                                    placeholder="Tu número de WhatsApp"
                                                    value={telefonoCliente}
                                                    onChange={(e) => setTelefonoCliente(e.target.value.replace(/\D/g, ''))}
                                                    className="flex-1"
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    className="flex-1"
                                                    onClick={() => setMostrarFormConfirmar(false)}
                                                >
                                                    Cancelar
                                                </Button>
                                                <Button
                                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                                    onClick={confirmarPedido}
                                                >
                                                    Enviar por WhatsApp
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </CardFooter>
                            )}
                        </Card>
                    </div>
                </aside>
            </div>

            {/* Botón flotante del carrito (mobile) */}
            {cantidadItems > 0 && (
                <div className="lg:hidden fixed bottom-4 right-4 z-50">
                    <Button
                        size="lg"
                        className="rounded-full h-14 w-14 bg-amber-500 hover:bg-amber-600 shadow-lg"
                        onClick={() => setCarritoAbierto(!carritoAbierto)}
                    >
                        <ShoppingCart className="h-6 w-6" />
                        <Badge className="absolute -top-1 -right-1 h-6 w-6 flex items-center justify-center p-0">
                            {cantidadItems}
                        </Badge>
                    </Button>
                </div>
            )}
        </div>
    )
}

// Componente de Card de Producto
interface ProductoCardProps {
    producto: Producto
    onAgregar: (producto: Producto, cantidad: number, pesoAprox?: number) => void
    enCarrito: boolean
}

function ProductoCard({ producto, onAgregar, enCarrito }: ProductoCardProps) {
    const [cantidad, setCantidad] = useState(1)
    const [pesoAprox, setPesoAprox] = useState<number | undefined>(undefined)
    const [expandido, setExpandido] = useState(false)

    const handleAgregar = () => {
        onAgregar(producto, cantidad, producto.es_pesable ? pesoAprox : undefined)
        setCantidad(1)
        setPesoAprox(undefined)
    }

    return (
        <Card className={`overflow-hidden transition-all hover:shadow-md ${enCarrito ? 'ring-2 ring-amber-500' : ''}`}>
            {/* Imagen placeholder */}
            <div className="h-32 bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                {producto.imagen_url ? (
                    <img
                        src={producto.imagen_url}
                        alt={producto.nombre}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <Package className="h-12 w-12 text-amber-300" />
                )}
            </div>

            <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                        <h3 className="font-semibold text-sm line-clamp-2">
                            {producto.nombre}
                        </h3>
                        <p className="text-xs text-gray-500">{producto.categoria?.nombre}</p>
                    </div>
                    {producto.es_pesable && (
                        <Badge variant="outline" className="text-xs shrink-0">
                            <Scale className="h-3 w-3 mr-1" />
                            Pesable
                        </Badge>
                    )}
                </div>

                <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-lg font-bold text-amber-600">
                        ${producto.precio_minorista}
                    </span>
                    <span className="text-xs text-gray-500">/{producto.unidad}</span>
                </div>

                {expandido && (
                    <div className="space-y-2 mb-3 animate-in slide-in-from-top-2">
                        {producto.es_pesable && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-600">Peso aprox:</span>
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
                        )}

                        {!producto.es_pesable && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-600">Cantidad:</span>
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                                    >
                                        <Minus className="h-3 w-3" />
                                    </Button>
                                    <span className="w-8 text-center font-medium">{cantidad}</span>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => setCantidad(cantidad + 1)}
                                    >
                                        <Plus className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>

            <CardFooter className="p-4 pt-0 flex gap-2">
                {!expandido ? (
                    <Button
                        className="w-full bg-amber-500 hover:bg-amber-600"
                        onClick={() => setExpandido(true)}
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Agregar
                    </Button>
                ) : (
                    <>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setExpandido(false)}
                        >
                            <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                            className="flex-1 bg-green-600 hover:bg-green-700"
                            onClick={handleAgregar}
                            disabled={producto.es_pesable && (!pesoAprox || pesoAprox <= 0)}
                        >
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            Confirmar
                        </Button>
                    </>
                )}
            </CardFooter>
        </Card>
    )
}
