'use client'

import { Card, CardContent } from '@/components/ui/card'
import { StatCardPrimary } from '@/components/ui/stat-card'
import { Button } from '@/components/ui/button'
import { Package, User, Calendar, Loader2, Save } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface PresupuestoResumenPanelProps {
  totalEstimado: number
  cantidadProductos: number
  clienteNombre?: string
  fechaEntrega?: string
  tipoVenta?: 'reparto' | 'retira_casa_central'
  isLoading?: boolean
  onCancel?: () => void
}

export function PresupuestoResumenPanel({
  totalEstimado,
  cantidadProductos,
  clienteNombre,
  fechaEntrega,
  tipoVenta = 'reparto',
  isLoading = false,
  onCancel,
}: PresupuestoResumenPanelProps) {
  const formattedDate = fechaEntrega
    ? new Date(fechaEntrega + 'T00:00:00').toLocaleDateString('es-AR', {
        day: '2-digit',
        month: 'short',
      })
    : undefined

  return (
    <div className="sticky top-4 space-y-4">
      {/* Tarjeta principal con total */}
      <StatCardPrimary
        title="Total Estimado"
        value={formatCurrency(totalEstimado)}
        subtitle={`${cantidadProductos} producto${cantidadProductos !== 1 ? 's' : ''}`}
        icon={Package}
        action={
          <div className="flex gap-2 pt-2">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={onCancel}
                disabled={isLoading}
              >
                Cancelar
              </Button>
            )}
            <Button
              type="submit"
              size="sm"
              className="flex-1"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar
                </>
              )}
            </Button>
          </div>
        }
      />

      {/* Información adicional */}
      {(clienteNombre || formattedDate) && (
        <Card>
          <CardContent className="p-4 space-y-3 text-sm">
            {clienteNombre && (
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <span className="text-muted-foreground block text-xs">Cliente</span>
                  <span className="font-medium block truncate">{clienteNombre}</span>
                </div>
              </div>
            )}
            {formattedDate && tipoVenta === 'reparto' && (
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <span className="text-muted-foreground block text-xs">Entrega</span>
                  <span className="font-medium block">{formattedDate}</span>
                </div>
              </div>
            )}
            {tipoVenta === 'retira_casa_central' && (
              <div className="flex items-start gap-2">
                <div className="h-4 w-4 shrink-0 mt-0.5">🏠</div>
                <div className="min-w-0 flex-1">
                  <span className="text-muted-foreground block text-xs">Tipo</span>
                  <span className="font-medium block">Retira en Casa Central</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Atajos de teclado */}
      <Card className="bg-muted/30 border-muted/50">
        <CardContent className="p-3 text-xs text-muted-foreground space-y-1">
          <div className="font-medium mb-2">Atajos rápidos:</div>
          <div className="flex justify-between">
            <span><kbd className="px-1 bg-background rounded border">C</kbd> Cliente</span>
            <span><kbd className="px-1 bg-background rounded border">P</kbd> Producto</span>
          </div>
          <div className="flex justify-between">
            <span><kbd className="px-1 bg-background rounded border">A</kbd> Agregar</span>
            <span><kbd className="px-1 bg-background rounded border">Ctrl+Enter</kbd> Guardar</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
