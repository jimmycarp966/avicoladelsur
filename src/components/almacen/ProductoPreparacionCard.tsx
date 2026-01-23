'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface ProductoPreparacionCardProps {
  nombre: string
  pesable: boolean
  totalCantidad: number
  presupuestos: number
  presupuestosIds: Set<string>
  presupuestosData?: Array<{ id: string; numero: string; cliente?: string }>
}

export function ProductoPreparacionCard({
  nombre,
  pesable,
  totalCantidad,
  presupuestos,
  presupuestosIds,
  presupuestosData,
}: ProductoPreparacionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const formatearCantidad = (cantidad: number, pesable: boolean) =>
    pesable ? `${cantidad.toFixed(1)} kg` : `${cantidad.toFixed(0)} u`

  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      {/* Header clickeable */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-start justify-between p-3 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm">{nombre}</h4>
          <p className="text-xs text-muted-foreground mt-1">
            {presupuestos} presupuesto(s) • {pesable ? 'Pesable' : 'Unidad'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-base font-semibold">{formatearCantidad(totalCantidad, pesable)}</p>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </div>
      </button>

      {/* Lista de presupuestos expandida */}
      {isExpanded && (
        <div className="border-t border-slate-100 bg-slate-50 p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Presupuestos que contienen este producto:</p>
          <div className="space-y-2">
            {Array.from(presupuestosIds).map((presupuestoId) => {
              const presupuesto = presupuestosData?.find(p => p.id === presupuestoId)
              return (
                <div key={presupuestoId} className="flex items-center justify-between text-xs bg-white p-2 rounded border border-slate-100">
                  <div>
                    <span className="font-medium">#{presupuesto?.numero || presupuestoId}</span>
                    {presupuesto?.cliente && (
                      <span className="text-muted-foreground ml-2">• {presupuesto.cliente}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
