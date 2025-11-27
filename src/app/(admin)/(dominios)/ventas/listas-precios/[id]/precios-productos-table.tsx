'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Plus, Save, X, Calculator } from 'lucide-react'
import { useNotificationStore } from '@/store/notificationStore'
import { guardarPrecioProductoAction, obtenerPreciosListaAction } from '@/actions/listas-precios.actions'
import { obtenerProductos } from '@/actions/almacen.actions'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { obtenerListaPrecioAction } from '@/actions/listas-precios.actions'

interface PrecioProducto {
  id: string
  producto_id: string
  precio: number
  activo: boolean
  producto?: {
    id: string
    codigo: string
    nombre: string
    precio_venta: number
    unidad_medida: string
  }
}

interface PreciosProductosTableProps {
  listaId: string
  precios: PrecioProducto[]
  listaInfo?: ListaPrecio
}

interface ListaPrecio {
  margen_ganancia?: number
}

export function PreciosProductosTable({ listaId, precios: preciosIniciales, listaInfo: listaInfoProp }: PreciosProductosTableProps) {
  const { showToast } = useNotificationStore()
  const [precios, setPrecios] = useState(preciosIniciales)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [precioEditado, setPrecioEditado] = useState<number>(0)
  const [agregandoProducto, setAgregandoProducto] = useState(false)
  const [productoSeleccionado, setProductoSeleccionado] = useState('')
  const [nuevoPrecio, setNuevoPrecio] = useState('')
  const [productos, setProductos] = useState<Array<{ id: string; codigo: string; nombre: string; precio_venta: number; precio_costo?: number }>>([])
  const [listaInfo, setListaInfo] = useState<ListaPrecio | null>(listaInfoProp || null)

  const cargarProductos = async () => {
    const [productosResult, listaResult] = await Promise.all([
      obtenerProductos(),
      obtenerListaPrecioAction(listaId)
    ])
    
    if (productosResult.success && productosResult.data) {
      setProductos((productosResult.data as any[]).filter(p => p.activo))
    }
    
    if (listaResult.success && listaResult.data) {
      setListaInfo(listaResult.data as any)
    } else if (listaInfoProp) {
      setListaInfo(listaInfoProp)
    }
  }

  const calcularPrecioConMargen = (productoId: string) => {
    const producto = productos.find(p => p.id === productoId)
    if (!producto || !listaInfo?.margen_ganancia || !producto.precio_costo) {
      return null
    }
    return producto.precio_costo * (1 + listaInfo.margen_ganancia / 100)
  }

  const handleEditar = (precio: PrecioProducto) => {
    setEditandoId(precio.id)
    setPrecioEditado(precio.precio)
  }

  const handleGuardar = async (precioId: string, productoId: string) => {
    const formData = new FormData()
    formData.append('lista_precio_id', listaId)
    formData.append('producto_id', productoId)
    formData.append('precio', precioEditado.toString())
    formData.append('activo', 'true')

    const result = await guardarPrecioProductoAction(formData)
    if (result.success) {
      showToast('success', 'Precio actualizado exitosamente')
      setEditandoId(null)
      // Recargar precios
      const preciosResult = await obtenerPreciosListaAction(listaId)
      if (preciosResult.success && preciosResult.data) {
        setPrecios(preciosResult.data as any)
      }
    } else {
      showToast('error', result.message || 'Error al actualizar precio')
    }
  }

  const handleAgregar = async () => {
    if (!productoSeleccionado || !nuevoPrecio) {
      showToast('error', 'Debes seleccionar un producto e ingresar un precio')
      return
    }

    const formData = new FormData()
    formData.append('lista_precio_id', listaId)
    formData.append('producto_id', productoSeleccionado)
    formData.append('precio', nuevoPrecio)
    formData.append('activo', 'true')

    const result = await guardarPrecioProductoAction(formData)
    if (result.success) {
      showToast('success', 'Precio agregado exitosamente')
      setAgregandoProducto(false)
      setProductoSeleccionado('')
      setNuevoPrecio('')
      // Recargar precios
      const preciosResult = await obtenerPreciosListaAction(listaId)
      if (preciosResult.success && preciosResult.data) {
        setPrecios(preciosResult.data as any)
      }
    } else {
      showToast('error', result.message || 'Error al agregar precio')
    }
  }

  const handleCalcularPreciosMasivo = async () => {
    if (!listaInfo?.margen_ganancia || listaInfo.margen_ganancia <= 0) {
      showToast('error', 'La lista debe tener un margen de ganancia configurado')
      return
    }

    if (!confirm(`¿Calcular precios para todos los productos usando ${listaInfo.margen_ganancia}% de margen?`)) {
      return
    }

    const productosConCosto = productos.filter(p => p.precio_costo && p.precio_costo > 0)
    
    if (productosConCosto.length === 0) {
      showToast('error', 'No hay productos con precio_costo configurado')
      return
    }

    let exitosos = 0
    let errores = 0

    for (const producto of productosConCosto) {
      const precioCalculado = producto.precio_costo! * (1 + listaInfo.margen_ganancia / 100)
      
      const formData = new FormData()
      formData.append('lista_precio_id', listaId)
      formData.append('producto_id', producto.id)
      formData.append('precio', precioCalculado.toFixed(2))
      formData.append('activo', 'true')

      const result = await guardarPrecioProductoAction(formData)
      if (result.success) {
        exitosos++
      } else {
        errores++
      }
    }

    showToast(
      exitosos > 0 ? 'success' : 'error',
      `Precios calculados: ${exitosos} exitosos${errores > 0 ? `, ${errores} errores` : ''}`
    )

    // Recargar precios
    const preciosResult = await obtenerPreciosListaAction(listaId)
    if (preciosResult.success && preciosResult.data) {
      setPrecios(preciosResult.data as any)
    }
  }

  if (precios.length === 0 && !agregandoProducto) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8 text-muted-foreground">
          No hay precios configurados para esta lista
        </div>
        <div className="flex gap-2 justify-center">
          <Button
            onClick={() => {
              setAgregandoProducto(true)
              cargarProductos()
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Agregar Primer Producto
          </Button>
          {listaInfo?.margen_ganancia && listaInfo.margen_ganancia > 0 && (
            <Button
              variant="outline"
              onClick={async () => {
                await cargarProductos()
                handleCalcularPreciosMasivo()
              }}
            >
              <Calculator className="mr-2 h-4 w-4" />
              Calcular Todos desde Margen ({listaInfo.margen_ganancia}%)
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Precio Base</TableHead>
              <TableHead>Precio en Lista</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {precios.map((precio) => (
              <TableRow key={precio.id}>
                <TableCell className="font-medium">
                  {precio.producto?.codigo || 'N/A'}
                </TableCell>
                <TableCell>{precio.producto?.nombre || 'N/A'}</TableCell>
                <TableCell>
                  {precio.producto?.precio_venta 
                    ? formatCurrency(precio.producto.precio_venta)
                    : 'N/A'}
                </TableCell>
                <TableCell>
                  {editandoId === precio.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={precioEditado}
                        onChange={(e) => setPrecioEditado(parseFloat(e.target.value) || 0)}
                        className="w-32"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleGuardar(precio.id, precio.producto_id)}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditandoId(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <span className="font-medium">
                      {formatCurrency(precio.precio)}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {editandoId !== precio.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditar(precio)}
                    >
                      Editar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {agregandoProducto && (
        <Card>
          <CardHeader>
            <CardTitle>Agregar Producto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select value={productoSeleccionado} onValueChange={(value) => {
                setProductoSeleccionado(value)
                // Si hay margen configurado, calcular precio automáticamente
                const precioCalculado = calcularPrecioConMargen(value)
                if (precioCalculado !== null) {
                  setNuevoPrecio(precioCalculado.toFixed(2))
                } else {
                  setNuevoPrecio('')
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar producto" />
                </SelectTrigger>
                <SelectContent>
                  {productos
                    .filter(p => !precios.some(pr => pr.producto_id === p.id))
                    .map((producto) => {
                      const precioCalculado = calcularPrecioConMargen(producto.id)
                      return (
                        <SelectItem key={producto.id} value={producto.id}>
                          {producto.codigo} - {producto.nombre}
                          {precioCalculado !== null && ` ($${precioCalculado.toFixed(2)})`}
                        </SelectItem>
                      )
                    })}
                </SelectContent>
              </Select>
              <div className="flex-1">
                <Input
                  type="number"
                  step="0.01"
                  placeholder={
                    listaInfo?.margen_ganancia 
                      ? `Precio (se calculará con ${listaInfo.margen_ganancia}% de margen)` 
                      : "Precio"
                  }
                  value={nuevoPrecio}
                  onChange={(e) => setNuevoPrecio(e.target.value)}
                />
                {listaInfo?.margen_ganancia && productoSeleccionado && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {(() => {
                      const producto = productos.find(p => p.id === productoSeleccionado)
                      const precioCalc = calcularPrecioConMargen(productoSeleccionado)
                      if (precioCalc !== null && producto?.precio_costo) {
                        return `Costo: $${producto.precio_costo.toFixed(2)} → Precio: $${precioCalc.toFixed(2)} (${listaInfo.margen_ganancia}% margen)`
                      }
                      return 'Ingresa precio manualmente (producto sin costo configurado)'
                    })()}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAgregar}>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAgregandoProducto(false)
                    setProductoSeleccionado('')
                    setNuevoPrecio('')
                  }}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancelar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        {!agregandoProducto && (
          <Button
            onClick={() => {
              setAgregandoProducto(true)
              cargarProductos()
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Agregar Producto
          </Button>
        )}
        {listaInfo?.margen_ganancia && listaInfo.margen_ganancia > 0 && (
          <Button
            variant="outline"
            onClick={async () => {
              await cargarProductos()
              handleCalcularPreciosMasivo()
            }}
          >
            <Calculator className="mr-2 h-4 w-4" />
            Calcular Todos desde Margen ({listaInfo.margen_ganancia}%)
          </Button>
        )}
      </div>
    </div>
  )
}

