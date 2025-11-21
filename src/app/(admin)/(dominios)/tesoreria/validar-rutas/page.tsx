import { createClient } from '@/lib/supabase/server'
import { obtenerRutasPendientesValidacion, listarCajas } from '@/actions/tesoreria.actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ValidarRutaForm } from './validar-ruta-form'
import { CheckCircle2, Clock, DollarSign, Truck, User } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function ValidarRutasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <div className="p-6">No autorizado</div>
  }

  const { data: usuarioRol } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!usuarioRol || !['admin', 'vendedor'].includes(usuarioRol.rol)) {
    return <div className="p-6">No tienes permisos para validar rutas</div>
  }

  const [rutasResult, cajas] = await Promise.all([
    obtenerRutasPendientesValidacion(),
    listarCajas(),
  ])

  const rutas = rutasResult.success ? (rutasResult.data || []) : []

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Validar Rutas Completadas</h1>
          <p className="text-muted-foreground mt-1">
            Verifica y valida la recaudación de las rutas completadas por los repartidores
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/tesoreria">Volver a Tesorería</Link>
        </Button>
      </div>

      {rutas.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No hay rutas pendientes de validación</h3>
            <p className="text-muted-foreground">
              Todas las rutas completadas han sido validadas
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rutas.map((ruta: any) => {
            const entregasConPago = ruta.detalles_ruta?.filter(
              (d: any) => d.pago_registrado && d.monto_cobrado_registrado > 0
            ) || []
            
            const totalRegistrado = ruta.recaudacion_total_registrada || 0
            
            // Agrupar por método de pago (incluyendo cuenta_corriente)
            const pagosPorMetodo: Record<string, number> = {}
            entregasConPago.forEach((detalle: any) => {
              const metodo = detalle.metodo_pago_registrado || 'efectivo'
              pagosPorMetodo[metodo] = (pagosPorMetodo[metodo] || 0) + Number(detalle.monto_cobrado_registrado)
            })
            
            // Separar totales: caja vs cuenta corriente
            const totalCaja = Object.entries(pagosPorMetodo)
              .filter(([metodo]) => metodo !== 'cuenta_corriente')
              .reduce((sum, [, monto]) => sum + monto, 0)
            const totalCuentaCorriente = pagosPorMetodo['cuenta_corriente'] || 0

            return (
              <Card key={ruta.id} className="border-l-4 border-l-primary">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Truck className="h-5 w-5" />
                        Ruta {ruta.numero_ruta}
                      </CardTitle>
                      <CardDescription className="mt-2">
                        <div className="flex flex-wrap gap-4 text-sm">
                          <span className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            {ruta.repartidor?.nombre} {ruta.repartidor?.apellido}
                          </span>
                          <span>
                            Vehículo: {ruta.vehiculo?.patente} ({ruta.vehiculo?.marca} {ruta.vehiculo?.modelo})
                          </span>
                          <span>
                            Fecha: {new Date(ruta.fecha_ruta).toLocaleDateString('es-AR')}
                          </span>
                          {ruta.zona?.nombre && (
                            <span>Zona: {ruta.zona.nombre}</span>
                          )}
                        </div>
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                      <Clock className="h-3 w-3 mr-1" />
                      Pendiente
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Resumen de recaudación */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-blue-900 flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Recaudación Registrada
                      </h4>
                      <span className="text-2xl font-bold text-blue-900">
                        ${totalRegistrado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    
                    {totalCaja > 0 && (
                      <div className="mb-2 p-2 bg-blue-100 rounded text-sm">
                        <span className="font-medium text-blue-900">Total para caja: </span>
                        <span className="font-bold text-blue-900">
                          ${totalCaja.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                    
                    {totalCuentaCorriente > 0 && (
                      <div className="mb-2 p-2 bg-green-100 rounded text-sm">
                        <span className="font-medium text-green-900">Total cuenta corriente: </span>
                        <span className="font-bold text-green-900">
                          ${totalCuentaCorriente.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-xs text-green-700 ml-2">(no afecta caja)</span>
                      </div>
                    )}
                    
                    {Object.keys(pagosPorMetodo).length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                        {Object.entries(pagosPorMetodo).map(([metodo, monto]) => (
                          <div key={metodo} className={`text-sm ${metodo === 'cuenta_corriente' ? 'bg-green-50 p-1 rounded' : ''}`}>
                            <span className={`font-medium capitalize ${metodo === 'cuenta_corriente' ? 'text-green-700' : 'text-blue-700'}`}>
                              {metodo.replace('_', ' ')}:
                            </span>
                            <span className={`ml-1 font-semibold ${metodo === 'cuenta_corriente' ? 'text-green-900' : 'text-blue-900'}`}>
                              ${Number(monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Lista de entregas con pagos */}
                  <div>
                    <h4 className="font-semibold mb-2">Entregas con pago registrado ({entregasConPago.length})</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {entregasConPago.map((detalle: any) => (
                        <div
                          key={detalle.id}
                          className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                        >
                          <div className="flex-1">
                            <span className="font-medium">
                              #{detalle.orden_entrega} - {detalle.pedido?.cliente?.nombre || 'Cliente'}
                            </span>
                            <span className="text-muted-foreground ml-2">
                              ({detalle.pedido?.numero_pedido})
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="text-xs capitalize">
                              {detalle.metodo_pago_registrado?.replace('_', ' ') || 'efectivo'}
                            </Badge>
                            <span className="font-semibold">
                              ${Number(detalle.monto_cobrado_registrado).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Formulario de validación */}
                  <ValidarRutaForm ruta={ruta} cajas={cajas || []} />
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

