import { Suspense } from 'react'
import { Plus, AlertTriangle, Package } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LotesTableSkeleton } from './lotes-table-skeleton'
import { LotesTableWrapper } from './lotes-table-wrapper'

export const dynamic = 'force-dynamic'
export const revalidate = 300 // Revalida cada 5 minutos

export const metadata = {
  title: 'Lotes - Avícola del Sur ERP',
  description: 'Gestión de lotes y trazabilidad del almacén',
}

export default function LotesPage() {
  return (
    <div className="space-y-6">
      {/* Header - Responsivo */}
      <div className="bg-white rounded-lg border border-border p-4 md:p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Lotes</h1>
            <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">
              Control de inventario por lotes y fechas de vencimiento
            </p>
          </div>
          <Button asChild size="sm" className="bg-primary hover:bg-primary/90 shadow-sm md:h-10 md:px-6 w-fit">
            <Link href="/almacen/lotes/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Lote
            </Link>
          </Button>
        </div>
      </div>

      {/* Alertas - Responsivas */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        <Card className="border-t-[4px] border-t-destructive hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Lotes Vencidos</CardTitle>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-destructive mb-2">
              <Suspense fallback="...">2</Suspense>
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              Requieren atención inmediata
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[4px] border-t-warning hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Próximos a Vencer</CardTitle>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-warning/10">
              <AlertTriangle className="h-6 w-6 text-warning" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-warning mb-2">
              <Suspense fallback="...">5</Suspense>
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              En los próximos 7 días
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[4px] border-t-primary hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Stock Total</CardTitle>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Package className="h-6 w-6 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary mb-2">
              <Suspense fallback="...">455</Suspense>
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              Unidades disponibles
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de lotes */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-bold">Lista de Lotes</CardTitle>
          <CardDescription className="text-base mt-1">
            Todos los lotes registrados en el sistema de trazabilidad
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<LotesTableSkeleton />}>
            <LotesTableWrapper />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
