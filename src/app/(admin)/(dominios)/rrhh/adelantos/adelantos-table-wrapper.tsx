'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AdelantosTable } from '@/components/tables/AdelantosTable'
import { aprobarAdelantoAction, rechazarAdelantoAction } from '@/actions/rrhh.actions'
import { useNotificationStore } from '@/store/notificationStore'
import { getCurrentUser } from '@/actions/auth.actions'
import type { Adelanto } from '@/types/domain.types'

interface AdelantosTableWrapperProps {
  adelantos: Adelanto[]
}

export function AdelantosTableWrapper({ adelantos }: AdelantosTableWrapperProps) {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleApprove = async (adelanto: Adelanto) => {
    try {
      setLoadingId(adelanto.id)

      const cuotasInput = window.prompt('Cantidad de cuotas para descontar este adelanto (1 a 24):', '1')
      if (cuotasInput === null) {
        setLoadingId(null)
        return
      }
      const cuotas = Math.max(1, Math.min(24, Number.parseInt(cuotasInput, 10) || 1))
      
      const user = await getCurrentUser()
      if (!user) {
        showToast('error', 'Usuario no autenticado', 'Error')
        return
      }

      const result = await aprobarAdelantoAction(adelanto.id, user.id, cuotas)

      if (result.success) {
        showToast('success', result.message || 'Adelanto aprobado exitosamente', 'Adelanto aprobado')
        router.refresh()
      } else {
        showToast('error', result.error || 'Error al aprobar adelanto', 'Error')
      }
    } catch (error) {
      console.error('Error al aprobar adelanto:', error)
      showToast('error', 'Error inesperado al aprobar adelanto', 'Error')
    } finally {
      setLoadingId(null)
    }
  }

  const handleReject = async (adelanto: Adelanto) => {
    if (!confirm('¿Está seguro de que desea rechazar este adelanto?')) {
      return
    }

    try {
      setLoadingId(adelanto.id)

      const result = await rechazarAdelantoAction(adelanto.id)

      if (result.success) {
        showToast('success', result.message || 'Adelanto rechazado exitosamente', 'Adelanto rechazado')
        router.refresh()
      } else {
        showToast('error', result.error || 'Error al rechazar adelanto', 'Error')
      }
    } catch (error) {
      console.error('Error al rechazar adelanto:', error)
      showToast('error', 'Error inesperado al rechazar adelanto', 'Error')
    } finally {
      setLoadingId(null)
    }
  }

  const handleView = (adelanto: Adelanto) => {
    // TODO: Implementar vista detallada del adelanto
    console.log('Ver adelanto:', adelanto)
  }

  return (
    <AdelantosTable
      adelantos={adelantos}
      onView={handleView}
      onApprove={handleApprove}
      onReject={handleReject}
    />
  )
}

