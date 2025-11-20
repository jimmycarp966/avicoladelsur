import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { ArrowLeft, Package, User, MapPin, Calendar, DollarSign, Scale } from 'lucide-react'
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
    'use server'
    const result = await enviarPresupuestoAlmacenAction(presupuestoId)
    return result
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
          <form action={handleEnviarAlmacen}>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
              <Package className="mr-2 h-4 w-4" />
              Enviar a Almacén
            </Button>
          </form>
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
