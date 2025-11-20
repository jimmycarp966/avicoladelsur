import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { ArrowLeft, Package, User, MapPin, Calendar, DollarSign, Scale, Clock, History, FileText, CreditCard } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { obtenerPresupuestoAction, enviarPresupuestoAlmacenAction, convertirPresupuestoACotizacionAction } from '@/actions/presupuestos.actions'
import { PresupuestoDetalleSkeleton } from './presupuesto-detalle-skeleton'
import { AsignarTurnoZonaForm } from './asignar-turno-zona-form'
import { createClient } from '@/lib/supabase/server'

interface PresupuestoDetallePageProps {
  params: {
    id: string
  }
}

async function PresupuestoDetalle({ presupuestoId }: { presupuestoId: string }) {
  const supabase = await createClient()
  const result = await obtenerPresupuestoAction(presupuestoId)

  if (!result.success || !result.data) {
    notFound()
  }

  const presupuesto = result.data
  const itemsPesables = (presupuesto.items || []).filter((item: any) => item.pesable)
  const puedeFacturarDirecto = presupuesto.estado === 'pendiente' && itemsPesables.length === 0

  // Obtener zonas y zonas_dias para el formulario
  const { data: zonas } = await supabase
    .from('zonas')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre')

  const { data: zonasDias } = await supabase
    .from('zonas_dias')
    .select('*')
    .eq('activo', true)

  async function handleEnviarAlmacen() {
    // Validar que tenga turno y zona antes de enviar
    if (!presupuesto.turno || !presupuesto.zona_id) {
      return { success: false, message: 'El presupuesto debe tener turno y zona asignados antes de enviar a almacén' }
    }

    try {
      const response = await fetch('/api/ventas/presupuestos/enviar-almacen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presupuesto_id: presupuestoId })
      })

      const result = await response.json()
      return result
    } catch (error) {
      return { success: false, message: 'Error de conexión' }
    }
  }

  async function handleConvertirACotizacion() {
    try {
      const result = await convertirPresupuestoACotizacionAction(presupuestoId)
      return result
    } catch (error) {
      return { success: false, message: 'Error al convertir a cotización' }
    }
  }

  async function handleFacturarDirecto() {
    try {
      const response = await fetch('/api/ventas/presupuestos/facturar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presupuesto_id: presupuestoId })
      })

      const result = await response.json()
      return result
    } catch (error) {
      return { success: false, message: 'Error de conexión' }
    }
  }

  const getEstadoConfig = (estado: string) => {
    const configs = {
      pendiente: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
      en_almacen: { label: 'En Almacén', color: 'bg-blue-100 text-blue-800' },
      facturado: { label: 'Facturado', color: 'bg-green-100 text-green-800' },
      anulado: { label: 'Anulado', color: 'bg-red-100 text-red-800' },
    }
    return configs[estado as keyof typeof configs] || { label: estado, color: 'bg-gray-100 text-gray-800' }
  }

  const estadoConfig = getEstadoConfig(presupuesto.estado)

  return (
    <div className="space-y-6">
      {/* Header con navegación */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/ventas/presupuestos">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Presupuestos
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Presupuesto {presupuesto.numero_presupuesto}</h1>
          <p className="text-muted-foreground">Detalle completo del presupuesto</p>
        </div>
        {presupuesto.estado === 'pendiente' && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                const result = await handleConvertirACotizacion()
                if (result.success) {
                  window.location.reload()
                } else {
                  alert(result.message || 'Error al convertir a cotización')
                }
              }}
            >
              <FileText className="mr-2 h-4 w-4" />
              Convertir a Cotización
            </Button>
            {puedeFacturarDirecto && (
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={async () => {
                  const result = await handleFacturarDirecto()
                  if (result.success) {
                    window.location.reload()
                  } else {
                    alert(result.message || 'Error al facturar presupuesto')
                  }
                }}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Facturar sin Almacén
              </Button>
            )}
            <Button
              onClick={async () => {
                const result = await handleEnviarAlmacen()
                if (result.success) {
                  window.location.reload()
                } else {
                  alert(result.message || 'Error al enviar a almacén')
                }
              }}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!presupuesto.turno || !presupuesto.zona_id}
            >
              <Package className="mr-2 h-4 w-4" />
              Enviar a Almacén
            </Button>
          </div>
        )}
      </div>

      {/* Información general */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estado</CardTitle>
            <Badge className={estadoConfig.color}>
              {estadoConfig.label}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{estadoConfig.label}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Estimado</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${presupuesto.total_estimado?.toFixed(2) || '0.00'}</div>
            {presupuesto.total_final && (
              <p className="text-xs text-muted-foreground">
                Final: ${presupuesto.total_final.toFixed(2)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fecha de Entrega</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {presupuesto.fecha_entrega_estimada
                ? new Date(presupuesto.fecha_entrega_estimada).toLocaleDateString('es-AR')
                : 'No definida'
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Asignar Turno y Zona (si está pendiente y no tiene turno/zona) */}
      {presupuesto.estado === 'pendiente' && (!presupuesto.turno || !presupuesto.zona_id) && zonas && (
        <AsignarTurnoZonaForm
          presupuestoId={presupuestoId}
          presupuesto={presupuesto}
          zonas={zonas}
          zonasDias={zonasDias || []}
          fechaEntrega={presupuesto.fecha_entrega_estimada}
        />
      )}

      {/* Información del cliente */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Información del Cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Nombre</label>
            <p className="text-lg">{presupuesto.cliente?.nombre || 'Cliente no encontrado'}</p>
          </div>
          <div>
            <label className="text-sm font-medium">Teléfono</label>
            <p className="text-lg">{presupuesto.cliente?.telefono || 'No disponible'}</p>
          </div>
          {presupuesto.zona && (
            <div>
              <label className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Zona de Entrega
              </label>
              <p className="text-lg">{presupuesto.zona.nombre}</p>
            </div>
          )}
          {presupuesto.turno && (
            <div>
              <label className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Turno
              </label>
              <p className="text-lg capitalize">{presupuesto.turno}</p>
            </div>
          )}
          {presupuesto.recargo_total && presupuesto.recargo_total > 0 && (
            <div className="md:col-span-2">
              <label className="text-sm font-medium">Recargo por Métodos de Pago</label>
              <p className="text-lg text-blue-600">${presupuesto.recargo_total.toFixed(2)}</p>
            </div>
          )}
        {Array.isArray(presupuesto.metodos_pago) && presupuesto.metodos_pago.length > 0 && (
          <div className="md:col-span-2 space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Métodos de pago admitidos
            </label>
            <div className="space-y-2">
              {presupuesto.metodos_pago.map((metodo: any, index: number) => {
                const etiqueta = (metodo.metodo || metodo.tipo || 'sin definir').replace('_', ' ')
                const recargoValue = Number(metodo.recargo || 0)
                const mostrarRecargo = Number.isFinite(recargoValue) && recargoValue > 0

                return (
                  <div key={`${etiqueta}-${index}`} className="flex items-center justify-between rounded-md border p-3 text-sm">
                    <span className="font-medium capitalize">{etiqueta}</span>
                    {mostrarRecargo && (
                      <span className="text-primary font-medium">
                        +${recargoValue.toFixed(2)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
        </CardContent>
      </Card>

      {/* Items del presupuesto */}
      <Card>
        <CardHeader>
          <CardTitle>Items del Presupuesto</CardTitle>
          <CardDescription>
            Productos solicitados con cantidades y precios
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {presupuesto.items?.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{item.producto?.nombre || 'Producto'}</h4>
                    <span className="text-sm text-muted-foreground">
                      #{item.producto?.codigo || 'N/A'}
                    </span>
                    {item.pesable && (
                      <Badge variant="outline" className="text-xs">
                        <Scale className="h-3 w-3 mr-1" />
                        BALANZA
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span>Solicitado: {item.cantidad_solicitada} kg</span>
                    {item.cantidad_reservada > 0 && (
                      <span className="text-green-600">
                        Reservado: {item.cantidad_reservada} kg
                      </span>
                    )}
                    {item.peso_final && (
                      <span className="text-blue-600">
                        Pesado: {item.peso_final} kg
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">
                    ${item.subtotal_est?.toFixed(2) || '0.00'}
                  </div>
                  {item.subtotal_final && (
                    <div className="text-sm text-muted-foreground">
                      Final: ${item.subtotal_final.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
            )) || (
              <p className="text-muted-foreground">No hay items en este presupuesto</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Historial de Versiones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historial de Versiones
          </CardTitle>
          <CardDescription>
            Registro de cambios y eventos del presupuesto
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Evento: Creación */}
            <div className="flex items-start gap-4 pb-4 border-b">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Package className="h-5 w-5 text-blue-600" />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Presupuesto Creado</h4>
                  <span className="text-sm text-muted-foreground">
                    {new Date(presupuesto.created_at).toLocaleString('es-AR', {
                      dateStyle: 'short',
                      timeStyle: 'short'
                    })}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Presupuesto {presupuesto.numero_presupuesto} creado en estado "{presupuesto.estado}"
                </p>
                {presupuesto.usuario_vendedor && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Vendedor: {(presupuesto.usuario_vendedor as any)?.nombre || 'N/A'}
                  </p>
                )}
              </div>
            </div>

            {/* Evento: Cambio de estado a "en_almacen" */}
            {presupuesto.estado === 'en_almacen' || presupuesto.estado === 'facturado' ? (
              <div className="flex items-start gap-4 pb-4 border-b">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                    <Package className="h-5 w-5 text-orange-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Enviado a Almacén</h4>
                    <span className="text-sm text-muted-foreground">
                      {presupuesto.updated_at && presupuesto.updated_at !== presupuesto.created_at
                        ? new Date(presupuesto.updated_at).toLocaleString('es-AR', {
                            dateStyle: 'short',
                            timeStyle: 'short'
                          })
                        : 'N/A'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Presupuesto enviado para procesamiento en almacén
                  </p>
                  {presupuesto.usuario_almacen && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Almacenista: {(presupuesto.usuario_almacen as any)?.nombre || 'N/A'}
                    </p>
                  )}
                </div>
              </div>
            ) : null}

            {/* Evento: Conversión a pedido */}
            {presupuesto.estado === 'facturado' && presupuesto.pedido_convertido_id ? (
              <div className="flex items-start gap-4 pb-4 border-b">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <Package className="h-5 w-5 text-green-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Convertido a Pedido</h4>
                    <span className="text-sm text-muted-foreground">
                      {presupuesto.updated_at
                        ? new Date(presupuesto.updated_at).toLocaleString('es-AR', {
                            dateStyle: 'short',
                            timeStyle: 'short'
                          })
                        : 'N/A'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Presupuesto convertido exitosamente a pedido
                  </p>
                  {presupuesto.pedido_convertido && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Pedido: {(presupuesto.pedido_convertido as any)?.numero_pedido || 'N/A'}
                    </p>
                  )}
                  {presupuesto.total_final && presupuesto.total_final !== presupuesto.total_estimado && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Total ajustado: ${presupuesto.total_estimado.toFixed(2)} → ${presupuesto.total_final.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            ) : null}

            {/* Evento: Última actualización */}
            {presupuesto.updated_at && presupuesto.updated_at !== presupuesto.created_at && (
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-gray-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Última Actualización</h4>
                    <span className="text-sm text-muted-foreground">
                      {new Date(presupuesto.updated_at).toLocaleString('es-AR', {
                        dateStyle: 'short',
                        timeStyle: 'short'
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Modificaciones realizadas en observaciones, fecha de entrega u otros campos
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Observaciones */}
      {presupuesto.observaciones && (
        <Card>
          <CardHeader>
            <CardTitle>Observaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{presupuesto.observaciones}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default async function PresupuestoDetallePage({ params }: PresupuestoDetallePageProps) {
  return (
    <Suspense fallback={<PresupuestoDetalleSkeleton />}>
      <PresupuestoDetalle presupuestoId={params.id} />
    </Suspense>
  )
}
