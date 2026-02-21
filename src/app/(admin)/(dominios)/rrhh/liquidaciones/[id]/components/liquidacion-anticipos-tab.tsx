'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { AdelantoCuota } from '@/types/domain.types'

type CuotaWithPlan = AdelantoCuota & {
  plan?: {
    tipo?: string
    monto_total?: number
    descripcion?: string
    cantidad_cuotas?: number
  }
}

function formatMoney(value?: number | null) {
  return `$${(value || 0).toLocaleString()}`
}

type LiquidacionAnticiposTabProps = {
  cuotas: CuotaWithPlan[]
  periodoMes: number
  periodoAnio: number
}

export function LiquidacionAnticiposTab({ cuotas, periodoMes, periodoAnio }: LiquidacionAnticiposTabProps) {
  const cuotasPeriodo = useMemo(
    () => cuotas.filter((c) => c.periodo_mes === periodoMes && c.periodo_anio === periodoAnio),
    [cuotas, periodoMes, periodoAnio],
  )

  const totalesPorTipo = useMemo(() => {
    const acc = { mercaderia: 0, efectivo: 0, otro: 0 }
    for (const c of cuotasPeriodo) {
      const tipo = (c.plan?.tipo || '').toLowerCase()
      if (tipo.includes('mercaderia')) acc.mercaderia += c.monto_cuota ?? 0
      else if (tipo.includes('efectivo')) acc.efectivo += c.monto_cuota ?? 0
      else acc.otro += c.monto_cuota ?? 0
    }
    return acc
  }, [cuotasPeriodo])

  const totalAnticipo = cuotasPeriodo.reduce((s, c) => s + (c.monto_cuota ?? 0), 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cuotas de anticipos del periodo</CardTitle>
        <CardDescription>
          Detalle de adelantos descontados en este periodo de liquidacion.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {cuotasPeriodo.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No hay cuotas aplicadas para este periodo.
          </p>
        ) : (
          <div className="space-y-3">
            {/* Resumen por tipo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {totalesPorTipo.mercaderia > 0 && (
                <div className="rounded-md border bg-orange-50/50 p-3">
                  <p className="text-xs text-muted-foreground">Mercaderia</p>
                  <p className="font-semibold tabular-nums text-orange-700">{formatMoney(totalesPorTipo.mercaderia)}</p>
                </div>
              )}
              {totalesPorTipo.efectivo > 0 && (
                <div className="rounded-md border bg-amber-50/50 p-3">
                  <p className="text-xs text-muted-foreground">Efectivo</p>
                  <p className="font-semibold tabular-nums text-amber-700">{formatMoney(totalesPorTipo.efectivo)}</p>
                </div>
              )}
              {totalesPorTipo.otro > 0 && (
                <div className="rounded-md border bg-slate-50 p-3">
                  <p className="text-xs text-muted-foreground">Otros</p>
                  <p className="font-semibold tabular-nums">{formatMoney(totalesPorTipo.otro)}</p>
                </div>
              )}
            </div>

            {/* Lista de cuotas */}
            <div className="space-y-2">
              {cuotasPeriodo.map((cuota) => {
                const cantCuotas = cuota.plan?.cantidad_cuotas || 0
                const nroCuota = cuota.nro_cuota || 0
                const pctPlan = cantCuotas > 0 ? Math.round((nroCuota / cantCuotas) * 100) : 0

                return (
                  <div key={cuota.id} className="border rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm">
                        <span className="font-medium">Cuota #{nroCuota}</span>
                        {cantCuotas > 0 && (
                          <span className="text-muted-foreground ml-1">de {cantCuotas}</span>
                        )}
                        <Badge variant="outline" className="ml-2 text-xs">
                          {cuota.plan?.tipo || 'N/A'}
                        </Badge>
                        {cuota.plan?.descripcion && (
                          <span className="text-muted-foreground ml-1 text-xs">
                            ({cuota.plan.descripcion})
                          </span>
                        )}
                      </div>
                      <div className="font-semibold tabular-nums">{formatMoney(cuota.monto_cuota)}</div>
                    </div>

                    {/* Progress bar del plan */}
                    {cantCuotas > 0 && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Progreso del plan</span>
                          <span>{nroCuota}/{cantCuotas} cuotas ({pctPlan}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-blue-400 transition-all"
                            style={{ width: `${pctPlan}%` }}
                          />
                        </div>
                        {cuota.plan?.monto_total && (
                          <p className="text-xs text-muted-foreground">
                            Plan total: {formatMoney(cuota.plan.monto_total)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex justify-between pt-2 border-t text-sm font-semibold">
              <span>Total anticipos periodo</span>
              <span>{formatMoney(totalAnticipo)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
