import { Suspense } from 'react'
import { Plus, Truck, Wrench, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { VehiculosTableSkeleton } from './vehiculos-table-skeleton'
import { VehiculosTableWrapper } from './vehiculos-table-wrapper'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Vehículos - Avícola del Sur ERP',
  description: 'Gestión de la flota de vehículos de reparto',
}

export default function VehiculosPage() {
  return (
    <div className="space-y-6">
      {/* Header con fondo colorido */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10"></div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Vehículos</h1>
            <p className="text-muted-foreground mt-1">
              Control de la flota de vehículos y mantenimientos
            </p>
          </div>
          <Button asChild className="bg-primary hover:bg-primary/90 shadow-sm">
            <Link href="/reparto/vehiculos/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Vehículo
            </Link>
          </Button>
        </div>
      </div>

      {/* Alertas importantes */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-t-[3px] border-t-success bg-success/5 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vehículos Activos</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <Truck className="h-5 w-5 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              <Suspense fallback="...">8</Suspense>
            </div>
            <p className="text-xs text-muted-foreground">
              Listos para reparto
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[3px] border-t-warning bg-warning/5 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Mantenimiento</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <Wrench className="h-5 w-5 text-warning" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              <Suspense fallback="...">2</Suspense>
            </div>
            <p className="text-xs text-muted-foreground">
              Fuera de servicio
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[3px] border-t-destructive bg-destructive/5 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Seguros por Vencer</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              <Suspense fallback="...">3</Suspense>
            </div>
            <p className="text-xs text-muted-foreground">
              Próximos 30 días
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[3px] border-t-info bg-info/5 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Service Pendiente</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
              <Wrench className="h-5 w-5 text-info" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-info">
              <Suspense fallback="...">4</Suspense>
            </div>
            <p className="text-xs text-muted-foreground">
              Requieren mantenimiento
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de vehículos */}
      <Card>
        <CardHeader>
          <CardTitle>Flota de Vehículos</CardTitle>
          <CardDescription>
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
