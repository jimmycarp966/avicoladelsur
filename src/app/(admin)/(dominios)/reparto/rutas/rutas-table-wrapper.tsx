'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RutasTable } from '@/components/tables/RutasTable'
import { useNotificationStore } from '@/store/notificationStore'
import type { RutaReparto as Ruta } from '@/types/domain.types'

// Datos de ejemplo - en producción vendrían de la base de datos
const rutasEjemplo: Ruta[] = [
  {
    id: '1',
    numero_ruta: 'RUT-2025-001',
    vehiculo_id: '1',
    repartidor_id: '1',
    fecha_ruta: '2025-11-05T00:00:00Z',
    estado: 'en_curso',
    distancia_estimada_km: 45.5,
    tiempo_estimado_min: 270,
    peso_total_kg: 120.5,
    observaciones: 'Ruta prioritaria - incluye cliente mayorista',
    created_at: '2025-11-04T18:00:00Z',
    updated_at: '2025-11-05T08:15:00Z',
  },
  {
    id: '2',
    numero_ruta: 'RUT-2025-002',
    vehiculo_id: '2',
    repartidor_id: '2',
    fecha_ruta: '2025-11-05T00:00:00Z',
    estado: 'planificada',
    distancia_estimada_km: 38.2,
    tiempo_estimado_min: 225,
    peso_total_kg: 95.0,
    observaciones: 'Ruta de la tarde - zona residencial',
    created_at: '2025-11-04T20:00:00Z',
    updated_at: '2025-11-04T20:00:00Z',
  },
  {
    id: '3',
    numero_ruta: 'RUT-2025-003',
    vehiculo_id: '1',
    repartidor_id: '1',
    fecha_ruta: '2025-11-04T00:00:00Z',
    estado: 'completada',
    distancia_estimada_km: 52.8,
    distancia_real_km: 55.2,
    tiempo_estimado_min: 315,
    tiempo_real_min: 298,
    peso_total_kg: 145.5,
    costo_combustible: 1250.00,
    observaciones: 'Ruta completada exitosamente - todos los pedidos entregados',
    created_at: '2025-11-03T17:00:00Z',
    updated_at: '2025-11-04T13:45:00Z',
  },
]

export function RutasTableWrapper() {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [rutas, setRutas] = useState<Ruta[]>(rutasEjemplo)

  const handleView = (ruta: Ruta) => {
    router.push(`/reparto/rutas/${ruta.id}`)
  }

  const handleEdit = (ruta: Ruta) => {
    router.push(`/reparto/rutas/${ruta.id}/editar`)
  }

  const handleDelete = async (ruta: Ruta) => {
    if (confirm(`¿Estás seguro de que quieres cancelar la ruta ${ruta.numero_ruta}?`)) {
      try {
        // En producción, esto sería una llamada real a la API
        setRutas(prev => prev.map(r =>
          r.id === ruta.id ? { ...r, estado: 'cancelada' } : r
        ))
        showToast('success', `Ruta ${ruta.numero_ruta} cancelada exitosamente`)
      } catch (error) {
        showToast('error', 'Error al cancelar ruta')
      }
    }
  }

  const handleStart = async (ruta: Ruta) => {
    try {
      // En producción, esto sería una llamada real a la API
      setRutas(prev => prev.map(r =>
        r.id === ruta.id ? { ...r, estado: 'en_curso' } : r
      ))
      showToast('success', `Ruta ${ruta.numero_ruta} iniciada exitosamente`)
    } catch (error) {
      showToast('error', 'Error al iniciar ruta')
    }
  }

  const handleComplete = async (ruta: Ruta) => {
    try {
      // En producción, esto sería una llamada real a la API
      setRutas(prev => prev.map(r =>
        r.id === ruta.id ? { ...r, estado: 'completada' } : r
      ))
      showToast('success', `Ruta ${ruta.numero_ruta} completada exitosamente`)
    } catch (error) {
      showToast('error', 'Error al completar ruta')
    }
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
