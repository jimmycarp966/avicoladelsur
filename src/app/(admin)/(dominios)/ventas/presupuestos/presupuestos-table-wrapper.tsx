'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PresupuestosTable } from '@/components/tables/PresupuestosTable'
import { useNotificationStore } from '@/store/notificationStore'
import { obtenerPresupuestosAction, enviarPresupuestoAlmacenAction, recalcularPresupuestoAction } from '@/actions/presupuestos.actions'
import type { Database } from '@/types/database.types'

type Presupuesto = {
  id: string
  numero_presupuesto: string
  cliente_id: string
  zona_id?: string
  estado: string
  fecha_entrega_estimada?: string
  total_estimado: number
  total_final?: number
  observaciones?: string
  usuario_vendedor?: string
  created_at: string
  updated_at: string
  cliente?: { nombre: string; telefono?: string }
  zona?: { nombre: string }
  usuario_vendedor_obj?: { nombre: string }
  items?: any[]
}

export function PresupuestosTableWrapper() {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([])
  const [loading, setLoading] = useState(true)

  // Cargar presupuestos al montar el componente
  useEffect(() => {
    loadPresupuestos()
  }, [])

  const loadPresupuestos = async () => {
    try {
      setLoading(true)
      const result = await obtenerPresupuestosAction()
      if (result.success) {
        setPresupuestos(result.data || [])
      } else {
        showToast('error', 'Error al cargar presupuestos')
      }
    } catch (error) {
      console.error('Error cargando presupuestos:', error)
      showToast('error', 'Error al cargar presupuestos')
    } finally {
      setLoading(false)
    }
  }

  const handleView = (presupuesto: Presupuesto) => {
    router.push(`/ventas/presupuestos/${presupuesto.id}`)
  }

  const handleEdit = (presupuesto: Presupuesto) => {
    router.push(`/ventas/presupuestos/${presupuesto.id}/editar`)
  }

  const handleSendToWarehouse = async (presupuesto: Presupuesto) => {
    try {
      const formData = new FormData()
      formData.append('presupuesto_id', presupuesto.id)

      const result = await enviarPresupuestoAlmacenAction(presupuesto.id)

      if (result.success) {
        showToast('success', result.message)
        // Recargar la lista
        await loadPresupuestos()
      } else {
        showToast('error', result.message)
      }
    } catch (error) {
      console.error('Error enviando presupuesto a almacén:', error)
      showToast('error', 'Error al enviar presupuesto a almacén')
    }
  }

  const handleReserveStock = async (presupuesto: Presupuesto) => {
    try {
      const formData = new FormData()
      formData.append('presupuesto_id', presupuesto.id)

      // Aquí iría la llamada a reservarStockAction
      // Por ahora, solo mostramos el toast
      showToast('info', 'Funcionalidad de reserva de stock en desarrollo')
    } catch (error) {
      console.error('Error reservando stock:', error)
      showToast('error', 'Error al reservar stock')
    }
  }

  const handleConvertToOrder = async (presupuesto: Presupuesto) => {
    try {
      const formData = new FormData()
      formData.append('presupuesto_id', presupuesto.id)
      // Opcionalmente agregar caja_id si es necesario

      // Aquí iría la llamada a confirmarPresupuestoAction
      showToast('info', 'Funcionalidad de conversión a pedido en desarrollo')
    } catch (error) {
      console.error('Error convirtiendo presupuesto:', error)
      showToast('error', 'Error al convertir presupuesto')
    }
  }

  const handleRecalculate = async (presupuesto: Presupuesto) => {
    try {
      const result = await recalcularPresupuestoAction(presupuesto.id)

      if (result.success) {
        showToast('success', result.message || 'Presupuesto recalculado exitosamente')
        // Recargar la lista
        await loadPresupuestos()
      } else {
        showToast('error', result.message || 'Error al recalcular presupuesto')
      }
    } catch (error) {
      console.error('Error recalculando presupuesto:', error)
      showToast('error', 'Error al recalcular presupuesto')
    }
  }

  if (loading) {
    return <div>Cargando presupuestos...</div>
  }

  return (
    <PresupuestosTable
      data={presupuestos}
      onView={handleView}
      onEdit={handleEdit}
      onSendToWarehouse={handleSendToWarehouse}
      onReserveStock={handleReserveStock}
      onConvertToOrder={handleConvertToOrder}
      onRecalculate={handleRecalculate}
    />
  )
}
