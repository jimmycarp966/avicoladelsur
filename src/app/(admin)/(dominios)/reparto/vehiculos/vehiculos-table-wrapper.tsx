'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { VehiculosTable } from '@/components/tables/VehiculosTable'
import { useNotificationStore } from '@/store/notificationStore'
import { obtenerVehiculos, eliminarVehiculo } from '@/actions/reparto.actions'
import type { Vehiculo } from '@/types/domain.types'

export function VehiculosTableWrapper() {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadVehiculos()
  }, [])

  const loadVehiculos = async () => {
    try {
      setIsLoading(true)
      const result = await obtenerVehiculos()
      if (result.success && result.data) {
        setVehiculos(result.data as Vehiculo[])
      } else {
        showToast('error', result.error || 'Error al cargar vehículos')
      }
    } catch (error: any) {
      console.error('Error al cargar vehículos:', error)
      showToast('error', 'Error al cargar vehículos')
    } finally {
      setIsLoading(false)
    }
  }

  const handleView = (vehiculo: Vehiculo) => {
    router.push(`/reparto/vehiculos/${vehiculo.id}`)
  }

  const handleEdit = (vehiculo: Vehiculo) => {
    router.push(`/reparto/vehiculos/${vehiculo.id}/editar`)
  }

  const handleDelete = async (vehiculo: Vehiculo) => {
    if (confirm(`¿Estás seguro de que quieres eliminar el vehículo ${vehiculo.patente}?`)) {
      try {
        const result = await eliminarVehiculo(vehiculo.id)
        if (result.success) {
          await loadVehiculos()
          showToast('success', result.message || `Vehículo ${vehiculo.patente} eliminado exitosamente`)
        } else {
          showToast('error', result.error || 'Error al eliminar vehículo')
        }
      } catch (error: any) {
        console.error('Error al eliminar vehículo:', error)
        showToast('error', error.message || 'Error al eliminar vehículo')
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
