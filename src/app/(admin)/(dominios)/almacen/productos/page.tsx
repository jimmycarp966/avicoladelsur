import { Suspense } from 'react'
import { Plus, Package, CheckCircle, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ProductosTableSkeleton } from './productos-table-skeleton'
import { ProductosTableWrapper } from './productos-table-wrapper'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Productos - Avícola del Sur ERP',
  description: 'Gestión de productos del almacén',
}

export default function ProductosPage() {
  return (
    <div className="space-y-6">
      {/* Header con fondo colorido */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10"></div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Productos</h1>
            <p className="text-muted-foreground mt-1">
              Gestiona el catálogo de productos de tu almacén
            </p>
          </div>
          <Button asChild className="bg-primary hover:bg-primary/90 shadow-sm">
            <Link href="/almacen/productos/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Producto
            </Link>
          </Button>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-t-[3px] border-t-primary bg-primary/5 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Productos</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Suspense fallback="...">147</Suspense>
            </div>
            <p className="text-xs text-muted-foreground">
              +12 desde el mes pasado
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[3px] border-t-success bg-success/5 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Productos Activos</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <CheckCircle className="h-5 w-5 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Suspense fallback="...">142</Suspense>
            </div>
            <p className="text-xs text-muted-foreground">
              97% del total
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[3px] border-t-destructive bg-destructive/5 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sin Stock</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              <Suspense fallback="...">5</Suspense>
            </div>
            <p className="text-xs text-muted-foreground">
              Requieren atención
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de productos */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Productos</CardTitle>
          <CardDescription>
            Todos los productos registrados en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<ProductosTableSkeleton />}>
            <ProductosTableWrapper />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
