import { Suspense } from 'react'
import { Plus, Truck, MapPin, Clock, CheckCircle, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RutasTableSkeleton } from './rutas-table-skeleton'
import { RutasTableWrapper } from './rutas-table-wrapper'

export const revalidate = 300 // Revalida cada 5 minutos

export const metadata = {
  title: 'Rutas - Avícola del Sur ERP',
  description: 'Gestión de rutas de reparto y entregas',
}

export default function RutasPage() {
  return (
    <div className="space-y-6">
      {/* Header - Estilo limpio y profesional */}
      <div className="bg-white rounded-lg border border-border p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Rutas de Reparto</h1>
            <p className="text-muted-foreground mt-2 text-base">
              Planificación y seguimiento de rutas de entrega
            </p>
          </div>
          <Button asChild className="bg-primary hover:bg-primary/90 shadow-sm h-10 px-6">
            <Link href="/reparto/rutas/nueva">
              <Plus className="mr-2 h-5 w-5" />
              Nueva Ruta
            </Link>
          </Button>
        </div>
      </div>

      {/* Alertas importantes */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-t-[4px] border-t-success hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Rutas Activas</CardTitle>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
              <Truck className="h-6 w-6 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-success mb-2">
              <Suspense fallback="...">3</Suspense>
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              En curso hoy
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[4px] border-t-info hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Planificadas</CardTitle>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-info/10">
              <MapPin className="h-6 w-6 text-info" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-info mb-2">
              <Suspense fallback="...">7</Suspense>
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              Para los próximos días
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[4px] border-t-warning hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Entregas Pendientes</CardTitle>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-warning/10">
              <Clock className="h-6 w-6 text-warning" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-warning mb-2">
              <Suspense fallback="...">24</Suspense>
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              Hoy y mañana
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[4px] border-t-secondary hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Completadas Hoy</CardTitle>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary/10">
              <CheckCircle className="h-6 w-6 text-secondary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-secondary mb-2">
              <Suspense fallback="...">18</Suspense>
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              +12% vs ayer
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de rutas */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-bold">Lista de Rutas</CardTitle>
          <CardDescription className="text-base mt-1">
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
