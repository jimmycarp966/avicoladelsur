'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ProductosTable } from '@/components/tables/ProductosTable'
import { useNotificationStore } from '@/store/notificationStore'
import { obtenerProductos, eliminarProducto } from '@/actions/almacen.actions'
import type { Producto } from '@/types/domain.types'

export function ProductosTableWrapper() {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [productos, setProductos] = useState<Producto[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadProductos()
  }, [])

  const loadProductos = async () => {
    try {
      setIsLoading(true)
      const result = await obtenerProductos()
      if (result.success && result.data) {
        setProductos(result.data as Producto[])
      } else {
        showToast('error', result.error || 'Error al cargar productos')
      }
    } catch (error: any) {
      console.error('Error al cargar productos:', error)
      showToast('error', 'Error al cargar productos')
    } finally {
      setIsLoading(false)
    }
  }

  const handleView = (producto: Producto) => {
    router.push(`/almacen/productos/${producto.id}`)
  }

  const handleEdit = (producto: Producto) => {
    router.push(`/almacen/productos/${producto.id}/editar`)
  }

  const handleDelete = async (producto: Producto) => {
    if (confirm(`¿Estás seguro de que quieres eliminar el producto "${producto.nombre}"?`)) {
      try {
        const result = await eliminarProducto(producto.id)
        if (result.success) {
          await loadProductos()
          showToast('success', result.message || 'Producto eliminado exitosamente')
        } else {
          showToast('error', result.error || 'Error al eliminar producto')
        }
      } catch (error: any) {
        console.error('Error al eliminar producto:', error)
        showToast('error', error.message || 'Error al eliminar producto')
      }
    }
  }

  if (isLoading) {
    return <div className="p-6">Cargando productos...</div>
  }

  return (
    <ProductosTable
      data={productos}
      onView={handleView}
      onEdit={handleEdit}
      onDelete={handleDelete}
    />
  )
}
