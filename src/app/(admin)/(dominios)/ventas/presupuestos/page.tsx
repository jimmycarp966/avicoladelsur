'use client'

import { Suspense, useEffect, useState } from 'react'
import { Plus, FileText, Clock, Package, CheckCircle, AlertTriangle, Loader2, Store } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PresupuestosTableSkeleton } from './presupuestos-table-skeleton'
import { PresupuestosTableWrapper } from './presupuestos-table-wrapper'
import { obtenerEstadisticasPresupuestosAction } from '@/actions/presupuestos.actions'

interface EstadisticasPresupuestos {
  totalMes: number
  pendientes: number
  enAlmacen: number
  facturadosHoy: number
  anuladosMes: number
}

export default function PresupuestosPage() {
  const [estadisticas, setEstadisticas] = useState<EstadisticasPresupuestos | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cargarEstadisticas = async () => {
      try {
        const result = await obtenerEstadisticasPresupuestosAction()
        if (result.success && result.data) {
          setEstadisticas(result.data)
        }
      } catch (error) {
        console.error('Error cargando estadísticas:', error)
      } finally {
        setLoading(false)
      }
    }
    cargarEstadisticas()
  }, [])

  const renderEstadistica = (valor: number | undefined, colorClass: string) => {
    if (loading) {
      return <Loader2 className={`h-8 w-8 animate-spin ${colorClass}`} />
    }
    return valor ?? 0
  }

  return (
    <div className="space-y-6">
      {/* Header - Responsivo */}
      <div className="bg-white rounded-lg border border-border p-4 md:p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Presupuestos</h1>
            <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">
              Gestiona todos los presupuestos del sistema
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="md:h-10 md:px-4 w-fit">
              <Link href="/ventas/presupuestos/nuevo?tipo=venta">
                <Store className="mr-2 h-4 w-4" />
                Nueva Venta
              </Link>
            </Button>
            <Button asChild size="sm" className="bg-primary hover:bg-primary/90 shadow-sm md:h-10 md:px-6 w-fit">
              <Link href="/ventas/presupuestos/nuevo">
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Presupuesto
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Estadísticas - Responsivas */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        <Card className="border-t-[4px] border-t-primary hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Total Presupuestos</CardTitle>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary mb-2">
              {renderEstadistica(estadisticas?.totalMes, 'text-primary')}
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
              {renderEstadistica(estadisticas?.pendientes, 'text-warning')}
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
              {renderEstadistica(estadisticas?.enAlmacen, 'text-secondary')}
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
              {renderEstadistica(estadisticas?.facturadosHoy, 'text-success')}
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
              {renderEstadistica(estadisticas?.anuladosMes, 'text-destructive')}
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
