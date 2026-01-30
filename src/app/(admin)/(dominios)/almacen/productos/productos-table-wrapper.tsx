'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ProductosTable } from '@/components/tables/ProductosTable'
import { useNotificationStore } from '@/store/notificationStore'
import { obtenerProductosAction, eliminarProductoAction } from '@/actions/almacen.actions'
import type { Producto } from '@/types/domain.types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

export function ProductosTableWrapper() {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [productos, setProductos] = useState<Producto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const isMountedRef = useRef(true)

  // Estados de filtros
  const [filtroCategoria, setFiltroCategoria] = useState<string>('all')
  const [filtroEstado, setFiltroEstado] = useState<string>('all')
  const [filtroVentaMayor, setFiltroVentaMayor] = useState<string>('all')

  // Cargar productos desde la base de datos
  const loadProductos = useCallback(async () => {
    if (!isMountedRef.current) return

    try {
      setIsLoading(true)
      const result = await obtenerProductosAction()

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

  // Obtener categorías únicas para el filtro
  const categoriasUnicas = useMemo(() => {
    const cats = new Set(productos.map(p => p.categoria).filter(Boolean))
    return Array.from(cats).sort()
  }, [productos])

  // Productos filtrados
  const productosFiltrados = useMemo(() => {
    return productos.filter(p => {
      if (filtroCategoria !== 'all' && p.categoria !== filtroCategoria) return false
      if (filtroEstado === 'activo' && !p.activo) return false
      if (filtroEstado === 'inactivo' && p.activo) return false
      if (filtroVentaMayor === 'si' && !p.venta_mayor_habilitada) return false
      if (filtroVentaMayor === 'no' && p.venta_mayor_habilitada) return false
      return true
    })
  }, [productos, filtroCategoria, filtroEstado, filtroVentaMayor])

  // Limpiar todos los filtros
  const limpiarFiltros = () => {
    setFiltroCategoria('all')
    setFiltroEstado('all')
    setFiltroVentaMayor('all')
  }

  const hayFiltrosActivos = filtroCategoria !== 'all' || filtroEstado !== 'all' || filtroVentaMayor !== 'all'

  const handleView = (producto: Producto) => {
    router.push(`/almacen/productos/${producto.id}`)
  }

  const handleEdit = (producto: Producto) => {
    router.push(`/almacen/productos/${producto.id}/editar`)
  }

  const handleDelete = async (producto: Producto) => {
    if (confirm(`¿Estás seguro de que quieres eliminar el producto "${producto.nombre}"?`)) {
      try {
        const result = await eliminarProductoAction(producto.id)
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
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-4 items-end p-4 bg-muted/30 rounded-lg border">
        <div className="flex flex-col gap-1.5">
          <Label className="text-sm font-medium">Categoría</Label>
          <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {categoriasUnicas.map(cat => (
                <SelectItem key={cat} value={cat!}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-sm font-medium">Estado</Label>
          <Select value={filtroEstado} onValueChange={setFiltroEstado}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="activo">Activos</SelectItem>
              <SelectItem value="inactivo">Inactivos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-sm font-medium">Venta Mayor</Label>
          <Select value={filtroVentaMayor} onValueChange={setFiltroVentaMayor}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="si">Sí (Cajones)</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hayFiltrosActivos && (
          <Button variant="ghost" size="sm" onClick={limpiarFiltros} className="h-10">
            <X className="mr-1 h-4 w-4" />
            Limpiar
          </Button>
        )}

        <div className="ml-auto text-sm text-muted-foreground">
          {productosFiltrados.length} de {productos.length} productos
        </div>
      </div>

      {/* Tabla */}
      <ProductosTable
        data={productosFiltrados}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  )
}
