'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProductosTable } from '@/components/tables/ProductosTable'
import { useNotificationStore } from '@/store/notificationStore'
// import { eliminarProducto } from '@/actions/almacen.actions' // TODO: Implementar cuando esté disponible
import type { Producto } from '@/types/domain.types'

// Datos de ejemplo - en producción vendrían de la base de datos
const productosEjemplo: Producto[] = [
  {
    id: '1',
    codigo: 'POLLO001',
    nombre: 'Pollo Entero',
    descripcion: 'Pollo entero fresco de granja',
    categoria: 'Aves',
    precio_venta: 850.00,
    precio_costo: 700.00,
    unidad_medida: 'kg',
    stock_minimo: 50,
    activo: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    codigo: 'POLLO002',
    nombre: 'Pechuga de Pollo',
    descripcion: 'Pechuga de pollo sin hueso',
    categoria: 'Aves',
    precio_venta: 1200.00,
    precio_costo: 950.00,
    unidad_medida: 'kg',
    stock_minimo: 30,
    activo: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '3',
    codigo: 'HUEVO001',
    nombre: 'Huevos Blancos',
    descripcion: 'Docena de huevos blancos frescos',
    categoria: 'Huevos',
    precio_venta: 180.00,
    precio_costo: 140.00,
    unidad_medida: 'docena',
    stock_minimo: 100,
    activo: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '4',
    codigo: 'POLLO003',
    nombre: 'Alas de Pollo',
    descripcion: 'Alas de pollo frescas',
    categoria: 'Aves',
    precio_venta: 650.00,
    precio_costo: 520.00,
    unidad_medida: 'kg',
    stock_minimo: 25,
    activo: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
]

export function ProductosTableWrapper() {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [productos, setProductos] = useState<Producto[]>(productosEjemplo)

  const handleView = (producto: Producto) => {
    router.push(`/almacen/productos/${producto.id}`)
  }

  const handleEdit = (producto: Producto) => {
    router.push(`/almacen/productos/${producto.id}/editar`)
  }

  const handleDelete = async (producto: Producto) => {
    if (confirm(`¿Estás seguro de que quieres eliminar el producto "${producto.nombre}"?`)) {
      try {
        // En producción, esto sería una llamada real a la API
        // const result = await eliminarProducto(producto.id)
        // if (result.success) {
        //   setProductos(prev => prev.filter(p => p.id !== producto.id))
        //   showToast('success', 'Producto eliminado exitosamente')
        // } else {
        //   showToast('error', result.error || 'Error al eliminar producto')
        // }

        // Simulación para desarrollo
        setProductos(prev => prev.filter(p => p.id !== producto.id))
        showToast('success', 'Producto eliminado exitosamente')
      } catch (error) {
        showToast('error', 'Error al eliminar producto')
      }
    }
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
