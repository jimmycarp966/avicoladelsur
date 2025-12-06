'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ReclamosTable } from '@/components/tables/ReclamosTable'
import { useNotificationStore } from '@/store/notificationStore'
import { obtenerReclamos } from '@/actions/ventas.actions'
import type { Reclamo } from '@/types/domain.types'

interface ReclamoCompleto extends Reclamo {
  cliente?: { nombre: string; telefono?: string; codigo?: string }
  pedido?: { numero_pedido: string }
  usuario_asignado_obj?: { nombre: string; apellido?: string }
}

export function ReclamosTableWrapper() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useNotificationStore()
  const [reclamos, setReclamos] = useState<ReclamoCompleto[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadReclamos()
  }, [searchParams])

  const loadReclamos = async () => {
    try {
      setIsLoading(true)
      const filtros: any = {}
      
      if (searchParams.get('estado')) filtros.estado = searchParams.get('estado')
      if (searchParams.get('prioridad')) filtros.prioridad = searchParams.get('prioridad')
      if (searchParams.get('tipo_reclamo')) filtros.tipo_reclamo = searchParams.get('tipo_reclamo')
      if (searchParams.get('cliente_id')) filtros.cliente_id = searchParams.get('cliente_id')
      if (searchParams.get('fecha_desde')) filtros.fecha_desde = searchParams.get('fecha_desde')
      if (searchParams.get('fecha_hasta')) filtros.fecha_hasta = searchParams.get('fecha_hasta')
      if (searchParams.get('search')) filtros.search = searchParams.get('search')

      const result = await obtenerReclamos(filtros)

      if (result.success && result.data) {
        setReclamos(Array.isArray(result.data) ? result.data : [])
      } else {
        showToast('error', result.error || 'Error al cargar reclamos')
      }
    } catch (error: any) {
      console.error('Error al cargar reclamos:', error)
      showToast('error', 'Error al cargar reclamos')
    } finally {
      setIsLoading(false)
    }
  }

  const handleView = (reclamo: ReclamoCompleto) => {
    router.push(`/ventas/reclamos/${reclamo.id}`)
  }

  const handleUpdateStatus = (reclamo: ReclamoCompleto) => {
    router.push(`/ventas/reclamos/${reclamo.id}/editar`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Cargando reclamos...</div>
      </div>
    )
  }

  return (
    <ReclamosTable
      data={reclamos}
      onView={handleView}
      onUpdateStatus={handleUpdateStatus}
    />
  )
}

