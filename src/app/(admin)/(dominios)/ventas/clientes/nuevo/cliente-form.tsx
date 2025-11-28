'use client'

import { ClienteForm } from '@/components/forms/ClienteForm'

interface NuevoClienteFormProps {
  zonas: Array<{ id: string; nombre: string }>
}

export function NuevoClienteForm({ zonas }: NuevoClienteFormProps) {
  return <ClienteForm zonas={zonas} onSuccess={() => window.location.href = '/ventas/clientes'} />
}
