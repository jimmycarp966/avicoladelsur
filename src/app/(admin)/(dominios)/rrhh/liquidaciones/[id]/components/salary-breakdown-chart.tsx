'use client'

import type { LiquidacionDetalle } from '@/types/domain.types'

type BreakdownItem = {
  label: string
  monto: number
  color: string
  tipo: 'ingreso' | 'descuento'
}

const TIPO_CONFIG: Record<string, { label: string; color: string; tipo: 'ingreso' | 'descuento' }> = {
  sueldo_basico: { label: 'Sueldo basico', color: 'bg-blue-500', tipo: 'ingreso' },
  presentismo: { label: 'Presentismo', color: 'bg-emerald-500', tipo: 'ingreso' },
  horas_mensuales: { label: 'Horas diarias', color: 'bg-blue-400', tipo: 'ingreso' },
  horas_extras: { label: 'Horas extras', color: 'bg-indigo-500', tipo: 'ingreso' },
  turnos_especiales: { label: 'Turnos especiales', color: 'bg-violet-500', tipo: 'ingreso' },
  adicional_cajero: { label: 'Adicional cajero', color: 'bg-cyan-500', tipo: 'ingreso' },
  adicional_produccion: { label: 'Adicional produccion', color: 'bg-teal-500', tipo: 'ingreso' },
  total_cajero: { label: 'Total cajero', color: 'bg-cyan-400', tipo: 'ingreso' },
  descuento_presentismo: { label: 'Desc. presentismo', color: 'bg-red-400', tipo: 'descuento' },
  adelanto_mercaderia: { label: 'Adelanto mercaderia', color: 'bg-orange-400', tipo: 'descuento' },
  adelanto_efectivo: { label: 'Adelanto efectivo', color: 'bg-amber-500', tipo: 'descuento' },
}

function formatMoney(value: number) {
  return `$${value.toLocaleString()}`
}

function mapDetallesToBreakdown(detalles: LiquidacionDetalle[]): BreakdownItem[] {
  return detalles
    .filter((d) => d.monto !== 0)
    .map((d) => {
      const config = TIPO_CONFIG[d.tipo]
      return {
        label: config?.label || d.descripcion || d.tipo,
        monto: d.monto,
        color: config?.color || (d.monto >= 0 ? 'bg-gray-400' : 'bg-red-300'),
        tipo: config?.tipo || (d.monto >= 0 ? 'ingreso' : 'descuento'),
      }
    })
    .sort((a, b) => {
      if (a.tipo !== b.tipo) return a.tipo === 'ingreso' ? -1 : 1
      return Math.abs(b.monto) - Math.abs(a.monto)
    })
}

type SalaryBreakdownChartProps = {
  detalles: LiquidacionDetalle[]
  totalSinDescuentos: number
  descuentosTotal: number
  anticiposTotal: number
  totalNeto: number
}

export function SalaryBreakdownChart({
  detalles,
  totalSinDescuentos,
  descuentosTotal,
  anticiposTotal,
  totalNeto,
}: SalaryBreakdownChartProps) {
  const items = mapDetallesToBreakdown(detalles)
  const ingresos = items.filter((i) => i.tipo === 'ingreso')
  const descuentos = items.filter((i) => i.tipo === 'descuento')
  const maxMonto = Math.max(...items.map((i) => Math.abs(i.monto)), 1)

  return (
    <div className="space-y-6">
      {/* Ingresos */}
      {ingresos.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Composicion del sueldo
          </p>
          <div className="space-y-1.5">
            {ingresos.map((item) => (
              <BarRow key={item.label} item={item} maxMonto={maxMonto} />
            ))}
          </div>
          <div className="flex justify-between pt-1 border-t text-sm font-semibold">
            <span>Total sin descuentos</span>
            <span>{formatMoney(totalSinDescuentos)}</span>
          </div>
        </div>
      )}

      {/* Descuentos */}
      {descuentos.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-500">
            Descuentos y anticipos
          </p>
          <div className="space-y-1.5">
            {descuentos.map((item) => (
              <BarRow key={item.label} item={item} maxMonto={maxMonto} />
            ))}
          </div>
          <div className="flex justify-between pt-1 border-t text-sm font-medium text-red-600">
            <span>Total descuentos + anticipos</span>
            <span>-{formatMoney(descuentosTotal + anticiposTotal)}</span>
          </div>
        </div>
      )}

      {/* Neto */}
      <div className="rounded-lg border-2 border-blue-200 bg-blue-50/50 p-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Total a percibir</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatMoney(totalSinDescuentos)} - {formatMoney(descuentosTotal)} - {formatMoney(anticiposTotal)} = Neto
            </p>
          </div>
          <p className="text-2xl font-bold text-blue-600">{formatMoney(totalNeto)}</p>
        </div>
      </div>
    </div>
  )
}

function BarRow({ item, maxMonto }: { item: BreakdownItem; maxMonto: number }) {
  const pct = Math.max((Math.abs(item.monto) / maxMonto) * 100, 2)
  const isNeg = item.tipo === 'descuento'

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-[140px] truncate shrink-0">{item.label}</span>
      <div className="flex-1 h-5 bg-gray-100 rounded-sm overflow-hidden">
        <div
          className={`h-full rounded-sm transition-all ${item.color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-medium tabular-nums w-[80px] text-right shrink-0 ${isNeg ? 'text-red-600' : ''}`}>
        {isNeg ? '-' : ''}{formatMoney(Math.abs(item.monto))}
      </span>
    </div>
  )
}
