'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ClientesTable } from '@/components/tables/ClientesTable'
import { useNotificationStore } from '@/store/notificationStore'
import { obtenerClientesAction, eliminarClienteAction } from '@/actions/ventas.actions'
import type { Cliente } from '@/types/domain.types'

export function ClientesTableWrapper() {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadClientes()
  }, [])

  const loadClientes = async () => {
    try {
      setIsLoading(true)
      const result = await obtenerClientesAction()

      if (result.success && result.data) {
        setClientes(Array.isArray(result.data) ? result.data : [])
      } else {
        showToast('error', result.error || 'Error al cargar clientes')
      }
    } catch (error: any) {
      console.error('Error al cargar clientes:', error)
      showToast('error', 'Error al cargar clientes')
    } finally {
      setIsLoading(false)
    }
  }

  const handleView = (cliente: Cliente) => {
    router.push(`/ventas/clientes/${cliente.id}`)
  }

  const handleEdit = (cliente: Cliente) => {
    router.push(`/ventas/clientes/${cliente.id}/editar`)
  }

  const handleDelete = async (cliente: Cliente) => {
    if (confirm(`¿Estás seguro de que quieres eliminar al cliente "${cliente.nombre}"?`)) {
      try {
        const result = await eliminarClienteAction(cliente.id)
        if (result.success) {
          await loadClientes()
          showToast('success', result.message || 'Cliente eliminado exitosamente')
        } else {
          showToast('error', result.error || 'Error al eliminar cliente')
        }
      } catch (error: any) {
        console.error('Error al eliminar cliente:', error)
        showToast('error', error.message || 'Error al eliminar cliente')
      }
    }
  }

  const handleCall = (cliente: Cliente) => {
    if (cliente.telefono) {
      window.open(`tel:${cliente.telefono}`, '_self')
    }
  }

  const handleWhatsApp = (cliente: Cliente) => {
    if (cliente.whatsapp) {
      const message = encodeURIComponent('Hola, le escribo desde Avícola del Sur')
      window.open(`https://wa.me/${cliente.whatsapp.replace(/[^\d]/g, '')}?text=${message}`, '_blank')
    }
  }

  return (
    <ClientesTable
      data={clientes}
      onView={handleView}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onCall={handleCall}
      onWhatsApp={handleWhatsApp}
    />
  )
}
