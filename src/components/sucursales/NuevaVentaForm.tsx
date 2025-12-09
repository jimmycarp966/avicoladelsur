'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Plus,
  Trash2,
  DollarSign,
  Loader2,
  Search,
  Barcode,
  AlertCircle,
  CreditCard,
  Tag,
  User,
  X,
  Printer,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  registrarVentaSucursalConControlAction,
  obtenerPrecioProductoAction,
  obtenerInfoCreditoClienteAction,
  validarLimiteCreditoAction,
} from '@/actions/ventas-sucursal.actions'
import { generarTicketTermicoAction } from '@/actions/pos-sucursal.actions'

// ===========================================
// SCHEMAS Y TIPOS
// ===========================================

const ventaSchema = z.object({
  clienteId: z.string().optional().or(z.literal('none')), // Opcional para venta genérica
  cajaId: z.string().min(1, 'Selecciona una caja'),
  listaPrecioId: z.string().min(1, 'Selecciona una lista de precios'),
  tipoComprobante: z.enum(['ticket', 'factura_a', 'factura_b']),
  items: z.array(z.object({
    productoId: z.string().min(1, 'Selecciona un producto'),
    cantidad: z.number().min(0.001, 'Cantidad requerida'),
    precioUnitario: z.number().min(0, 'Precio requerido'),
  })).min(1, 'Agrega al menos un producto'),
  pagos: z.array(z.object({
    metodoPago: z.enum(['efectivo', 'transferencia', 'tarjeta', 'mercado_pago', 'cuenta_corriente']),
    monto: z.number().min(0.01, 'Monto debe ser mayor a 0'),
  })).min(1, 'Agrega al menos un método de pago'),
}).refine((data) => {
  // Validar que la suma de pagos coincida con el total
  const totalItems = data.items.reduce((sum, item) => sum + (item.cantidad * item.precioUnitario), 0)
  const totalPagos = data.pagos.reduce((sum, pago) => sum + pago.monto, 0)
  return Math.abs(totalPagos - totalItems) < 0.01
}, {
  message: 'La suma de los pagos debe coincidir con el total',
  path: ['pagos'],
})

type VentaFormData = z.infer<typeof ventaSchema>

interface NuevaVentaFormProps {
  productos: Array<{
    id: string
    nombre: string
    codigo: string
    precioVenta: number
    unidadMedida: string
    stockDisponible: number
  }>
  clientes: Array<{
    id: string
    nombre: string
    codigo: string
  }>
  cajas: Array<{
    id: string
    nombre: string
    saldo_actual: number
  }>
  listasPrecios: Array<{
    id: string
    codigo: string
    nombre: string
    tipo: string
    margen_ganancia: number | null
  }>
  sucursalId: string
}

// ===========================================
// COMPONENTE PRINCIPAL
// ===========================================

