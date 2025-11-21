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
    marca: 'Toyota',
    modelo: 'Hilux',
    capacidad_kg: 1000,
    tipo_vehiculo: 'camioneta',
    seguro_vigente: true,
    fecha_vto_seguro: '2026-03-01T00:00:00Z',
    activo: true,
    created_at: '2020-01-01T00:00:00Z',
    updated_at: '2025-11-05T00:00:00Z',
  },
  {
    id: '2',
    patente: 'XYZ789',
    marca: 'Fiat',
    modelo: 'Fiorino',
    capacidad_kg: 800,
    tipo_vehiculo: 'furgon',
    seguro_vigente: true,
    fecha_vto_seguro: '2026-02-15T00:00:00Z',
    activo: true,
    created_at: '2019-01-01T00:00:00Z',
    updated_at: '2025-11-05T00:00:00Z',
  },
  {
    id: '3',
    patente: 'DEF456',
    marca: 'Honda',
    modelo: 'CB300R',
    capacidad_kg: 20,
    tipo_vehiculo: 'moto',
    seguro_vigente: true,
    fecha_vto_seguro: '2026-04-10T00:00:00Z',
    activo: true,
    created_at: '2021-01-01T00:00:00Z',
    updated_at: '2025-11-05T00:00:00Z',
  },
  {
    id: '4',
    patente: 'GHI012',
    marca: 'Peugeot',
    modelo: 'Partner',
    capacidad_kg: 600,
    tipo_vehiculo: 'furgon',
    seguro_vigente: false,
    fecha_vto_seguro: '2025-10-30T00:00:00Z',
    activo: false,
    created_at: '2018-01-01T00:00:00Z',
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
