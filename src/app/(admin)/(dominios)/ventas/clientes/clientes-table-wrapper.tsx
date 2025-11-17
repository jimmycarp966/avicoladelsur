'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClientesTable } from '@/components/tables/ClientesTable'
import { useNotificationStore } from '@/store/notificationStore'
import type { Cliente } from '@/types/domain.types'

// Datos de ejemplo - en producción vendrían de la base de datos
const clientesEjemplo: Cliente[] = [
  {
    id: '1',
    nombre: 'Supermercado Central',
    telefono: '+5491123456789',
    whatsapp: '+5491123456789',
    email: 'contacto@supercentral.com',
    direccion: 'Av. Principal 123, Ciudad',
    zona_entrega: 'Centro',
    tipo_cliente: 'mayorista',
    limite_credito: 50000.00,
    activo: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    nombre: 'Tienda Familiar',
    telefono: '+5491198765432',
    whatsapp: '+5491198765432',
    email: 'familia@tiendafamiliar.com',
    direccion: 'Calle Secundaria 456, Ciudad',
    zona_entrega: 'Norte',
    tipo_cliente: 'minorista',
    limite_credito: 10000.00,
    activo: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '3',
    nombre: 'Restaurante El Buen Sabor',
    telefono: '+5491188889999',
    whatsapp: '+5491188889999',
    email: 'info@elbuensabor.com',
    direccion: 'Plaza Mayor 789, Ciudad',
    zona_entrega: 'Centro',
    tipo_cliente: 'minorista',
    limite_credito: 15000.00,
    activo: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
]

export function ClientesTableWrapper() {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [clientes, setClientes] = useState<Cliente[]>(clientesEjemplo)

  const handleView = (cliente: Cliente) => {
    router.push(`/ventas/clientes/${cliente.id}`)
  }

  const handleEdit = (cliente: Cliente) => {
    router.push(`/ventas/clientes/${cliente.id}/editar`)
  }

  const handleDelete = async (cliente: Cliente) => {
    if (confirm(`¿Estás seguro de que quieres eliminar al cliente "${cliente.nombre}"?`)) {
      try {
        // En producción, esto sería una llamada real a la API
        setClientes(prev => prev.filter(c => c.id !== cliente.id))
        showToast('success', 'Cliente eliminado exitosamente')
      } catch (error) {
        showToast('error', 'Error al eliminar cliente')
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
