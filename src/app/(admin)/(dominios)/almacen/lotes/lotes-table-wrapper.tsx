'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LotesTable } from '@/components/tables/LotesTable'
import { useNotificationStore } from '@/store/notificationStore'
import { obtenerLotes } from '@/actions/almacen.actions'
import type { Lote } from '@/types/domain.types'

export function LotesTableWrapper() {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [lotes, setLotes] = useState<Lote[]>([])
  const [loading, setLoading] = useState(true)

  // Cargar lotes reales de la base de datos
  useEffect(() => {
    async function cargarLotes() {
      setLoading(true)
      const result = await obtenerLotes()
      
      if (result.success && result.data) {
        setLotes(result.data as Lote[])
      } else {
        showToast('error', 'Error al cargar lotes')
      }
      setLoading(false)
    }
    
    cargarLotes()
  }, [showToast])

  const handleView = (lote: Lote) => {
    router.push(`/almacen/lotes/${lote.id}`)
  }

  const handleEdit = (lote: Lote) => {
    router.push(`/almacen/lotes/${lote.id}/editar`)
  }

  const handleDelete = async (lote: Lote) => {
    if (confirm(`¿Estás seguro de que quieres eliminar el lote ${lote.numero_lote}?`)) {
      try {
        // TODO: Implementar eliminación real
        setLotes(prev => prev.filter(l => l.id !== lote.id))
        showToast('success', `Lote ${lote.numero_lote} eliminado exitosamente`)
      } catch (error) {
        showToast('error', 'Error al eliminar lote')
      }
    }
  }

  const handleAdjust = (lote: Lote) => {
    router.push(`/almacen/lotes/${lote.id}/ajustar`)
  }

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Cargando lotes...</div>
  }

  return (
    <LotesTable
      data={lotes}
      onView={handleView}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onAdjust={handleAdjust}
    />
  )
}
