import { Suspense } from 'react'
import { Plus, Truck, Wrench, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { VehiculosTableSkeleton } from './vehiculos-table-skeleton'
import { VehiculosTableWrapper } from './vehiculos-table-wrapper'

export const revalidate = 300 // Revalida cada 5 minutos

export const metadata = {
  title: 'Vehículos - Avícola del Sur ERP',
  description: 'Gestión de la flota de vehículos de reparto',
}

export default function VehiculosPage() {
  return (
    <div className="space-y-6">
      {/* Header - Estilo limpio y profesional */}
      <div className="bg-white rounded-lg border border-border p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Vehículos</h1>
            <p className="text-muted-foreground mt-2 text-base">
              Control de la flota de vehículos y mantenimientos
            </p>
          </div>
          <Button asChild className="bg-primary hover:bg-primary/90 shadow-sm h-10 px-6">
            <Link href="/reparto/vehiculos/nuevo">
              <Plus className="mr-2 h-5 w-5" />
              Nuevo Vehículo
            </Link>
          </Button>
        </div>
      </div>

      {/* Alertas importantes */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-t-[4px] border-t-success hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Vehículos Activos</CardTitle>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
              <Truck className="h-6 w-6 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-success mb-2">
              <Suspense fallback="...">8</Suspense>
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              Listos para reparto
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[4px] border-t-warning hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold text-foreground">En Mantenimiento</CardTitle>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-warning/10">
              <Wrench className="h-6 w-6 text-warning" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-warning mb-2">
              <Suspense fallback="...">2</Suspense>
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              Fuera de servicio
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[4px] border-t-destructive hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Seguros por Vencer</CardTitle>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-destructive mb-2">
              <Suspense fallback="...">3</Suspense>
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              Próximos 30 días
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[4px] border-t-info hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Service Pendiente</CardTitle>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-info/10">
              <Wrench className="h-6 w-6 text-info" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-info mb-2">
              <Suspense fallback="...">4</Suspense>
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              Requieren mantenimiento
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de vehículos */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-bold">Flota de Vehículos</CardTitle>
          <CardDescription className="text-base mt-1">
            Todos los vehículos registrados en el sistema de reparto
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<VehiculosTableSkeleton />}>
            <VehiculosTableWrapper />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
