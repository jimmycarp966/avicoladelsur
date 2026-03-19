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
  Camera,
} from 'lucide-react'
import {
  registrarVentaSucursalConControlAction,
  obtenerPrecioProductoAction,
} from '@/actions/ventas-sucursal.actions'
import { buscarProductoPorCodigoBarrasAction } from '@/actions/almacen.actions'
import { ScanButton } from '@/components/barcode/BarcodeScanner'
import { parseBarcodeEAN13 } from '@/lib/barcode-parser'
import { ProductosFrecuentes } from '@/components/sucursales/ProductosFrecuentes'

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
  listaPrecioId?: string // Lista de precio individual por producto
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
  // Cliente opcional - vacío significa "Consumidor Final"
  const [clienteSeleccionado, setClienteSeleccionado] = useState<string>('')
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [cantidadInput, setCantidadInput] = useState<Record<string, string>>({})
  const [cargandoPrecio, setCargandoPrecio] = useState<string | null>(null)
  const [procesandoVenta, setProcesandoVenta] = useState(false)

  // MODO SIMPLE: Sin listas de precio complicadas
  const MODO_VENTA_RAPIDA = true

  // Productos filtrados con priorización: primero coincidencias exactas, luego por longitud
  const productosFiltrados = (() => {
    const term = busquedaProducto.toLowerCase().trim()
    if (!term) return productos

    // Separar en grupos de prioridad
    const nombreExacto: Producto[] = []
    const nombrePalabraCompleta: Producto[] = []
    const nombreEmpiezaCon: Producto[] = []
    const codigoEmpiezaCon: Producto[] = []
    const contiene: Producto[] = []

    for (const p of productos) {
      const nombreLower = p.nombre.toLowerCase()
      const codigoLower = p.codigo.toLowerCase()

      // Prioridad 1: Nombre exacto
      if (nombreLower === term) {
        nombreExacto.push(p)
        continue
      }

      // Prioridad 2: Nombre empieza con término y es palabra completa
      if (nombreLower.startsWith(term)) {
        const charDespues = nombreLower[term.length]
        if (charDespues === ' ' || charDespues === undefined) {
          nombrePalabraCompleta.push(p)
        } else {
          nombreEmpiezaCon.push(p)
        }
        continue
      }

      // Prioridad 3: Código empieza con el término
      if (codigoLower.startsWith(term)) {
        codigoEmpiezaCon.push(p)
        continue
      }

      // Prioridad 4: Contiene el término
      if (nombreLower.includes(term) || codigoLower.includes(term)) {
        contiene.push(p)
      }
    }

    // Ordenar por longitud de nombre (más corto primero)
    nombrePalabraCompleta.sort((a, b) => a.nombre.length - b.nombre.length)
    nombreEmpiezaCon.sort((a, b) => a.nombre.length - b.nombre.length)

    return [
      ...nombreExacto,
      ...nombrePalabraCompleta,
      ...nombreEmpiezaCon,
      ...codigoEmpiezaCon,
      ...contiene
    ]
  })()


  // Totales
  const totalCarrito = carrito.reduce((sum, item) => sum + item.subtotal, 0)
  const cantidadTotalKg = carrito.reduce((sum, item) => sum + item.cantidad, 0)

  // Obtener precio de un producto con una lista específica
  const obtenerPrecioProducto = useCallback(
    async (productoId: string, listaPrecioId?: string): Promise<number> => {
      if (!listaPrecioId) {
        const producto = productos.find((p) => p.id === productoId)
        return producto?.precioVenta || 0
      }

      setCargandoPrecio(productoId)
      try {
        const result = await obtenerPrecioProductoAction(
          listaPrecioId,
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
    [productos]
  )

  // Manejar escaneo de código de barras
  const handleScan = useCallback(async (code: string) => {
    const parsed = parseBarcodeEAN13(code)
    console.log('[POS Sucursal] Codigo escaneado:', code, parsed)

    if (!parsed.isValid || !parsed.plu) {
      toast.error(parsed.error || 'Código no válido')
      return false
    }

    const result = await buscarProductoPorCodigoBarrasAction(parsed.rawCode)

    if (!result.success || !result.data) {
      toast.error(result.error || 'Producto no encontrado')
      return false
    }

    const productoEncontrado = result.data.producto
    const productoLocal = productos.find(p => p.id === productoEncontrado.id)

    if (!productoLocal) {
      toast.error('Producto no disponible en esta sucursal')
      return false
    }

    if (parsed.isWeightCode && parsed.weight) {
      setCantidadInput({ ...cantidadInput, [productoLocal.id]: parsed.weight.toFixed(3) })
    } else {
      setCantidadInput({ ...cantidadInput, [productoLocal.id]: '1' })
    }

    const cantidad = parsed.isWeightCode && parsed.weight ? parsed.weight : 1

    if (cantidad > productoLocal.stockDisponible) {
      toast.error(`Stock insuficiente. Disponible: ${productoLocal.stockDisponible} ${productoLocal.unidadMedida}`)
      return false
    }

    const existente = carrito.find((item) => item.productoId === productoLocal.id)
    const cantidadTotal = existente ? existente.cantidad + cantidad : cantidad

    if (cantidadTotal > productoLocal.stockDisponible) {
      toast.error(`Stock insuficiente. Disponible: ${productoLocal.stockDisponible} ${productoLocal.unidadMedida}`)
      return false
    }

    const precioUnitario = productoLocal.precioVenta

    if (existente) {
      setCarrito(
        carrito.map((item) =>
          item.productoId === productoLocal.id
            ? {
              ...item,
              cantidad: cantidadTotal,
              subtotal: cantidadTotal * (item.listaPrecioId ? item.precioUnitario : precioUnitario),
            }
            : item
        )
      )
    } else {
      setCarrito([
        ...carrito,
        {
          productoId: productoLocal.id,
          producto: productoLocal,
          cantidad,
          precioUnitario,
          subtotal: cantidad * precioUnitario,
        },
      ])
    }

    toast.success(`${productoLocal.nombre} - ${cantidad.toFixed(3)} kg agregado`)
    return true
  }, [productos, carrito, cantidadInput])

  // Actualizar precio cuando cambia la lista de un item específico
  const actualizarPrecioItem = useCallback(async (productoId: string, listaPrecioId: string) => {
    const item = carrito.find((i) => i.productoId === productoId)
    if (!item) return

    // Si listaPrecioId es vacío o 'none', usar undefined para precio base
    const listaIdParaPrecio = listaPrecioId === '' || listaPrecioId === 'none' ? undefined : listaPrecioId
    let nuevoPrecio = await obtenerPrecioProducto(productoId, listaIdParaPrecio)

    // LÓGICA MAYORISTA: Si es lista mayorista y el producto tiene venta mayor habilitada,
    // multiplicar el precio por kg_por_unidad_mayor (igual que en presupuestos del sistema central)
    if (listaIdParaPrecio) {
      const listaSeleccionada = listasPrecio.find((l) => l.id === listaIdParaPrecio)
      const esListaMayorista = listaSeleccionada?.tipo === 'mayorista'

      // Buscar información completa del producto para venta mayor
      // El producto en items no tiene estos campos, necesitamos buscar en productos
      const productoCompleto = productos.find((p) => p.id === productoId)
      const ventaMayorHabilitada = (productoCompleto as any)?.ventaMayorHabilitada || false
      const kgPorUnidadMayor = (productoCompleto as any)?.kgPorUnidadMayor
      const unidadMedida = productoCompleto?.unidadMedida || item.producto.unidadMedida

      if (esListaMayorista && ventaMayorHabilitada && unidadMedida === 'kg' && kgPorUnidadMayor) {
        nuevoPrecio = nuevoPrecio * kgPorUnidadMayor
      }
    }

    setCarrito(
      carrito.map((i) =>
        i.productoId === productoId
          ? {
            ...i,
            listaPrecioId: listaIdParaPrecio, // undefined si no hay lista
            precioUnitario: nuevoPrecio,
            subtotal: i.cantidad * nuevoPrecio,
          }
          : i
      )
    )
  }, [carrito, obtenerPrecioProducto, listasPrecio, productos])

  // Agregar producto al carrito (sin lista, se puede seleccionar después)
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

    // Usar precio_venta por defecto (sin lista)
    const precioUnitario = producto.precioVenta

    if (existente) {
      setCarrito(
        carrito.map((item) =>
          item.productoId === producto.id
            ? {
              ...item,
              cantidad: cantidadTotal,
              subtotal: cantidadTotal * (item.listaPrecioId ? item.precioUnitario : precioUnitario),
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
          // Sin listaPrecioId inicial, se puede seleccionar después
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
    // Cliente es opcional - Consumidor Final por defecto
    if (carrito.length === 0) {
      toast.error('El carrito está vacío')
      return
    }

    setProcesandoVenta(true)

    try {
      // Cliente opcional: si no hay seleccionado o es "consumidor_final", enviar undefined
      const clienteIdFinal = clienteSeleccionado && clienteSeleccionado !== 'consumidor_final'
        ? clienteSeleccionado
        : undefined

      const result = await registrarVentaSucursalConControlAction({
        sucursalId,
        clienteId: clienteIdFinal,
        listaPrecioId: undefined,
        items: carrito.map((item) => ({
          productoId: item.productoId,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          listaPrecioId: MODO_VENTA_RAPIDA ? undefined : item.listaPrecioId,
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
              <ScanButton
                onScan={handleScan}
                size="default"
                variant="outline"
                title="Escanear Producto"
                description="Escanea el código de barras para agregar al carrito"
              />
            </div>
          </CardContent>
        </Card>

        {/* Productos Frecuentes - Acceso Rápido */}
        {!busquedaProducto && (
          <ProductosFrecuentes
            productos={productos.slice(0, 8).map(p => ({
              id: p.id,
              nombre: p.nombre,
              codigo: p.codigo,
              precio_base: p.precioVenta,
              stock_disponible: p.stockDisponible
            }))}
            onAgregar={(prod) => {
              const productoCompleto = productos.find(p => p.id === prod.id)
              if (productoCompleto) {
                // Verificar si ya existe en el carrito
                const existente = carrito.find((item) => item.productoId === productoCompleto.id)
                const cantidad = 1
                const cantidadTotal = existente ? existente.cantidad + cantidad : cantidad

                if (cantidadTotal > productoCompleto.stockDisponible) {
                  toast.error(`Stock insuficiente. Disponible: ${productoCompleto.stockDisponible}`)
                  return
                }

                const precioUnitario = productoCompleto.precioVenta

                if (existente) {
                  setCarrito(
                    carrito.map((item) =>
                      item.productoId === productoCompleto.id
                        ? {
                          ...item,
                          cantidad: cantidadTotal,
                          subtotal: cantidadTotal * item.precioUnitario,
                        }
                        : item
                    )
                  )
                } else {
                  setCarrito([
                    ...carrito,
                    {
                      productoId: productoCompleto.id,
                      producto: productoCompleto,
                      cantidad,
                      precioUnitario,
                      subtotal: cantidad * precioUnitario,
                    },
                  ])
                }
                toast.success(`${productoCompleto.nombre} agregado`)
              }
            }}
          />
        )}

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
                          className="rounded-full w-8 h-8 p-0 bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg transition-all hover:scale-105 active:scale-95"
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
        {/* Selección de cliente - SIMPLIFICADA */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="w-4 h-4" />
              Cliente (opcional)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Select
              value={clienteSeleccionado}
              onValueChange={setClienteSeleccionado}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Consumidor Final" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="consumidor_final">
                  Consumidor Final
                </SelectItem>
                {clientes.map((cliente) => (
                  <SelectItem key={cliente.id} value={cliente.id}>
                    {cliente.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Dejar vacío para venta sin factura
            </p>
          </CardContent>
        </Card>


        {/* Carrito */}
        <Card className="border-primary/20 shadow-xl bg-gradient-to-br from-white to-primary/5 dark:from-background dark:to-primary/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
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
              <div>
                <div className="space-y-3">
                  {carrito.map((item) => {
                    const listaActual = item.listaPrecioId ? listasPrecio.find((l) => l.id === item.listaPrecioId) : null

                    return (
                      <div
                        key={item.productoId}
                        className="bg-white/60 dark:bg-black/20 backdrop-blur-md border border-white/40 dark:border-white/10 rounded-xl p-3 space-y-2 shadow-sm transition-all hover:shadow-md"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {item.producto.nombre}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.producto.codigo}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-sm">
                              ${item.precioUnitario.toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              / {item.producto.unidadMedida}
                            </p>
                          </div>
                        </div>
                        {/* Selector de lista - OCULTO EN MODO SIMPLE */}
                        {!MODO_VENTA_RAPIDA && (
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Lista de precio:</Label>
                            <Select
                              value={item.listaPrecioId || 'none'}
                              onValueChange={(listaId) => {
                                actualizarPrecioItem(item.productoId, listaId)
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Sin lista (precio base)" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Sin lista (precio base)</SelectItem>
                                {listasPrecio.map((lista) => (
                                  <SelectItem key={lista.id} value={lista.id}>
                                    {lista.nombre}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2">
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
                        </div>
                        <div className="w-20 text-right font-medium">
                          ${item.subtotal.toFixed(2)}
                        </div>
                      </div>
                    )
                  })}
                </div>

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

                {/* Botón de cobrar - GRANDE Y VERDE */}
                <Button
                  className="w-full h-14 text-xl font-bold bg-green-600 hover:bg-green-700"
                  onClick={procesarVenta}
                  disabled={procesandoVenta || carrito.length === 0}
                >
                  {procesandoVenta ? (
                    <>
                      <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-6 h-6 mr-2" />
                      COBRAR ${totalCarrito.toFixed(2)}
                    </>
                  )}
                </Button>

                {/* Info de cliente (no bloquea) */}
                {!clienteSeleccionado && (
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Venta como Consumidor Final
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


