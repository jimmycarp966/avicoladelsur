import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, AlertTriangle, Package, TrendingUp, Plus, Eye, Settings } from 'lucide-react'
import Link from 'next/link'
import { obtenerSucursalesAction } from '@/actions/sucursales.actions'

async function getSucursales() {
  const result = await obtenerSucursalesAction()
  return result.success ? result.data || [] : []
}

function SucursalesSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <Card key={i} className="animate-pulse">
          <CardHeader>
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-3 bg-muted rounded w-1/2"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="h-3 bg-muted rounded"></div>
              <div className="h-3 bg-muted rounded w-2/3"></div>
            </div>
          </CardContent>
        </Card>
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="w-8 h-8" />
            Sucursales
          </h1>
          <p className="text-muted-foreground">
            Gestión de sucursales y monitoreo de inventario
          </p>
        </div>
        <Button asChild>
          <Link href="/sucursales/nueva">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Sucursal
          </Link>
        </Button>
      </div>

      {/* Estadísticas Globales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sucursales</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSucursales}</div>
            <p className="text-xs text-muted-foreground">
              {sucursalesActivas} activas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas Pendientes</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totalAlertas}</div>
            <p className="text-xs text-muted-foreground">
              Requieren atención
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inventario Crítico</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{totalInventarioCritico}</div>
            <p className="text-xs text-muted-foreground">
              Productos bajo umbral
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estado General</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {totalAlertas === 0 ? 'Excelente' : totalAlertas < 5 ? 'Bueno' : 'Requiere Atención'}
            </div>
            <p className="text-xs text-muted-foreground">
              Basado en alertas activas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Sucursales */}
      <Card>
        <CardHeader>
          <CardTitle>Sucursales</CardTitle>
          <CardDescription>
            Lista de todas las sucursales con indicadores de estado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<SucursalesSkeleton />}>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sucursales.map((sucursal) => (
                <Card key={sucursal.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{sucursal.nombre}</CardTitle>
                      <Badge variant={sucursal.active ? "default" : "secondary"}>
                        {sucursal.active ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Alertas */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Alertas pendientes</span>
                      <Badge variant={sucursal.alertasPendientes > 0 ? "destructive" : "secondary"}>
                        {sucursal.alertasPendientes}
                      </Badge>
                    </div>

                    {/* Inventario crítico */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Inventario crítico</span>
                      <Badge variant={sucursal.inventarioCritico > 0 ? "destructive" : "secondary"}>
                        {sucursal.inventarioCritico}
                      </Badge>
                    </div>

                    {/* Acciones */}
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" asChild className="flex-1">
                        <Link href={`/sucursales/${sucursal.id}`}>
                          <Eye className="w-4 h-4 mr-2" />
                          Ver
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
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
              <div className="text-center py-12">
                <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No hay sucursales</h3>
                <p className="text-muted-foreground mb-4">
                  Crea tu primera sucursal para comenzar a gestionar inventario por ubicación
                </p>
                <Button asChild>
                  <Link href="/sucursales/nueva">
                    <Plus className="w-4 h-4 mr-2" />
                    Crear Primera Sucursal
                  </Link>
                </Button>
              </div>
            )}
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
