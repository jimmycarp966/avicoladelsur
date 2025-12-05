import { Suspense } from 'react'
import { Package, Scale, Calendar, MapPin, Truck, Clock, Filter, ArrowRightLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/server'
import { getTodayArgentina } from '@/lib/utils'
import { PresupuestosDiaSkeleton } from './presupuestos-dia-skeleton'
import { PresupuestosDiaFiltros } from './presupuestos-dia-filtros'
import { PresupuestosDiaAcciones, PresupuestoIndividualAccion } from '@/components/almacen/PresupuestosDiaAcciones'
import { TransferenciasDiaCard } from '@/components/almacen/TransferenciasDiaCard'
import { obtenerTransferenciasDiaAction } from '@/actions/sucursales-transferencias.actions'

export const dynamic = 'force-dynamic'
export const revalidate = 60 // Revalida cada 60 segundos

export const metadata = {
  title: 'Presupuestos del Día - Almacén - Avícola del Sur ERP',
  description: 'Gestión de presupuestos para pesaje en almacén',
}

// Helper para determinar si un item es pesable
function esItemPesable(item: any): boolean {
  // Primero verificar el campo pesable del item
  if (item.pesable === true) {
    return true
  }
  
  // Si no está marcado como pesable, verificar la categoría del producto
  const categoria = item.producto?.categoria
  if (categoria) {
    const categoriaUpper = categoria.toUpperCase().trim()
    return categoriaUpper === 'BALANZA'
  }
  
  return false
}

async function PresupuestosDiaContent({
  searchParams,
}: {
  searchParams?: { fecha?: string; zona_id?: string; turno?: string }
}) {
  const supabase = await createClient()
  const presupuestoSelect = `
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
    `

  // Obtener parámetros de filtro
  const fecha = searchParams?.fecha || getTodayArgentina()
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
    .select(presupuestoSelect)
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

  // Obtener transferencias del día
  const transferencias = await obtenerTransferenciasDiaAction(fecha, turno, zonaId)

  const { data: presupuestosDiaData, error: presupuestosDiaError } = await supabase
    .from('presupuestos')
    .select(presupuestoSelect)
    .eq('estado', 'en_almacen')
    .eq('fecha_entrega_estimada', fecha)
    .order('fecha_entrega_estimada', { ascending: true })

  if (presupuestosDiaError) {
    console.error('Error obteniendo resumen del día:', presupuestosDiaError)
  }

  const calcularKgItem = (item: any) => {
    if (!item) return 0
    if (item.pesable && item.peso_final) {
      return item.peso_final
    }
    return item.cantidad_solicitada || 0
  }

  const presupuestosDelDia = presupuestosDiaData || []

  const totalPresupuestosDia = presupuestosDelDia.length
  const totalKgDia =
    presupuestosDelDia.reduce(
      (acc, presupuesto) =>
        acc + (presupuesto.items?.reduce((sum: number, item: any) => sum + calcularKgItem(item), 0) || 0),
      0,
    ) || 0
  const totalItemsPesablesPendientesDia =
    presupuestosDelDia.reduce(
      (acc, presupuesto) =>
        acc + (presupuesto.items?.filter((item: any) => esItemPesable(item) && !item.peso_final).length || 0),
      0,
    ) || 0

  const resumenPorZona = Object.values(
    (presupuestosDelDia || []).reduce(
      (acc: Record<string, { nombre: string; totalKg: number; totalPresupuestos: number }>, presupuesto: any) => {
        const key = presupuesto.zona_id || 'sin-zona'
        if (!acc[key]) {
          acc[key] = {
            nombre: presupuesto.zona?.nombre || 'Sin zona',
            totalKg: 0,
            totalPresupuestos: 0,
          }
        }
        acc[key].totalPresupuestos += 1
        acc[key].totalKg += presupuesto.items?.reduce((sum: number, item: any) => sum + calcularKgItem(item), 0) || 0
        return acc
      },
      {},
    ),
  ).sort((a, b) => b.totalKg - a.totalKg)

  const resumenPorTurno = Object.values(
    (presupuestosDelDia || []).reduce(
      (acc: Record<string, { nombre: string; totalKg: number; totalPresupuestos: number }>, presupuesto: any) => {
        const key = presupuesto.turno || 'sin-turno'
        if (!acc[key]) {
          acc[key] = {
            nombre: presupuesto.turno ? presupuesto.turno : 'Sin turno',
            totalKg: 0,
            totalPresupuestos: 0,
          }
        }
        acc[key].totalPresupuestos += 1
        acc[key].totalKg += presupuesto.items?.reduce((sum: number, item: any) => sum + calcularKgItem(item), 0) || 0
        return acc
      },
      {},
    ),
  ).sort((a, b) => b.totalKg - a.totalKg)

  const preparacionPorZonaTurno = (presupuestosDelDia || []).reduce(
    (
      acc: Record<
        string,
        {
          zona: string
          turno: string
          productos: Record<
            string,
            {
              nombre: string
              pesable: boolean
              totalCantidad: number
              presupuestosIds: Set<string>
            }
          >
          totalKgPesables: number
        }
      >,
      presupuesto: any,
    ) => {
      const coincideZona = !zonaId || presupuesto.zona_id === zonaId
      const coincideTurno = !turno || presupuesto.turno === turno

      if (!coincideZona || !coincideTurno) {
        return acc
      }

      const key = `${presupuesto.zona_id || 'sin-zona'}-${presupuesto.turno || 'sin-turno'}`
      if (!acc[key]) {
        acc[key] = {
          zona: presupuesto.zona?.nombre || 'Sin zona',
          turno: presupuesto.turno || 'Sin turno',
          productos: {},
          totalKgPesables: 0,
        }
      }

      ;(presupuesto.items || []).forEach((item: any) => {
        const productoKey = item.producto?.codigo || `${item.producto?.nombre || 'producto'}-${item.id}`
        const cantidad = calcularKgItem(item)

        if (esItemPesable(item)) {
          acc[key].totalKgPesables += cantidad
        }

        if (!acc[key].productos[productoKey]) {
          acc[key].productos[productoKey] = {
            nombre: item.producto?.nombre || 'Producto sin nombre',
            pesable: esItemPesable(item),
            totalCantidad: 0,
            presupuestosIds: new Set<string>(),
          }
        }

        acc[key].productos[productoKey].totalCantidad += cantidad
        acc[key].productos[productoKey].presupuestosIds.add(presupuesto.id)
      })

      return acc
    },
    {},
  )

  const listaPreparacion = Object.entries(preparacionPorZonaTurno).map(([key, grupo]) => ({
    key,
    zona: grupo.zona,
    turno: grupo.turno,
    totalKgPesables: grupo.totalKgPesables,
    productos: Object.values(grupo.productos)
      .map((producto) => ({
        nombre: producto.nombre,
        pesable: producto.pesable,
        totalCantidad: producto.totalCantidad,
        presupuestos: producto.presupuestosIds.size,
      }))
      .sort((a, b) => b.totalCantidad - a.totalCantidad),
  }))

  const formatearCantidad = (cantidad: number, pesable: boolean) =>
    pesable ? `${cantidad.toFixed(1)} kg` : `${cantidad.toFixed(0)} u`

  const { data: sugerenciasVehiculos } = await supabase.rpc('fn_asignar_vehiculos_por_peso', {
    p_fecha: fecha,
    p_zona_id: zonaId || null,
    p_turno: turno || null
  })

  const vehiculoIds = sugerenciasVehiculos?.map((s: any) => s.vehiculo_id).filter(Boolean) ?? []
  let vehiculosAsignados: Record<string, any> = {}

  if (vehiculoIds.length > 0) {
    const { data: vehiculosData } = await supabase
      .from('vehiculos')
      .select('id, patente, marca, modelo, capacidad_kg')
      .in('id', vehiculoIds)

    vehiculosAsignados = Object.fromEntries((vehiculosData || []).map((v: any) => [v.id, v]))
  }

  const presupuestoInfoMap = new Map(
    (presupuestos || []).map((p: any) => [p.id, { numero: p.numero_presupuesto }])
  )

  const asignacionesVehiculoMap: Record<string, {
    vehiculo: any | null
    peso_total: number
    capacidad_restante: number
    presupuestos: Array<{ id: string; numero: string; peso_estimado: number }>
  }> = {}

  const asignacionPorPresupuesto = new Map<string, {
    vehiculo: any | null
    peso_estimado: number
    capacidad_restante: number
  }>()

  ;(sugerenciasVehiculos || []).forEach((sugerencia: any) => {
    if (!sugerencia?.vehiculo_id || !sugerencia?.presupuesto_id) {
      return
    }

    const vehiculo = vehiculosAsignados[sugerencia.vehiculo_id] || null
    const presupuestoInfo = presupuestoInfoMap.get(sugerencia.presupuesto_id)
    const pesoEstimado = Number(sugerencia.peso_estimado) || 0
    const capacidadRestante = Number(sugerencia.capacidad_restante ?? (vehiculo?.capacidad_kg || 0))
    const vehiculoKey = sugerencia.vehiculo_id

    if (!asignacionesVehiculoMap[vehiculoKey]) {
      asignacionesVehiculoMap[vehiculoKey] = {
        vehiculo,
        peso_total: 0,
        capacidad_restante: capacidadRestante,
        presupuestos: [],
      }
    }

    asignacionesVehiculoMap[vehiculoKey].peso_total += pesoEstimado
    asignacionesVehiculoMap[vehiculoKey].capacidad_restante = capacidadRestante

    if (presupuestoInfo) {
      asignacionesVehiculoMap[vehiculoKey].presupuestos.push({
        id: sugerencia.presupuesto_id,
        numero: presupuestoInfo.numero,
        peso_estimado: pesoEstimado,
      })
    }

    asignacionPorPresupuesto.set(sugerencia.presupuesto_id, {
      vehiculo,
      peso_estimado: pesoEstimado,
      capacidad_restante: capacidadRestante,
    })
  })

  const asignacionesResumen = Object.values(asignacionesVehiculoMap)

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
      sum + calcularKgItem(item), 0) || 0
    return acc
  }, {}) || {}

  // Calcular estadísticas
  const totalPresupuestos = presupuestos?.length || 0
  const totalItemsPesables = presupuestos?.reduce((acc, p) =>
    acc + (p.items?.filter((item: any) => item.pesable && !item.peso_final).length || 0), 0
  ) || 0
  const totalKgEstimados = presupuestos?.reduce((acc, p) =>
    acc + (p.items?.reduce((sum: number, item: any) =>
      sum + calcularKgItem(item), 0) || 0), 0
  ) || 0

  // Estadísticas de transferencias
  const totalTransferencias = transferencias?.length || 0
  const totalKgTransferencias = transferencias?.reduce((acc: number, t: any) =>
    acc + (t.items?.reduce((sum: number, item: any) => 
      sum + (item.peso_preparado || item.cantidad_enviada || item.cantidad_solicitada || 0), 0) || 0), 0
  ) || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10"></div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Almacén del Día</h1>
            <p className="text-muted-foreground mt-1">
              Presupuestos y transferencias pendientes de preparación
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              <Calendar className="mr-1 h-3 w-3" />
              {new Date().toLocaleDateString('es-AR')}
            </Badge>
            {presupuestos && presupuestos.length > 0 && (
              <PresupuestosDiaAcciones presupuestos={presupuestos} />
            )}
          </div>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="border-t-[3px] border-t-primary bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Presupuestos</CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPresupuestos}</div>
            <p className="text-xs text-muted-foreground">
              Clientes
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[3px] border-t-orange-500 bg-orange-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transferencias</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{totalTransferencias}</div>
            <p className="text-xs text-muted-foreground">
              Sucursales
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
            <CardTitle className="text-sm font-medium">KG Presupuestos</CardTitle>
            <Truck className="h-4 w-4 text-info" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-info">{totalKgEstimados.toFixed(1)}kg</div>
            <p className="text-xs text-muted-foreground">
              Clientes
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[3px] border-t-orange-500 bg-orange-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">KG Transferencias</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{totalKgTransferencias.toFixed(1)}kg</div>
            <p className="text-xs text-muted-foreground">
              Sucursales
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

      {/* Resumen consolidado del día */}
      {totalPresupuestosDia > 0 && (
        <Card className="border border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Resumen consolidado del día
            </CardTitle>
            <CardDescription>
              Totales considerando todos los presupuestos del día sin importar filtros
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-primary/10 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase text-muted-foreground">Presupuestos del día</p>
                <p className="text-3xl font-semibold mt-1">{totalPresupuestosDia}</p>
              </div>
              <div className="rounded-lg border border-primary/10 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase text-muted-foreground">Kg estimados totales</p>
                <p className="text-3xl font-semibold mt-1">{totalKgDia.toFixed(1)} kg</p>
              </div>
              <div className="rounded-lg border border-primary/10 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase text-muted-foreground">Items pesables pendientes</p>
                <p className="text-3xl font-semibold mt-1">{totalItemsPesablesPendientesDia}</p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <p className="text-sm font-semibold mb-3">Distribución por zona</p>
                <div className="space-y-3">
                  {resumenPorZona.length === 0 && (
                    <p className="text-sm text-muted-foreground">Sin zonas asignadas</p>
                  )}
                  {resumenPorZona.map((zona) => (
                    <div key={zona.nombre} className="flex items-center justify-between rounded-lg border border-primary/10 bg-white p-3">
                      <div>
                        <p className="font-medium">{zona.nombre}</p>
                        <p className="text-xs text-muted-foreground">{zona.totalPresupuestos} presupuesto(s)</p>
                      </div>
                      <Badge variant="outline" className="text-sm">
                        {zona.totalKg.toFixed(1)} kg
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold mb-3">Distribución por turno</p>
                <div className="space-y-3">
                  {resumenPorTurno.length === 0 && (
                    <p className="text-sm text-muted-foreground">Sin turnos asignados</p>
                  )}
                  {resumenPorTurno.map((turnoResumen) => (
                    <div key={turnoResumen.nombre} className="flex items-center justify-between rounded-lg border border-primary/10 bg-white p-3">
                      <div>
                        <p className="font-medium capitalize">{turnoResumen.nombre}</p>
                        <p className="text-xs text-muted-foreground">{turnoResumen.totalPresupuestos} presupuesto(s)</p>
                      </div>
                      <Badge variant="outline" className="text-sm">
                        {turnoResumen.totalKg.toFixed(1)} kg
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sugerencias de asignación automática */}
      {asignacionesResumen.length > 0 && (
        <Card className="border-l-4 border-l-primary/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              Asignación automática sugerida
            </CardTitle>
            <CardDescription>
              Vehículos recomendados según la carga total de los presupuestos seleccionados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {asignacionesResumen.map((asignacion, index) => {
              const capacidadVehiculo = Number(asignacion.vehiculo?.capacidad_kg || 0)
              const restante = Math.max(capacidadVehiculo - asignacion.peso_total, 0)

              return (
                <div key={asignacion.vehiculo?.id || `vehiculo-${index}`} className="rounded-lg border border-primary/10 p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Vehículo sugerido</p>
                      <p className="text-lg font-semibold">
                        {asignacion.vehiculo
                          ? `${asignacion.vehiculo.patente} • ${asignacion.vehiculo.marca || ''} ${asignacion.vehiculo.modelo || ''}`
                          : 'Sin vehículo disponible'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Capacidad: {capacidadVehiculo.toFixed(1)} kg • Restante: {restante.toFixed(1)} kg
                      </p>
                    </div>
                    <Badge variant="outline" className="w-fit">
                      {asignacion.presupuestos.length} presupuesto(s)
                    </Badge>
                  </div>
                  {asignacion.presupuestos.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {asignacion.presupuestos.map((presupuesto) => (
                        <Link
                          key={presupuesto.id}
                          href={`/ventas/presupuestos/${presupuesto.id}`}
                          className="text-sm text-primary underline underline-offset-2"
                        >
                          #{presupuesto.numero} ({presupuesto.peso_estimado.toFixed(1)} kg)
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      <PresupuestosDiaFiltros zonas={zonas || []} fecha={fecha} zonaId={zonaId} turno={turno} />

      {/* Transferencias del Día */}
      {transferencias && transferencias.length > 0 && (
        <TransferenciasDiaCard transferencias={transferencias} />
      )}

      {/* Lista de preparación consolidada */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Lista de preparación del día
          </CardTitle>
          <CardDescription>
            Consolidado de productos por zona y turno considerando los filtros seleccionados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {listaPreparacion.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No hay presupuestos que coincidan con los filtros actuales.
            </div>
          )}

          {listaPreparacion.map((grupo) => (
            <div key={grupo.key} className="rounded-lg border border-dashed border-primary/20 p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{grupo.turno === 'Sin turno' ? 'Turno sin asignar' : `Turno ${grupo.turno}`}</p>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {grupo.zona}
                  </h3>
                </div>
                <Badge variant="outline" className="text-sm">
                  {grupo.totalKgPesables.toFixed(1)} kg pesables
                </Badge>
              </div>

              <div className="mt-4 space-y-3">
                {grupo.productos.map((producto) => (
                  <div key={`${grupo.key}-${producto.nombre}`} className="flex items-start justify-between rounded-md border border-slate-100 bg-white/80 px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{producto.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {producto.presupuestos} presupuesto(s) • {producto.pesable ? 'Pesable' : 'Unidad'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-semibold">{formatearCantidad(producto.totalCantidad, producto.pesable)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

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
                    const itemsPesables = presupuesto.items?.filter((item: any) => esItemPesable(item)) || []
                    const itemsPesados = itemsPesables.filter((item: any) => item.peso_final)
                    const totalKg = presupuesto.items?.reduce((sum: number, item: any) =>
                      sum + calcularKgItem(item), 0) || 0
                    const asignacionVehiculo = asignacionPorPresupuesto.get(presupuesto.id)

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
                              {asignacionVehiculo && (
                                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary/5 px-3 py-1 text-sm text-primary">
                                  <Truck className="h-4 w-4" />
                                  Vehículo sugerido: {asignacionVehiculo.vehiculo?.patente || 'Por asignar'} ({asignacionVehiculo.peso_estimado.toFixed(1)} kg)
                                </div>
                              )}
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
                              <PresupuestoIndividualAccion presupuesto={presupuesto} />
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

                          {presupuesto.items?.length > 0 && (
                            <div className="mt-4">
                              <Accordion type="single" collapsible className="rounded-lg border border-slate-200">
                                <AccordionItem value={`items-${presupuesto.id}`}>
                                  <AccordionTrigger className="px-4 py-2 text-sm">
                                    Ver productos ({presupuesto.items.length})
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    <div className="space-y-3 px-4 pb-4">
                                      {presupuesto.items.map((item: any) => (
                                        <div
                                          key={item.id}
                                          className="flex items-start justify-between gap-4 rounded-md border border-slate-100 bg-white/80 px-3 py-2 text-sm"
                                        >
                                          <div>
                                            <p className="font-medium">
                                              {(() => {
                                                const esPesableItem = esItemPesable(item)
                                                const estaPendienteItem = esPesableItem && !item.peso_final
                                                
                                                return estaPendienteItem ? (
                                                  <>
                                              <mark 
                                                style={{
                                                  backgroundColor: '#fef08a',
                                                  padding: '2px 4px',
                                                  borderRadius: '2px',
                                                  boxDecorationBreak: 'clone',
                                                  WebkitBoxDecorationBreak: 'clone',
                                                  display: 'inline'
                                                }}
                                              >
                                                {item.producto?.nombre || 'Producto'}
                                              </mark>
                                              {item.producto?.codigo && (
                                                <mark
                                                  className="ml-1 text-xs"
                                                  style={{
                                                    backgroundColor: '#fef08a',
                                                    padding: '2px 4px',
                                                    borderRadius: '2px',
                                                    boxDecorationBreak: 'clone',
                                                    WebkitBoxDecorationBreak: 'clone',
                                                    display: 'inline'
                                                  }}
                                                >
                                                  ({item.producto.codigo})
                                                </mark>
                                              )}
                                                  </>
                                                ) : (
                                                  <>
                                                    {item.producto?.nombre || 'Producto'}
                                                    {item.producto?.codigo && (
                                                      <span className="text-xs text-muted-foreground ml-1">
                                                        ({item.producto.codigo})
                                                      </span>
                                                    )}
                                                  </>
                                                )
                                              })()}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                              {esItemPesable(item) ? 'Pesable' : 'Unidad'} • Solicitado:{' '}
                                              {item.cantidad_solicitada ?? 0} {esItemPesable(item) ? 'kg' : 'u'}
                                              {esItemPesable(item) && (
                                                <>
                                                  {' '}•{' '}
                                                  {item.peso_final
                                                    ? `Final: ${item.peso_final} kg`
                                                    : 'Pendiente de pesaje'}
                                                </>
                                              )}
                                            </p>
                                          </div>
                                          <Badge
                                            variant="outline"
                                            className={
                                              esItemPesable(item)
                                                ? item.peso_final
                                                  ? 'border-green-200 bg-green-50 text-green-700'
                                                  : 'border-yellow-200 bg-yellow-50 text-yellow-700'
                                                : 'border-slate-200 bg-slate-50 text-slate-700'
                                            }
                                          >
                                            {esItemPesable(item) ? (item.peso_final ? 'Pesado' : 'Pendiente') : 'Sin balanza'}
                                          </Badge>
                                        </div>
                                      ))}
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              </Accordion>
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
                  sum + calcularKgItem(item), 0) || 0
                const asignacionVehiculo = asignacionPorPresupuesto.get(presupuesto.id)

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

                          {asignacionVehiculo && (
                            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary/5 px-3 py-1 text-sm text-primary">
                              <Truck className="h-4 w-4" />
                              Vehículo sugerido: {asignacionVehiculo.vehiculo?.patente || 'Por asignar'} ({asignacionVehiculo.peso_estimado.toFixed(1)} kg)
                            </div>
                          )}
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
                          <PresupuestoIndividualAccion presupuesto={presupuesto} />
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

                      {presupuesto.items?.length > 0 && (
                        <div className="mt-4">
                          <Accordion type="single" collapsible className="rounded-lg border border-slate-200">
                            <AccordionItem value={`items-${presupuesto.id}`}>
                              <AccordionTrigger className="px-4 py-2 text-sm">
                                Ver productos ({presupuesto.items.length})
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="space-y-3 px-4 pb-4">
                                  {presupuesto.items.map((item: any) => {
                                    const esPesable = esItemPesable(item)
                                    const estaPendiente = esPesable && !item.peso_final
                                    
                                    return (
                                    <div
                                      key={item.id}
                                      className="flex items-start justify-between gap-4 rounded-md border border-slate-100 bg-white/80 px-3 py-2 text-sm"
                                    >
                                      <div>
                                        <p className="font-medium">
                                          {estaPendiente ? (
                                            <>
                                              <mark 
                                                style={{
                                                  backgroundColor: '#fef08a',
                                                  padding: '2px 4px',
                                                  borderRadius: '2px',
                                                  boxDecorationBreak: 'clone',
                                                  WebkitBoxDecorationBreak: 'clone',
                                                  display: 'inline'
                                                }}
                                              >
                                                {item.producto?.nombre || 'Producto'}
                                              </mark>
                                              {item.producto?.codigo && (
                                                <mark
                                                  className="ml-1 text-xs"
                                                  style={{
                                                    backgroundColor: '#fef08a',
                                                    padding: '2px 4px',
                                                    borderRadius: '2px',
                                                    boxDecorationBreak: 'clone',
                                                    WebkitBoxDecorationBreak: 'clone',
                                                    display: 'inline'
                                                  }}
                                                >
                                                  ({item.producto.codigo})
                                                </mark>
                                              )}
                                            </>
                                          ) : (
                                            <>
                                              {item.producto?.nombre || 'Producto'}
                                              {item.producto?.codigo && (
                                                <span className="text-xs text-muted-foreground ml-1">
                                                  ({item.producto.codigo})
                                                </span>
                                              )}
                                            </>
                                          )}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {esPesable ? 'Pesable' : 'Unidad'} • Solicitado:{' '}
                                          {item.cantidad_solicitada ?? 0} {esPesable ? 'kg' : 'u'}
                                          {esPesable && (
                                            <>
                                              {' '}•{' '}
                                              {item.peso_final
                                                ? `Final: ${item.peso_final} kg`
                                                : 'Pendiente de pesaje'}
                                            </>
                                          )}
                                        </p>
                                      </div>
                                      <Badge
                                        variant="outline"
                                        className={
                                          esPesable
                                            ? item.peso_final
                                              ? 'border-green-200 bg-green-50 text-green-700'
                                              : 'border-yellow-200 bg-yellow-50 text-yellow-700'
                                            : 'border-slate-200 bg-slate-50 text-slate-700'
                                        }
                                      >
                                        {esPesable ? (item.peso_final ? 'Pesado' : 'Pendiente') : 'Sin balanza'}
                                      </Badge>
                                    </div>
                                  )})}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
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