export function NuevaVentaForm({
  productos,
  clientes,
  cajas,
  listasPrecios,
  sucursalId,
}: NuevaVentaFormProps) {
  const [mounted, setMounted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [busquedaProducto, setBusquedaProducto] = useState('')
  const [codigoBarras, setCodigoBarras] = useState('')
  const [cargandoPrecios, setCargandoPrecios] = useState<string | null>(null)
  const [validandoCredito, setValidandoCredito] = useState(false)
  const [saldoCliente, setSaldoCliente] = useState<{
    saldo: number
    limite: number
    bloqueado: boolean
  } | null>(null)
  const barcodeInputRef = useRef<HTMLInputElement>(null)

  // Evitar problemas de hidratación con componentes Select
  useEffect(() => {
    setMounted(true)
  }, [])

  const form = useForm<VentaFormData>({
    resolver: zodResolver(ventaSchema),
    defaultValues: {
      clienteId: undefined,
      cajaId: cajas[0]?.id || '',
      listaPrecioId: listasPrecios[0]?.id || '',
      tipoComprobante: 'ticket',
      items: [],
      pagos: [],
    },
  })

  const { fields: itemsFields, append: appendItem, remove: removeItem } = useFieldArray({
    control: form.control,
    name: 'items',
  })

  const { fields: pagosFields, append: appendPago, remove: removePago } = useFieldArray({
    control: form.control,
    name: 'pagos',
  })

  const watchedItems = form.watch('items')
  const watchedPagos = form.watch('pagos')
  const watchedListaPrecio = form.watch('listaPrecioId')
  const watchedCliente = form.watch('clienteId')

  // Calcular totales
  const subtotal = watchedItems.reduce((sum, item) => {
    return sum + (item.cantidad * item.precioUnitario)
  }, 0)

  const totalPagos = watchedPagos.reduce((sum, pago) => sum + pago.monto, 0)
  const diferencia = subtotal - totalPagos

  // Agregar método de pago
  const agregarMetodoPago = useCallback(() => {
    appendPago({
      metodoPago: 'efectivo',
      monto: diferencia > 0 ? diferencia : 0,
    })
  }, [diferencia, appendPago])

  // Actualizar precios cuando cambia la lista
  useEffect(() => {
    if (watchedListaPrecio && watchedItems.length > 0) {
      const actualizarPrecios = async () => {
        setCargandoPrecios('actualizando')
        for (let i = 0; i < watchedItems.length; i++) {
          const item = watchedItems[i]
          if (item.productoId) {
            try {
              const result = await obtenerPrecioProductoAction(watchedListaPrecio, item.productoId)
              if (result.success && result.data) {
                form.setValue(`items.${i}.precioUnitario`, result.data.precio)
              }
            } catch (error) {
              console.error('Error al actualizar precio:', error)
            }
          }
        }
        setCargandoPrecios(null)
      }
      actualizarPrecios()
    }
  }, [watchedListaPrecio])

  // Obtener información del cliente cuando se selecciona
  useEffect(() => {
    const obtenerInfoCliente = async () => {
      if (watchedCliente) {
        try {
          const result = await obtenerInfoCreditoClienteAction(watchedCliente)
          if (result.success && result.data) {
            setSaldoCliente({
              saldo: result.data.saldo,
              limite: result.data.limiteCredito,
              bloqueado: result.data.bloqueado,
            })
          }
        } catch (error) {
          console.error('Error al obtener información del cliente:', error)
          setSaldoCliente(null)
        }
      } else {
        setSaldoCliente(null)
      }
    }
    obtenerInfoCliente()
  }, [watchedCliente])

  // Atajos de teclado
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // F1: Cobrar
      if (e.key === 'F1' && !isSubmitting && itemsFields.length > 0 && pagosFields.length > 0) {
        e.preventDefault()
        form.handleSubmit(onSubmit)()
      }
      
      // F2: Agregar método de pago
      if (e.key === 'F2' && diferencia > 0.01) {
        e.preventDefault()
        agregarMetodoPago()
      }
      
      // F3: Agregar producto (focus en búsqueda)
      if (e.key === 'F3') {
        e.preventDefault()
        // Focus en búsqueda
        document.querySelector<HTMLInputElement>('input[placeholder*="Buscar"]')?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isSubmitting, itemsFields.length, pagosFields.length, diferencia, form, onSubmit, agregarMetodoPago])

  // Manejar escáner de código de barras
  const handleCodigoBarras = useCallback(async (codigo: string) => {
    if (!codigo.trim()) return

    const producto = productos.find(p => 
      p.codigo.toLowerCase() === codigo.toLowerCase().trim()
    )

    if (!producto) {
      toast.error(`Producto con código ${codigo} no encontrado`)
      setCodigoBarras('')
      return
    }

    // Verificar si ya está en el carrito
    const itemExistente = watchedItems.findIndex(item => item.productoId === producto.id)
    
    if (itemExistente >= 0) {
      // Incrementar cantidad
      const cantidadActual = watchedItems[itemExistente].cantidad
      form.setValue(`items.${itemExistente}.cantidad`, cantidadActual + 1)
      toast.success(`${producto.nombre} - Cantidad aumentada`)
    } else {
      // Obtener precio de la lista actual
      let precio = producto.precioVenta
      if (watchedListaPrecio) {
        try {
          const result = await obtenerPrecioProductoAction(watchedListaPrecio, producto.id)
          if (result.success && result.data) {
            precio = result.data.precio
          }
        } catch (error) {
          console.error('Error al obtener precio:', error)
        }
      }

      // Agregar producto
      appendItem({
        productoId: producto.id,
        cantidad: 1,
        precioUnitario: precio,
      })
      toast.success(`${producto.nombre} agregado`)
    }

    setCodigoBarras('')
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus()
    }
  }, [productos, watchedItems, watchedListaPrecio, form, appendItem])

  // Agregar producto por búsqueda
  const agregarProducto = useCallback(async (productoId: string) => {
    const producto = productos.find(p => p.id === productoId)
    if (!producto) return

    // Verificar stock
    if (producto.stockDisponible <= 0) {
      toast.error('Stock insuficiente')
      return
    }

    // Obtener precio de la lista
    let precio = producto.precioVenta
    if (watchedListaPrecio) {
      try {
        const result = await obtenerPrecioProductoAction(watchedListaPrecio, producto.id)
        if (result.success && result.data) {
          precio = result.data.precio
        }
      } catch (error) {
        console.error('Error al obtener precio:', error)
      }
    }

    appendItem({
      productoId: producto.id,
      cantidad: 1,
      precioUnitario: precio,
    })

    setBusquedaProducto('')
  }, [productos, watchedListaPrecio, appendItem])

  // Validar crédito antes de enviar
  const validarCredito = async (): Promise<boolean> => {
    if (!watchedCliente) return true // Venta genérica, no requiere validación

    const pagoCredito = watchedPagos.find(p => p.metodoPago === 'cuenta_corriente')
    if (!pagoCredito) return true // No hay pago a crédito

    // Si está bloqueado, no permitir
    if (saldoCliente?.bloqueado) {
      toast.error('El cliente está bloqueado por deuda')
      return false
    }

    setValidandoCredito(true)
    try {
      const result = await validarLimiteCreditoAction(watchedCliente, pagoCredito.monto)
      
      if (!result.success || !result.data) {
        toast.error(result.error || 'Error al validar crédito')
        return false
      }

      const { permiteVenta, saldoActual, limiteCredito } = result.data
      if (!permiteVenta) {
        toast.error(
          `La venta excede el límite de crédito. Saldo: $${(saldoActual ?? 0).toFixed(2)} / Límite: $${(limiteCredito ?? 0).toFixed(2)}`
        )
        return false
      }

      return true
    } catch (error) {
      console.error('Error al validar crédito:', error)
      toast.error('Error al validar crédito del cliente')
      return false
    } finally {
      setValidandoCredito(false)
    }
  }

  // Enviar formulario
  async function onSubmit(data: VentaFormData) {
    // Validar stock
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i]
      const producto = productos.find(p => p.id === item.productoId)

      if (!producto) {
        toast.error(`Producto ${item.productoId} no encontrado`)
        return
      }

      if (item.cantidad > producto.stockDisponible) {
        toast.error(`Stock insuficiente para ${producto.nombre}. Disponible: ${producto.stockDisponible}`)
        return
      }
    }

    // Validar crédito
    const creditoValido = await validarCredito()
    if (!creditoValido) {
      toast.error('La venta excede el límite de crédito del cliente')
      return
    }

    setIsSubmitting(true)

    try {
      const result = await registrarVentaSucursalConControlAction({
        sucursalId,
        clienteId: data.clienteId || undefined,
        listaPrecioId: data.listaPrecioId,
        items: data.items.map(item => ({
          productoId: item.productoId,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
        })),
        cajaId: data.cajaId,
        pago: {
          pagos: data.pagos,
        },
      })

    if (result.success && result.data) {
      const ventaRegistrada = result.data
      const pedidoId = ventaRegistrada.pedidoId

        toast.success(
          <div className="space-y-1">
            <p className="font-semibold">¡Venta registrada!</p>
          <p className="text-sm">Pedido: {ventaRegistrada.numeroPedido}</p>
          <p className="text-sm">Total: ${ventaRegistrada.total.toFixed(2)}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={async () => {
                const ticketResult = await generarTicketTermicoAction(pedidoId)
                if (ticketResult.success && ticketResult.data) {
                  const pdfArrayBuffer = ticketResult.data instanceof ArrayBuffer
                    ? ticketResult.data
                    : new Uint8Array(ticketResult.data as ArrayLike<number>).buffer
                  const blob = new Blob([pdfArrayBuffer], { type: 'application/pdf' })
                  const url = window.URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                a.download = `ticket-${ventaRegistrada.numeroPedido}.pdf`
                  document.body.appendChild(a)
                  a.click()
                  window.URL.revokeObjectURL(url)
                  document.body.removeChild(a)
                  toast.success('Ticket generado')
                }
              }}
            >
              <Printer className="w-4 h-4 mr-2" />
              Imprimir Ticket
            </Button>
          </div>,
          { duration: 5000 }
        )

        // Limpiar formulario
        form.reset({
          clienteId: '',
          cajaId: cajas[0]?.id || '',
          listaPrecioId: listasPrecios[0]?.id || '',
          tipoComprobante: 'ticket',
          items: [],
          pagos: [],
        })
        setBusquedaProducto('')
        setCodigoBarras('')
        
        // Auto-imprimir si está configurado (opcional)
        // const autoImprimir = localStorage.getItem('pos_auto_imprimir') === 'true'
        // if (autoImprimir && data.tipoComprobante === 'ticket') {
        //   handleImprimir(pedidoId, 'ticket')
        // }

        // Recargar página
        setTimeout(() => window.location.reload(), 2000)
      } else {
        toast.error(result.error || 'Error al registrar venta')
      }
    } catch (error) {
      toast.error('Error inesperado al registrar venta')
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Productos filtrados
  const productosFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase()) ||
    p.codigo.toLowerCase().includes(busquedaProducto.toLowerCase())
  ).slice(0, 10) // Limitar a 10 resultados

  // Evitar problemas de hidratación - solo renderizar después de montar
  if (!mounted) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Header: Búsqueda rápida y escáner */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Escáner de código de barras */}
          <div className="space-y-2">
            <FormLabel className="flex items-center gap-2">
              <Barcode className="w-4 h-4" />
              Escáner de Código de Barras
            </FormLabel>
            <Input
              ref={barcodeInputRef}
              placeholder="Escanear código..."
              value={codigoBarras}
              onChange={(e) => setCodigoBarras(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleCodigoBarras(codigoBarras)
                }
              }}
              className="font-mono text-lg"
              autoFocus
            />
          </div>

          {/* Búsqueda de productos */}
          <div className="space-y-2 relative">
            <FormLabel className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              Buscar Producto
            </FormLabel>
            <div className="relative">
              <Input
                placeholder="Buscar por nombre o código..."
                value={busquedaProducto}
                onChange={(e) => setBusquedaProducto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && productosFiltrados.length === 1) {
                    e.preventDefault()
                    agregarProducto(productosFiltrados[0].id)
                  }
                }}
              />
              {busquedaProducto && productosFiltrados.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {productosFiltrados.map((producto) => (
                    <button
                      key={producto.id}
                      type="button"
                      onClick={() => agregarProducto(producto.id)}
                      className="w-full text-left p-3 hover:bg-gray-100 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium">{producto.nombre}</p>
                        <p className="text-sm text-muted-foreground">
                          {producto.codigo} • Stock: {producto.stockDisponible} {producto.unidadMedida}
                        </p>
                      </div>
                      <Badge variant={producto.stockDisponible > 0 ? 'default' : 'destructive'}>
                        ${producto.precioVenta.toFixed(2)}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Información básica */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Cliente (opcional) */}
          <FormField
            control={form.control}
            name="clienteId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Cliente (Opcional)
                </FormLabel>
                <Select onValueChange={(value) => field.onChange(value === 'none' ? undefined : value)} value={field.value || 'none'}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Venta genérica (sin cliente)" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">Venta genérica</SelectItem>
                    {clientes.map((cliente) => (
                      <SelectItem key={cliente.id} value={cliente.id}>
                        {cliente.nombre}
                        {cliente.codigo && ` (${cliente.codigo})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
                {saldoCliente && (
                  <div className="text-xs text-muted-foreground">
                    Saldo: ${saldoCliente.saldo.toFixed(2)} / Límite: ${saldoCliente.limite.toFixed(2)}
                  </div>
                )}
              </FormItem>
            )}
          />

          {/* Lista de precios */}
          <FormField
            control={form.control}
            name="listaPrecioId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Lista de Precios
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar lista" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {listasPrecios.map((lista) => (
                      <SelectItem key={lista.id} value={lista.id}>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {lista.tipo}
                          </Badge>
                          {lista.nombre}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Caja */}
          <FormField
            control={form.control}
            name="cajaId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Caja</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar caja" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {cajas.map((caja) => (
                      <SelectItem key={caja.id} value={caja.id}>
                        {caja.nombre} - ${caja.saldo_actual?.toFixed(2) || '0.00'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Tipo de comprobante */}
          <FormField
            control={form.control}
            name="tipoComprobante"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Comprobante</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="ticket">Ticket</SelectItem>
                    <SelectItem value="factura_a">Factura A</SelectItem>
                    <SelectItem value="factura_b">Factura B</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Carrito de productos */}
        <Card>
          <CardHeader>
            <CardTitle>Carrito de Productos</CardTitle>
          </CardHeader>
          <CardContent>
            {itemsFields.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No hay productos en el carrito</p>
                <p className="text-sm mt-2">Usa el escáner o busca productos arriba</p>
              </div>
            ) : (
              <div className="space-y-3">
                {itemsFields.map((field, index) => {
                  const producto = productos.find(p => p.id === watchedItems[index]?.productoId)
                  return (
                    <div
                      key={field.id}
                      className="flex items-center gap-4 p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{producto?.nombre || 'Producto'}</p>
                        <p className="text-sm text-muted-foreground">
                          {producto?.codigo} • Stock: {producto?.stockDisponible} {producto?.unidadMedida}
                        </p>
                      </div>

                    <FormField
                      control={form.control}
                      name={`items.${index}.cantidad`}
                      render={({ field }) => (
                        <FormItem className="w-32">
                          <FormControl>
                            <Input
                              type="number"
                              step="0.001"
                              min="0.001"
                              {...field}
                              value={field.value || ''}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0
                                field.onChange(val)
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  // Auto-focus siguiente campo o botón cobrar
                                }
                              }}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                      <FormField
                        control={form.control}
                        name={`items.${index}.precioUnitario`}
                        render={({ field }) => (
                          <FormItem className="w-32">
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                {...field}
                                value={field.value || ''}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0
                                  field.onChange(val)
                                }}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <div className="w-24 text-right font-medium">
                        ${((watchedItems[index]?.cantidad || 0) * (watchedItems[index]?.precioUnitario || 0)).toFixed(2)}
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  )
                })}

                <Separator />

                <div className="flex justify-end text-lg font-bold">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Subtotal: ${subtotal.toFixed(2)}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Métodos de pago */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Métodos de Pago</CardTitle>
              {diferencia > 0.01 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={agregarMetodoPago}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Pago (${diferencia.toFixed(2)})
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {pagosFields.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <p>No hay métodos de pago agregados</p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2"
                  onClick={agregarMetodoPago}
                >
                  Agregar Método de Pago
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {pagosFields.map((field, index) => (
                  <div
                    key={field.id}
                    className="flex items-center gap-4 p-3 border rounded-lg"
                  >
                    <FormField
                      control={form.control}
                      name={`pagos.${index}.metodoPago`}
                      render={({ field }) => (
                        <FormItem className="w-48">
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="efectivo">Efectivo</SelectItem>
                              <SelectItem value="transferencia">Transferencia</SelectItem>
                              <SelectItem value="tarjeta">Tarjeta</SelectItem>
                              <SelectItem value="mercado_pago">Mercado Pago</SelectItem>
                              <SelectItem value="cuenta_corriente">Cuenta Corriente</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`pagos.${index}.monto`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              placeholder="Monto"
                              {...field}
                              value={field.value || ''}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0
                                field.onChange(val)
                              }}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {pagosFields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removePago(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-medium">${subtotal.toFixed(2)}</span>
                  </div>
                  {/* Los recargos se calculan en el backend según método de pago */}
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Recargos (se aplican automáticamente):</span>
                    <span>Calculado al cobrar</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total a pagar:</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total pagado:</span>
                    <span className="font-medium">${totalPagos.toFixed(2)}</span>
                  </div>
                  {Math.abs(diferencia) > 0.01 && (
                    <div className={`flex justify-between font-bold ${
                      diferencia > 0 ? 'text-amber-600' : 'text-green-600'
                    }`}>
                      <span>{diferencia > 0 ? 'Falta pagar:' : 'Vuelto:'}</span>
                      <span>${Math.abs(diferencia).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

          {/* Botón de cobrar */}
        <div className="flex items-center justify-end gap-4">
          <div className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="w-6 h-6" />
            Total: ${subtotal.toFixed(2)}
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={isSubmitting || itemsFields.length === 0 || pagosFields.length === 0 || validandoCredito}
              size="lg"
              className="min-w-48"
              title="Presiona F1 para cobrar"
            >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Procesando...
              </>
            ) : validandoCredito ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Validando crédito...
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5 mr-2" />
                Cobrar ${subtotal.toFixed(2)}
              </>
            )}
          </Button>
            {itemsFields.length > 0 && pagosFields.length > 0 && (
              <div className="text-xs text-muted-foreground flex items-center">
                <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded border">F1</kbd>
                <span className="ml-1">Cobrar</span>
              </div>
            )}
          </div>
        </div>

        {/* Advertencias */}
        {watchedCliente && watchedPagos.some(p => p.metodoPago === 'cuenta_corriente') && saldoCliente?.bloqueado && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800">
            <AlertCircle className="w-5 h-5" />
            <p className="text-sm font-medium">Cliente bloqueado por deuda</p>
          </div>
        )}
      </form>
    </Form>
  )
}
