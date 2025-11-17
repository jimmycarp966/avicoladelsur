import { Suspense } from 'react'
import { Plus, Users, UserCheck, Building2, ShoppingCart } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ClientesTableSkeleton } from './clientes-table-skeleton'
import { ClientesTableWrapper } from './clientes-table-wrapper'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Clientes - Avícola del Sur ERP',
  description: 'Gestión de clientes del sistema',
}

export default function ClientesPage() {
  return (
    <div className="space-y-6">
      {/* Header con fondo colorido */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10"></div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
            <p className="text-muted-foreground mt-1">
              Gestiona la base de datos de tus clientes
            </p>
          </div>
          <Button asChild className="bg-primary hover:bg-primary/90 shadow-sm">
            <Link href="/ventas/clientes/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Cliente
            </Link>
          </Button>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-t-[3px] border-t-primary bg-primary/5 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Suspense fallback="...">89</Suspense>
            </div>
            <p className="text-xs text-muted-foreground">
              +5 desde el mes pasado
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[3px] border-t-success bg-success/5 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Activos</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <UserCheck className="h-5 w-5 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Suspense fallback="...">87</Suspense>
            </div>
            <p className="text-xs text-muted-foreground">
              98% del total
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[3px] border-t-secondary bg-secondary/5 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mayoristas</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10">
              <Building2 className="h-5 w-5 text-secondary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Suspense fallback="...">12</Suspense>
            </div>
            <p className="text-xs text-muted-foreground">
              13% del total
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[3px] border-t-info bg-info/5 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos Hoy</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
              <ShoppingCart className="h-5 w-5 text-info" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Suspense fallback="...">23</Suspense>
            </div>
            <p className="text-xs text-muted-foreground">
              +15% vs ayer
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de clientes */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes</CardTitle>
          <CardDescription>
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
