'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Search,
  User,
  Tag,
  DollarSign,
  Scale,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import {
  registrarVentaSucursalConControlAction,
  obtenerPrecioProductoAction,
} from '@/actions/ventas-sucursal.actions'

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

interface Cliente {
  id: string
  nombre: string
  codigo: string
  tipoCliente?: string
}

interface ListaPrecio {
  id: string
  codigo: string
  nombre: string
  tipo: string
  margenGanancia: number | null
}

interface ItemCarrito {
  productoId: string
  producto: Producto
  cantidad: number
  precioUnitario: number
  subtotal: number
}

interface POSSucursalProps {
  productos: Producto[]
  clientes: Cliente[]
  listasPrecio: ListaPrecio[]
  sucursalId: string
  onVentaCompletada?: () => void
}

// ===========================================
// COMPONENTE PRINCIPAL
// ===========================================

export function POSSucursal({
  productos,
  clientes,
  listasPrecio,
  sucursalId,
  onVentaCompletada,
}: POSSucursalProps) {
  // Estado
  const [busquedaProducto, setBusquedaProducto] = useState('')
  const [clienteSeleccionado, setClienteSeleccionado] = useState<string>('')
  const [listaPrecioSeleccionada, setListaPrecioSeleccionada] = useState<string>('')
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [cantidadInput, setCantidadInput] = useState<Record<string, string>>({})
  const [cargandoPrecio, setCargandoPrecio] = useState<string | null>(null)
  const [procesandoVenta, setProcesandoVenta] = useState(false)

  // Productos filtrados
  const productosFiltrados = productos.filter(
    (p) =>
      p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase()) ||
      p.codigo.toLowerCase().includes(busquedaProducto.toLowerCase())
  )

  // Lista de precio seleccionada
  const listaActual = listasPrecio.find((l) => l.id === listaPrecioSeleccionada)

  // Totales
  const totalCarrito = carrito.reduce((sum, item) => sum + item.subtotal, 0)
  const cantidadTotalKg = carrito.reduce((sum, item) => sum + item.cantidad, 0)

  // Obtener precio cuando cambia la lista
  const obtenerPrecioProducto = useCallback(
    async (productoId: string): Promise<number> => {
      if (!listaPrecioSeleccionada) {
        const producto = productos.find((p) => p.id === productoId)
        return producto?.precioVenta || 0
      }

      setCargandoPrecio(productoId)
      try {
        const result = await obtenerPrecioProductoAction(
          listaPrecioSeleccionada,
          productoId
        )
        if (result.success && result.data) {
          return result.data.precio
        }
      } catch (error) {
        console.error('Error al obtener precio:', error)
      } finally {
        setCargandoPrecio(null)
      }

      const producto = productos.find((p) => p.id === productoId)
      return producto?.precioVenta || 0
    },
    [listaPrecioSeleccionada, productos]
  )

  // Actualizar precios cuando cambia la lista
  useEffect(() => {
    if (carrito.length > 0 && listaPrecioSeleccionada) {
      const actualizarPrecios = async () => {
        const carritoActualizado = await Promise.all(
          carrito.map(async (item) => {
            const nuevoPrecio = await obtenerPrecioProducto(item.productoId)
            return {
              ...item,
              precioUnitario: nuevoPrecio,
              subtotal: item.cantidad * nuevoPrecio,
            }
          })
        )
        setCarrito(carritoActualizado)
      }
      actualizarPrecios()
    }
  }, [listaPrecioSeleccionada])

  // Agregar producto al carrito
  const agregarAlCarrito = async (producto: Producto) => {
    const cantidadStr = cantidadInput[producto.id] || '1'
    const cantidad = parseFloat(cantidadStr)

    if (isNaN(cantidad) || cantidad <= 0) {
      toast.error('Cantidad inválida')
      return
    }

    if (cantidad > producto.stockDisponible) {
      toast.error(`Stock insuficiente. Disponible: ${producto.stockDisponible} ${producto.unidadMedida}`)
      return
    }

    // Verificar si ya existe en el carrito
    const existente = carrito.find((item) => item.productoId === producto.id)
    const cantidadTotal = existente ? existente.cantidad + cantidad : cantidad

    if (cantidadTotal > producto.stockDisponible) {
      toast.error(`Stock insuficiente. Disponible: ${producto.stockDisponible} ${producto.unidadMedida}`)
      return
    }

    const precioUnitario = await obtenerPrecioProducto(producto.id)

    if (existente) {
      setCarrito(
        carrito.map((item) =>
          item.productoId === producto.id
            ? {
                ...item,
                cantidad: cantidadTotal,
                subtotal: cantidadTotal * precioUnitario,
              }
            : item
        )
      )
    } else {
      setCarrito([
        ...carrito,
        {
          productoId: producto.id,
          producto,
          cantidad,
          precioUnitario,
          subtotal: cantidad * precioUnitario,
        },
      ])
    }

    // Limpiar input de cantidad
    setCantidadInput({ ...cantidadInput, [producto.id]: '' })
    toast.success(`${producto.nombre} agregado al carrito`)
  }

  // Actualizar cantidad en carrito
  const actualizarCantidad = (productoId: string, nuevaCantidad: number) => {
    const item = carrito.find((i) => i.productoId === productoId)
    if (!item) return

    if (nuevaCantidad <= 0) {
      eliminarDelCarrito(productoId)
      return
    }

    if (nuevaCantidad > item.producto.stockDisponible) {
      toast.error(`Stock máximo: ${item.producto.stockDisponible} ${item.producto.unidadMedida}`)
      return
    }

    setCarrito(
      carrito.map((i) =>
        i.productoId === productoId
          ? {
              ...i,
              cantidad: nuevaCantidad,
              subtotal: nuevaCantidad * i.precioUnitario,
            }
          : i
      )
    )
  }

  // Eliminar del carrito
  const eliminarDelCarrito = (productoId: string) => {
    setCarrito(carrito.filter((item) => item.productoId !== productoId))
  }

  // Procesar venta
  const procesarVenta = async () => {
    if (!clienteSeleccionado) {
      toast.error('Selecciona un cliente')
      return
    }

    if (!listaPrecioSeleccionada) {
      toast.error('Selecciona una lista de precios')
      return
    }

    if (carrito.length === 0) {
      toast.error('El carrito está vacío')
      return
    }

    setProcesandoVenta(true)

    try {
      const result = await registrarVentaSucursalConControlAction({
        sucursalId,
        clienteId: clienteSeleccionado,
        listaPrecioId: listaPrecioSeleccionada,
        items: carrito.map((item) => ({
          productoId: item.productoId,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
        })),
        pago: {
          pagos: [{
            metodoPago: 'efectivo',
            monto: totalCarrito,
          }],
        },
      })

      if (result.success && result.data) {
        toast.success(
          <div className="space-y-1">
            <p className="font-semibold">¡Venta registrada!</p>
            <p className="text-sm">Pedido: {result.data.numeroPedido}</p>
            <p className="text-sm">Total: ${result.data.total.toFixed(2)}</p>
            <p className="text-sm text-green-600">
              Margen: ${result.data.margenBruto.toFixed(2)}
            </p>
          </div>
        )

        // Limpiar estado
        setCarrito([])
        setClienteSeleccionado('')
        setCantidadInput({})

        // Callback
        onVentaCompletada?.()
      } else {
        toast.error(result.error || 'Error al procesar la venta')
      }
    } catch (error) {
      toast.error('Error al procesar la venta')
      console.error(error)
    } finally {
      setProcesandoVenta(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Panel izquierdo: Productos */}
      <div className="lg:col-span-2 space-y-4">
        {/* Búsqueda y filtros */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="w-5 h-5" />
              Buscar Productos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Buscar por nombre o código..."
                  value={busquedaProducto}
                  onChange={(e) => setBusquedaProducto(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="w-64">
                <Select
                  value={listaPrecioSeleccionada}
                  onValueChange={setListaPrecioSeleccionada}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Lista de precios" />
                  </SelectTrigger>
                  <SelectContent>
                    {listasPrecio.map((lista) => (
                      <SelectItem key={lista.id} value={lista.id}>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              lista.tipo === 'mayorista'
                                ? 'default'
                                : lista.tipo === 'minorista'
                                ? 'secondary'
                                : 'outline'
                            }
                            className="text-xs"
                          >
                            {lista.tipo}
                          </Badge>
                          {lista.nombre}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de productos */}
        <Card>
          <CardContent className="p-0">
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="w-32">Cantidad</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productosFiltrados.map((producto) => (
                    <TableRow key={producto.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{producto.nombre}</p>
                          <p className="text-xs text-muted-foreground">
                            {producto.codigo}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={
                            producto.stockDisponible > 10
                              ? 'default'
                              : producto.stockDisponible > 0
                              ? 'secondary'
                              : 'destructive'
                          }
                        >
                          {producto.stockDisponible.toFixed(2)} {producto.unidadMedida}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {cargandoPrecio === producto.id ? (
                          <Loader2 className="w-4 h-4 animate-spin ml-auto" />
                        ) : (
                          `$${producto.precioVenta.toFixed(2)}`
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Cant."
                          value={cantidadInput[producto.id] || ''}
                          onChange={(e) =>
                            setCantidadInput({
                              ...cantidadInput,
                              [producto.id]: e.target.value,
                            })
                          }
                          className="w-full"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => agregarAlCarrito(producto)}
                          disabled={
                            producto.stockDisponible <= 0 ||
                            cargandoPrecio === producto.id
                          }
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {productosFiltrados.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <p className="text-muted-foreground">
                          No se encontraron productos
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Panel derecho: Carrito */}
      <div className="space-y-4">
        {/* Selección de cliente */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5" />
              Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={clienteSeleccionado}
              onValueChange={setClienteSeleccionado}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar cliente" />
              </SelectTrigger>
              <SelectContent>
                {clientes.map((cliente) => (
                  <SelectItem key={cliente.id} value={cliente.id}>
                    {cliente.nombre}{' '}
                    <span className="text-muted-foreground">
                      ({cliente.codigo})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Lista de precio activa */}
        {listaActual && (
          <Card className="border-primary/50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Tag className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium">{listaActual.nombre}</p>
                  <p className="text-sm text-muted-foreground">
                    Tipo: {listaActual.tipo}
                    {listaActual.margenGanancia && (
                      <> • Margen: {listaActual.margenGanancia}%</>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Carrito */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Carrito
              {carrito.length > 0 && (
                <Badge variant="secondary">{carrito.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {carrito.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>El carrito está vacío</p>
              </div>
            ) : (
              <div className="space-y-3">
                {carrito.map((item) => (
                  <div
                    key={item.productoId}
                    className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {item.producto.nombre}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ${item.precioUnitario.toFixed(2)} x {item.cantidad.toFixed(2)}{' '}
                        {item.producto.unidadMedida}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() =>
                          actualizarCantidad(item.productoId, item.cantidad - 0.5)
                        }
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-12 text-center text-sm font-medium">
                        {item.cantidad.toFixed(2)}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() =>
                          actualizarCantidad(item.productoId, item.cantidad + 0.5)
                        }
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => eliminarDelCarrito(item.productoId)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="w-20 text-right font-medium">
                      ${item.subtotal.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {carrito.length > 0 && (
              <>
                <Separator className="my-4" />

                {/* Resumen */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Scale className="w-4 h-4" />
                      Cantidad total:
                    </span>
                    <span className="font-medium">
                      {cantidadTotalKg.toFixed(2)} kg
                    </span>
                  </div>
                  <div className="flex justify-between text-lg font-bold">
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-5 h-5" />
                      Total:
                    </span>
                    <span className="text-green-600">
                      ${totalCarrito.toFixed(2)}
                    </span>
                  </div>
                </div>

                <Separator className="my-4" />

                {/* Botón de cobrar */}
                <Button
                  className="w-full h-12 text-lg"
                  onClick={procesarVenta}
                  disabled={
                    procesandoVenta ||
                    !clienteSeleccionado ||
                    !listaPrecioSeleccionada
                  }
                >
                  {procesandoVenta ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Cobrar ${totalCarrito.toFixed(2)}
                    </>
                  )}
                </Button>

                {/* Advertencias */}
                {!clienteSeleccionado && (
                  <p className="text-xs text-amber-600 flex items-center gap-1 mt-2">
                    <AlertCircle className="w-3 h-3" />
                    Selecciona un cliente para continuar
                  </p>
                )}
                {!listaPrecioSeleccionada && (
                  <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    Selecciona una lista de precios
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

