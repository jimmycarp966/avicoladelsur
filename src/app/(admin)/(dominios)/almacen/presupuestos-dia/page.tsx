import { Suspense } from 'react'
import { Package, Scale, Calendar, MapPin, Truck, Clock, Filter, ArrowRightLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { getTodayArgentina } from '@/lib/utils'
import { PresupuestosDiaSkeleton } from './presupuestos-dia-skeleton'
import { PresupuestosDiaFiltros } from './presupuestos-dia-filtros'
import { PresupuestosDiaAcciones, PresupuestoIndividualAccion } from '@/components/almacen/PresupuestosDiaAcciones'
import { TransferenciasDiaCard } from '@/components/almacen/TransferenciasDiaCard'
import { obtenerTransferenciasDiaAction } from '@/actions/sucursales-transferencias.actions'
import { PresupuestosDiaRealtime } from '@/components/almacen/PresupuestosDiaRealtime'
import { obtenerPresupuestosDiaAction, esItemPesable, calcularKgItem } from '@/actions/presupuestos-dia.actions'
import { esVentaMayorista } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 60 // Revalida cada 60 segundos

export const metadata = {
  title: 'Presupuestos del Día - Almacén - Avícola del Sur ERP',
  description: 'Gestión de presupuestos para pesaje en almacén',
}

async function PresupuestosDiaContent({
  searchParams,
}: {
  searchParams?: { fecha?: string; zona_id?: string; turno?: string }
}) {
  // Obtener parámetros de filtro
  const fecha = searchParams?.fecha || getTodayArgentina()
  const zonaId = searchParams?.zona_id
  const turno = searchParams?.turno

  // Obtener datos usando el Server Action
  const {
    zonas,
    presupuestos,
    resumenDia,
    listaPreparacion,
    asignacionesResumen,
    asignacionPorPresupuesto,
    presupuestosPorZonaTurno,
    estadisticas,
  } = await obtenerPresupuestosDiaAction(fecha, zonaId, turno)

  // #region agent log
  // Log para verificar estructura de datos recibidos
  if (presupuestos && presupuestos.length > 0) {
    const primerPresupuesto = presupuestos[0]
    const primerItem = primerPresupuesto?.items?.[0]
    fetch('http://127.0.0.1:7242/ingest/1672462a-0bab-407c-8bd1-baf6ccc7131f', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'presupuestos-dia/page.tsx:51',
        message: 'Estructura datos presupuesto recibidos',
        data: {
          totalPresupuestos: presupuestos.length,
          primerPresupuestoId: primerPresupuesto?.id,
          primerItemId: primerItem?.id,
          primerItemTieneProducto: !!primerItem?.producto,
          primerItemProductoNombre: primerItem?.producto?.nombre,
          primerItemProductoCodigo: primerItem?.producto?.codigo,
          primerItemProductoEstructura: primerItem?.producto ? Object.keys(primerItem.producto) : null,
          primerItemEstructura: primerItem ? Object.keys(primerItem) : null,
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'A',
      }),
    }).catch(() => {})
  }
  // #endregion

  // Obtener transferencias del día
  const transferencias = await obtenerTransferenciasDiaAction(fecha, turno, zonaId)

  // Estadísticas de transferencias
  const totalTransferencias = transferencias?.length || 0
  const totalKgTransferencias = transferencias?.reduce((acc: number, t: any) =>
    acc + (t.items?.reduce((sum: number, item: any) =>
      sum + (item.peso_preparado || item.cantidad_enviada || item.cantidad_solicitada || 0), 0) || 0), 0
  ) || 0

  // Extraer estadísticas del día
  const {
    totalPresupuestosDia,
    totalKgDia,
    totalItemsPesablesPendientesDia,
    resumenPorZona,
    resumenPorTurno,
  } = resumenDia

  const { totalPresupuestos, totalItemsPesables, totalKgEstimados } = estadisticas

  // Función helper para formatear cantidad
  const formatearCantidad = (cantidad: number, pesable: boolean) =>
    pesable ? `${cantidad.toFixed(1)} kg` : `${cantidad.toFixed(0)} u`

  return (
    <div className="space-y-6">
      {/* Componente Realtime que actualiza la página automáticamente */}
      <PresupuestosDiaRealtime fecha={fecha} zonaId={zonaId} turno={turno} />

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
                    const itemsPesables = presupuesto.items?.filter((item: any) => esItemPesable(item, esVentaMayorista(presupuesto, item))) || []
                    const itemsPesados = itemsPesables.filter((item: any) => item.peso_final)
                    const totalKg = presupuesto.items?.reduce((sum: number, item: any) =>
                      sum + calcularKgItem(presupuesto, item), 0) || 0
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
                                <AccordionItem value={`items-${presupuesto.id}`} className="border-b-0">
                                  <AccordionTrigger className="px-4 py-2 text-sm">
                                    Ver productos ({presupuesto.items.length})
                                  </AccordionTrigger>
                                  <AccordionContent className="px-4 pb-4 pt-0">
                                    <div className="space-y-3 w-full overflow-visible">
                                      {presupuesto.items.map((item: any) => {
                                        // #region agent log
                                        // Log para verificar que el item se está renderizando dentro del AccordionContent
                                        fetch('http://127.0.0.1:7242/ingest/1672462a-0bab-407c-8bd1-baf6ccc7131f', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            location: 'presupuestos-dia/page.tsx:523',
                                            message: 'Item renderizado dentro AccordionContent',
                                            data: {
                                              presupuestoId: presupuesto.id,
                                              itemId: item.id,
                                              nombreProducto: item.producto?.nombre || 'Producto',
                                              totalItems: presupuesto.items.length,
                                            },
                                            timestamp: Date.now(),
                                            sessionId: 'debug-session',
                                            runId: 'run2',
                                            hypothesisId: 'F',
                                          }),
                                        }).catch(() => {})
                                        // #endregion
                                        // Calcular valores una sola vez fuera del JSX (EXACTAMENTE igual que en ver detalles)
                                        const esMayorista =
                                          item.producto?.venta_mayor_habilitada === true &&
                                          (item.lista_precio?.tipo === 'mayorista' || presupuesto.lista_precio?.tipo === 'mayorista')
                                        const esPesableItem = esItemPesable(item, esMayorista)
                                        const estaPendienteItem = esPesableItem && !item.peso_final
                                        const kgPorUnidadMayor = item.producto?.kg_por_unidad_mayor
                                        const unidadMayorNombre = item.producto?.unidad_mayor_nombre
                                        const solicitadoKg = esMayorista && kgPorUnidadMayor ? (item.cantidad_solicitada || 0) * kgPorUnidadMayor : item.cantidad_solicitada
                                        const reservadoKg = esMayorista && kgPorUnidadMayor ? (item.cantidad_reservada || 0) * kgPorUnidadMayor : item.cantidad_reservada
                                        
                                        const nombreProducto = item.producto?.nombre || 'Producto'
                                        const codigoProducto = item.producto?.codigo
                                        
                                        // Calcular el texto que se mostrará (usando unidad_mayor_nombre del producto)
                                        const textoSolicitado = esMayorista && unidadMayorNombre && kgPorUnidadMayor
                                          ? `${item.cantidad_solicitada ?? 0} ${unidadMayorNombre}${(item.cantidad_solicitada ?? 0) !== 1 ? '(s)' : ''} ≈ ${solicitadoKg?.toFixed(1)} kg`
                                          : `${item.cantidad_solicitada ?? 0} ${esPesableItem ? 'kg' : 'u'}`

                                        // #region agent log
                                        // Log para verificar valores calculados y texto final
                                        fetch('http://127.0.0.1:7242/ingest/1672462a-0bab-407c-8bd1-baf6ccc7131f', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            location: 'presupuestos-dia/page.tsx:556',
                                            message: 'Valores calculados para mostrar cajas',
                                            data: {
                                              presupuestoId: presupuesto.id,
                                              itemId: item.id,
                                              nombreProducto,
                                              esMayorista,
                                              cantidad_solicitada: item.cantidad_solicitada,
                                              cantidad_reservada: item.cantidad_reservada,
                                              kgPorUnidadMayor,
                                              unidadMayorNombre,
                                              solicitadoKg,
                                              reservadoKg,
                                              textoSolicitado,
                                              venta_mayor_habilitada: item.producto?.venta_mayor_habilitada,
                                              lista_precio_item: item.lista_precio?.tipo,
                                              lista_precio_presupuesto: presupuesto.lista_precio?.tipo,
                                            },
                                            timestamp: Date.now(),
                                            sessionId: 'debug-session',
                                            runId: 'run4',
                                            hypothesisId: 'H',
                                          }),
                                        }).catch(() => {})
                                        // #endregion

                                        return (
                                          <div
                                            key={item.id}
                                            className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 min-h-[80px]"
                                          >
                                            <div className="flex-1">
                                              <div className="flex items-center gap-2 mb-2">
                                                {estaPendienteItem ? (
                                                  <>
                                                    <h4 className="font-medium">
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
                                                        {nombreProducto}
                                                      </mark>
                                                    </h4>
                                                    {codigoProducto && (
                                                      <span className="text-sm text-muted-foreground">
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
                                                          #{codigoProducto}
                                                        </mark>
                                                      </span>
                                                    )}
                                                  </>
                                                ) : (
                                                  <>
                                                    <h4 className="font-medium">{nombreProducto}</h4>
                                                    {codigoProducto && (
                                                      <span className="text-sm text-muted-foreground">
                                                        #{codigoProducto}
                                                      </span>
                                                    )}
                                                  </>
                                                )}
                                                {esPesableItem && (
                                                  <Badge variant="outline" className="text-xs">
                                                    <Scale className="h-3 w-3 mr-1" />
                                                    BALANZA
                                                  </Badge>
                                                )}
                                              </div>
                                              <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-muted-foreground">
                                                <span className="whitespace-nowrap">
                                                  Solicitado: {textoSolicitado}
                                                </span>
                                                {item.cantidad_reservada > 0 && (
                                                  <span className="text-green-600 whitespace-nowrap">
                                                    Reservado: {esMayorista && unidadMayorNombre && kgPorUnidadMayor ? `${item.cantidad_reservada} ${unidadMayorNombre}${item.cantidad_reservada !== 1 ? '(s)' : ''} ≈ ${reservadoKg?.toFixed(1)} kg` : `${item.cantidad_reservada} kg`}
                                                  </span>
                                                )}
                                                {item.peso_final && (
                                                  <span className="text-blue-600 whitespace-nowrap">
                                                    Pesado: {item.peso_final} kg
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                            <Badge
                                              variant="outline"
                                              className={
                                                esPesableItem
                                                  ? item.peso_final
                                                    ? 'border-green-200 bg-green-50 text-green-700'
                                                    : 'border-yellow-200 bg-yellow-50 text-yellow-700'
                                                  : 'border-slate-200 bg-slate-50 text-slate-700'
                                              }
                                            >
                                              {esPesableItem ? (item.peso_final ? 'Pesado' : 'Pendiente') : 'Sin balanza'}
                                            </Badge>
                                          </div>
                                        )
                                      })}
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
                  const itemsPesables = presupuesto.items?.filter((item: any) => esItemPesable(item, esVentaMayorista(presupuesto, item))) || []
                  const itemsPesados = itemsPesables.filter((item: any) => item.peso_final)
                  const totalKg = presupuesto.items?.reduce((sum: number, item: any) =>
                    sum + calcularKgItem(presupuesto, item), 0) || 0
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
                                      // Calcular valores una sola vez fuera del JSX
                                      const esMayorista = esVentaMayorista(presupuesto, item)
                                      const esPesable = esItemPesable(item, esMayorista)
                                      const estaPendiente = esPesable && !item.peso_final
                                      const kgEquivalente = calcularKgItem(presupuesto, item)
                                      const unidadMayorNombre = item.producto?.unidad_mayor_nombre
                                      const cantidadSolicitada = item.cantidad_solicitada ?? 0
                                      const solicitadoLabel = esMayorista && unidadMayorNombre
                                        ? `${cantidadSolicitada} ${unidadMayorNombre}${cantidadSolicitada !== 1 ? '(s)' : ''} ≈ ${kgEquivalente.toFixed(1)} kg`
                                        : `${cantidadSolicitada} ${esPesable ? 'kg' : 'u'}`
                                      
                                      const nombreProducto = item.producto?.nombre || 'Producto'
                                      const codigoProducto = item.producto?.codigo

                                      return (
                                        <div
                                          key={item.id}
                                          className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4"
                                        >
                                          <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                              {estaPendiente ? (
                                                <>
                                                  <h4 className="font-medium">
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
                                                      {nombreProducto}
                                                    </mark>
                                                  </h4>
                                                  {codigoProducto && (
                                                    <span className="text-sm text-muted-foreground">
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
                                                        #{codigoProducto}
                                                      </mark>
                                                    </span>
                                                  )}
                                                </>
                                              ) : (
                                                <>
                                                  <h4 className="font-medium">{nombreProducto}</h4>
                                                  {codigoProducto && (
                                                    <span className="text-sm text-muted-foreground">
                                                      #{codigoProducto}
                                                    </span>
                                                  )}
                                                </>
                                              )}
                                              {esPesable && (
                                                <Badge variant="outline" className="text-xs">
                                                  <Scale className="h-3 w-3 mr-1" />
                                                  BALANZA
                                                </Badge>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                              <span>
                                                Solicitado: {solicitadoLabel}
                                              </span>
                                              {(esPesable || esMayorista) && (
                                                <>
                                                  {item.peso_final ? (
                                                    <span className="text-blue-600">
                                                      Pesado: {item.peso_final} kg
                                                    </span>
                                                  ) : esMayorista ? (
                                                    <span>
                                                      Equivalente: {kgEquivalente.toFixed(1)} kg
                                                    </span>
                                                  ) : (
                                                    <span className="text-yellow-600">
                                                      Pendiente de pesaje
                                                    </span>
                                                  )}
                                                </>
                                              )}
                                            </div>
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
                                      )
                                    })}
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
