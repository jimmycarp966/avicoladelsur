'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PresupuestosTable } from '@/components/tables/PresupuestosTable'
import { useNotificationStore } from '@/store/notificationStore'
import { obtenerPresupuestosAction, enviarPresupuestoAlmacenAction, recalcularPresupuestoAction, reservarStockAction, confirmarPresupuestoAction } from '@/actions/presupuestos.actions'
import { FileText } from 'lucide-react'
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
        const presupuestosData = result.data || []
        setPresupuestos(presupuestosData)
        
        // Si no hay presupuestos, no mostrar error, solo mostrar lista vacía
        if (presupuestosData.length === 0) {
          // No mostrar error si simplemente no hay datos
          console.log('No hay presupuestos para mostrar')
        }
      } else {
        // Solo mostrar error si hay un problema real
        console.error('Error obteniendo presupuestos:', result.message, result.error)
        // Mostrar mensaje más detallado si está disponible
        const errorMessage = result.error?.message || result.message || 'Error al cargar presupuestos'
        showToast('error', errorMessage)
      }
    } catch (error) {
      console.error('Error cargando presupuestos:', error)
      showToast('error', 'Error al cargar presupuestos. Por favor, intenta nuevamente.')
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

      const result = await reservarStockAction(formData)

      if (result.success) {
        showToast('success', result.message || 'Stock reservado exitosamente')
        await loadPresupuestos()
      } else {
        showToast('error', result.message || 'Error al reservar stock')
      }
    } catch (error) {
      console.error('Error reservando stock:', error)
      showToast('error', 'Error al reservar stock')
    }
  }

  const handleConvertToOrder = async (presupuesto: Presupuesto) => {
    try {
      if (!confirm(`¿Estás seguro de convertir el presupuesto ${presupuesto.numero_presupuesto} a pedido?`)) {
        return
      }

      const formData = new FormData()
      formData.append('presupuesto_id', presupuesto.id)
      // caja_id es opcional, se puede agregar después si es necesario

      const result = await confirmarPresupuestoAction(formData)

      if (result.success) {
        showToast('success', result.message || 'Presupuesto convertido a pedido exitosamente')
        await loadPresupuestos()
        // Redirigir al pedido creado si hay ID
        if (result.data?.pedido_id) {
          router.push(`/almacen/pedidos/${result.data.pedido_id}`)
        }
      } else {
        showToast('error', result.message || 'Error al convertir presupuesto')
      }
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
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando presupuestos...</p>
        </div>
      </div>
    )
  }

  // Mostrar mensaje amigable si no hay presupuestos
  if (!loading && presupuestos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="text-center max-w-md">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No hay presupuestos</h3>
          <p className="text-muted-foreground mb-4">
            Aún no se han creado presupuestos en el sistema. Puedes crear uno nuevo haciendo clic en el botón "Nuevo Presupuesto".
          </p>
        </div>
      </div>
    )
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
