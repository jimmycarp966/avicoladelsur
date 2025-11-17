import { Suspense } from 'react'
import { Plus, AlertTriangle, Package } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LotesTableSkeleton } from './lotes-table-skeleton'
import { LotesTableWrapper } from './lotes-table-wrapper'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Lotes - Avícola del Sur ERP',
  description: 'Gestión de lotes y trazabilidad del almacén',
}

export default function LotesPage() {
  return (
    <div className="space-y-6">
      {/* Header con fondo colorido */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10"></div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Lotes</h1>
            <p className="text-muted-foreground mt-1">
              Control de inventario por lotes y fechas de vencimiento
            </p>
          </div>
          <Button asChild className="bg-primary hover:bg-primary/90 shadow-sm">
            <Link href="/almacen/lotes/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Lote
            </Link>
          </Button>
        </div>
      </div>

      {/* Alertas importantes */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-t-[3px] border-t-destructive bg-destructive/5 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lotes Vencidos</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              <Suspense fallback="...">2</Suspense>
            </div>
            <p className="text-xs text-muted-foreground">
              Requieren atención inmediata
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[3px] border-t-warning bg-warning/5 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próximos a Vencer</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              <Suspense fallback="...">5</Suspense>
            </div>
            <p className="text-xs text-muted-foreground">
              En los próximos 7 días
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[3px] border-t-info bg-info/5 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Total</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
              <Package className="h-5 w-5 text-info" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-info">
              <Suspense fallback="...">455</Suspense>
            </div>
            <p className="text-xs text-muted-foreground">
              Unidades disponibles
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de lotes */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Lotes</CardTitle>
          <CardDescription>
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
