'use client'

import { ClienteForm } from '@/components/forms/ClienteForm'

export function NuevoClienteForm() {
  return <ClienteForm onSuccess={() => window.location.href = '/ventas/clientes'} />
}
