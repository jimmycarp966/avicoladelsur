'use client'

import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
    Sparkles,
    Grid3x3,
    List,
    SlidersHorizontal,
    Heart,
    ChevronDown,
    ArrowUpDown
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
const FAVORITOS_KEY = 'avicola_favoritos'

type VistaType = 'grid' | 'lista'
type OrdenType = 'nombre' | 'precio_asc' | 'precio_desc'

export default function CatalogoClient({ productos, categorias }: CatalogoClientProps) {
    const [busqueda, setBusqueda] = useState('')
    const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>('todas')
    const [carrito, setCarrito] = useState<ItemCarrito[]>([])
    const [carritoAbierto, setCarritoAbierto] = useState(false)
    const [telefonoCliente, setTelefonoCliente] = useState('')
    const [mostrarFormConfirmar, setMostrarFormConfirmar] = useState(false)
    const [enviando, setEnviando] = useState(false)
    const [productoExpandido, setProductoExpandido] = useState<string | null>(null)
    const [vista, setVista] = useState<VistaType>('grid')
    const [orden, setOrden] = useState<OrdenType>('nombre')
    const [favoritos, setFavoritos] = useState<Set<string>>(new Set())
    const [soloFavoritos, setSoloFavoritos] = useState(false)
    const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)

    // Cargar carrito y favoritos de localStorage
    useEffect(() => {
        const carritoGuardado = localStorage.getItem(CARRITO_KEY)
        if (carritoGuardado) {
            try {
                setCarrito(JSON.parse(carritoGuardado))
            } catch (e) {
                console.error('Error cargando carrito:', e)
            }
        }

        const favoritosGuardados = localStorage.getItem(FAVORITOS_KEY)
        if (favoritosGuardados) {
            try {
                setFavoritos(new Set(JSON.parse(favoritosGuardados)))
            } catch (e) {
                console.error('Error cargando favoritos:', e)
            }
        }
    }, [])

    // Guardar carrito en localStorage
    useEffect(() => {
        localStorage.setItem(CARRITO_KEY, JSON.stringify(carrito))
    }, [carrito])

    // Guardar favoritos en localStorage
    useEffect(() => {
        localStorage.setItem(FAVORITOS_KEY, JSON.stringify(Array.from(favoritos)))
    }, [favoritos])

    // Filtrar y ordenar productos
    const productosFiltrados = useMemo(() => {
        let filtrados = productos.filter(p => {
            const matchBusqueda = p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
                p.codigo.toLowerCase().includes(busqueda.toLowerCase())
            const matchCategoria = categoriaSeleccionada === 'todas' ||
                p.categoria?.id === categoriaSeleccionada
            const matchFavoritos = !soloFavoritos || favoritos.has(p.id)
            return matchBusqueda && matchCategoria && matchFavoritos
        })

        // Ordenar
        filtrados = [...filtrados].sort((a, b) => {
            switch (orden) {
                case 'precio_asc':
                    return a.precio_minorista - b.precio_minorista
                case 'precio_desc':
                    return b.precio_minorista - a.precio_minorista
                default:
                    return a.nombre.localeCompare(b.nombre)
            }
        })

        return filtrados
    }, [productos, busqueda, categoriaSeleccionada, orden, favoritos, soloFavoritos])

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

    // Toggle favorito
    const toggleFavorito = (productoId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setFavoritos(prev => {
            const nuevos = new Set(prev)
            if (nuevos.has(productoId)) {
                nuevos.delete(productoId)
                toast.success('Eliminado de favoritos')
            } else {
                nuevos.add(productoId)
                toast.success('Agregado a favoritos', {
                    icon: <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />,
                })
            }
            return nuevos
        })
    }

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
        setProductoExpandido(null)
        toast.success(`${producto.nombre} agregado`, {
            icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
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

    const categoriasConTodas = [{ id: 'todas', nombre: 'Todos' }, ...categorias]

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/50">
                <div className="container mx-auto px-3 sm:px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 sm:gap-4">
                            <motion.div
                                whileHover={{ rotate: [0, -10, 10, -10, 0] }}
                                transition={{ duration: 0.5 }}
                                className="relative shrink-0"
                            >
                                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/25">
                                    <Package className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                                </div>
                                <div className="absolute -bottom-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-amber-400 rounded-full border-2 border-white" />
                            </motion.div>
                            <div>
                                <h1 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight">Avícola del Sur</h1>
                                <p className="text-[10px] sm:text-xs text-slate-500 hidden sm:block">Productos frescos de calidad</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-1 sm:gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                className={`relative h-9 w-9 sm:h-auto sm:w-auto sm:px-3 ${soloFavoritos ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : ''}`}
                                onClick={() => setSoloFavoritos(!soloFavoritos)}
                            >
                                <Heart className={`h-4 w-4 sm:h-5 sm:w-5 ${soloFavoritos ? 'fill-rose-500' : ''}`} />
                                {favoritos.size > 0 && !soloFavoritos && (
                                    <Badge className="absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 min-w-4 sm:min-w-5 px-0 sm:px-1 flex items-center justify-center bg-rose-500 border-rose-500 text-[10px] sm:text-xs">
                                        {favoritos.size}
                                    </Badge>
                                )}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="relative h-9 w-9 sm:h-auto sm:w-auto sm:px-3 hover:bg-emerald-50"
                                onClick={() => setCarritoAbierto(!carritoAbierto)}
                            >
                                <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />
                                {cantidadItems > 0 && (
                                    <Badge className="absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 min-w-4 sm:min-w-5 px-0 sm:px-1 flex items-center justify-center bg-emerald-500 border-emerald-500 text-[10px] sm:text-xs">
                                        {cantidadItems}
                                    </Badge>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-24 flex flex-col xl:flex-row gap-4 sm:gap-6">
                {/* Catálogo */}
                <main className="flex-1 min-w-0">
                    {/* Barra de búsqueda y filtros */}
                    <div className="mb-6 space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
                            <Input
                                placeholder="Buscar productos..."
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                className="pl-10 sm:pl-12 pr-10 sm:pr-12 h-10 sm:h-12 text-sm bg-white border-slate-200 focus:border-emerald-500 focus:ring-emerald-500 rounded-xl sm:rounded-2xl shadow-sm"
                            />
                            {busqueda && (
                                <motion.button
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    onClick={() => setBusqueda('')}
                                    className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <XCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                                </motion.button>
                            )}
                        </div>

                        {/* Controles superiores */}
                        <div className="flex items-center justify-between gap-4">
                            {/* Categorías - Pills scrollable */}
                            <div className="flex-1 overflow-x-auto scrollbar-hide">
                                <div className="flex gap-2 pb-1">
                                    {categoriasConTodas.map(cat => (
                                        <motion.button
                                            key={cat.id}
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => setCategoriaSeleccionada(cat.id)}
                                            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all ${
                                                categoriaSeleccionada === cat.id
                                                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                                                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                            }`}
                                        >
                                            {cat.nombre}
                                        </motion.button>
                                    ))}
                                </div>
                            </div>

                            {/* Botón de filtros avanzados */}
                            <Button
                                variant="outline"
                                size="sm"
                                className={`rounded-xl shrink-0 ${filtrosAbiertos ? 'bg-slate-100 border-slate-300' : ''}`}
                                onClick={() => setFiltrosAbiertos(!filtrosAbiertos)}
                            >
                                <SlidersHorizontal className="h-4 w-4 mr-2" />
                                Filtros
                                {filtrosAbiertos && <ChevronDown className="h-4 w-4 ml-2" />}
                            </Button>
                        </div>

                        {/* Panel de filtros avanzados */}
                        <AnimatePresence>
                            {filtrosAbiertos && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200"
                                >
                                    <div className="flex flex-wrap items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-slate-600">Vista:</span>
                                            <div className="flex bg-slate-100 rounded-lg p-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className={`h-8 px-3 ${vista === 'grid' ? 'bg-white shadow-sm' : ''}`}
                                                    onClick={() => setVista('grid')}
                                                >
                                                    <Grid3x3 className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className={`h-8 px-3 ${vista === 'lista' ? 'bg-white shadow-sm' : ''}`}
                                                    onClick={() => setVista('lista')}
                                                >
                                                    <List className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-slate-600">Ordenar por:</span>
                                            <div className="flex bg-slate-100 rounded-lg p-1">
                                                {[
                                                    { value: 'nombre' as OrdenType, label: 'Nombre' },
                                                    { value: 'precio_asc' as OrdenType, label: '$ - $$$$' },
                                                    { value: 'precio_desc' as OrdenType, label: '$$$$ - $' },
                                                ].map(op => (
                                                    <Button
                                                        key={op.value}
                                                        variant="ghost"
                                                        size="sm"
                                                        className={`h-8 px-3 text-xs ${orden === op.value ? 'bg-white shadow-sm' : ''}`}
                                                        onClick={() => setOrden(op.value)}
                                                    >
                                                        {op.label}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Info de resultados */}
                        <div className="flex items-center justify-between text-sm">
                            <p className="text-slate-500">
                                <span className="font-semibold text-slate-700">{productosFiltrados.length}</span>
                                {productosFiltrados.length === 1 ? ' producto' : ' productos'}
                                {soloFavoritos && ' en favoritos'}
                                {categoriaSeleccionada !== 'todas' && ` en ${categorias.find(c => c.id === categoriaSeleccionada)?.nombre}`}
                            </p>
                            {productosFiltrados.length > 1 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-slate-500 hover:text-slate-700"
                                    onClick={() => {
                                        setOrden(orden === 'precio_asc' ? 'precio_desc' : 'precio_asc')
                                    }}
                                >
                                    <ArrowUpDown className="h-4 w-4 mr-1" />
                                    {orden === 'precio_asc' ? 'Menor precio' : 'Mayor precio'}
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Productos */}
                    <AnimatePresence mode="wait">
                        {vista === 'grid' ? (
                            <motion.div
                                key="grid"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                            >
                                {productosFiltrados.map((producto, index) => (
                                    <ProductoCard
                                        key={producto.id}
                                        producto={producto}
                                        onAgregar={agregarAlCarrito}
                                        enCarrito={carrito.some(i => i.producto.id === producto.id)}
                                        expandido={productoExpandido === producto.id}
                                        onToggleExpand={() => setProductoExpandido(
                                            productoExpandido === producto.id ? null : producto.id
                                        )}
                                        esFavorito={favoritos.has(producto.id)}
                                        onToggleFavorito={toggleFavorito}
                                        index={index}
                                    />
                                ))}
                            </motion.div>
                        ) : (
                            <motion.div
                                key="lista"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="space-y-3"
                            >
                                {productosFiltrados.map((producto, index) => (
                                    <ProductoListItem
                                        key={producto.id}
                                        producto={producto}
                                        onAgregar={agregarAlCarrito}
                                        enCarrito={carrito.some(i => i.producto.id === producto.id)}
                                        esFavorito={favoritos.has(producto.id)}
                                        onToggleFavorito={toggleFavorito}
                                        index={index}
                                    />
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Estado vacío */}
                    {productosFiltrados.length === 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center py-16"
                        >
                            <div className="w-24 h-24 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
                                <Search className="h-10 w-10 text-slate-300" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-700 mb-1">No encontramos productos</h3>
                            <p className="text-slate-500 mb-4">Intenta con otros filtros o términos de búsqueda</p>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setBusqueda('')
                                    setCategoriaSeleccionada('todas')
                                    setSoloFavoritos(false)
                                }}
                                className="rounded-full"
                            >
                                Limpiar todos los filtros
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
                                className="fixed inset-0 bg-black/50 z-40 xl:hidden backdrop-blur-sm"
                            />

                            {/* Sidebar */}
                            <motion.aside
                                initial={{ x: '100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                className="fixed right-0 top-0 h-full w-full max-w-sm bg-white z-50 xl:hidden shadow-2xl flex flex-col"
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
                <aside className="hidden xl:block xl:w-96 shrink-0">
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
                        className="xl:hidden fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-30"
                    >
                        <Button
                            size="lg"
                            className="rounded-full h-14 w-14 sm:h-16 sm:w-16 bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-xl shadow-emerald-500/30"
                            onClick={() => setCarritoAbierto(true)}
                        >
                            <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6" />
                            <Badge className="absolute -top-1 -right-1 h-6 w-6 sm:h-7 sm:w-7 flex items-center justify-center p-0 bg-white text-emerald-600 border-0 font-bold text-xs">
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
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="p-5 border-b border-slate-100">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center">
                            <ShoppingCart className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-900">Tu Carrito</h2>
                            {cantidadItems > 0 && (
                                <p className="text-xs text-slate-500">{cantidadItems} {cantidadItems === 1 ? 'producto' : 'productos'}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {carrito.length > 0 && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                onClick={onVaciar}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-slate-400 hover:text-slate-600 hover:bg-slate-100 xl:hidden"
                            onClick={onCerrar}
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                {/* Barra de progreso visual */}
                {carrito.length > 0 && carrito.length < 5 && (
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, (carrito.length / 5) * 100)}%` }}
                            className="h-full bg-gradient-to-r from-emerald-400 to-teal-500"
                        />
                    </div>
                )}
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-4">
                {carrito.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-8">
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mb-4"
                        >
                            <ShoppingCart className="h-10 w-10 text-slate-300" />
                        </motion.div>
                        <h3 className="font-semibold text-slate-700 mb-1">Carrito vacío</h3>
                        <p className="text-sm text-slate-500">Agregá productos para comenzar</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <AnimatePresence initial={false}>
                            {carrito.map(item => (
                                <CarritoItem
                                    key={item.producto.id}
                                    item={item}
                                    onQuitar={onQuitar}
                                    onActualizar={onActualizar}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Footer con total y acciones */}
            {carrito.length > 0 && (
                <div className="p-5 border-t border-slate-100 bg-slate-50/50 space-y-4">
                    {/* Resumen */}
                    <div className="bg-white rounded-2xl p-4 border border-slate-100">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-slate-500">Subtotal</span>
                            <span className="font-medium text-slate-700">
                                ${totalCarrito.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="font-semibold text-slate-900">Total</span>
                            <span className="text-2xl font-bold text-emerald-600">
                                ${totalCarrito.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>

                    {!mostrarFormConfirmar ? (
                        <Button
                            className="w-full h-12 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold rounded-2xl shadow-lg shadow-emerald-500/25"
                            onClick={() => setMostrarFormConfirmar(true)}
                        >
                            <Send className="h-4 w-4 mr-2" />
                            Confirmar Pedido
                        </Button>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-3">
                                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                                    <Phone className="h-5 w-5 text-emerald-600" />
                                </div>
                                <Input
                                    placeholder="Tu número de WhatsApp"
                                    type="tel"
                                    value={telefonoCliente}
                                    onChange={(e) => setTelefonoCliente(e.target.value.replace(/\D/g, ''))}
                                    className="flex-1 border-0 focus-visible:ring-0 px-0"
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    className="flex-1 h-12 rounded-xl"
                                    onClick={() => setMostrarFormConfirmar(false)}
                                    disabled={enviando}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    className="flex-1 h-12 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 rounded-xl font-semibold"
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
                                            <Send className="h-4 w-4 mr-2" />
                                            Enviar
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// Item del carrito
interface CarritoItemProps {
    item: ItemCarrito
    onQuitar: (id: string) => void
    onActualizar: (id: string, cant: number) => void
}

function CarritoItem({ item, onQuitar, onActualizar }: CarritoItemProps) {
    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm"
        >
            <div className="flex gap-3">
                {/* Miniatura */}
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl flex items-center justify-center shrink-0">
                    <Package className="h-8 w-8 text-emerald-400" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-slate-900 text-sm truncate">{item.producto.nombre}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                        ${item.producto.precio_minorista.toLocaleString('es-AR')} / {item.producto.unidad}
                    </p>

                    {/* Controles */}
                    <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 hover:bg-white"
                                onClick={() => onActualizar(item.producto.id, item.cantidad - 1)}
                            >
                                <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-7 text-center text-sm font-semibold text-slate-700">
                                {item.cantidad}
                            </span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 hover:bg-white"
                                onClick={() => onActualizar(item.producto.id, item.cantidad + 1)}
                            >
                                <Plus className="h-3 w-3" />
                            </Button>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-emerald-600">
                                ${(item.producto.precio_minorista * item.cantidad).toLocaleString('es-AR')}
                            </span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                onClick={() => onQuitar(item.producto.id)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    )
}

// Componente de Card de Producto (Grid)
interface ProductoCardProps {
    producto: Producto
    onAgregar: (producto: Producto, cantidad: number, pesoAprox?: number) => void
    enCarrito: boolean
    expandido: boolean
    onToggleExpand: () => void
    esFavorito: boolean
    onToggleFavorito: (id: string, e: React.MouseEvent) => void
    index: number
}

function ProductoCard({
    producto,
    onAgregar,
    enCarrito,
    expandido,
    onToggleExpand,
    esFavorito,
    onToggleFavorito,
    index
}: ProductoCardProps) {
    const [cantidad, setCantidad] = useState(1)
    const [pesoAprox, setPesoAprox] = useState<number | undefined>(undefined)

    const handleAgregar = () => {
        onAgregar(producto, cantidad, producto.es_pesable ? pesoAprox : undefined)
        setCantidad(1)
        setPesoAprox(undefined)
    }

    const subtotal = producto.es_pesable && pesoAprox
        ? producto.precio_minorista * pesoAprox
        : producto.precio_minorista * cantidad

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ delay: index * 0.05 }}
        >
            <Card className={`group overflow-hidden transition-all duration-300 border-2 ${
                enCarrito ? 'border-emerald-400 shadow-lg shadow-emerald-500/10' : 'border-transparent bg-white'
            }`}>
                {/* Header del producto */}
                <div className="relative">
                    {/* Badge de favorito */}
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => onToggleFavorito(producto.id, e)}
                        className="absolute top-3 right-3 z-10 w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm hover:bg-white transition-colors"
                    >
                        <Heart className={`h-4 w-4 transition-colors ${esFavorito ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}`} />
                    </motion.button>

                    {/* Imagen o placeholder */}
                    <div className="relative bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 p-4 sm:p-6">
                        {producto.imagen_url ? (
                            <img
                                src={producto.imagen_url}
                                alt={producto.nombre}
                                className="w-full h-24 sm:h-32 object-contain"
                            />
                        ) : (
                            <div className="w-full h-24 sm:h-32 flex items-center justify-center">
                                <motion.div
                                    whileHover={{ scale: 1.1, rotate: 5 }}
                                    transition={{ type: 'spring', stiffness: 300 }}
                                >
                                    <Package className="h-12 w-12 sm:h-16 sm:w-16 text-emerald-300" />
                                </motion.div>
                            </div>
                        )}

                        {/* Badges de producto */}
                        <div className="absolute bottom-2 left-2 flex gap-1.5">
                            {producto.es_pesable && (
                                <Badge className="bg-amber-400 text-amber-900 border-0 text-xs font-medium px-2 py-0.5 rounded-full">
                                    <Scale className="h-3 w-3 mr-1" />
                                    Pesable
                                </Badge>
                            )}
                            {producto.categoria && (
                                <Badge variant="outline" className="bg-white/80 backdrop-blur-sm border-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full">
                                    {producto.categoria.nombre}
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>

                {/* Info del producto */}
                <CardContent className="p-3 sm:p-4 space-y-2 sm:space-y-3">
                    <div>
                        <h3 className="font-semibold text-slate-900 leading-tight text-sm sm:text-base">{producto.nombre}</h3>
                        {producto.descripcion && (
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2 hidden sm:block">{producto.descripcion}</p>
                        )}
                    </div>

                    <div className="flex items-baseline justify-between">
                        <div>
                            <span className="text-xl sm:text-2xl font-bold text-slate-900">
                                ${producto.precio_minorista.toLocaleString('es-AR')}
                            </span>
                            <span className="text-xs sm:text-sm text-slate-500 ml-1">/{producto.unidad}</span>
                        </div>
                        {expandido && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-right"
                            >
                                <p className="text-xs text-slate-500">Subtotal</p>
                                <p className="font-bold text-emerald-600">${subtotal.toFixed(2)}</p>
                            </motion.div>
                        )}
                    </div>

                    {expandido && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-2 pt-2 border-t border-slate-100"
                        >
                            {producto.es_pesable ? (
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-slate-600">Peso (kg):</span>
                                    <div className="flex-1 flex items-center bg-slate-100 rounded-lg">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => setPesoAprox(Math.max(0.1, (pesoAprox || 0) - 0.1))}
                                        >
                                            <Minus className="h-3 w-3" />
                                        </Button>
                                        <Input
                                            type="number"
                                            step="0.1"
                                            min="0.1"
                                            value={pesoAprox || ''}
                                            onChange={(e) => setPesoAprox(parseFloat(e.target.value) || undefined)}
                                            className="w-16 h-8 text-center border-0 bg-transparent focus-visible:ring-0 p-0"
                                            placeholder="0.5"
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => setPesoAprox((pesoAprox || 0) + 0.1)}
                                        >
                                            <Plus className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-slate-600">Cantidad:</span>
                                    <div className="flex-1 flex items-center bg-slate-100 rounded-lg">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                                        >
                                            <Minus className="h-3 w-3" />
                                        </Button>
                                        <span className="flex-1 text-center font-semibold text-slate-700">
                                            {cantidad}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
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
                <div className="p-3 sm:p-4 pt-0">
                    {!expandido ? (
                        <Button
                            className={`w-full h-10 sm:h-11 font-semibold rounded-xl transition-all text-sm sm:text-base ${
                                enCarrito
                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                    : 'bg-slate-900 text-white hover:bg-slate-800'
                            }`}
                            onClick={onToggleExpand}
                        >
                            {enCarrito ? (
                                <>
                                    <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                    <span className="hidden sm:inline">En carrito</span>
                                    <span className="sm:hidden">Carrito</span>
                                </>
                            ) : (
                                <>
                                    <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                    Agregar
                                </>
                            )}
                        </Button>
                    ) : (
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                className="h-10 sm:h-11 w-10 sm:w-auto sm:px-4 rounded-xl"
                                onClick={onToggleExpand}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                            <Button
                                className="flex-1 h-10 sm:h-11 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold rounded-xl text-sm"
                                onClick={handleAgregar}
                                disabled={producto.es_pesable && (!pesoAprox || pesoAprox <= 0)}
                            >
                                <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                <span className="hidden sm:inline">Confirmar</span>
                                <span className="sm:hidden">OK</span>
                            </Button>
                        </div>
                    )}
                </div>
            </Card>
        </motion.div>
    )
}

// Componente de Lista de Producto
interface ProductoListItemProps {
    producto: Producto
    onAgregar: (producto: Producto, cantidad: number, pesoAprox?: number) => void
    enCarrito: boolean
    esFavorito: boolean
    onToggleFavorito: (id: string, e: React.MouseEvent) => void
    index: number
}

function ProductoListItem({
    producto,
    onAgregar,
    enCarrito,
    esFavorito,
    onToggleFavorito,
    index
}: ProductoListItemProps) {
    const [cantidad, setCantidad] = useState(1)
    const [agregando, setAgregando] = useState(false)

    const handleAgregar = () => {
        onAgregar(producto, cantidad, undefined)
        setCantidad(1)
        setAgregando(false)
    }

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03 }}
        >
            <Card className={`transition-all duration-300 ${enCarrito ? 'border-emerald-400 bg-emerald-50/30' : 'bg-white'}`}>
                <CardContent className="p-4">
                    <div className="flex gap-4">
                        {/* Imagen miniatura */}
                        <div className="w-20 h-20 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl flex items-center justify-center shrink-0">
                            {producto.imagen_url ? (
                                <img src={producto.imagen_url} alt={producto.nombre} className="w-full h-full object-contain rounded-xl" />
                            ) : (
                                <Package className="h-10 w-10 text-emerald-300" />
                            )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-slate-900">{producto.nombre}</h3>
                                        {producto.es_pesable && (
                                            <Badge className="bg-amber-100 text-amber-700 border-0 text-xs px-1.5 py-0">
                                                <Scale className="h-3 w-3 mr-0.5" />
                                                Pesable
                                            </Badge>
                                        )}
                                    </div>
                                    {producto.categoria && (
                                        <p className="text-xs text-slate-500 mt-0.5">{producto.categoria.nombre}</p>
                                    )}
                                </div>

                                <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    onClick={(e) => onToggleFavorito(producto.id, e)}
                                    className="shrink-0"
                                >
                                    <Heart className={`h-5 w-5 transition-colors ${esFavorito ? 'fill-rose-500 text-rose-500' : 'text-slate-300 hover:text-rose-400'}`} />
                                </motion.button>
                            </div>

                            <div className="flex items-center justify-between mt-3">
                                <div>
                                    <span className="text-xl font-bold text-slate-900">
                                        ${producto.precio_minorista.toLocaleString('es-AR')}
                                    </span>
                                    <span className="text-sm text-slate-500">/{producto.unidad}</span>
                                </div>

                                {!agregando ? (
                                    <Button
                                        size="sm"
                                        className={`h-9 rounded-lg font-medium transition-all ${
                                            enCarrito
                                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                : 'bg-slate-900 text-white hover:bg-slate-800'
                                        }`}
                                        onClick={() => setAgregando(true)}
                                    >
                                        <Plus className="h-4 w-4 mr-1" />
                                        Agregar
                                    </Button>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center bg-slate-100 rounded-lg">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                                            >
                                                <Minus className="h-3 w-3" />
                                            </Button>
                                            <span className="w-8 text-center font-semibold text-sm">{cantidad}</span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => setCantidad(cantidad + 1)}
                                            >
                                                <Plus className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        <Button
                                            size="sm"
                                            className="h-9 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg"
                                            onClick={handleAgregar}
                                        >
                                            <ShoppingCart className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9"
                                            onClick={() => setAgregando(false)}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    )
}
