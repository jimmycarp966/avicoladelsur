'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Scale, Package } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import Link from 'next/link'

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

  const formatearCantidad = (cantidad: number, esPesable: boolean) =>
    esPesable ? `${cantidad.toFixed(1)} kg` : `${cantidad.toFixed(0)} u`

  return (
    <div
      className={cn(
        "border rounded-lg overflow-hidden transition-colors",
        pesable
          ? "border-yellow-400 bg-yellow-50 hover:bg-yellow-100"
          : "border-slate-200 bg-white hover:bg-slate-50"
      )}
    >
      {/* Header clickeable */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-start justify-between p-3 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm">{nombre}</h4>
            {pesable ? (
              <Badge variant="outline" className="text-xs bg-yellow-200 border-yellow-400 text-yellow-800">
                <Scale className="h-3 w-3 mr-1" />
                BALANZA
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs bg-slate-100 border-slate-300 text-slate-600">
                <Package className="h-3 w-3 mr-1" />
                UNIDAD
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {presupuestos} presupuesto(s)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className={cn(
            "text-base font-semibold",
            pesable ? "text-yellow-700" : "text-slate-700"
          )}>
            {formatearCantidad(totalCantidad, pesable)}
          </p>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </div>
      </button>

      {/* Lista de presupuestos expandida */}
      {isExpanded && (
        <div className={cn(
          "border-t p-3",
          pesable ? "border-yellow-200 bg-yellow-100/50" : "border-slate-100 bg-slate-50"
        )}>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Presupuestos que contienen este producto:
          </p>
          <div className="space-y-2">
            {Array.from(presupuestosIds).map((presupuestoId) => {
              const presupuesto = presupuestosData?.find(p => p.id === presupuestoId)
              return (
                <Link
                  key={presupuestoId}
                  href={`/ventas/presupuestos/${presupuestoId}`}
                  className={cn(
                    "flex items-center justify-between text-xs p-2 rounded border transition-colors block",
                    pesable
                      ? "bg-white border-yellow-200 hover:border-yellow-400 hover:bg-yellow-50"
                      : "bg-white border-slate-100 hover:border-primary hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-primary">
                      #{presupuesto?.numero || presupuestoId.substring(0, 8)}
                    </span>
                    {presupuesto?.cliente && (
                      <span className="text-muted-foreground">
                        • {presupuesto.cliente}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-primary/60">
                    Ver →
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
