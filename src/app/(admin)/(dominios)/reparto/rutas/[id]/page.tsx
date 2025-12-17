import Link from 'next/link'
import { ArrowLeft, ClipboardList, MapPinned, DollarSign, CheckCircle2, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import RutaMap from '@/components/reparto/RutaMap'
import { iniciarRutaAction, finalizarRutaAction } from '@/actions/reparto.actions'
import { RutaDetalleRealtime } from '@/components/reparto/RutaDetalleRealtime'

export const dynamic = 'force-dynamic'

export default async function RutaDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const resolvedSearchParams = await searchParams
  const activeTab = resolvedSearchParams?.tab === 'mapa' ? 'mapa' : 'lista'

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

  // Obtener detalles de ruta con información completa
  // Primero obtener los detalles básicos
  const { data: detallesRutaRaw, error: detallesError } = await supabase
    .from('detalles_ruta')
    .select(`
      id,
      orden_entrega,
      estado_entrega,
      coordenadas_entrega,
      fecha_hora_entrega,
      pago_registrado,
      metodo_pago_registrado,
      monto_cobrado_registrado,
      pago_validado,
      pedido_id,
      pedido:pedidos(
        id,
        numero_pedido,
        total,
        pago_estado,
        cliente_id
      )
    `)
    .eq('ruta_id', id)
    .order('orden_entrega', { ascending: true })

  if (detallesError) {
    console.error('Error obteniendo detalles de ruta:', detallesError)
  }

  // Para cada detalle, obtener el cliente (desde pedido o desde entregas)
  const detallesConClienteMatrix = await Promise.all(
    (detallesRutaRaw || []).map(async (detalle: any) => {
      // Si el pedido tiene cliente_id, es un pedido simple (1 cliente)
      if (detalle.pedido?.cliente_id) {
        let clienteData = null
        let coordenadasCliente = null

        const { data: cliente, error: clienteError } = await supabase
          .from('clientes')
          .select('id, nombre, direccion, telefono, coordenadas')
          .eq('id', detalle.pedido.cliente_id)
          .single()

        if (!clienteError && cliente) {
          clienteData = cliente
          // Convertir coordenadas PostGIS si existen
          if (cliente.coordenadas) {
            const coords = cliente.coordenadas
            if (coords && typeof coords === 'object' && 'type' in coords && coords.type === 'Point' && Array.isArray(coords.coordinates)) {
              const [lng, lat] = coords.coordinates
              coordenadasCliente = { lat, lng }
            } else if (coords && typeof coords === 'object' && 'lat' in coords && 'lng' in coords) {
              coordenadasCliente = coords
            }
          }
        }

        return [{
          ...detalle,
          pedido: {
            ...detalle.pedido,
            cliente: clienteData ? {
              ...clienteData,
              coordenadas: coordenadasCliente,
            } : null,
          },
        }]
      } else {
        // Si el pedido no tiene cliente_id, es un PEDIDO AGRUPADO (múltiples entregas)
        const { data: entregas, error: entregasError } = await supabase
          .from('entregas')
          .select(`
            id,
            cliente_id,
            estado_entrega,
            estado_pago,
            monto_cobrado,
            metodo_pago,
            coordenadas,
            orden_entrega,
            cliente:clientes(
              id,
              nombre,
              direccion,
              telefono,
              coordenadas
            )
          `)
          .eq('pedido_id', detalle.pedido_id)
          .order('orden_entrega', { ascending: true })

        if (!entregasError && entregas && entregas.length > 0) {
          // Generar una fila visual por cada entrega individual
          return entregas.map((entrega: any) => {
            let clienteData = null
            let coordenadasCliente = null

            // Procesar cliente de la entrega
            const clienteFromEntrega = Array.isArray(entrega.cliente) ? entrega.cliente[0] : entrega.cliente
            if (clienteFromEntrega) {
              clienteData = clienteFromEntrega
              // Convertir coordenadas desde entregas o desde cliente
              const coords = entrega.coordenadas || clienteFromEntrega.coordenadas
              if (coords) {
                if (coords && typeof coords === 'object' && 'type' in coords && coords.type === 'Point' && Array.isArray(coords.coordinates)) {
                  const [lng, lat] = coords.coordinates
                  coordenadasCliente = { lat, lng }
                } else if (coords && typeof coords === 'object' && 'lat' in coords && 'lng' in coords) {
                  coordenadasCliente = coords
                }
              }
            }

            return {
              ...detalle,
              // Sobrescribir ID para evitar claves duplicadas en listas si se usa detalle.id
              // Usamos un ID compuesto virtual
              virtual_id: `${detalle.id}-${entrega.id}`,
              // Datos específicos de esta entrega
              estado_entrega: entrega.estado_entrega,
              pago_registrado: entrega.estado_pago === 'pagado',
              metodo_pago_registrado: entrega.metodo_pago,
              monto_cobrado_registrado: entrega.monto_cobrado,
              orden_entrega: entrega.orden_entrega, // Usar orden de la entrega específica
              pedido: {
                ...detalle.pedido,
                cliente: clienteData ? {
                  ...clienteData,
                  coordenadas: coordenadasCliente,
                } : null,
              },
            }
          })
        }

        // Si no se encontraron entregas (caso extraño), devolver el detalle original vacío
        return [{ ...detalle }]
      }
    })
  )

  // Aplanar la matriz de resultados (array de arrays -> array simple)
  const detallesConCliente = detallesConClienteMatrix.flat()

  // Obtener ruta básica con relaciones
  const { data: rutaBasica, error: rutaError } = await supabase
    .from('rutas_reparto')
    .select(`
      *,
      repartidor:usuarios!rutas_reparto_repartidor_id_fkey(nombre, apellido, telefono),
      vehiculo:vehiculos(patente, marca, modelo, capacidad_kg),
      zona:zonas(nombre),
      tesorero_validador:usuarios!rutas_reparto_tesorero_validador_id_fkey(nombre, apellido)
    `)
    .eq('id', id)
    .single()

  if (rutaError || !rutaBasica) {
    return (
      <Card className="m-6">
        <CardContent className="p-6 text-center text-muted-foreground">
          No se encontró la ruta solicitada.
        </CardContent>
      </Card>
    )
  }

  const rutaData = {
    ...rutaBasica,
    detalles_ruta: detallesConCliente,
  }

  console.log('🗺️ [RutaDetallePage] Datos raw de Supabase:', {
    totalDetalles: rutaData.detalles_ruta?.length || 0,
    primerDetalle: rutaData.detalles_ruta?.[0],
    estructuraCompleta: JSON.stringify(rutaData.detalles_ruta?.[0], null, 2),
  })

  console.log('🗺️ [RutaDetallePage] Datos raw de Supabase:', {
    totalDetalles: rutaData.detalles_ruta?.length || 0,
    primerDetalle: rutaData.detalles_ruta?.[0],
    estructuraCompleta: JSON.stringify(rutaData.detalles_ruta?.[0], null, 2),
  })

  // Convertir coordenadas PostGIS a formato JSON si es necesario
  const ruta = {
    ...rutaData,
    detalles_ruta: rutaData.detalles_ruta?.map((detalle: any) => {
      if (detalle.pedido?.cliente?.coordenadas) {
        const coords = detalle.pedido.cliente.coordenadas

        // Log para debug
        console.log('🗺️ [RutaDetallePage] Coordenadas raw del cliente:', {
          detalleId: detalle.id,
          clienteNombre: detalle.pedido.cliente.nombre,
          coordenadasRaw: coords,
          tipo: typeof coords,
          esArray: Array.isArray(coords),
          tieneType: coords && typeof coords === 'object' && 'type' in coords,
          type: coords && typeof coords === 'object' && 'type' in coords ? coords.type : null,
        })

        // Si es un objeto GeoJSON Point de PostGIS, convertir a { lat, lng }
        if (coords && typeof coords === 'object' && 'type' in coords && coords.type === 'Point' && Array.isArray(coords.coordinates)) {
          const [lng, lat] = coords.coordinates
          console.log('✅ [RutaDetallePage] Coordenadas convertidas:', { lat, lng })
          return {
            ...detalle,
            pedido: {
              ...detalle.pedido,
              cliente: {
                ...detalle.pedido.cliente,
                coordenadas: { lat, lng },
              },
            },
          }
        }

        // Si ya está en formato { lat, lng }, mantenerlo
        if (coords && typeof coords === 'object' && 'lat' in coords && 'lng' in coords) {
          console.log('✅ [RutaDetallePage] Coordenadas ya en formato correcto:', coords)
          return detalle
        }
      } else {
        console.log('⚠️ [RutaDetallePage] Entrega sin coordenadas:', {
          detalleId: detalle.id,
          detalleCompleto: detalle,
          tienePedido: !!detalle.pedido,
          pedidoId: detalle.pedido?.id,
          tieneCliente: !!detalle.pedido?.cliente,
          clienteId: detalle.pedido?.cliente?.id,
          clienteNombre: detalle.pedido?.cliente?.nombre,
          clienteCompleto: detalle.pedido?.cliente,
        })
      }
      return detalle
    }),
  }

  console.log('🗺️ [RutaDetallePage] Ruta procesada:', {
    totalEntregas: ruta.detalles_ruta?.length || 0,
    entregasConCoordenadas: ruta.detalles_ruta?.filter((d: any) =>
      d.pedido?.cliente?.coordenadas &&
      (typeof d.pedido.cliente.coordenadas === 'object' && ('lat' in d.pedido.cliente.coordenadas || 'type' in d.pedido.cliente.coordenadas))
    ).length || 0,
  })

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

  const handleIniciarRuta = async () => {
    'use server'
    await iniciarRutaAction(ruta.id)
  }

  const handleFinalizarRuta = async () => {
    'use server'
    await finalizarRutaAction(ruta.id)
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
          <form action={async () => {
            'use server'
            await iniciarRutaAction(id)
          }}>
            <Button
              type="submit"
              variant="secondary"
              disabled={ruta.estado !== 'planificada'}
            >
              Iniciar ruta
            </Button>
          </form>

          <form action={async () => {
            'use server'
            await finalizarRutaAction(id)
          }}>
            <Button
              type="submit"
              variant="default"
              disabled={ruta.estado !== 'en_curso'}
            >
              Finalizar ruta
            </Button>
          </form>

          <Button asChild variant="secondary">
            <Link href={`/reparto/rutas/${ruta.id}/optimizar`}>
              <MapPinned className="mr-2 h-4 w-4" />
              Optimizar Ruta
            </Link>
          </Button>

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
                        <tr key={entrega.virtual_id || entrega.id} className="border-t">
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
          <RutaMap
            rutaId={ruta.id}
            entregas={entregas.map((e: any) => ({ ...e, id: e.virtual_id || e.id }))}
            showGpsTracking={false}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}


