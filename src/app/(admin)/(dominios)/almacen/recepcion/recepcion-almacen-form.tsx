'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDownCircle, ArrowUpCircle, Package, Search, X } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'

interface RecepcionAlmacenFormProps {
  productos: Array<{ id: string; nombre: string; codigo: string; unidad_medida: string; categoria?: string }>
  lotes: Array<{ id: string; numero_lote: string; producto_id: string; cantidad_disponible: number; proveedor?: string }>
  categorias: string[]
  proveedores: string[]
}

export function RecepcionAlmacenForm({ productos, lotes, categorias, proveedores }: RecepcionAlmacenFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [tipo, setTipo] = useState<'ingreso' | 'egreso'>('ingreso')
  const [productoId, setProductoId] = useState('')
  const [loteId, setLoteId] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [unidadMedida, setUnidadMedida] = useState('kg')
  const [motivo, setMotivo] = useState('')
  const [destinoProduccion, setDestinoProduccion] = useState(false)
  
  // Filtros de búsqueda
  const [busquedaProducto, setBusquedaProducto] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('all')
  const [filtroProveedor, setFiltroProveedor] = useState<string>('all')

  // Filtrar productos por búsqueda, categoría y proveedor
  const productosFiltrados = useMemo(() => {
    let filtrados = productos

    // Filtro por búsqueda (nombre o código)
    if (busquedaProducto) {
      const busqueda = busquedaProducto.toLowerCase()
      filtrados = filtrados.filter(p => 
        p.nombre.toLowerCase().includes(busqueda) ||
        p.codigo.toLowerCase().includes(busqueda)
      )
    }

    // Filtro por categoría
    if (filtroCategoria && filtroCategoria !== 'all') {
      filtrados = filtrados.filter(p => p.categoria === filtroCategoria)
    }

    // Filtro por proveedor (a través de lotes)
    if (filtroProveedor && filtroProveedor !== 'all') {
      const productosConProveedor = lotes
        .filter(l => l.proveedor === filtroProveedor)
        .map(l => l.producto_id)
      filtrados = filtrados.filter(p => productosConProveedor.includes(p.id))
    }

    return filtrados
  }, [productos, lotes, busquedaProducto, filtroCategoria, filtroProveedor])

  // Filtrar lotes por producto seleccionado
  const lotesFiltrados = useMemo(() => {
    if (!productoId) return []
    return lotes.filter(l => l.producto_id === productoId)
  }, [lotes, productoId])

  // Obtener unidad de medida del producto seleccionado y asignarla automáticamente
  const productoSeleccionado = productos.find(p => p.id === productoId)
  const unidadMedidaProducto = productoSeleccionado?.unidad_medida || 'kg'

  // Efecto para asignar automáticamente la unidad de medida cuando se selecciona un producto
  useEffect(() => {
    if (productoId && productoSeleccionado) {
      // Asignar siempre la unidad de medida del producto (no permitir cambios)
      setUnidadMedida(productoSeleccionado.unidad_medida)
    } else if (!productoId) {
      // Si no hay producto seleccionado, resetear a kg
      setUnidadMedida('kg')
    }
  }, [productoId, productoSeleccionado])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!productoId || !cantidad || !motivo) {
        toast.error('Completa todos los campos requeridos')
        setLoading(false)
        return
      }

      if (tipo === 'ingreso' && !loteId) {
        toast.error('Selecciona un lote para el ingreso')
        setLoading(false)
        return
      }

      const response = await fetch('/api/almacen/recepcion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          producto_id: productoId,
          lote_id: tipo === 'ingreso' ? loteId : undefined,
          cantidad: parseFloat(cantidad),
          unidad_medida: unidadMedida || unidadMedidaProducto,
          motivo,
          destino_produccion: tipo === 'egreso' ? destinoProduccion : false,
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast.success(result.message || 'Recepción registrada exitosamente')
        // Limpiar formulario
        setProductoId('')
        setLoteId('')
        setCantidad('')
        setMotivo('')
        setDestinoProduccion(false)
        setBusquedaProducto('')
        setFiltroCategoria('')
        setFiltroProveedor('')
        setUnidadMedida('kg') // Se reseteará automáticamente con el useEffect
        router.refresh()
      } else {
        toast.error(result.message || 'Error al registrar recepción')
      }
    } catch (error) {
      toast.error('Error inesperado al registrar recepción')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Registrar Recepción
        </CardTitle>
        <CardDescription>
          Registra ingresos o egresos de productos en almacén
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={tipo} onValueChange={(value) => setTipo(value as 'ingreso' | 'egreso')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ingreso" className="flex items-center gap-2">
              <ArrowDownCircle className="h-4 w-4" />
              Ingreso
            </TabsTrigger>
            <TabsTrigger value="egreso" className="flex items-center gap-2">
              <ArrowUpCircle className="h-4 w-4" />
              Egreso
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ingreso" className="space-y-4 mt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Filtros de búsqueda mejorados */}
              <div className="p-4 bg-muted/50 rounded-lg border space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-semibold">Filtros de Búsqueda</Label>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="busqueda-producto">Buscar por Nombre o Código</Label>
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="busqueda-producto"
                        placeholder="Nombre o código..."
                        value={busquedaProducto}
                        onChange={(e) => setBusquedaProducto(e.target.value)}
                        className="pl-8"
                      />
                      {busquedaProducto && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1 h-6 w-6 p-0"
                          onClick={() => setBusquedaProducto('')}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="filtro-categoria">Filtrar por Categoría</Label>
                    <Select value={filtroCategoria || 'all'} onValueChange={setFiltroCategoria}>
                      <SelectTrigger id="filtro-categoria">
                        <SelectValue placeholder="Todas las categorías" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las categorías</SelectItem>
                        {categorias.map(cat => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="filtro-proveedor">Filtrar por Proveedor</Label>
                    <Select value={filtroProveedor || 'all'} onValueChange={setFiltroProveedor}>
                      <SelectTrigger id="filtro-proveedor">
                        <SelectValue placeholder="Todos los proveedores" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los proveedores</SelectItem>
                        {proveedores.map(prov => (
                          <SelectItem key={prov} value={prov}>
                            {prov}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {(busquedaProducto || filtroCategoria || filtroProveedor) && (
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setBusquedaProducto('')
                        setFiltroCategoria('')
                        setFiltroProveedor('')
                      }}
                      className="text-xs"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Limpiar filtros
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {productosFiltrados.length} producto{productosFiltrados.length !== 1 ? 's' : ''} encontrado{productosFiltrados.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="producto-ingreso">Producto *</Label>
                  <Select 
                    value={productoId} 
                    onValueChange={(value) => {
                      setProductoId(value)
                      // Limpiar lote cuando cambia el producto
                      setLoteId('')
                      // La unidad de medida se asignará automáticamente vía useEffect
                    }} 
                    required
                  >
                    <SelectTrigger id="producto-ingreso">
                      <SelectValue placeholder="Selecciona un producto" />
                    </SelectTrigger>
                    <SelectContent>
                      {productosFiltrados.length > 0 ? (
                        productosFiltrados.map(producto => (
                          <SelectItem key={producto.id} value={producto.id}>
                            {producto.nombre} ({producto.codigo})
                            {producto.categoria && ` - ${producto.categoria}`}
                            {producto.unidad_medida && ` [${producto.unidad_medida}]`}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          {busquedaProducto || filtroCategoria || filtroProveedor 
                            ? 'No se encontraron productos con los filtros aplicados'
                            : 'No hay productos disponibles'}
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lote-ingreso">Lote *</Label>
                  <Select
                    value={loteId}
                    onValueChange={setLoteId}
                    required
                    disabled={!productoId || lotesFiltrados.length === 0}
                  >
                    <SelectTrigger id="lote-ingreso">
                      <SelectValue
                        placeholder={
                          !productoId
                            ? 'Primero selecciona un producto'
                            : lotesFiltrados.length === 0
                            ? 'No hay lotes disponibles'
                            : 'Selecciona un lote'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {lotesFiltrados.map(lote => (
                        <SelectItem key={lote.id} value={lote.id}>
                          {lote.numero_lote} (Disponible: {lote.cantidad_disponible})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cantidad-ingreso">Cantidad *</Label>
                  <Input
                    id="cantidad-ingreso"
                    type="number"
                    step="0.001"
                    min="0"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    placeholder="0.000"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unidad-ingreso">
                    Unidad de Medida *
                    {productoSeleccionado && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        (asignada automáticamente)
                      </span>
                    )}
                  </Label>
                  <Select 
                    value={unidadMedida || unidadMedidaProducto} 
                    onValueChange={setUnidadMedida} 
                    required
                    disabled={!!productoSeleccionado}
                  >
                    <SelectTrigger id="unidad-ingreso" className={productoSeleccionado ? "bg-muted" : ""}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">Kilogramos (kg)</SelectItem>
                      <SelectItem value="g">Gramos (g)</SelectItem>
                      <SelectItem value="docena">Docena</SelectItem>
                      <SelectItem value="unidad">Unidades</SelectItem>
                      <SelectItem value="litro">Litros (L)</SelectItem>
                      <SelectItem value="ml">Mililitros (ml)</SelectItem>
                    </SelectContent>
                  </Select>
                  {productoSeleccionado && (
                    <p className="text-xs text-primary font-medium flex items-center gap-1">
                      ✓ Unidad del producto: <span className="font-semibold">{productoSeleccionado.unidad_medida}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="motivo-ingreso">Motivo *</Label>
                <Select value={motivo} onValueChange={setMotivo} required>
                  <SelectTrigger id="motivo-ingreso">
                    <SelectValue placeholder="Selecciona un motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compra">Compra</SelectItem>
                    <SelectItem value="produccion">Producción</SelectItem>
                    <SelectItem value="ajuste">Ajuste de inventario</SelectItem>
                    <SelectItem value="devolucion">Devolución</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Registrando...' : 'Registrar Ingreso'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="egreso" className="space-y-4 mt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Filtros de búsqueda mejorados */}
              <div className="p-4 bg-muted/50 rounded-lg border space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-semibold">Filtros de Búsqueda</Label>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="busqueda-producto-egreso">Buscar por Nombre o Código</Label>
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="busqueda-producto-egreso"
                        placeholder="Nombre o código..."
                        value={busquedaProducto}
                        onChange={(e) => setBusquedaProducto(e.target.value)}
                        className="pl-8"
                      />
                      {busquedaProducto && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1 h-6 w-6 p-0"
                          onClick={() => setBusquedaProducto('')}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="filtro-categoria-egreso">Filtrar por Categoría</Label>
                    <Select value={filtroCategoria || 'all'} onValueChange={setFiltroCategoria}>
                      <SelectTrigger id="filtro-categoria-egreso">
                        <SelectValue placeholder="Todas las categorías" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las categorías</SelectItem>
                        {categorias.map(cat => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="filtro-proveedor-egreso">Filtrar por Proveedor</Label>
                    <Select value={filtroProveedor || 'all'} onValueChange={setFiltroProveedor}>
                      <SelectTrigger id="filtro-proveedor-egreso">
                        <SelectValue placeholder="Todos los proveedores" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los proveedores</SelectItem>
                        {proveedores.map(prov => (
                          <SelectItem key={prov} value={prov}>
                            {prov}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {(busquedaProducto || filtroCategoria || filtroProveedor) && (
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setBusquedaProducto('')
                        setFiltroCategoria('')
                        setFiltroProveedor('')
                      }}
                      className="text-xs"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Limpiar filtros
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {productosFiltrados.length} producto{productosFiltrados.length !== 1 ? 's' : ''} encontrado{productosFiltrados.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="producto-egreso">Producto *</Label>
                <Select 
                  value={productoId} 
                  onValueChange={(value) => {
                    setProductoId(value)
                    // La unidad de medida se asignará automáticamente vía useEffect
                  }} 
                  required
                >
                  <SelectTrigger id="producto-egreso">
                    <SelectValue placeholder="Selecciona un producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {productosFiltrados.length > 0 ? (
                      productosFiltrados.map(producto => (
                        <SelectItem key={producto.id} value={producto.id}>
                          {producto.nombre} ({producto.codigo})
                          {producto.categoria && ` - ${producto.categoria}`}
                          {producto.unidad_medida && ` [${producto.unidad_medida}]`}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        {busquedaProducto || filtroCategoria || filtroProveedor 
                          ? 'No se encontraron productos con los filtros aplicados'
                          : 'No hay productos disponibles'}
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cantidad-egreso">Cantidad *</Label>
                  <Input
                    id="cantidad-egreso"
                    type="number"
                    step="0.001"
                    min="0"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    placeholder="0.000"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unidad-egreso">
                    Unidad de Medida *
                    {productoSeleccionado && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        (asignada automáticamente)
                      </span>
                    )}
                  </Label>
                  <Select 
                    value={unidadMedida || unidadMedidaProducto} 
                    onValueChange={setUnidadMedida} 
                    required
                    disabled={!!productoSeleccionado}
                  >
                    <SelectTrigger id="unidad-egreso" className={productoSeleccionado ? "bg-muted" : ""}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">Kilogramos (kg)</SelectItem>
                      <SelectItem value="g">Gramos (g)</SelectItem>
                      <SelectItem value="docena">Docena</SelectItem>
                      <SelectItem value="unidad">Unidades</SelectItem>
                      <SelectItem value="litro">Litros (L)</SelectItem>
                      <SelectItem value="ml">Mililitros (ml)</SelectItem>
                    </SelectContent>
                  </Select>
                  {productoSeleccionado && (
                    <p className="text-xs text-primary font-medium flex items-center gap-1">
                      ✓ Unidad del producto: <span className="font-semibold">{productoSeleccionado.unidad_medida}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="motivo-egreso">Motivo *</Label>
                <Select value={motivo} onValueChange={setMotivo} required>
                  <SelectTrigger id="motivo-egreso">
                    <SelectValue placeholder="Selecciona un motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="produccion">Producción</SelectItem>
                    <SelectItem value="venta">Venta</SelectItem>
                    <SelectItem value="ajuste">Ajuste de inventario</SelectItem>
                    <SelectItem value="merma">Merma/Pérdida</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="destino-produccion"
                  checked={destinoProduccion}
                  onCheckedChange={(checked) => setDestinoProduccion(checked === true)}
                />
                <Label htmlFor="destino-produccion" className="cursor-pointer">
                  Es para producción (cortes BALANZA)
                </Label>
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Registrando...' : 'Registrar Egreso'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

