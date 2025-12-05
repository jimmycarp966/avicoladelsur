'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  const isMountedRef = useRef(true)

  // Cargar productos desde la base de datos
  const loadProductos = useCallback(async () => {
    if (!isMountedRef.current) return
    
    try {
      setIsLoading(true)
      const result = await obtenerProductos()
      
      if (!isMountedRef.current) return
      
      if (result.success && result.data) {
        setProductos(result.data as Producto[])
      } else {
        showToast('error', result.error || 'Error al cargar productos')
      }
    } catch (error: any) {
      if (!isMountedRef.current) return
      console.error('Error al cargar productos:', error)
      showToast('error', 'Error al cargar productos')
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    loadProductos()

    return () => {
      isMountedRef.current = false
    }
  }, [loadProductos])

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
