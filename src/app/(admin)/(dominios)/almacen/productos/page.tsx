import { Suspense } from 'react'
import { Plus, Package, CheckCircle, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { ProductosTableSkeleton } from './productos-table-skeleton'
import { ProductosTableWrapper } from './productos-table-wrapper'

export const revalidate = 120 // Revalida cada 2 minutos

export const metadata = {
  title: 'Productos - Avícola del Sur ERP',
  description: 'Gestión de productos del almacén',
}

export default function ProductosPage() {
  return (
    <div className="space-y-8">
      {/* Header Estandarizado */}
      <PageHeader
        title="Productos"
        description="Gestiona el catálogo de productos de tu almacén"
        actions={
          <Button asChild size="sm" className="bg-primary hover:bg-primary/90 shadow-sm md:h-10 md:px-6 w-fit">
            <Link href="/almacen/productos/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Producto
            </Link>
          </Button>
        }
      />

      {/* Estadísticas Estandarizadas con StatCard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Total Productos"
          value={<Suspense fallback="...">147</Suspense>}
          subtitle="+12 desde el mes pasado"
          icon={Package}
          variant="primary"
        />

        <StatCard
          title="Productos Activos"
          value={<Suspense fallback="...">142</Suspense>}
          subtitle="97% del total"
          icon={CheckCircle}
          variant="success"
        />

        <StatCard
          title="Sin Stock"
          value={<Suspense fallback="...">5</Suspense>}
          subtitle="Requieren atención"
          icon={AlertTriangle}
          variant="danger"
        />
      </div>

      {/* Tabla de productos - Card Estandarizada */}
      <Card className="overflow-hidden border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-bold">Lista de Productos</CardTitle>
          <CardDescription className="text-base mt-1">
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
