'use client'

import { ProductoForm } from '@/components/forms/ProductoForm'

export function NuevoProductoForm() {
  return <ProductoForm onSuccess={() => window.location.href = '/almacen/productos'} />
}
