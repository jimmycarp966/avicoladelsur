import { Suspense } from 'react'
import { Plus, ShoppingCart, Clock, Package, CheckCircle, DollarSign } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PedidosTableSkeleton } from './pedidos-table-skeleton'
import { PedidosTableWrapper } from './pedidos-table-wrapper'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Pedidos - Avícola del Sur ERP',
  description: 'Gestión de pedidos del sistema',
}

export default function PedidosPage() {
  return (
    <div className="space-y-6">
      {/* Header con fondo colorido */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10"></div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Pedidos</h1>
            <p className="text-muted-foreground mt-1">
              Gestiona todos los pedidos del sistema
            </p>
          </div>
          <Button asChild className="bg-primary hover:bg-primary/90 shadow-sm">
            <Link href="/ventas/pedidos/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Pedido
            </Link>
          </Button>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="border-t-[3px] border-t-primary bg-primary/5 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pedidos</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <ShoppingCart className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Suspense fallback="...">147</Suspense>
            </div>
            <p className="text-xs text-muted-foreground">
              +12 desde ayer
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[3px] border-t-warning bg-warning/5 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <Clock className="h-5 w-5 text-warning" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              <Suspense fallback="...">23</Suspense>
            </div>
            <p className="text-xs text-muted-foreground">
              Requieren atención
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[3px] border-t-secondary bg-secondary/5 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Preparación</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10">
              <Package className="h-5 w-5 text-secondary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-secondary">
              <Suspense fallback="...">18</Suspense>
            </div>
            <p className="text-xs text-muted-foreground">
              En almacén
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[3px] border-t-success bg-success/5 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entregados Hoy</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <CheckCircle className="h-5 w-5 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              <Suspense fallback="...">42</Suspense>
            </div>
            <p className="text-xs text-muted-foreground">
              +8% vs ayer
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[3px] border-t-info bg-info/5 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos del Día</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
              <DollarSign className="h-5 w-5 text-info" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-info">
              <Suspense fallback="...">$12,450</Suspense>
            </div>
            <p className="text-xs text-muted-foreground">
              +15% vs ayer
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de pedidos */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Pedidos</CardTitle>
          <CardDescription>
            Todos los pedidos registrados en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<PedidosTableSkeleton />}>
            <PedidosTableWrapper />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
