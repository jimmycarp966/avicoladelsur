import { Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, AlertTriangle, Package, TrendingUp, Plus, Eye, Settings } from 'lucide-react'
import Link from 'next/link'
import { obtenerSucursalesAction } from '@/actions/sucursales.actions'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'

async function getSucursales() {
  const result = await obtenerSucursalesAction()
  return result.success ? result.data || [] : []
}

function SucursalesSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-48 rounded-2xl bg-muted animate-pulse border border-border/50" />
      ))}
    </div>
  )
}

export default async function SucursalesPage() {
  const sucursales = await getSucursales()

  // Calcular estadísticas globales
  const totalSucursales = sucursales.length
  const sucursalesActivas = sucursales.filter(s => s.active).length
  const totalAlertas = sucursales.reduce((sum, s) => sum + s.alertasPendientes, 0)
  const totalInventarioCritico = sucursales.reduce((sum, s) => sum + s.inventarioCritico, 0)

  return (
    <div className="space-y-8">
      {/* Header Estandarizado */}
      <PageHeader
        title="Sucursales"
        description="Gestión de sucursales y monitoreo de inventario por ubicación"
        icon={Building2}
        actions={
          <Button asChild size="sm" className="bg-primary hover:bg-primary/90 shadow-sm md:h-10">
            <Link href="/sucursales/nueva">
              <Plus className="w-4 h-4 mr-2" />
              Nueva Sucursal
            </Link>
          </Button>
        }
      />

      {/* Estadísticas Globales Estandarizadas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Sucursales"
          value={totalSucursales}
          subtitle={`${sucursalesActivas} sucursales activas`}
          icon={Building2}
          variant="primary"
        />

        <StatCard
          title="Alertas Activas"
          value={totalAlertas}
          subtitle="Requieren atención"
          icon={AlertTriangle}
          variant={totalAlertas > 0 ? 'danger' : 'default'}
        />

        <StatCard
          title="Stock Crítico"
          value={totalInventarioCritico}
          subtitle="Productos bajo umbral"
          icon={Package}
          variant={totalInventarioCritico > 0 ? 'warning' : 'default'}
        />

        <StatCard
          title="Estado General"
          value={totalAlertas === 0 ? 'Excelente' : totalAlertas < 5 ? 'Bueno' : 'Atención'}
          subtitle="Basado en alertas"
          icon={TrendingUp}
          variant={totalAlertas === 0 ? 'success' : 'default'}
        />
      </div>

      {/* Lista de Sucursales Estilo Dashboard */}
      <Card className="overflow-hidden border-border/60">
        <CardHeader className="pb-6 border-b border-border/50">
          <CardTitle className="text-xl font-bold">Listado de Sucursales</CardTitle>
          <CardDescription className="text-base mt-1">
            Monitoreo en tiempo real de indicadores por ubicación
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <Suspense fallback={<SucursalesSkeleton />}>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {sucursales.map((sucursal) => (
                <Card key={sucursal.id} className="group hover:border-primary/40 shadow-md">
                  <CardHeader className="pb-3 px-6 pt-6 flex flex-row items-center justify-between border-b border-border/40 mb-4 bg-muted/10">
                    <CardTitle className="text-lg font-bold group-hover:text-primary transition-colors">{sucursal.nombre}</CardTitle>
                    <Badge variant={sucursal.active ? "default" : "secondary"} className={sucursal.active ? "bg-success hover:bg-success/90" : ""}>
                      {sucursal.active ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-4 px-6 pb-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-2 rounded-xl bg-muted/30">
                        <span className="text-sm font-medium text-muted-foreground">Alertas</span>
                        <Badge variant={sucursal.alertasPendientes > 0 ? "destructive" : "secondary"} className="font-bold">
                          {sucursal.alertasPendientes}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between p-2 rounded-xl bg-muted/30">
                        <span className="text-sm font-medium text-muted-foreground">Stock Crítico</span>
                        <Badge variant={sucursal.inventarioCritico > 0 ? "warning" : "secondary"} className="font-bold">
                          {sucursal.inventarioCritico}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" asChild className="flex-1 rounded-xl font-bold uppercase text-xs tracking-wider">
                        <Link href={`/sucursales/${sucursal.id}`}>
                          <Eye className="w-4 h-4 mr-2" />
                          Detalles
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild className="rounded-xl">
                        <Link href={`/sucursales/${sucursal.id}/settings`}>
                          <Settings className="w-4 h-4" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {sucursales.length === 0 && (
              <div className="text-center py-20 bg-muted/10 rounded-3xl border-2 border-dashed border-border/40">
                <Building2 className="w-16 h-16 mx-auto mb-6 text-muted-foreground/40" />
                <h3 className="text-2xl font-black text-foreground mb-3 uppercase tracking-tight">Sin sucursales registradas</h3>
                <p className="text-muted-foreground mb-8 text-lg max-w-md mx-auto">
                  Comience por crear su primera ubicación física para el control de stock.
                </p>
                <Button asChild size="lg" className="rounded-2xl px-10 font-black shadow-xl">
                  <Link href="/sucursales/nueva">
                    <Plus className="w-5 h-5 mr-3" />
                    Crear primera sucursal
                  </Link>
                </Button>
              </div>
            )}
          </Suspense>
        </CardContent>
      </Card>

      <div className="text-right text-xs text-muted-foreground opacity-30 pt-4 font-bold uppercase">DaniR</div>
    </div>
  )
}
