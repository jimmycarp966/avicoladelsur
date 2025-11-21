import Link from 'next/link'
import { ArrowLeft, ClipboardList, MapPinned, DollarSign, CheckCircle2, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import RutaMap from '@/components/reparto/RutaMap'
import { iniciarRuta, finalizarRuta } from '@/actions/reparto.actions'

export const dynamic = 'force-dynamic'

export default async function RutaDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: { tab?: string }
}) {
  const { id } = await params
  const activeTab = searchParams?.tab === 'mapa' ? 'mapa' : 'lista'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <div className="p-6">No autorizado</div>
  }

  const { data: usuarioRol } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!usuarioRol || !['admin', 'almacenista'].includes(usuarioRol.rol)) {
    return <div className="p-6">No tienes permisos para ver esta ruta.</div>
  }

  const { data: ruta, error } = await supabase
    .from('rutas_reparto')
    .select(
      `
        *,
        repartidor:usuarios(nombre, apellido, telefono),
        vehiculo:vehiculos(patente, marca, modelo, capacidad_kg),
        zona:zonas(nombre),
        tesorero_validador:usuarios!rutas_reparto_tesorero_validador_id_fkey(nombre, apellido),
        detalles_ruta (
          id,
          orden_entrega,
          estado_entrega,
          coordenadas_entrega,
          fecha_hora_entrega,
          pago_registrado,
          metodo_pago_registrado,
          monto_cobrado_registrado,
          pago_validado,
          pedido:pedidos(
            id,
            numero_pedido,
            total,
            pago_estado,
            cliente:clientes(
              id,
              nombre,
              direccion,
              telefono,
              coordenadas
            )
          )
        )
      `,
    )
    .eq('id', id)
    .single()

  if (error || !ruta) {
    return (
      <Card className="m-6">
        <CardContent className="p-6 text-center text-muted-foreground">
          No se encontró la ruta solicitada.
        </CardContent>
      </Card>
    )
  }

  const fechaLegible = new Date(ruta.fecha_ruta).toLocaleDateString('es-AR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const entregas = ruta.detalles_ruta || []
  const entregasCompletadas = entregas.filter(
    (entrega: any) => entrega.estado_entrega === 'entregado',
  ).length
  
  // Calcular recaudación
  const entregasConPago = entregas.filter((e: any) => e.pago_registrado && e.monto_cobrado_registrado > 0)
  const recaudacionRegistrada = ruta.recaudacion_total_registrada || 0
  const pagosPorMetodo: Record<string, number> = {}
  entregasConPago.forEach((detalle: any) => {
    const metodo = detalle.metodo_pago_registrado || 'efectivo'
    pagosPorMetodo[metodo] = (pagosPorMetodo[metodo] || 0) + Number(detalle.monto_cobrado_registrado)
  })

  const iniciarRutaAction = async () => {
    'use server'
    await iniciarRuta(ruta.id)
  }

  const finalizarRutaAction = async () => {
    'use server'
    await finalizarRuta(ruta.id)
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href="/reparto/rutas">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a rutas
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <form action={iniciarRutaAction}>
            <Button
              type="submit"
              variant="secondary"
              disabled={ruta.estado !== 'planificada'}
            >
              Iniciar ruta
            </Button>
          </form>

          <form action={finalizarRutaAction}>
            <Button
              type="submit"
              variant="default"
              disabled={ruta.estado !== 'en_curso'}
            >
              Finalizar ruta
            </Button>
          </form>

          <Button asChild variant="outline">
            <Link href={`/reparto/rutas/${ruta.id}/editar`}>Editar</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xl">Ruta {ruta.numero_ruta}</CardTitle>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span>{fechaLegible}</span>
            <span>Turno: {ruta.turno === 'mañana' ? 'Mañana' : 'Tarde'}</span>
            <span>Zona: {ruta.zona?.nombre || 'N/A'}</span>
            <Badge
              variant={
                ruta.estado === 'en_curso'
                  ? 'default'
                  : ruta.estado === 'completada'
                    ? 'outline'
                    : 'secondary'
              }
            >
              {ruta.estado}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Repartidor asignado
            </p>
            <p className="text-lg font-semibold">
              {ruta.repartidor?.nombre} {ruta.repartidor?.apellido}
            </p>
            {ruta.repartidor?.telefono && (
              <p className="text-sm text-muted-foreground">
                Tel: {ruta.repartidor.telefono}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Vehículo
            </p>
            <p className="text-lg font-semibold">
              {ruta.vehiculo?.patente} • {ruta.vehiculo?.marca}{' '}
              {ruta.vehiculo?.modelo}
            </p>
            <p className="text-sm text-muted-foreground">
              Capacidad: {ruta.vehiculo?.capacidad_kg || 0} kg
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Entregas
            </p>
            <p className="text-lg font-semibold">
              {entregasCompletadas}/{entregas.length} completadas
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Observaciones
            </p>
            <p className="text-sm">
              {ruta.observaciones?.trim() || 'Sin observaciones'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Información de validación de tesorería */}
      {ruta.estado === 'completada' && (
        <Card className={ruta.validada_por_tesorero ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Estado de Validación de Tesorería
              {ruta.validada_por_tesorero ? (
                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Validada
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300">
                  <Clock className="h-3 w-3 mr-1" />
                  Pendiente
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {ruta.validada_por_tesorero
                ? 'Esta ruta fue validada y los fondos fueron acreditados en caja'
                : 'Esta ruta está pendiente de validación por tesorería'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recaudacionRegistrada > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Recaudación registrada:</span>
                  <span className="text-xl font-bold">
                    ${recaudacionRegistrada.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                
                {Object.keys(pagosPorMetodo).length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Desglose por método:</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {Object.entries(pagosPorMetodo).map(([metodo, monto]) => (
                        <div key={metodo} className="text-sm bg-white/50 p-2 rounded">
                          <span className="capitalize text-muted-foreground">{metodo.replace('_', ' ')}:</span>
                          <span className="ml-1 font-semibold">
                            ${Number(monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {ruta.validada_por_tesorero ? (
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total validado:</span>
                  <span className="font-semibold text-green-700">
                    ${Number(ruta.recaudacion_total_validada || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {ruta.tesorero_validador && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Validada por: {ruta.tesorero_validador.nombre} {ruta.tesorero_validador.apellido}
                  </p>
                )}
                {ruta.fecha_validacion && (
                  <p className="text-xs text-muted-foreground">
                    Fecha: {new Date(ruta.fecha_validacion).toLocaleString('es-AR')}
                  </p>
                )}
                {ruta.observaciones_validacion && (
                  <div className="mt-2 p-2 bg-white/50 rounded text-xs">
                    <p className="font-medium mb-1">Observaciones:</p>
                    <p className="text-muted-foreground">{ruta.observaciones_validacion}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="pt-2 border-t">
                <Button asChild variant="default" className="w-full">
                  <Link href="/tesoreria/validar-rutas">
                    <DollarSign className="mr-2 h-4 w-4" />
                    Ir a Validar Ruta
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue={activeTab}>
        <TabsList>
          <TabsTrigger value="lista">
            <ClipboardList className="mr-2 h-4 w-4" />
            Lista de entregas
          </TabsTrigger>
          <TabsTrigger value="mapa">
            <MapPinned className="mr-2 h-4 w-4" />
            Mapa
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Entregas</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {entregas.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  No hay entregas asignadas.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-2 pr-4">#</th>
                      <th className="py-2 pr-4">Cliente</th>
                      <th className="py-2 pr-4">Dirección</th>
                      <th className="py-2 pr-4">Pedido</th>
                      <th className="py-2 pr-4">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entregas
                      .slice()
                      .sort(
                        (a: any, b: any) =>
                          (a.orden_entrega || 0) - (b.orden_entrega || 0),
                      )
                      .map((entrega: any) => (
                        <tr key={entrega.id} className="border-t">
                          <td className="py-2 pr-4 font-semibold">
                            #{entrega.orden_entrega}
                          </td>
                          <td className="py-2 pr-4">
                            <p className="font-medium">
                              {entrega.pedido?.cliente?.nombre || 'Cliente'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {entrega.pedido?.cliente?.telefono || '-'}
                            </p>
                          </td>
                          <td className="py-2 pr-4">
                            {entrega.pedido?.cliente?.direccion || '—'}
                          </td>
                          <td className="py-2 pr-4">
                            {entrega.pedido?.numero_pedido || '—'}
                          </td>
                          <td className="py-2 pr-4">
                            <Badge
                              variant={
                                entrega.estado_entrega === 'entregado'
                                  ? 'default'
                                  : 'secondary'
                              }
                              className="capitalize"
                            >
                              {entrega.estado_entrega || 'pendiente'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mapa">
          <RutaMap rutaId={ruta.id} entregas={entregas} showGpsTracking={false} />
        </TabsContent>
      </Tabs>
    </div>
  )
}


