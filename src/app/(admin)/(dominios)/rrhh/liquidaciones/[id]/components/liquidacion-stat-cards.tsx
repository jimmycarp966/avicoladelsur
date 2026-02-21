'use client'

import { DollarSign, TrendingDown, CreditCard, Wallet } from 'lucide-react'
import { StatCard } from '@/components/ui/stat-card'
import type { Liquidacion } from '@/types/domain.types'

function formatMoney(value?: number | null) {
  return `$${(value || 0).toLocaleString()}`
}

type LiquidacionStatCardsProps = {
  liquidacion: Liquidacion
}

export function LiquidacionStatCards({ liquidacion }: LiquidacionStatCardsProps) {
  const descuentosTotal = (liquidacion.descuento_presentismo || 0)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Total sin descuentos"
        subtitle="Sueldo bruto antes de deducciones"
        value={formatMoney(liquidacion.total_sin_descuentos)}
        icon={DollarSign}
      />

      <StatCard
        variant="danger"
        title="Descuentos"
        subtitle="Presentismo + otros descuentos"
        value={formatMoney(descuentosTotal)}
        icon={TrendingDown}
      />

      <StatCard
        variant="warning"
        title="Anticipos periodo"
        subtitle="Adelantos descontados este mes"
        value={formatMoney(liquidacion.control_30_anticipos)}
        icon={CreditCard}
      />

      <StatCard
        variant="primary"
        title="Total a percibir"
        subtitle="Monto final a cobrar"
        value={formatMoney(liquidacion.total_neto)}
        icon={Wallet}
      />
    </div>
  )
}
