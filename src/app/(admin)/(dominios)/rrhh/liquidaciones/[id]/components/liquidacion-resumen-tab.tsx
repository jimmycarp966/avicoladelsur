'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Liquidacion, LiquidacionDetalle } from '@/types/domain.types'
import { SalaryBreakdownChart } from './salary-breakdown-chart'

function formatMoney(value?: number | null) {
  return `$${(value || 0).toLocaleString()}`
}

type LiquidacionResumenTabProps = {
  liquidacion: Liquidacion
}

export function LiquidacionResumenTab({ liquidacion }: LiquidacionResumenTabProps) {
  const detalles = (liquidacion.detalles || []) as LiquidacionDetalle[]

  return (
    <div className="space-y-4">
      {/* Datos base del empleado */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Datos base de calculo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
            <InfoItem label="Sueldo basico" value={formatMoney(liquidacion.sueldo_basico)} />
            <InfoItem label="Presentismo teorico" value={formatMoney(liquidacion.presentismo_teorico)} />
            <InfoItem label="Presentismo pagado" value={formatMoney(liquidacion.presentismo_pagado)} />
            <InfoItem label="Valor jornal" value={formatMoney(liquidacion.valor_jornal)} />
            <InfoItem label="Valor hora" value={formatMoney(liquidacion.valor_hora)} />
            <InfoItem label="Dias base" value={String(liquidacion.dias_base ?? '-')} />
            <InfoItem label="Horas jornada" value={String(liquidacion.horas_jornada ?? '-')} />
          </div>
        </CardContent>
      </Card>

      {/* Desglose salarial visual */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Desglose del sueldo</CardTitle>
        </CardHeader>
        <CardContent>
          {detalles.length > 0 ? (
            <SalaryBreakdownChart
              detalles={detalles}
              totalSinDescuentos={liquidacion.total_sin_descuentos || 0}
              descuentosTotal={liquidacion.descuentos_total || 0}
              anticiposTotal={liquidacion.adelantos_total || 0}
              totalNeto={liquidacion.total_neto || 0}
            />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No hay detalles de desglose disponibles.</p>
              <p className="text-xs mt-1">
                Los detalles se generan al recalcular la liquidacion.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-slate-50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums mt-1">{value}</p>
    </div>
  )
}
