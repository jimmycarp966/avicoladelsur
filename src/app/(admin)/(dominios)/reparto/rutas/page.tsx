import { Suspense } from 'react'
import { Plus, Truck, MapPin, Clock, CheckCircle, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RutasTableSkeleton } from './rutas-table-skeleton'
import { RutasTableWrapper } from './rutas-table-wrapper'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Rutas - Avícola del Sur ERP',
  description: 'Gestión de rutas de reparto y entregas',
}

export default function RutasPage() {
  return (
    <div className="space-y-6">
      {/* Header con fondo colorido */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10"></div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Rutas de Reparto</h1>
            <p className="text-muted-foreground mt-1">
              Planificación y seguimiento de rutas de entrega
            </p>
          </div>
          <Button asChild className="bg-primary hover:bg-primary/90 shadow-sm">
            <Link href="/reparto/rutas/nueva">
              <Plus className="mr-2 h-4 w-4" />
              Nueva Ruta
            </Link>
          </Button>
        </div>
      </div>

      {/* Alertas importantes */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-t-[3px] border-t-success bg-success/5 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rutas Activas</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <Truck className="h-5 w-5 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              <Suspense fallback="...">3</Suspense>
            </div>
            <p className="text-xs text-muted-foreground">
              En curso hoy
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[3px] border-t-info bg-info/5 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planificadas</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
              <MapPin className="h-5 w-5 text-info" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-info">
              <Suspense fallback="...">7</Suspense>
            </div>
            <p className="text-xs text-muted-foreground">
              Para los próximos días
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[3px] border-t-warning bg-warning/5 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entregas Pendientes</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <Clock className="h-5 w-5 text-warning" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              <Suspense fallback="...">24</Suspense>
            </div>
            <p className="text-xs text-muted-foreground">
              Hoy y mañana
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[3px] border-t-secondary bg-secondary/5 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completadas Hoy</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10">
              <CheckCircle className="h-5 w-5 text-secondary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-secondary">
              <Suspense fallback="...">18</Suspense>
            </div>
            <p className="text-xs text-muted-foreground">
              +12% vs ayer
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de rutas */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Rutas</CardTitle>
          <CardDescription>
            Todas las rutas planificadas y en ejecución
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<RutasTableSkeleton />}>
            <RutasTableWrapper />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
