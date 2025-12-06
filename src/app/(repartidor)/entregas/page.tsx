import { Suspense } from 'react'
import { Truck, MapPin, Clock, CheckCircle, DollarSign, Camera, FileText, Calendar, Filter } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/server'
import { RepartoSkeleton } from './reparto-skeleton'
import { obtenerRutasPorVehiculoAction } from '@/actions/reparto.actions'

export const dynamic = 'force-dynamic'

async function RepartoContent({ searchParams }: { searchParams: { fecha?: string; turno?: string } }) {
  const supabase = await createClient()

  // Obtener usuario actual (repartidor)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div>No autorizado</div>

  // Obtener vehículo asignado al repartidor
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('vehiculo_asignado')
    .eq('id', user.id)
    .single()

  if (!usuario?.vehiculo_asignado) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="p-8 text-center">
            <Truck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No hay vehículo asignado</h3>
            <p className="text-muted-foreground">
              Contacta al administrador para asignar un vehículo
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Filtros
  const fechaFiltro = searchParams.fecha || undefined
  const turnoFiltro = searchParams.turno || undefined

  // Obtener rutas del vehículo del repartidor (sin filtrar por fecha si no se especifica)
  const rutasResponse = await obtenerRutasPorVehiculoAction(usuario.vehiculo_asignado, fechaFiltro)
  const rutas = rutasResponse.success && rutasResponse.data ? (rutasResponse.data as any[]) : []

  // Filtrar por turno si se especifica
  const rutasFiltradas = turnoFiltro 
    ? rutas.filter((r: any) => r.turno === turnoFiltro)
    : rutas

  // Obtener todas las entregas de las rutas activas
  const rutasActivas = rutasFiltradas.filter((r: any) => 
    ['planificada', 'en_curso'].includes(r.estado)
  )

  // Obtener detalles de ruta con información completa
  const rutaIds = rutasActivas.map((r: any) => r.id)
  
  // Obtener detalles básicos primero
  const { data: detallesRutaRaw } = rutaIds.length > 0
    ? await supabase
        .from('detalles_ruta')
        .select(`
          id,
          orden_entrega,
          estado_entrega,
          ruta_id,
          pedido_id,
          pedido:pedidos(
            id,
            numero_pedido,
            total,
            turno,
            zona_id,
            cliente_id,
            pago_estado,
            instrucciones_repartidor
          ),
          ruta: rutas_reparto(
            id,
            numero_ruta,
            fecha_ruta,
            turno,
            zona_id,
            estado,
            vehiculo:vehiculos(patente, marca, modelo)
          )
        `)
        .in('ruta_id', rutaIds)
        .order('orden_entrega')
    : { data: [] }

  // Para cada detalle, obtener el cliente (desde pedido o desde entregas)
  const detallesConCliente = await Promise.all(
    (detallesRutaRaw || []).map(async (detalle: any) => {
      let clienteData = null

      // Si el pedido tiene cliente_id, obtener cliente directamente
      if (detalle.pedido?.cliente_id) {
        const { data: cliente, error: clienteError } = await supabase
          .from('clientes')
          .select('id, nombre, telefono, direccion, zona_entrega')
          .eq('id', detalle.pedido.cliente_id)
          .single()

        if (!clienteError && cliente) {
          clienteData = cliente
        }
      } else {
        // Si el pedido no tiene cliente_id, buscar en entregas
        const { data: entregas, error: entregasError } = await supabase
          .from('entregas')
          .select(`
            cliente_id,
            cliente:clientes(
              id,
              nombre,
              telefono,
              direccion,
              zona_entrega
            )
          `)
          .eq('pedido_id', detalle.pedido_id)
          .limit(1)
          .single()

        if (!entregasError && entregas?.cliente) {
          clienteData = entregas.cliente
        }
      }

      return {
        ...detalle,
        pedido: {
          ...detalle.pedido,
          cliente: clienteData,
        },
      }
    })
  )

  const entregas = detallesConCliente.map((detalle: any) => ({
    id: detalle.id,
    pedido_id: detalle.pedido?.id,
    numero_pedido: detalle.pedido?.numero_pedido,
    cliente: detalle.pedido?.cliente,
    total: detalle.pedido?.total,
    pago_estado: detalle.pedido?.pago_estado,
    instrucciones: detalle.pedido?.instrucciones_repartidor,
    orden_entrega: detalle.orden_entrega,
    ruta_id: detalle.ruta_id,
    ruta: detalle.ruta,
    estado: detalle.estado_entrega,
    turno: detalle.ruta?.turno,
    zona: detalle.pedido?.cliente?.zona_entrega
  }))

  // Estadísticas
  const totalEntregas = entregas.length
  const entregasCompletadas = entregas.filter(e => e.estado === 'entregado').length
  const totalCobrar = entregas
    .filter(e => e.pago_estado !== 'pagado')
    .reduce((sum, e) => sum + (e.total || 0), 0)

  // Agrupar entregas por ruta
  const entregasPorRuta = entregas.reduce((acc: any, entrega: any) => {
    const rutaId = entrega.ruta_id
    if (!acc[rutaId]) {
      acc[rutaId] = {
        ruta: entrega.ruta,
        entregas: []
      }
    }
    acc[rutaId].entregas.push(entrega)
    return acc
  }, {})

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="bg-white border-b p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Reparto del Día</h1>
            <p className="text-muted-foreground">
              {fechaFiltro 
                ? new Date(fechaFiltro).toLocaleDateString('es-AR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })
                : 'Todas las fechas'}
            </p>
          </div>
          {rutasActivas.length > 0 && (
            <Badge variant="outline" className="bg-blue-50">
              <Truck className="mr-1 h-3 w-3" />
              {rutasActivas.length} {rutasActivas.length === 1 ? 'Ruta Activa' : 'Rutas Activas'}
            </Badge>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="px-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-1 block">Fecha (opcional)</label>
                <input
                  type="date"
                  defaultValue={fechaFiltro || ''}
                  className="w-full px-3 py-2 border rounded-md"
                  onChange={(e) => {
                    const params = new URLSearchParams(searchParams as any)
                    if (e.target.value) {
                      params.set('fecha', e.target.value)
                    } else {
                      params.delete('fecha')
                    }
                    window.location.search = params.toString()
                  }}
                />
              </div>
              <div className="flex-1">
                <label className="text-sm font-medium mb-1 block">Turno</label>
                <select
                  defaultValue={turnoFiltro || ''}
                  className="w-full px-3 py-2 border rounded-md"
                  onChange={(e) => {
                    const params = new URLSearchParams(searchParams as any)
                    if (e.target.value) {
                      params.set('turno', e.target.value)
                    } else {
                      params.delete('turno')
                    }
                    window.location.search = params.toString()
                  }}
                >
                  <option value="">Todos</option>
                  <option value="mañana">Mañana</option>
                  <option value="tarde">Tarde</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-3 gap-4 px-4">
        <Card className="text-center">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{totalEntregas}</div>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{entregasCompletadas}</div>
            <p className="text-xs text-muted-foreground">Completadas</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">${totalCobrar.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Por Cobrar</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de rutas y entregas */}
      <div className="px-4 space-y-6">
        {Object.keys(entregasPorRuta).length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Truck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No hay rutas asignadas</h3>
              <p className="text-muted-foreground">
                Esperando asignación de ruta por el administrador
              </p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(entregasPorRuta).map(([rutaId, grupo]: [string, any]) => {
            const ruta = grupo.ruta
            const entregasRuta = grupo.entregas
            const entregasCompletadasRuta = entregasRuta.filter((e: any) => e.estado === 'entregado').length
            
            return (
              <div key={rutaId} className="space-y-3">
                {/* Header de Ruta */}
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{ruta?.numero_ruta}</CardTitle>
                        <CardDescription>
                          {ruta?.vehiculo?.patente} • {ruta?.turno === 'mañana' ? '🌅 Mañana' : '🌆 Tarde'}
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <Link href={`/ruta/${rutaId}`}>
                          <MapPin className="mr-2 h-4 w-4" />
                          Ver Hoja de Ruta
                        </Link>
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm">
                      <span>
                        {entregasCompletadasRuta} / {entregasRuta.length} entregas
                      </span>
                      <Badge variant={ruta?.estado === 'en_curso' ? 'default' : 'secondary'}>
                        {ruta?.estado === 'en_curso' ? 'En Curso' : 'Planificada'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Entregas de esta ruta */}
                {entregasRuta.map((entrega: any) => (
            <Card key={entrega.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">#{entrega.orden_entrega}</Badge>
                    <span className="font-semibold">{entrega.numero_pedido}</span>
                    <Badge
                      variant={entrega.pago_estado === 'pagado' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {entrega.pago_estado === 'pagado' ? 'Pagado' : 'Pendiente'}
                    </Badge>
                  </div>
                    <Badge variant="outline" className="text-xs">
                      <MapPin className="mr-1 h-3 w-3" />
                      {entrega.ruta?.numero_ruta || 'Ruta'}
                    </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Información del cliente */}
                  <div>
                    <h4 className="font-medium">{entrega.cliente?.nombre || 'Cliente'}</h4>
                    <p className="text-sm text-muted-foreground">
                      📍 {entrega.cliente?.direccion || 'Dirección no disponible'}
                    </p>
                    {entrega.cliente?.telefono && (
                      <p className="text-sm text-muted-foreground">
                        📞 {entrega.cliente.telefono}
                      </p>
                    )}
                  </div>

                  {/* Información del pedido */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        ${entrega.total?.toFixed(2) || '0.00'}
                      </span>
                      {entrega.ruta?.vehiculo?.patente && (
                        <span className="flex items-center gap-1">
                          <Truck className="h-4 w-4" />
                          {entrega.ruta.vehiculo.patente}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Instrucciones del repartidor */}
                  {entrega.instrucciones && (
                    <div className="bg-yellow-50 p-3 rounded-md">
                      <p className="text-sm">
                        <FileText className="inline h-4 w-4 mr-1" />
                        {entrega.instrucciones}
                      </p>
                    </div>
                  )}

                  {/* Acciones */}
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1" asChild>
                      <Link href={`/ruta/${rutaId}/entrega/${entrega.id}`}>
                        <MapPin className="mr-2 h-4 w-4" />
                        Gestionar
                      </Link>
                    </Button>
                    {entrega.estado !== 'entregado' && (
                      <Button
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        asChild
                      >
                        <Link href={`/ruta/${rutaId}`}>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Ir a ruta
                        </Link>
                      </Button>
                    )}
                    {entrega.estado === 'entregado' && (
                      <Badge variant="default" className="flex-1 justify-center">
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Entregado
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
                ))}
              </div>
            )
          })
        )}
      </div>

      {/* Información adicional */}
      {entregas.length > 0 && (
        <div className="px-4">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-800">Información Importante</span>
              </div>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Registra cada entrega con comprobante de pago</li>
                <li>• Toma foto del recibo o comprobante de transferencia</li>
                <li>• Marca como entregado solo cuando el cliente confirme recepción</li>
                <li>• Los cobros se registran automáticamente en la caja central</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default function RepartoPage({
  searchParams,
}: {
  searchParams: { fecha?: string; turno?: string }
}) {
  return (
    <Suspense fallback={<RepartoSkeleton />}>
      <RepartoContent searchParams={searchParams} />
    </Suspense>
  )
}
