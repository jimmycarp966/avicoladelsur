'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InfoItem label="Sueldo basico" value={formatMoney(liquidacion.sueldo_basico)} />
            <InfoItem label="Valor jornal" value={formatMoney(liquidacion.valor_jornal)} />
            <InfoItem label="Valor hora" value={formatMoney(liquidacion.valor_hora)} />
            <InfoItem label="Dias base" value={String(liquidacion.dias_base ?? '-')} />
            <InfoItem label="Horas diarias" value={String(liquidacion.horas_jornada ?? '-')} />
          </div>

          {/* Card de presentismo fijo */}
          <PresentismoCard liquidacion={liquidacion} />
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

function PresentismoCard({ liquidacion }: { liquidacion: Liquidacion }) {
  const presentismoTeorico = liquidacion.presentismo_teorico ?? 0
  const presentismoPagado = liquidacion.presentismo_pagado ?? 0
  const descuento = liquidacion.descuento_presentismo ?? 0

  const estaGanado = presentismoPagado > 0 && descuento === 0
  const estaDescontado = descuento > 0

  return (
    <div className={`rounded-md border p-4 ${estaGanado ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Presentismo</p>
          <p className="text-lg font-bold tabular-nums mt-0.5">{formatMoney(presentismoTeorico)}</p>
        </div>
        <div className="text-right space-y-1">
          {estaGanado && (
            <>
              <Badge className="bg-green-100 text-green-700 border-green-300 hover:bg-green-100">
                Ganado
              </Badge>
              <p className="text-xs text-green-600">Mes completo sin infracciones</p>
            </>
          )}
          {estaDescontado && (
            <>
              <Badge className="bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-100">
                Descuento pendiente
              </Badge>
              <p className="text-xs text-amber-600">
                {liquidacion.periodo_mes === new Date().getMonth() + 1 &&
                liquidacion.periodo_anio === new Date().getFullYear()
                  ? 'Mes en curso'
                  : 'Infracciones detectadas'}
              </p>
            </>
          )}
          {!estaGanado && !estaDescontado && (
            <Badge variant="outline" className="text-muted-foreground">
              Sin datos
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}
