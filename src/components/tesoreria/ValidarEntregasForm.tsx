'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  CheckCircle,
  DollarSign,
  User,
  Package,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { validarCobrosEntregasAction } from '@/actions/entregas.actions'

interface Entrega {
  id: string
  cliente_id: string
  cliente_nombre?: string
  subtotal: number
  recargo: number
  total: number
  estado_pago: string
  metodo_pago: string | null
  monto_cobrado: number
  pago_validado: boolean
  referencia_pago: string | null
}

interface ValidarEntregasFormProps {
  pedido: {
    id: string
    numero_pedido: string
    total: number
    turno: string
    fecha_entrega_estimada: string
    zona?: { nombre: string }
    entregas: Entrega[]
  }
  cajas: Array<{ id: string; nombre: string }>
}

export function ValidarEntregasForm({ pedido, cajas }: ValidarEntregasFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [observaciones, setObservaciones] = useState('')
  const [cajaId, setCajaId] = useState(cajas[0]?.id || '')

  const entregasPagadas = pedido.entregas.filter(e => e.estado_pago !== 'pendiente')
  const entregasFiadas = pedido.entregas.filter(e => e.estado_pago === 'fiado')
  const totalCobrado = pedido.entregas.reduce((sum, e) => sum + (e.monto_cobrado || 0), 0)
  const totalFiado = entregasFiadas.reduce((sum, e) => sum + e.total, 0)

  // Agrupar por método de pago
  const pagosPorMetodo: Record<string, number> = {}
  pedido.entregas.forEach(e => {
    if (e.monto_cobrado > 0 && e.metodo_pago) {
      pagosPorMetodo[e.metodo_pago] = (pagosPorMetodo[e.metodo_pago] || 0) + e.monto_cobrado
    }
  })

  const handleValidar = async () => {
    if (!cajaId) {
      toast.error('Selecciona una caja')
      return
    }

    setLoading(true)

    const formData = new FormData()
    formData.append('pedido_id', pedido.id)
    formData.append('caja_id', cajaId)
    if (observaciones) {
      formData.append('observaciones', observaciones)
    }

    const result = await validarCobrosEntregasAction(formData)
    setLoading(false)

    if (result.success) {
      toast.success(result.message || 'Cobros validados exitosamente')
      router.refresh()
    } else {
      toast.error(result.message || 'Error al validar cobros')
    }
  }

  const estadoPagoConfig = {
    pendiente: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
    parcial: { label: 'Parcial', color: 'bg-orange-100 text-orange-800' },
    pagado: { label: 'Pagado', color: 'bg-green-100 text-green-800' },
    fiado: { label: 'Fiado', color: 'bg-purple-100 text-purple-800' },
  }

  const todasValidadas = pedido.entregas.every(e => e.pago_validado || e.estado_pago === 'pendiente')

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Pedido {pedido.numero_pedido}
            </CardTitle>
            <CardDescription className="mt-2">
              <div className="flex flex-wrap gap-4 text-sm">
                <span>Turno: {pedido.turno}</span>
                <span>Zona: {pedido.zona?.nombre || 'N/A'}</span>
                <span>Fecha: {new Date(pedido.fecha_entrega_estimada).toLocaleDateString('es-AR')}</span>
                <span>{pedido.entregas.length} entrega(s)</span>
              </div>
            </CardDescription>
          </div>
          {todasValidadas ? (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <CheckCircle className="h-3 w-3 mr-1" />
              Validado
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
              <AlertCircle className="h-3 w-3 mr-1" />
              Pendiente
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumen de cobros */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-blue-900 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Resumen de Cobros
            </h4>
            <span className="text-2xl font-bold text-blue-900">
              {formatCurrency(totalCobrado)}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-white p-2 rounded">
              <p className="text-xs text-muted-foreground">Total pedido</p>
              <p className="font-semibold">{formatCurrency(pedido.total)}</p>
            </div>
            <div className="bg-white p-2 rounded">
              <p className="text-xs text-muted-foreground">Cobrado</p>
              <p className="font-semibold text-green-600">{formatCurrency(totalCobrado)}</p>
            </div>
            <div className="bg-white p-2 rounded">
              <p className="text-xs text-muted-foreground">Fiado</p>
              <p className="font-semibold text-purple-600">{formatCurrency(totalFiado)}</p>
            </div>
          </div>

          {Object.keys(pagosPorMetodo).length > 0 && (
            <div className="mt-3 pt-3 border-t border-blue-200">
              <p className="text-xs font-medium text-blue-700 mb-2">Por método de pago:</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(pagosPorMetodo).map(([metodo, monto]) => (
                  <Badge key={metodo} variant="outline" className="bg-white">
                    {metodo.replace('_', ' ')}: {formatCurrency(monto)}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Lista de entregas */}
        <div>
          <h4 className="font-semibold mb-2">Entregas ({pedido.entregas.length})</h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {pedido.entregas.map((entrega) => {
              const estado = estadoPagoConfig[entrega.estado_pago as keyof typeof estadoPagoConfig] ||
                { label: entrega.estado_pago, color: 'bg-gray-100' }

              return (
                <div
                  key={entrega.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded"
                >
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{entrega.cliente_nombre || 'Cliente'}</p>
                      <p className="text-xs text-muted-foreground">
                        Total: {formatCurrency(entrega.total)}
                        {entrega.referencia_pago && ` • Ref: ${entrega.referencia_pago}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={estado.color}>
                      {estado.label}
                    </Badge>
                    {entrega.monto_cobrado > 0 && (
                      <span className="font-semibold text-green-600">
                        {formatCurrency(entrega.monto_cobrado)}
                      </span>
                    )}
                    {entrega.pago_validado && (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {!todasValidadas && (
          <>
            <Separator />

            {/* Formulario de validación */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Caja destino *</Label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={cajaId}
                  onChange={(e) => setCajaId(e.target.value)}
                  required
                >
                  <option value="">Selecciona una caja</option>
                  {cajas.map((caja) => (
                    <option key={caja.id} value={caja.id}>
                      {caja.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Observaciones (opcional)</Label>
                <Textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Notas sobre la validación..."
                  rows={2}
                />
              </div>

              <Button
                onClick={handleValidar}
                disabled={loading || !cajaId}
                className="w-full"
              >
                {loading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Validando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Validar Cobros del Pedido
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

