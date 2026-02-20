'use client'

import { useRouter } from 'next/navigation'
import { useNotificationStore } from '@/store/notificationStore'
import { aprobarLiquidacionAction, marcarLiquidacionPagadaAction } from '@/actions/rrhh.actions'
import { LiquidacionesTable } from '@/components/tables/LiquidacionesTable'
import type { Liquidacion } from '@/types/domain.types'

interface Props {
  liquidaciones: Liquidacion[]
}

export function LiquidacionesTableWrapper({ liquidaciones }: Props) {
  const router = useRouter()
  const { showToast } = useNotificationStore()

  const handleApprove = async (liquidacion: Liquidacion) => {
    const result = await aprobarLiquidacionAction(liquidacion.id)
    if (result.success) {
      showToast('success', 'Liquidacion aprobada', 'OK')
      router.refresh()
    } else {
      showToast('error', result.error || 'No se pudo aprobar', 'Error')
    }
  }

  const handlePay = async (liquidacion: Liquidacion) => {
    const result = await marcarLiquidacionPagadaAction(liquidacion.id)
    if (result.success) {
      showToast('success', 'Liquidacion marcada como pagada', 'OK')
      router.refresh()
    } else {
      showToast('error', result.error || 'No se pudo marcar como pagada', 'Error')
    }
  }

  return (
    <LiquidacionesTable
      liquidaciones={liquidaciones}
      onApprove={handleApprove}
      onPay={handlePay}
    />
  )
}
