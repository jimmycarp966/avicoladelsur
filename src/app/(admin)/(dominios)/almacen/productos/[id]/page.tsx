import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Edit, Package, TrendingUp, AlertTriangle } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
// import { getProductoById } from '@/actions/almacen.actions' // TODO: Implementar cuando esté disponible

interface ProductoDetallePageProps {
  params: {
    id: string
  }
}

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Detalle Producto - Avícola del Sur ERP',
  description: 'Información detallada del producto',
}

export default async function ProductoDetallePage({ params }: ProductoDetallePageProps) {
  const { id } = await params
  const productoId = id

  // En producción, esto sería una llamada real a la base de datos
  // const producto = await getProductoById(productoId)
  // if (!producto) notFound()

  // Datos de ejemplo para desarrollo
  const productoEjemplo = {
    id: productoId,
    codigo: 'POLLO001',
    nombre: 'Pollo Entero',
    descripcion: 'Pollo entero fresco de granja, criado en condiciones óptimas y procesado siguiendo los más altos estándares de calidad.',
    categoria: 'Aves',
    precio_venta: 850.00,
    precio_costo: 700.00,
    unidad_medida: 'kg',
    stock_minimo: 50,
    stock_actual: 75,
    activo: true,
    fecha_creacion: '2024-01-15T10:00:00Z',
    fecha_actualizacion: '2025-11-05T14:30:00Z',
    lotes_activos: 3,
    total_vendido_mes: 120,
  }

  const producto = productoEjemplo

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10"></div>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" asChild className="hover:bg-primary/5 hover:text-primary hover:border-primary/30">
              <Link href="/almacen/productos">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{producto.nombre}</h1>
              <p className="text-muted-foreground">Código: {producto.codigo}</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" asChild className="bg-primary text-white hover:bg-primary/90 shadow-sm">
              <Link href={`/almacen/productos/${producto.id}/editar`}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Estado del producto */}
      <div className="flex items-center space-x-4">
        <Badge variant={producto.activo ? "default" : "secondary"}>
          {producto.activo ? "Activo" : "Inactivo"}
        </Badge>
        <Badge variant="outline">{producto.categoria}</Badge>
        {producto.stock_actual <= producto.stock_minimo && (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Stock Bajo
          </Badge>
        )}
      </div>

      {/* Información principal */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Información básica */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Información Básica
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Nombre</label>
              <p className="text-sm">{producto.nombre}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Código</label>
              <p className="text-sm font-mono">{producto.codigo}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Categoría</label>
              <p className="text-sm">{producto.categoria}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Unidad de Medida</label>
              <p className="text-sm">{producto.unidad_medida}</p>
            </div>
            <Separator />
            <div>
              <label className="text-sm font-medium text-muted-foreground">Descripción</label>
              <p className="text-sm mt-1">{producto.descripcion}</p>
            </div>
          </CardContent>
        </Card>

        {/* Información económica */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Información Económica
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Precio de Venta</label>
              <p className="text-lg font-semibold text-success">
                {formatCurrency(producto.precio_venta)}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Precio de Costo</label>
              <p className="text-sm">{formatCurrency(producto.precio_costo)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Margen</label>
              <p className="text-sm">
                {(((producto.precio_venta - producto.precio_costo) / producto.precio_costo) * 100).toFixed(1)}%
              </p>
            </div>
            <Separator />
            <div>
              <label className="text-sm font-medium text-muted-foreground">Stock Mínimo</label>
              <p className="text-sm">{producto.stock_minimo} {producto.unidad_medida}</p>
            </div>
          </CardContent>
        </Card>

        {/* Estadísticas */}
        <Card>
          <CardHeader>
            <CardTitle>Estadísticas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Stock Actual</label>
              <p className={`text-lg font-semibold ${
                producto.stock_actual <= producto.stock_minimo ? 'text-destructive' : 'text-success'
              }`}>
                {producto.stock_actual} {producto.unidad_medida}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Lotes Activos</label>
              <p className="text-sm">{producto.lotes_activos}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Vendido este mes</label>
              <p className="text-sm">{producto.total_vendido_mes} {producto.unidad_medida}</p>
            </div>
            <Separator />
            <div>
              <label className="text-sm font-medium text-muted-foreground">Última actualización</label>
              <p className="text-xs text-muted-foreground">
                {formatDate(producto.fecha_actualizacion)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lotes asociados */}
      <Card>
        <CardHeader>
          <CardTitle>Lotes Activos</CardTitle>
          <CardDescription>
            Lotes de este producto disponibles en inventario
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Lista de lotes - datos de ejemplo */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="p-3 border rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">Lote LOT-2025-001</p>
                    <p className="text-sm text-muted-foreground">Vence: 15/11/2025</p>
                  </div>
                  <Badge variant="outline">75 kg disponible</Badge>
                </div>
              </div>
              <div className="p-3 border rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">Lote LOT-2025-002</p>
                    <p className="text-sm text-muted-foreground">Vence: 20/11/2025</p>
                  </div>
                  <Badge variant="outline">45 kg disponible</Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
