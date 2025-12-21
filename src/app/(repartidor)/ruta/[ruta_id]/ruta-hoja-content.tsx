'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Truck,
  MapPin,
  Clock,
  CheckCircle,
  DollarSign,
  Camera,
  FileText,
  AlertCircle,
  Navigation,
  Package,
  X,
  Plus,
  Map,
  List
} from 'lucide-react'
import { getEntregasSinEstadoPago, estaPagado } from '@/lib/utils/estado-pago'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { iniciarRutaAction, finalizarRutaAction } from '@/actions/reparto.actions'
import { ChecklistInicioForm } from './checklist-inicio-form'
import { ChecklistFinForm } from './checklist-fin-form'
import { EntregaCard } from './entrega-card'
import GpsTracker from '@/components/reparto/GpsTracker'
import { RutaMapaContent } from './ruta-mapa-content'

interface RutaHojaContentProps {
  ruta: any
}

export function RutaHojaContent({ ruta }: RutaHojaContentProps) {
  const router = useRouter()
  const [vistaActual, setVistaActual] = useState<'mapa' | 'lista'>('mapa')
  const [showChecklistInicio, setShowChecklistInicio] = useState(false)
  const [showChecklistFin, setShowChecklistFin] = useState(false)
  const [loading, setLoading] = useState(false)

  // Si la vista es mapa, renderizar el nuevo componente
  if (vistaActual === 'mapa') {
    return (
      <div className="relative">
        <RutaMapaContent ruta={ruta} />
        {/* Botón flotante para cambiar a vista lista */}
        <Button
          variant="secondary"
          size="sm"
          className="fixed bottom-20 right-4 z-30 shadow-lg"
          onClick={() => setVistaActual('lista')}
        >
          <List className="mr-2 h-4 w-4" />
          Ver Lista
        </Button>
      </div>
    )
  }

  // Vista lista existente (original)
  const entregas = ruta.detalles_ruta || []
  const entregasOrdenadas = [...entregas].sort((a, b) => a.orden_entrega - b.orden_entrega)
  const entregasCompletadas = entregas.filter((e: any) =>
    e.estado_entrega === 'entregado' || e.estado_entrega === 'rechazado'
  ).length
  const entregasPendientes = entregas.filter((e: any) =>
    e.estado_entrega === 'pendiente' || e.estado_entrega === 'en_camino' || !e.estado_entrega
  ).length
  const totalCobrar = entregas
    .filter((e: any) => e.pedido?.pago_estado !== 'pagado')
    .reduce((sum: number, e: any) => sum + (e.pedido?.total || 0), 0)

  // Debug: Log si no hay entregas
  if (entregas.length === 0) {
    console.warn('⚠️ Ruta sin entregas:', {
      rutaId: ruta.id,
      numeroRuta: ruta.numero_ruta,
      estado: ruta.estado,
      detalles_ruta: ruta.detalles_ruta
    })
  }

  // Calcular recaudación registrada
  const entregasConPago = entregas.filter((e: any) => e.pago_registrado && e.monto_cobrado_registrado > 0)
  const recaudacionRegistrada = ruta.recaudacion_total_registrada || 0
  const pagosPorMetodo: Record<string, number> = {}
  entregasConPago.forEach((detalle: any) => {
    const metodo = detalle.metodo_pago_registrado || 'efectivo'
    pagosPorMetodo[metodo] = (pagosPorMetodo[metodo] || 0) + Number(detalle.monto_cobrado_registrado)
  })

  // Usar función helper centralizada para verificar estado de pago
  const entregasSinEstadoPago = getEntregasSinEstadoPago(entregas)

  // Permitir iniciar rutas en estado 'planificada' o 'en_curso' (rutas iniciadas desde almacén)
  // El botón aparecerá si tiene checklist_inicio_id completado
  const puedeIniciar = (ruta.estado === 'planificada' || ruta.estado === 'en_curso') && ruta.checklist_inicio_id
  const puedeFinalizar = ruta.estado === 'en_curso' &&
    entregasPendientes === 0 &&
    entregasSinEstadoPago.length === 0 &&
    ruta.checklist_fin_id

  const handleIniciarRuta = async () => {
    if (!ruta.checklist_inicio_id) {
      toast.error('Debes completar el checklist de inicio antes de iniciar la ruta')
      setShowChecklistInicio(true)
      return
    }

    setLoading(true)
    const result = await iniciarRutaAction(ruta.id)
    setLoading(false)

    if (result.success) {
      toast.success('Ruta iniciada exitosamente')
      router.refresh()
    } else {
      toast.error(result.error || 'Error al iniciar la ruta')
    }
  }

  const handleFinalizarRuta = async () => {
    if (entregasPendientes > 0) {
      toast.error('Todas las entregas deben estar completas antes de finalizar')
      return
    }

    if (entregasSinEstadoPago.length > 0) {
      toast.error(`Debes registrar el estado de pago para ${entregasSinEstadoPago.length} entrega(s) antes de finalizar la ruta`)
      return
    }

    if (!ruta.checklist_fin_id) {
      toast.error('Debes completar el checklist de finalización')
      setShowChecklistFin(true)
      return
    }

    setLoading(true)
    const result = await finalizarRutaAction(ruta.id, ruta.checklist_fin_id)
    setLoading(false)

    if (result.success) {
      toast.success('Ruta finalizada exitosamente')
      router.push('/entregas')
    } else {
      toast.error(result.error || 'Error al finalizar la ruta')
    }
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="bg-white border-b p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">{ruta.numero_ruta}</h1>
            <p className="text-muted-foreground">
              {new Date(ruta.fecha_ruta).toLocaleDateString('es-AR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>
          <Badge
            variant={ruta.estado === 'en_curso' ? 'default' : 'secondary'}
            className="text-sm"
          >
            {ruta.estado === 'en_curso' ? 'En Curso' :
              ruta.estado === 'completada' ? 'Completada' : 'Planificada'}
          </Badge>
        </div>

        {/* Información de la ruta */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Vehículo:</span>
            <p className="font-medium">
              {ruta.vehiculo?.patente} • {ruta.vehiculo?.marca} {ruta.vehiculo?.modelo}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Turno:</span>
            <p className="font-medium">
              {ruta.turno === 'mañana' ? '🌅 Mañana' : '🌆 Tarde'}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Zona:</span>
            <p className="font-medium">{ruta.zona?.nombre || 'N/A'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Capacidad:</span>
            <p className="font-medium">{ruta.vehiculo?.capacidad_kg} kg</p>
          </div>
        </div>
      </div>

      {/* GPS Tracker - Solo cuando la ruta está en curso */}
      {ruta.estado === 'en_curso' && (
        <div className="px-4">
          <GpsTracker
            repartidorId={ruta.repartidor_id}
            vehiculoId={ruta.vehiculo_id}
            rutaId={ruta.id}
          />
        </div>
      )}

      {/* Estadísticas */}
      <div className="px-4 grid grid-cols-3 gap-4">
        <Card className="text-center">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{entregas.length}</div>
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

      {/* Resumen de Recaudación - Solo si hay pagos registrados o ruta completada */}
      {(recaudacionRegistrada > 0 || ruta.estado === 'completada') && (
        <div className="px-4">
          <Card className={ruta.validada_por_tesorero ? 'border-green-200 bg-green-50' : 'border-blue-200 bg-blue-50'}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Recaudación Registrada
                {ruta.validada_por_tesorero && (
                  <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Validada
                  </Badge>
                )}
                {ruta.estado === 'completada' && !ruta.validada_por_tesorero && (
                  <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300">
                    <Clock className="h-3 w-3 mr-1" />
                    Pendiente de validación
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {ruta.validada_por_tesorero
                  ? 'Esta ruta fue validada por tesorería y los fondos fueron acreditados en caja'
                  : ruta.estado === 'completada'
                    ? 'La ruta está completada. Esperando validación de tesorería.'
                    : 'Pagos registrados durante la ruta'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total registrado:</span>
                <span className="text-2xl font-bold">
                  ${recaudacionRegistrada.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {Object.keys(pagosPorMetodo).length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Desglose por método de pago:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(pagosPorMetodo).map(([metodo, monto]) => (
                      <div key={metodo} className="flex items-center justify-between text-sm bg-white/50 p-2 rounded">
                        <span className="capitalize text-muted-foreground">
                          {metodo.replace('_', ' ')}:
                        </span>
                        <span className="font-semibold">
                          ${Number(monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {ruta.validada_por_tesorero && ruta.recaudacion_total_validada && (
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total validado:</span>
                    <span className="font-semibold text-green-700">
                      ${Number(ruta.recaudacion_total_validada).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {ruta.fecha_validacion && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Validada el {new Date(ruta.fecha_validacion).toLocaleString('es-AR')}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Checklist Inicio */}
      {ruta.estado === 'planificada' && (
        <div className="px-4">
          {!ruta.checklist_inicio_id ? (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  Checklist de Inicio Requerido
                </CardTitle>
                <CardDescription>
                  Debes completar el checklist antes de iniciar la ruta
                </CardDescription>
              </CardHeader>
              <CardContent>
                {showChecklistInicio ? (
                  <ChecklistInicioForm
                    rutaId={ruta.id}
                    vehiculoId={ruta.vehiculo_id}
                    onComplete={() => {
                      setShowChecklistInicio(false)
                      router.refresh()
                    }}
                  />
                ) : (
                  <Button
                    onClick={() => setShowChecklistInicio(true)}
                    className="w-full"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Completar Checklist de Inicio
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Checklist de inicio completado</span>
                  </div>
                  {(!ruta.estado || ruta.estado === 'planificada') && (
                    <Button
                      onClick={handleIniciarRuta}
                      disabled={loading}
                      size="sm"
                    >
                      Iniciar Ruta
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Alerta de entregas sin estado de pago */}
      {ruta.estado === 'en_curso' && entregasSinEstadoPago.length > 0 && (
        <div className="px-4">
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium text-yellow-900">
                  Debes registrar el estado de pago para {entregasSinEstadoPago.length} entrega(s) antes de finalizar la ruta:
                </p>
                <ul className="list-disc list-inside text-sm text-yellow-800 space-y-1">
                  {entregasSinEstadoPago.map((entrega: any) => (
                    <li key={entrega.id}>
                      Orden #{entrega.orden_entrega} - {entrega.pedido?.cliente?.nombre || 'Cliente'}
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 ml-2 text-yellow-700 underline"
                        asChild
                      >
                        <Link href={`/ruta/${ruta.id}/entrega/${entrega.id}`}>
                          Registrar pago
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Checklist Fin */}
      {ruta.estado === 'en_curso' && entregasPendientes === 0 && entregasSinEstadoPago.length === 0 && (
        <div className="px-4">
          {!ruta.checklist_fin_id ? (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                  Todas las entregas completadas
                </CardTitle>
                <CardDescription>
                  Completa el checklist de finalización para cerrar la ruta
                </CardDescription>
              </CardHeader>
              <CardContent>
                {showChecklistFin ? (
                  <ChecklistFinForm
                    rutaId={ruta.id}
                    vehiculoId={ruta.vehiculo_id}
                    onComplete={() => {
                      setShowChecklistFin(false)
                      handleFinalizarRuta()
                    }}
                  />
                ) : (
                  <Button
                    onClick={() => setShowChecklistFin(true)}
                    className="w-full"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Completar Checklist de Finalización
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Checklist de finalización completado</span>
                  </div>
                  <Button
                    onClick={handleFinalizarRuta}
                    disabled={loading}
                    size="sm"
                  >
                    Finalizar Ruta
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Lista de entregas */}
      <div className="px-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Entregas ({entregasOrdenadas.length})
          </h2>
          {entregasOrdenadas.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVistaActual('mapa')}
            >
              <Map className="mr-2 h-4 w-4" />
              Ver mapa
            </Button>
          )}
        </div>

        {entregasOrdenadas.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No hay entregas asignadas</h3>
              <p className="text-muted-foreground">
                Esta ruta no tiene entregas asignadas. Contacta al administrador para agregar pedidos a la ruta.
              </p>
            </CardContent>
          </Card>
        ) : (
          entregasOrdenadas.map((entrega: any) => (
            <EntregaCard
              key={entrega.id}
              entrega={entrega}
              rutaId={ruta.id}
              rutaEstado={ruta.estado}
            />
          ))
        )}
      </div>
    </div>
  )
}

