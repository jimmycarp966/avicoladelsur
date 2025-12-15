import { Suspense } from 'react'
import { Plus, FileText, Clock, Package, CheckCircle, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PresupuestosTableSkeleton } from './presupuestos-table-skeleton'
import { PresupuestosTableWrapper } from './presupuestos-table-wrapper'

export const revalidate = 300 // Revalida cada 5 minutos

export const metadata = {
  title: 'Presupuestos - Avícola del Sur ERP',
  description: 'Gestión de presupuestos del sistema',
}

export default function PresupuestosPage() {
  return (
    <div className="space-y-6">
      {/* Header - Estilo limpio y profesional */}
      <div className="bg-white rounded-lg border border-border p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Presupuestos</h1>
            <p className="text-muted-foreground mt-2 text-base">
              Gestiona todos los presupuestos del sistema
            </p>
          </div>
          <Button asChild className="bg-primary hover:bg-primary/90 shadow-sm h-10 px-6">
            <Link href="/ventas/presupuestos/nuevo">
              <Plus className="mr-2 h-5 w-5" />
              Nuevo Presupuesto
            </Link>
          </Button>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="border-t-[4px] border-t-primary hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Total Presupuestos</CardTitle>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary mb-2">
              -
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              Este mes
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[4px] border-t-warning hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Pendientes</CardTitle>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-warning/10">
              <Clock className="h-6 w-6 text-warning" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-warning mb-2">
              -
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              Requieren atención
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[4px] border-t-secondary hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold text-foreground">En Almacén</CardTitle>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary/10">
              <Package className="h-6 w-6 text-secondary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-secondary mb-2">
              -
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              Pesaje pendiente
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[4px] border-t-success hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Facturados Hoy</CardTitle>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
              <CheckCircle className="h-6 w-6 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-success mb-2">
              -
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              Convertidos a pedidos
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[4px] border-t-destructive hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Anulados</CardTitle>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-destructive mb-2">
              -
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              Este mes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de presupuestos */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-bold">Lista de Presupuestos</CardTitle>
          <CardDescription className="text-base mt-1">
            Todos los presupuestos registrados en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<PresupuestosTableSkeleton />}>
            <PresupuestosTableWrapper />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
