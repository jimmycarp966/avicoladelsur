'use client'

import { ClienteForm } from '@/components/forms/ClienteForm'
import { useRouter } from 'next/navigation'

interface EditarClienteFormProps {
  cliente: {
    id: string
    codigo: string
    nombre: string
    telefono?: string
    whatsapp?: string
    email?: string
    direccion?: string
    zona_entrega?: string
    coordenadas?: { lat: number; lng: number }
    tipo_cliente: string
    limite_credito: number
    activo: boolean
  }
}

export function EditarClienteForm({ cliente }: EditarClienteFormProps) {
  const router = useRouter()
  
  return (
    <ClienteForm 
      cliente={cliente} 
      onSuccess={() => router.push('/ventas/clientes')} 
    />
  )
}
