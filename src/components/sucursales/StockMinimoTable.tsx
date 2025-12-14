'use client'

import { useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Package, Settings, Edit, Save, X, AlertTriangle, CheckCircle, Minus } from 'lucide-react'
import { toast } from 'sonner'
import { configurarStockMinimoAction, eliminarStockMinimoAction } from '@/actions/sucursales.actions'

interface StockMinimoProducto {
  productoId: string
  productoNombre: string
  productoCodigo: string
  stockMinimoGlobal: number | null
  stockMinimoSucursal: number | null
  stockActual: number
}

interface StockMinimoTableProps {
  productos: StockMinimoProducto[]
  sucursalId: string
}

export function StockMinimoTable({ productos, sucursalId }: StockMinimoTableProps) {
  const [editingProduct, setEditingProduct] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [isPending, startTransition] = useTransition()

  const handleStartEdit = (producto: StockMinimoProducto) => {
    setEditingProduct(producto.productoId)
    setEditValue(producto.stockMinimoSucursal?.toString() || '')
  }

  const handleCancelEdit = () => {
    setEditingProduct(null)
    setEditValue('')
  }

  const handleSave = async (productoId: string) => {
    const valor = parseInt(editValue.trim())

    if (isNaN(valor) || valor < 0) {
      toast.error('El stock mínimo debe ser un número entero positivo o 0')
      return
    }

    startTransition(async () => {
      try {
        const result = await configurarStockMinimoAction({
          sucursalId,
          productoId,
          stockMinimo: valor
        })

        if (result.success) {
          toast.success('Stock mínimo configurado exitosamente')
          setEditingProduct(null)
          setEditValue('')
        } else {
          toast.error(result.error || 'Error al configurar stock mínimo')
        }
      } catch (error) {
        toast.error('Error inesperado al guardar')
      }
    })
  }

  const handleEliminarConfiguracion = async (productoId: string) => {
    startTransition(async () => {
      try {
        const result = await eliminarStockMinimoAction({
          sucursalId,
          productoId
        })

        if (result.success) {
          toast.success('Configuración eliminada, ahora usa el mínimo global')
        } else {
          toast.error(result.error || 'Error al eliminar configuración')
        }
      } catch (error) {
        toast.error('Error inesperado al eliminar')
      }
    })
  }

  const getEstadoBadge = (producto: StockMinimoProducto) => {
    const minimoEfectivo = producto.stockMinimoSucursal ?? producto.stockMinimoGlobal
    const estaBajoMinimo = minimoEfectivo !== null && producto.stockActual < minimoEfectivo

    if (estaBajoMinimo) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Bajo stock
        </Badge>
      )
    }

    if (producto.stockMinimoSucursal !== null) {
      return (
        <Badge variant="default" className="flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Configurado
        </Badge>
      )
    }

    if (producto.stockMinimoGlobal !== null) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Settings className="w-3 h-3" />
          Global
        </Badge>
      )
    }

    return (
      <Badge variant="outline" className="flex items-center gap-1">
        <Minus className="w-3 h-3" />
        Sin mínimo
      </Badge>
    )
  }

  if (productos.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No hay productos con stock</h3>
        <p className="text-muted-foreground">
          No se encontraron productos con stock disponible en tu sucursal para configurar.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {productos.map((producto) => {
        const isEditing = editingProduct === producto.productoId
        const minimoEfectivo = producto.stockMinimoSucursal ?? producto.stockMinimoGlobal

        return (
          <Card key={producto.productoId} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Package className="w-6 h-6 text-primary" />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{producto.productoNombre}</h4>
                      {producto.productoCodigo && (
                        <Badge variant="outline" className="text-xs">
                          {producto.productoCodigo}
                        </Badge>
                      )}
                      {getEstadoBadge(producto)}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        Stock actual: <strong>{producto.stockActual}</strong> unidades
                      </span>

                      {producto.stockMinimoGlobal !== null && (
                        <span className="flex items-center gap-1">
                          <Settings className="w-3 h-3" />
                          Mínimo global: <strong>{producto.stockMinimoGlobal}</strong>
                        </span>
                      )}

                      {producto.stockMinimoSucursal !== null && (
                        <span className="flex items-center gap-1 text-blue-600">
                          <CheckCircle className="w-3 h-3" />
                          Mínimo sucursal: <strong>{producto.stockMinimoSucursal}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`edit-${producto.productoId}`} className="text-xs">
                          Nuevo mínimo
                        </Label>
                        <Input
                          id={`edit-${producto.productoId}`}
                          type="number"
                          min="0"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-24 h-8"
                          placeholder="0"
                          disabled={isPending}
                        />
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleSave(producto.productoId)}
                        disabled={isPending}
                      >
                        <Save className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelEdit}
                        disabled={isPending}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStartEdit(producto)}
                        disabled={isPending}
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Configurar
                      </Button>

                      {producto.stockMinimoSucursal !== null && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleEliminarConfiguracion(producto.productoId)}
                          disabled={isPending}
                        >
                          <X className="w-3 h-3 mr-1" />
                          Eliminar
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}










