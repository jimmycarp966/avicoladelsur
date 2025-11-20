import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { ArrowLeft, Package, User, MapPin, Calendar, DollarSign, Scale, Clock, History } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { obtenerPresupuestoAction, enviarPresupuestoAlmacenAction } from '@/actions/presupuestos.actions'
import { PresupuestoDetalleSkeleton } from './presupuesto-detalle-skeleton'

interface PresupuestoDetallePageProps {
  params: {
    id: string
  }
}

async function PresupuestoDetalle({ presupuestoId }: { presupuestoId: string }) {
  const result = await obtenerPresupuestoAction(presupuestoId)

  if (!result.success || !result.data) {
    notFound()
  }

  const presupuesto = result.data

  async function handleEnviarAlmacen() {
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
          <Button
            onClick={async () => {
              const result = await handleEnviarAlmacen()
              if (result.success) {
                window.location.reload()
              }
            }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Package className="mr-2 h-4 w-4" />
            Enviar a Almacén
          </Button>
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
            <div className="md:col-span-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Zona de Entrega
              </label>
              <p className="text-lg">{presupuesto.zona.nombre}</p>
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
