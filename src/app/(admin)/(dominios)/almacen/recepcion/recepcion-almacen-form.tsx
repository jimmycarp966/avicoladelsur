'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDownCircle, ArrowUpCircle, Package } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'

interface RecepcionAlmacenFormProps {
  productos: Array<{ id: string; nombre: string; codigo: string; unidad_medida: string }>
  lotes: Array<{ id: string; numero_lote: string; producto_id: string; cantidad_disponible: number }>
}

export function RecepcionAlmacenForm({ productos, lotes }: RecepcionAlmacenFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [tipo, setTipo] = useState<'ingreso' | 'egreso'>('ingreso')
  const [productoId, setProductoId] = useState('')
  const [loteId, setLoteId] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [unidadMedida, setUnidadMedida] = useState('kg')
  const [motivo, setMotivo] = useState('')
  const [destinoProduccion, setDestinoProduccion] = useState(false)

  // Filtrar lotes por producto seleccionado
  const lotesFiltrados = productoId
    ? lotes.filter(l => l.producto_id === productoId)
    : []

  // Obtener unidad de medida del producto seleccionado
  const productoSeleccionado = productos.find(p => p.id === productoId)
  const unidadMedidaProducto = productoSeleccionado?.unidad_medida || 'kg'

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
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="producto-ingreso">Producto *</Label>
                  <Select value={productoId} onValueChange={setProductoId} required>
                    <SelectTrigger id="producto-ingreso">
                      <SelectValue placeholder="Selecciona un producto" />
                    </SelectTrigger>
                    <SelectContent>
                      {productos.map(producto => (
                        <SelectItem key={producto.id} value={producto.id}>
                          {producto.nombre} ({producto.codigo})
                        </SelectItem>
                      ))}
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
                  <Label htmlFor="unidad-ingreso">Unidad de Medida</Label>
                  <Select value={unidadMedida} onValueChange={setUnidadMedida}>
                    <SelectTrigger id="unidad-ingreso">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">Kilogramos (kg)</SelectItem>
                      <SelectItem value="unidad">Unidades</SelectItem>
                      <SelectItem value="litro">Litros</SelectItem>
                    </SelectContent>
                  </Select>
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
              <div className="space-y-2">
                <Label htmlFor="producto-egreso">Producto *</Label>
                <Select value={productoId} onValueChange={setProductoId} required>
                  <SelectTrigger id="producto-egreso">
                    <SelectValue placeholder="Selecciona un producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {productos.map(producto => (
                      <SelectItem key={producto.id} value={producto.id}>
                        {producto.nombre} ({producto.codigo})
                      </SelectItem>
                    ))}
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
                  <Label htmlFor="unidad-egreso">Unidad de Medida</Label>
                  <Select value={unidadMedida} onValueChange={setUnidadMedida}>
                    <SelectTrigger id="unidad-egreso">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">Kilogramos (kg)</SelectItem>
                      <SelectItem value="unidad">Unidades</SelectItem>
                      <SelectItem value="litro">Litros</SelectItem>
                    </SelectContent>
                  </Select>
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

