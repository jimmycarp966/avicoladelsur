'use client'

import { useRouter } from 'next/navigation'
import { useNotificationStore } from '@/store/notificationStore'
import { aprobarLicenciaAction, rechazarLicenciaAction } from '@/actions/rrhh.actions'
import { LicenciasTable } from '@/components/tables/LicenciasTable'
import type { Licencia } from '@/types/domain.types'

type LicenciasTableWrapperProps = {
  licencias: Licencia[]
  canApprove: boolean
}

export function LicenciasTableWrapper({ licencias, canApprove }: LicenciasTableWrapperProps) {
  const router = useRouter()
  const { showToast } = useNotificationStore()

  const handleApprove = async (licencia: Licencia) => {
    const result = await aprobarLicenciaAction(licencia.id)

    if (result.success) {
      showToast('success', result.message || 'Licencia aprobada exitosamente', 'Licencia aprobada')
      router.refresh()
      return
    }

    showToast('error', result.error || 'No se pudo aprobar la licencia', 'Error')
  }

  const handleReject = async (licencia: Licencia) => {
    const result = await rechazarLicenciaAction(licencia.id)

    if (result.success) {
      showToast('success', result.message || 'Licencia rechazada exitosamente', 'Licencia rechazada')
      router.refresh()
      return
    }

    showToast('error', result.error || 'No se pudo rechazar la licencia', 'Error')
  }

  return (
    <LicenciasTable
      licencias={licencias}
      onApprove={canApprove ? handleApprove : undefined}
      onReject={canApprove ? handleReject : undefined}
    />
  )
}
