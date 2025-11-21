'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { RutasTable } from '@/components/tables/RutasTable'
import { useNotificationStore } from '@/store/notificationStore'
import { obtenerRutas } from '@/actions/reparto.actions'
import type { RutaReparto as Ruta } from '@/types/domain.types'

export function RutasTableWrapper() {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [rutas, setRutas] = useState<Ruta[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadRutas()
  }, [])

  const loadRutas = async () => {
    try {
      setIsLoading(true)
      const result = await obtenerRutas()
      if (result.success && result.data) {
        setRutas(result.data as Ruta[])
      } else {
        showToast('error', result.error || 'Error al cargar rutas')
      }
    } catch (error: any) {
      console.error('Error al cargar rutas:', error)
      showToast('error', 'Error al cargar rutas')
    } finally {
      setIsLoading(false)
    }
  }

  const handleView = (ruta: Ruta) => {
    router.push(`/reparto/rutas/${ruta.id}`)
  }

  const handleEdit = (ruta: Ruta) => {
    router.push(`/reparto/rutas/${ruta.id}/editar`)
  }

  const handleDelete = async (ruta: Ruta) => {
    if (confirm(`¿Estás seguro de que quieres cancelar la ruta ${ruta.numero_ruta}?`)) {
      try {
        // TODO: Implementar cancelación de ruta cuando esté disponible
        await loadRutas()
        showToast('success', `Ruta ${ruta.numero_ruta} cancelada exitosamente`)
      } catch (error: any) {
        console.error('Error al cancelar ruta:', error)
        showToast('error', error.message || 'Error al cancelar ruta')
      }
    }
  }

  const handleStart = async (ruta: Ruta) => {
    try {
      const { iniciarRuta } = await import('@/actions/reparto.actions')
      const result = await iniciarRuta(ruta.id)
      if (result.success) {
        await loadRutas()
        showToast('success', result.message || `Ruta ${ruta.numero_ruta} iniciada exitosamente`)
      } else {
        showToast('error', result.error || 'Error al iniciar ruta')
      }
    } catch (error: any) {
      console.error('Error al iniciar ruta:', error)
      showToast('error', error.message || 'Error al iniciar ruta')
    }
  }

  const handleComplete = async (ruta: Ruta) => {
    try {
      const { finalizarRuta } = await import('@/actions/reparto.actions')
      const result = await finalizarRuta(ruta.id)
      if (result.success) {
        await loadRutas()
        showToast('success', result.message || `Ruta ${ruta.numero_ruta} completada exitosamente`)
      } else {
        showToast('error', result.error || 'Error al completar ruta')
      }
    } catch (error: any) {
      console.error('Error al completar ruta:', error)
      showToast('error', error.message || 'Error al completar ruta')
    }
  }

  if (isLoading) {
    return <div className="p-6">Cargando rutas...</div>
  }

  return (
    <RutasTable
      data={rutas}
      onView={handleView}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onStart={handleStart}
      onComplete={handleComplete}
    />
  )
}
