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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Save, Edit, X, Calculator, ExternalLink } from 'lucide-react'
import { useNotificationStore } from '@/store/notificationStore'
import { obtenerPreciosProductoEnTodasListasAction, obtenerPrecioProductoAction, guardarPrecioProductoAction } from '@/actions/listas-precios.actions'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'

interface PrecioEnLista {
  lista_precio_id: string
  lista_precio: {
    id: string
    codigo: string
    nombre: string
    tipo: string
    margen_ganancia: number | null
  }
  precio: number | null
  activo: boolean
  fecha_desde: string | null
  fecha_hasta: string | null
}

interface PreciosProductoListasProps {
  productoId: string
  precioCosto?: number
  precioVenta?: number
}

export function PreciosProductoListas({ productoId, precioCosto, precioVenta }: PreciosProductoListasProps) {
  const { showToast } = useNotificationStore()
  const [precios, setPrecios] = useState<PrecioEnLista[]>([])
  const [cargando, setCargando] = useState(true)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [precioEditado, setPrecioEditado] = useState<number>(0)

  const cargarPrecios = async () => {
    setCargando(true)
    try {
      const result = await obtenerPreciosProductoEnTodasListasAction(productoId)
      if (result.success && result.data) {
        // Para cada lista sin precio, calcular el precio usando la función RPC
        const preciosConCalculo = await Promise.all(
          result.data.map(async (precio) => {
            if (precio.precio !== null) {
              return precio
            }
            // Si no hay precio configurado, obtener el precio calculado
            const precioResult = await obtenerPrecioProductoAction(
              precio.lista_precio_id,
              productoId
            )
            if (precioResult.success && precioResult.data) {
              return {
                ...precio,
                precio: precioResult.data.precio,
              }
            }
            return precio
          })
        )
        setPrecios(preciosConCalculo)
      } else {
        showToast('error', result.error || 'Error al cargar precios')
      }
    } catch (error) {
      showToast('error', 'Error al cargar precios')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarPrecios()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoId])

  const calcularPrecioConMargen = (margenGanancia: number | null): number | null => {
    if (!margenGanancia || !precioCosto || precioCosto <= 0) {
      return null
    }
    return precioCosto * (1 + margenGanancia / 100)
  }

  const handleEditar = (precio: PrecioEnLista) => {
    setEditandoId(precio.lista_precio_id)
    setPrecioEditado(precio.precio || 0)
  }

  const handleGuardar = async (listaPrecioId: string) => {
    const formData = new FormData()
    formData.append('lista_precio_id', listaPrecioId)
    formData.append('producto_id', productoId)
    formData.append('precio', precioEditado.toString())
    formData.append('activo', 'true')

    const result = await guardarPrecioProductoAction(formData)
    if (result.success) {
      showToast('success', 'Precio actualizado exitosamente')
      setEditandoId(null)
      await cargarPrecios()
    } else {
      showToast('error', result.error || 'Error al actualizar precio')
    }
  }

  const handleCalcularDesdeMargen = async (listaPrecioId: string, margenGanancia: number | null) => {
    const precioCalculado = calcularPrecioConMargen(margenGanancia)
    if (precioCalculado === null) {
      showToast('error', 'No se puede calcular: falta precio de costo o margen de ganancia')
      return
    }

    const formData = new FormData()
    formData.append('lista_precio_id', listaPrecioId)
    formData.append('producto_id', productoId)
    formData.append('precio', precioCalculado.toFixed(2))
    formData.append('activo', 'true')

    const result = await guardarPrecioProductoAction(formData)
    if (result.success) {
      showToast('success', 'Precio calculado y guardado exitosamente')
      await cargarPrecios()
    } else {
      showToast('error', result.error || 'Error al guardar precio')
    }
  }

  if (cargando) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Precios en Listas</CardTitle>
          <CardDescription>Cargando precios...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Precios en Listas de Precios</CardTitle>
            <CardDescription>
              Precios de venta configurados para este producto en cada lista de precios
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/ventas/listas-precios">
              <ExternalLink className="mr-2 h-4 w-4" />
              Gestionar Listas
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {precios.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No hay listas de precios activas
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lista de Precios</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Margen</TableHead>
                  <TableHead>Precio Configurado</TableHead>
                  <TableHead>Precio Calculado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {precios.map((precio) => {
                  const precioCalculado = calcularPrecioConMargen(precio.lista_precio.margen_ganancia)
                  const tienePrecioConfigurado = precio.precio !== null && precio.activo
                  
                  return (
                    <TableRow key={precio.lista_precio_id}>
                      <TableCell className="font-medium">
                        <div>
                          <div>{precio.lista_precio.nombre}</div>
                          <div className="text-xs text-muted-foreground">
                            {precio.lista_precio.codigo}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {precio.lista_precio.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {precio.lista_precio.margen_ganancia ? (
                          <span className="text-sm">
                            {precio.lista_precio.margen_ganancia}%
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sin margen</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editandoId === precio.lista_precio_id ? (
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
                              onClick={() => handleGuardar(precio.lista_precio_id)}
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
                          <div>
                            {tienePrecioConfigurado ? (
                              <span className="font-medium text-success">
                                {formatCurrency(precio.precio!)}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">
                                No configurado
                              </span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {precioCalculado !== null ? (
                          <span className="text-sm text-muted-foreground">
                            {formatCurrency(precioCalculado)}
                            {!tienePrecioConfigurado && (
                              <span className="ml-1 text-xs">(calculado)</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {precioVenta ? formatCurrency(precioVenta) : 'N/A'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {editandoId !== precio.lista_precio_id && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditar(precio)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              {precioCalculado !== null && !tienePrecioConfigurado && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCalcularDesdeMargen(
                                    precio.lista_precio_id,
                                    precio.lista_precio.margen_ganancia
                                  )}
                                  title={`Calcular desde margen (${precio.lista_precio.margen_ganancia}%)`}
                                >
                                  <Calculator className="h-4 w-4" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

