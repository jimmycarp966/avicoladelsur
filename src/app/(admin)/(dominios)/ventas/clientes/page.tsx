import { Suspense } from 'react'
import { Plus, Users, UserCheck, Building2, ShoppingCart } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ClientesTableSkeleton } from './clientes-table-skeleton'
import { ClientesTableWrapper } from './clientes-table-wrapper'

export const revalidate = 300 // Revalida cada 5 minutos

export const metadata = {
  title: 'Clientes - Avícola del Sur ERP',
  description: 'Gestión de clientes del sistema',
}

export default function ClientesPage() {
  return (
    <div className="space-y-6">
      {/* Header - Estilo limpio y profesional */}
      <div className="bg-white rounded-lg border border-border p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Clientes</h1>
            <p className="text-muted-foreground mt-2 text-base">
              Gestiona la base de datos de tus clientes
            </p>
          </div>
          <Button asChild className="bg-primary hover:bg-primary/90 shadow-sm h-10 px-6">
            <Link href="/ventas/clientes/nuevo">
              <Plus className="mr-2 h-5 w-5" />
              Nuevo Cliente
            </Link>
          </Button>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-t-[4px] border-t-primary hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Total Clientes</CardTitle>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary mb-2">
              <Suspense fallback="...">89</Suspense>
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              +5 desde el mes pasado
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[4px] border-t-success hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Clientes Activos</CardTitle>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
              <UserCheck className="h-6 w-6 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-success mb-2">
              <Suspense fallback="...">87</Suspense>
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              98% del total
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[4px] border-t-secondary hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Mayoristas</CardTitle>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary/10">
              <Building2 className="h-6 w-6 text-secondary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-secondary mb-2">
              <Suspense fallback="...">12</Suspense>
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              13% del total
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[4px] border-t-info hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Pedidos Hoy</CardTitle>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-info/10">
              <ShoppingCart className="h-6 w-6 text-info" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-info mb-2">
              <Suspense fallback="...">23</Suspense>
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              +15% vs ayer
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de clientes */}
      <Card>
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
