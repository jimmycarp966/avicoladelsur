import { Suspense } from 'react'
import { Plus, Users, UserCheck, Building2, ShoppingCart } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { ClientesTableSkeleton } from './clientes-table-skeleton'
import { ClientesTableWrapper } from './clientes-table-wrapper'

export const revalidate = 300 // Revalida cada 5 minutos

export const metadata = {
  title: 'Clientes - Avícola del Sur ERP',
  description: 'Gestión de clientes del sistema',
}

export default function ClientesPage() {
  return (
    <div className="space-y-8">
      {/* Header Estandarizado */}
      <PageHeader
        title="Clientes"
        description="Gestiona la base de datos de tus clientes"
        actions={
          <Button asChild size="sm" className="bg-primary hover:bg-primary/90 shadow-sm md:h-10 md:px-6 w-fit">
            <Link href="/ventas/clientes/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Cliente
            </Link>
          </Button>
        }
      />

      {/* Estadísticas Estandarizadas con StatCard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Clientes"
          value="-"
          subtitle="Total registrados"
          icon={Users}
          variant="primary"
        />

        <StatCard
          title="Clientes Activos"
          value="-"
          subtitle="Con pedidos recientes"
          icon={UserCheck}
          variant="success"
        />

        <StatCard
          title="Mayoristas"
          value="-"
          subtitle="Tipo mayorista"
          icon={Building2}
          variant="warning"
        />

        <StatCard
          title="Pedidos Hoy"
          value="-"
          subtitle="Hoy"
          icon={ShoppingCart}
          variant="info"
        />
      </div>

      {/* Tabla de clientes - Card Estandarizada */}
      <Card className="overflow-hidden border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-bold">Lista de Clientes</CardTitle>
          <CardDescription className="text-base mt-1">
            Todos los clientes registrados en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<ClientesTableSkeleton />}>
            <ClientesTableWrapper />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
