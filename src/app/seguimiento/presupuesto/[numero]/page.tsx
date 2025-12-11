import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { Package, Calendar, MapPin, DollarSign, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface SeguimientoPageProps {
  params: Promise<{
    numero: string
  }>
}

async function SeguimientoContent({ numero }: { numero: string }) {
  const supabase = await createClient()

  // Buscar presupuesto por número (público, sin autenticación)
  const { data: presupuesto, error } = await supabase
    .from('presupuestos')
    .select(`
      id,
      numero_presupuesto,
      estado,
      fecha_entrega_estimada,
      total_estimado,
      total_final,
      observaciones,
      created_at,
      updated_at,
      cliente_id,
      clientes!presupuestos_cliente_id_fkey(
        nombre,
        telefono,
        direccion
      ),
      zona_id,
      zonas!presupuestos_zona_id_fkey(
        nombre
      ),
      items:presupuesto_items(
        id,
        cantidad_solicitada,
        cantidad_reservada,
        precio_unit_est,
        peso_final,
        subtotal_est,
        subtotal_final,
        producto_id,
        productos!presupuesto_items_producto_id_fkey(
          nombre,
          codigo
        )
      )
    `)
    .eq('numero_presupuesto', numero)
    .single()

  if (error || !presupuesto) {
    notFound()
  }

  const getEstadoConfig = (estado: string) => {
    const configs = {
      pendiente: { 
        label: 'Pendiente', 
        color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
        icon: Clock,
        description: 'Tu presupuesto está siendo revisado por nuestro equipo de ventas'
      },
      en_almacen: { 
        label: 'En Almacén', 
        color: 'bg-blue-100 text-blue-800 border-blue-300',
        icon: Package,
        description: 'Tu presupuesto está siendo preparado en nuestro almacén'
      },
      facturado: { 
        label: 'Facturado', 
        color: 'bg-green-100 text-green-800 border-green-300',
        icon: CheckCircle,
        description: 'Tu presupuesto ha sido confirmado y convertido en pedido'
      },
      anulado: { 
        label: 'Anulado', 
        color: 'bg-red-100 text-red-800 border-red-300',
        icon: XCircle,
        description: 'Este presupuesto ha sido cancelado'
      },
    }
    return configs[estado as keyof typeof configs] || { 
      label: estado, 
      color: 'bg-gray-100 text-gray-800 border-gray-300',
      icon: AlertCircle,
      description: 'Estado desconocido'
    }
  }

  const estadoConfig = getEstadoConfig(presupuesto.estado)
  const EstadoIcon = estadoConfig.icon

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-secondary/5 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Seguimiento de Presupuesto</h1>
          <p className="text-muted-foreground">
            Número: <span className="font-mono font-semibold">{presupuesto.numero_presupuesto}</span>
          </p>
        </div>

        {/* Estado Principal */}
        <Card className="border-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-lg ${estadoConfig.color}`}>
                  <EstadoIcon className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-xl">Estado Actual</CardTitle>
                  <CardDescription>{estadoConfig.description}</CardDescription>
                </div>
              </div>
              <Badge className={`${estadoConfig.color} text-base px-4 py-2`}>
                {estadoConfig.label}
              </Badge>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Información del Cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Información de Entrega
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Cliente</p>
                <p className="font-medium">{(presupuesto.clientes as any)?.nombre || 'N/A'}</p>
              </div>
              {(presupuesto.clientes as any)?.telefono && (
                <div>
                  <p className="text-sm text-muted-foreground">Teléfono</p>
                  <p className="font-medium">{(presupuesto.clientes as any).telefono}</p>
                </div>
              )}
              {(presupuesto.clientes as any)?.direccion && (
                <div>
                  <p className="text-sm text-muted-foreground">Dirección</p>
                  <p className="font-medium">{(presupuesto.clientes as any).direccion}</p>
                </div>
              )}
              {(presupuesto.zonas as any)?.nombre && (
                <div>
                  <p className="text-sm text-muted-foreground">Zona</p>
                  <p className="font-medium">{(presupuesto.zonas as any).nombre}</p>
                </div>
              )}
              {presupuesto.fecha_entrega_estimada && (
                <div>
                  <p className="text-sm text-muted-foreground">Fecha Estimada</p>
                  <p className="font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {new Date(presupuesto.fecha_entrega_estimada).toLocaleDateString('es-AR', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resumen Financiero */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Resumen Financiero
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Total Estimado</p>
                <p className="text-2xl font-bold">
                  ${Number(presupuesto.total_estimado || 0).toLocaleString('es-AR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </p>
              </div>
              {presupuesto.total_final && (
                <>
                  <div className="border-t my-3" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Final</p>
                    <p className="text-2xl font-bold text-green-600">
                      ${Number(presupuesto.total_final).toLocaleString('es-AR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </p>
                  </div>
                </>
              )}
              <div className="pt-2">
                <p className="text-xs text-muted-foreground">
                  Creado: {new Date(presupuesto.created_at).toLocaleString('es-AR')}
                </p>
                {presupuesto.updated_at !== presupuesto.created_at && (
                  <p className="text-xs text-muted-foreground">
                    Actualizado: {new Date(presupuesto.updated_at).toLocaleString('es-AR')}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Items del Presupuesto */}
        <Card>
          <CardHeader>
            <CardTitle>Productos Incluidos</CardTitle>
            <CardDescription>
              {presupuesto.items?.length || 0} {presupuesto.items?.length === 1 ? 'producto' : 'productos'} en este presupuesto
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {presupuesto.items?.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{(item.productos as any)?.nombre || 'Producto'}</p>
                    <p className="text-sm text-muted-foreground">
                      Código: {(item.productos as any)?.codigo || 'N/A'}
                    </p>
                    <div className="mt-2 flex gap-4 text-sm">
                      <span>
                        Cantidad: <strong>{Number(item.cantidad_solicitada).toFixed(2)}</strong>
                      </span>
                      {item.peso_final && (
                        <span>
                          Peso: <strong>{Number(item.peso_final).toFixed(2)} kg</strong>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      ${Number(item.subtotal_final || item.subtotal_est || 0).toLocaleString('es-AR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </p>
                    {item.subtotal_final && item.subtotal_final !== item.subtotal_est && (
                      <p className="text-xs text-muted-foreground line-through">
                        ${Number(item.subtotal_est).toLocaleString('es-AR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
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
              <p className="text-sm whitespace-pre-wrap">{presupuesto.observaciones}</p>
            </CardContent>
          </Card>
        )}

        {/* Información de Contacto */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <p className="font-medium">¿Tienes preguntas sobre tu presupuesto?</p>
              <p className="text-sm text-muted-foreground">
                Contacta a nuestro equipo de ventas para más información
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default async function SeguimientoPage({ params }: SeguimientoPageProps) {
  const { numero } = await params
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Cargando información del presupuesto...</p>
        </div>
      </div>
    }>
      <SeguimientoContent numero={numero} />
    </Suspense>
  )
}
