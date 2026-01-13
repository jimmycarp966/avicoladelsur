'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, ChevronUp, DollarSign, Building2, Calendar, CheckCircle2, AlertCircle } from 'lucide-react'
import { validarRetiroAction } from '@/actions/tesoreria.actions'
import { toast } from 'sonner'

interface Billete {
  denominacion: number
  cantidad: number
  subtotal: number
}

interface Arqueo {
  esperado: number
  real: number
  diferencia: number
  observaciones: string
  billetes: Billete[]
}

interface Retiro {
  id: string
  sucursal: { id: string; nombre: string }
  monto: number
  descripcion: string
  created_at: string
  arqueo: Arqueo | null
}

interface RetirosPendientesCardProps {
  retiros: Retiro[]
  onValidar?: () => void
}

export function RetirosPendientesCard({ retiros, onValidar }: RetirosPendientesCardProps) {
  const [validando, setValidando] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const handleValidar = async (retiroId: string) => {
    setValidando(retiroId)
    try {
      // TODO: Obtener caja central del usuario
      const result = await validarRetiroAction(retiroId, 'caja-central-id')
      
      if (result.success) {
        toast.success('Retiro validado exitosamente')
        onValidar?.()
      } else {
        toast.error(result.error || 'Error al validar retiro')
      }
    } catch (error) {
      toast.error('Error inesperado al validar retiro')
    } finally {
      setValidando(null)
    }
  }

  const formatearMoneda = (monto: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2
    }).format(monto)
  }

  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const totalRetiros = retiros.reduce((sum, r) => sum + r.monto, 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Retiros de Sucursales
            </CardTitle>
            <CardDescription>
              Dinero pendiente de recoger de sucursales
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-lg">
            {retiros.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total de retiros */}
        <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <span className="font-medium text-green-900 dark:text-green-100">Total a recoger:</span>
            <span className="text-2xl font-bold text-green-700 dark:text-green-300">
              {formatearMoneda(totalRetiros)}
            </span>
          </div>
        </div>

        {/* Lista de retiros */}
        {retiros.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No hay retiros pendientes</p>
          </div>
        ) : (
          <div className="space-y-3">
            {retiros.map((retiro) => (
              <Collapsible
                key={retiro.id}
                open={expanded === retiro.id}
                onOpenChange={(open) => setExpanded(open ? retiro.id : null)}
              >
                <div className="border rounded-lg p-4 space-y-3">
                  {/* Header del retiro */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">{retiro.sucursal.nombre}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatearFecha(retiro.created_at)}
                        </div>
                      </div>
                      <div className="text-lg font-bold text-green-600">
                        {formatearMoneda(retiro.monto)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleValidar(retiro.id)}
                        disabled={validando === retiro.id}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {validando === retiro.id ? (
                          <>Validando...</>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Validar
                          </>
                        )}
                      </Button>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon">
                          {expanded === retiro.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </div>

                  {/* Detalle de arqueo (expandible) */}
                  <CollapsibleContent className="space-y-3 pt-3 border-t">
                    {retiro.arqueo ? (
                      <>
                        {/* Resumen del arqueo */}
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div className="p-2 bg-muted rounded">
                            <p className="text-muted-foreground">Esperado</p>
                            <p className="font-semibold">{formatearMoneda(retiro.arqueo.esperado)}</p>
                          </div>
                          <div className="p-2 bg-muted rounded">
                            <p className="text-muted-foreground">Real</p>
                            <p className="font-semibold">{formatearMoneda(retiro.arqueo.real)}</p>
                          </div>
                          <div className={`p-2 rounded ${
                            retiro.arqueo.diferencia > 0 ? 'bg-green-100 dark:bg-green-900' :
                            retiro.arqueo.diferencia < 0 ? 'bg-red-100 dark:bg-red-900' :
                            'bg-muted'
                          }`}>
                            <p className="text-muted-foreground">Diferencia</p>
                            <p className="font-semibold">
                              {retiro.arqueo.diferencia > 0 ? '+' : ''}{formatearMoneda(retiro.arqueo.diferencia)}
                            </p>
                          </div>
                        </div>

                        {/* Detalle de billetes */}
                        {retiro.arqueo.billetes.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Desglose de billetes:</p>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              {retiro.arqueo.billetes.map((billete, idx) => (
                                <div key={idx} className="flex justify-between p-2 bg-muted rounded">
                                  <span>${billete.denominacion.toLocaleString('es-AR')}</span>
                                  <span>x{billete.cantidad} = {formatearMoneda(billete.subtotal)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Observaciones */}
                        {retiro.arqueo.observaciones && (
                          <div className="text-sm">
                            <p className="font-medium">Observaciones:</p>
                            <p className="text-muted-foreground">{retiro.arqueo.observaciones}</p>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No hay detalle de arqueo disponible</p>
                    )}
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
