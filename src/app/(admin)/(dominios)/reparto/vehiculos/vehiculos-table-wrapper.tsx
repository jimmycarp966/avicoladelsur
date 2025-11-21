'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { VehiculosTable } from '@/components/tables/VehiculosTable'
import { useNotificationStore } from '@/store/notificationStore'
import type { Vehiculo } from '@/types/domain.types'

// Datos de ejemplo - en producción vendrían de la base de datos
const vehiculosEjemplo: Vehiculo[] = [
  {
    id: '1',
    patente: 'ABC123',
    marca: 'Fiat',
    modelo: 'Fiorino',
    capacidad_kg: 600,
    tipo_vehiculo: 'fiat_fiorino',
    seguro_vigente: true,
    fecha_vto_seguro: '2026-03-01T00:00:00Z',
    activo: true,
    created_at: '2020-01-01T00:00:00Z',
    updated_at: '2025-11-05T00:00:00Z',
  },
  {
    id: '2',
    patente: 'XYZ789',
    marca: 'Toyota',
    modelo: 'Hilux',
    capacidad_kg: 1500,
    tipo_vehiculo: 'toyota_hilux',
    seguro_vigente: true,
    fecha_vto_seguro: '2026-02-15T00:00:00Z',
    activo: true,
    created_at: '2019-01-01T00:00:00Z',
    updated_at: '2025-11-05T00:00:00Z',
  },
  {
    id: '3',
    patente: 'DEF456',
    marca: 'Ford',
    modelo: 'F-4000',
    capacidad_kg: 4000,
    tipo_vehiculo: 'ford_f4000',
    seguro_vigente: true,
    fecha_vto_seguro: '2026-04-10T00:00:00Z',
    activo: true,
    created_at: '2021-01-01T00:00:00Z',
    updated_at: '2025-11-05T00:00:00Z',
  },
]

export function VehiculosTableWrapper() {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>(vehiculosEjemplo)

  const handleView = (vehiculo: Vehiculo) => {
    router.push(`/reparto/vehiculos/${vehiculo.id}`)
  }

  const handleEdit = (vehiculo: Vehiculo) => {
    router.push(`/reparto/vehiculos/${vehiculo.id}/editar`)
  }

  const handleDelete = async (vehiculo: Vehiculo) => {
    if (confirm(`¿Estás seguro de que quieres eliminar el vehículo ${vehiculo.patente}?`)) {
      try {
        // En producción, esto sería una llamada real a la API
        setVehiculos(prev => prev.filter(v => v.id !== vehiculo.id))
        showToast('success', `Vehículo ${vehiculo.patente} eliminado exitosamente`)
      } catch (error) {
        showToast('error', 'Error al eliminar vehículo')
      }
    }
  }

  const handleMaintenance = (vehiculo: Vehiculo) => {
    router.push(`/reparto/vehiculos/${vehiculo.id}/mantenimiento`)
  }

  const handleInspection = (vehiculo: Vehiculo) => {
    router.push(`/reparto/vehiculos/${vehiculo.id}/checklist`)
  }

  return (
    <VehiculosTable
      data={vehiculos}
      onView={handleView}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onMaintenance={handleMaintenance}
      onInspection={handleInspection}
    />
  )
}
