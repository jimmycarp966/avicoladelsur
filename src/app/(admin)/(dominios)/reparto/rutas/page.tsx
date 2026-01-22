import { Suspense } from 'react'
import { Plus, Truck, MapPin, Clock, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { RutasTableSkeleton } from './rutas-table-skeleton'
import { RutasTableWrapper } from './rutas-table-wrapper'
import { getCurrentUser } from '@/actions/auth.actions'

export const dynamic = 'force-dynamic'
export const revalidate = 300 // Revalida cada 5 minutos

export const metadata = {
  title: 'Rutas - Avícola del Sur ERP',
  description: 'Gestión de rutas de reparto y entregas',
}

export default async function RutasPage() {
  const user = await getCurrentUser()
  const isAdmin = user?.rol === 'admin'

  return (
    <div className="space-y-8">
      {/* Header Estandarizado */}
      <PageHeader
        title="Rutas de Reparto"
        description="Planificación y seguimiento de rutas de entrega"
        actions={
          isAdmin && (
            <Button asChild size="sm" className="bg-primary hover:bg-primary/90 shadow-sm md:h-10 md:px-6 w-fit">
              <Link href="/reparto/rutas/nueva">
                <Plus className="mr-2 h-4 w-4" />
                Nueva Ruta
              </Link>
            </Button>
          )
        }
      />

      {/* Estadísticas Estandarizadas con StatCard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Rutas Activas"
          value={<Suspense fallback="...">3</Suspense>}
          subtitle="En curso hoy"
          icon={Truck}
          variant="success"
        />

        <StatCard
          title="Planificadas"
          value={<Suspense fallback="...">7</Suspense>}
          subtitle="Para los próximos días"
          icon={MapPin}
          variant="info"
        />

        <StatCard
          title="Entregas Pendientes"
          value={<Suspense fallback="...">24</Suspense>}
          subtitle="Hoy y mañana"
          icon={Clock}
          variant="warning"
        />

        <StatCard
          title="Completadas Hoy"
          value={<Suspense fallback="...">18</Suspense>}
          subtitle="+12% vs ayer"
          icon={CheckCircle}
          variant="primary"
        />
      </div>

      {/* Tabla de rutas - Card Estandarizada */}
      <Card className="overflow-hidden border-border/60">
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
