import { Suspense } from 'react'
import { Package, Scale, Calendar, MapPin, Truck, Clock, Filter } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/server'
import { PresupuestosDiaSkeleton } from './presupuestos-dia-skeleton'
import { PresupuestosDiaFiltros } from './presupuestos-dia-filtros'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Presupuestos del Día - Almacén - Avícola del Sur ERP',
  description: 'Gestión de presupuestos para pesaje en almacén',
}

async function PresupuestosDiaContent({
  searchParams,
}: {
  searchParams?: { fecha?: string; zona_id?: string; turno?: string }
}) {
  const supabase = await createClient()

  // Obtener parámetros de filtro
  const fecha = searchParams?.fecha || new Date().toISOString().split('T')[0]
  const zonaId = searchParams?.zona_id
  const turno = searchParams?.turno

  // Obtener zonas para el filtro
  const { data: zonas } = await supabase
    .from('zonas')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre')

  // Construir query con filtros
  let query = supabase
    .from('presupuestos')
    .select(`
      *,
      cliente:clientes(nombre, telefono),
      zona:zonas(nombre),
      items:presupuesto_items(
        id,
        cantidad_solicitada,
        cantidad_reservada,
        pesable,
        peso_final,
        producto:productos(nombre, codigo, categoria)
      )
    `)
    .eq('estado', 'en_almacen')
    .eq('fecha_entrega_estimada', fecha)

  if (zonaId) {
    query = query.eq('zona_id', zonaId)
  }

  if (turno) {
    query = query.eq('turno', turno)
  }

  const { data: presupuestos, error } = await query.order('fecha_entrega_estimada', { ascending: true })

  if (error) {
    console.error('Error obteniendo presupuestos:', error)
  }

  // Agrupar por zona y turno
  const presupuestosPorZonaTurno = presupuestos?.reduce((acc: any, p: any) => {
    const key = `${p.zona_id || 'sin-zona'}-${p.turno || 'sin-turno'}`
    if (!acc[key]) {
      acc[key] = {
        zona: p.zona,
        turno: p.turno,
        presupuestos: [],
        totalKg: 0,
      }
    }
    acc[key].presupuestos.push(p)
    acc[key].totalKg += p.items?.reduce((sum: number, item: any) =>
      sum + (item.cantidad_solicitada || 0), 0) || 0
    return acc
  }, {}) || {}

  // Calcular estadísticas
  const totalPresupuestos = presupuestos?.length || 0
  const totalItemsPesables = presupuestos?.reduce((acc, p) =>
    acc + (p.items?.filter((item: any) => item.pesable && !item.peso_final).length || 0), 0
  ) || 0
  const totalKgEstimados = presupuestos?.reduce((acc, p) =>
    acc + (p.items?.reduce((sum: number, item: any) =>
      sum + (item.cantidad_solicitada || 0), 0) || 0), 0
  ) || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10"></div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Presupuestos del Día</h1>
            <p className="text-muted-foreground mt-1">
              Presupuestos pendientes de pesaje en almacén
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              <Calendar className="mr-1 h-3 w-3" />
              {new Date().toLocaleDateString('es-AR')}
            </Badge>
          </div>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-t-[3px] border-t-primary bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Presupuestos Hoy</CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPresupuestos}</div>
            <p className="text-xs text-muted-foreground">
              En almacén
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[3px] border-t-warning bg-warning/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Items por Pesar</CardTitle>
            <Scale className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{totalItemsPesables}</div>
            <p className="text-xs text-muted-foreground">
              Requieren balanza
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[3px] border-t-info bg-info/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">KG Estimados</CardTitle>
            <Truck className="h-4 w-4 text-info" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-info">{totalKgEstimados.toFixed(1)}kg</div>
            <p className="text-xs text-muted-foreground">
              Total aproximado
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[3px] border-t-success bg-success/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eficiencia</CardTitle>
            <div className="h-4 w-4 rounded-full bg-success"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {totalPresupuestos > 0 ? '85%' : '100%'}
            </div>
            <p className="text-xs text-muted-foreground">
              Procesamiento
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <PresupuestosDiaFiltros zonas={zonas || []} fecha={fecha} zonaId={zonaId} turno={turno} />

      {/* Agrupación por zona y turno */}
      {Object.keys(presupuestosPorZonaTurno).length > 0 && (
        <div className="space-y-6">
          {Object.entries(presupuestosPorZonaTurno).map(([key, grupo]: [string, any]) => (
            <Card key={key}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      {grupo.zona?.nombre || 'Sin zona'}
                      {grupo.turno && (
                        <>
                          <span className="text-muted-foreground">•</span>
                          <Clock className="h-4 w-4" />
                          <span className="capitalize">{grupo.turno}</span>
                        </>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {grupo.presupuestos.length} presupuesto(s) • {grupo.totalKg.toFixed(1)} kg aproximados
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-lg">
                    {grupo.totalKg.toFixed(1)} kg
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {grupo.presupuestos.map((presupuesto: any) => {
                    const itemsPesables = presupuesto.items?.filter((item: any) => item.pesable) || []
                    const itemsPesados = itemsPesables.filter((item: any) => item.peso_final)
                    const totalKg = presupuesto.items?.reduce((sum: number, item: any) =>
                      sum + (item.cantidad_solicitada || 0), 0) || 0

                    // Calcular porcentaje fuera de la expresión inline
                    const porcentajePesaje = itemsPesables.length > 0 
                      ? Math.round(itemsPesados.length * 100 / itemsPesables.length) 
                      : 0

                    return (
                      <Card key={presupuesto.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-semibold">
                                  #{presupuesto.numero_presupuesto}
                                </h3>
                                <Badge variant="outline">
                                  {presupuesto.cliente?.nombre || 'Cliente'}
                                </Badge>
                              </div>

                              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                                <span>
                                  📦 {presupuesto.items?.length || 0} items
                                </span>
                                <span>
                                  ⚖️ {itemsPesables.length} pesables ({itemsPesados.length} de {itemsPesables.length} completados)
                                </span>
                                <span>
                                  🏋️ {totalKg.toFixed(1)}kg estimados
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm" asChild>
                                <Link href={`/ventas/presupuestos/${presupuesto.id}`}>
                                  Ver Detalle
                                </Link>
                              </Button>
                              <Button asChild className="bg-blue-600 hover:bg-blue-700">
                                <Link href={`/almacen/presupuesto/${presupuesto.id}/pesaje`}>
                                  <Scale className="mr-2 h-4 w-4" />
                                  Comenzar Pesaje
                                </Link>
                              </Button>
                            </div>
                          </div>

                          {/* Barra de progreso de pesaje */}
                          {itemsPesables.length > 0 && (
                            <div className="mt-4">
                              <div className="flex items-center justify-between text-sm mb-2">
                                <span>Progreso de pesaje</span>
                                <span>{itemsPesados.length} de {itemsPesables.length} items</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                  style={{
                                    width: `${porcentajePesaje}%`
                                  }}
                                ></div>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Lista de presupuestos fallback si no hay agrupacion */}
      {Object.keys(presupuestosPorZonaTurno).length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Presupuestos Pendientes de Pesaje</CardTitle>
            <CardDescription>
              Selecciona un presupuesto para comenzar el pesaje
            </CardDescription>
          </CardHeader>
        <CardContent>
          {!presupuestos || presupuestos.length === 0 ? (
            <div className="text-center py-8">
              <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No hay presupuestos pendientes</h3>
              <p className="text-muted-foreground">
                Todos los presupuestos del día han sido procesados
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {presupuestos.map((presupuesto: any) => {
                const itemsPesables = presupuesto.items?.filter((item: any) => item.pesable) || []
                const itemsPesados = itemsPesables.filter((item: any) => item.peso_final)
                const totalKg = presupuesto.items?.reduce((sum: number, item: any) =>
                  sum + (item.cantidad_solicitada || 0), 0) || 0

                // Calcular porcentaje fuera de la expresión inline
                const porcentajePesaje = itemsPesables.length > 0 
                  ? Math.round(itemsPesados.length * 100 / itemsPesables.length) 
                  : 0

                return (
                  <Card key={presupuesto.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold">
                              #{presupuesto.numero_presupuesto}
                            </h3>
                            <Badge variant="outline">
                              {presupuesto.cliente?.nombre || 'Cliente'}
                            </Badge>
                            {presupuesto.zona && (
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {presupuesto.zona.nombre}
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-6 text-sm text-muted-foreground">
                            <span>
                              {presupuesto.fecha_entrega_estimada
                                ? `📅 ${new Date(presupuesto.fecha_entrega_estimada).toLocaleDateString('es-AR')}`
                                : '📅 Sin fecha'}
                            </span>
                            <span>
                              📦 {presupuesto.items?.length || 0} items
                            </span>
                            <span>
                              ⚖️ {itemsPesables.length} pesables ({itemsPesados.length} de {itemsPesables.length} completados)
                            </span>
                            <span>
                              🏋️ {totalKg.toFixed(1)}kg estimados
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/ventas/presupuestos/${presupuesto.id}`}>
                              Ver Detalle
                            </Link>
                          </Button>
                          <Button asChild className="bg-blue-600 hover:bg-blue-700">
                            <Link href={`/almacen/presupuesto/${presupuesto.id}/pesaje`}>
                              <Scale className="mr-2 h-4 w-4" />
                              Comenzar Pesaje
                            </Link>
                          </Button>
                        </div>
                      </div>

                      {/* Barra de progreso de pesaje */}
                      {itemsPesables.length > 0 && (
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span>Progreso de pesaje</span>
                            <span>{itemsPesados.length} de {itemsPesables.length} items</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{
                                width: `${porcentajePesaje}%`
                              }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  )
}

export default async function PresupuestosDiaPage({
  searchParams,
}: {
  searchParams?: Promise<{ fecha?: string; zona_id?: string; turno?: string }>
}) {
  const params = await searchParams
  return (
    <Suspense fallback={<PresupuestosDiaSkeleton />}>
      <PresupuestosDiaContent searchParams={params} />
    </Suspense>
  )
}
