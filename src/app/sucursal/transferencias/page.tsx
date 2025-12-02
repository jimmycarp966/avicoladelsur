import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Truck, Plus, PackageCheck, ArrowRightLeft, AlertCircle, AlertTriangle, Building2 } from 'lucide-react'
import Link from 'next/link'
import { TransferenciasTable } from '@/components/sucursales/TransferenciasTable'
import { TransferenciasPendientesRecepcion } from '@/components/sucursales/TransferenciasPendientesRecepcion'
import { getSucursalUsuarioConAdmin } from '@/lib/utils'

async function getTransferenciasSucursal() {
  const supabase = await createClient()

  // Obtener usuario actual
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Usuario no autenticado')
  }

  // Obtener sucursal del usuario con soporte para admin
  const { sucursalId, esAdmin } = await getSucursalUsuarioConAdmin(supabase, user.id, user.email || '')

  if (!sucursalId && !esAdmin) {
    throw new Error('Usuario no tiene sucursal asignada')
  }

  if (!sucursalId) {
    // Admin sin sucursales activas
    return {
      transferencias: [],
      pendientesRecepcion: [],
      estadisticas: {
        total: 0,
        pendientes: 0,
        enTransito: 0,
        recibidas: 0,
        comoOrigen: 0,
        comoDestino: 0,
        pendientesRecepcion: 0
      },
      sucursalId: '',
      sinSucursal: true,
      esAdmin: true
    }
  }

  // Obtener transferencias relacionadas con la sucursal
  const { data: transferencias, error: transferenciasError } = await supabase
    .from('transferencias_stock')
    .select(`
      *,
      sucursal_origen:sucursales!sucursal_origen_id(id, nombre),
      sucursal_destino:sucursales!sucursal_destino_id(id, nombre),
      items:transferencia_items(
        id,
        cantidad_solicitada,
        cantidad_enviada,
        cantidad_recibida,
        producto:productos(nombre, codigo, unidad_medida)
      )
    `)
    .or(`sucursal_origen_id.eq.${sucursalId},sucursal_destino_id.eq.${sucursalId}`)
    .order('fecha_solicitud', { ascending: false })
    .limit(50)

  if (transferenciasError) {
    throw new Error('Error al obtener transferencias')
  }

  // Obtener transferencias pendientes de recepción (entregadas o en_ruta hacia esta sucursal)
  const { data: pendientesRecepcion, error: pendientesError } = await supabase
    .from('transferencias_stock')
    .select(`
      *,
      sucursal_origen:sucursales!sucursal_origen_id(id, nombre),
      sucursal_destino:sucursales!sucursal_destino_id(id, nombre),
      items:transferencia_items(
        id,
        cantidad_solicitada,
        cantidad_enviada,
        cantidad_recibida,
        producto:productos(nombre, codigo, unidad_medida)
      )
    `)
    .eq('sucursal_destino_id', sucursalId)
    .in('estado', ['entregado', 'en_ruta', 'en_transito'])
    .order('fecha_solicitud', { ascending: false })

  // Calcular estadísticas con los nuevos estados
  const transferenciasList = transferencias || []
  const pendientesRecepcionList = pendientesRecepcion || []
  
  const estadisticas = {
    total: transferenciasList.length,
    pendientes: transferenciasList.filter(t => 
      ['pendiente', 'solicitud', 'en_almacen', 'preparado'].includes(t.estado)
    ).length,
    enTransito: transferenciasList.filter(t => 
      ['en_transito', 'en_ruta', 'entregado'].includes(t.estado)
    ).length,
    recibidas: transferenciasList.filter(t => 
      ['recibida', 'recibido'].includes(t.estado)
    ).length,
    comoOrigen: transferenciasList.filter(t => t.sucursal_origen_id === sucursalId).length,
    comoDestino: transferenciasList.filter(t => t.sucursal_destino_id === sucursalId).length,
    pendientesRecepcion: pendientesRecepcionList.length
  }

  return {
    transferencias: transferenciasList,
    pendientesRecepcion: pendientesRecepcionList,
    estadisticas,
    sucursalId,
    sinSucursal: false,
    esAdmin
  }
}

export default async function SucursalTransferenciasPage() {
  try {
    const data = await getTransferenciasSucursal()

    // Si es admin sin sucursal, mostrar mensaje informativo
    if (data.sinSucursal && data.esAdmin) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="w-full max-w-md border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
              <div className="text-center">
                <AlertTriangle className="w-12 h-12 text-amber-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2 text-amber-900">
                  No hay sucursales activas
                </h3>
                <p className="text-amber-800 mb-4">
                  Como administrador, necesitas crear una sucursal antes de poder ver las transferencias.
                </p>
                <Button asChild>
                  <Link href="/sucursales/nueva">
                    <Building2 className="w-4 h-4 mr-2" />
                    Crear Primera Sucursal
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Truck className="w-8 h-8" />
              Transferencias de Sucursal
            </h1>
            <p className="text-muted-foreground">
              Gestiona transferencias de stock entre sucursales
            </p>
          </div>

          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <p className="font-medium mb-1">💡 Solicitar Transferencias</p>
            <p>Las transferencias deben ser solicitadas a través del administrador del sistema.</p>
            <p>Contacte al administrador para solicitar movimientos de stock entre sucursales.</p>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Transferencias</CardTitle>
              <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.estadisticas.total}</div>
              <p className="text-xs text-muted-foreground">
                Historial completo
              </p>
            </CardContent>
          </Card>

          <Card className={data.estadisticas.pendientesRecepcion > 0 ? 'border-orange-300 bg-orange-50' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Por Recibir</CardTitle>
              <PackageCheck className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{data.estadisticas.pendientesRecepcion}</div>
              <p className="text-xs text-muted-foreground">
                Esperando tu confirmación
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En Proceso</CardTitle>
              <Truck className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{data.estadisticas.enTransito}</div>
              <p className="text-xs text-muted-foreground">
                En tránsito
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completadas</CardTitle>
              <Truck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{data.estadisticas.recibidas}</div>
              <p className="text-xs text-muted-foreground">
                Recibidas exitosamente
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Transferencias pendientes de recepción - Sección destacada */}
        {data.pendientesRecepcion && data.pendientesRecepcion.length > 0 && (
          <Card className="border-2 border-orange-300 bg-orange-50/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-600" />
                  <CardTitle className="text-orange-700">Transferencias Pendientes de Recepción</CardTitle>
                </div>
                <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
                  {data.pendientesRecepcion.length} pendiente(s)
                </Badge>
              </div>
              <CardDescription>
                Estas transferencias han llegado y requieren tu confirmación de recepción
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TransferenciasPendientesRecepcion 
                transferencias={data.pendientesRecepcion} 
                sucursalId={data.sucursalId} 
              />
            </CardContent>
          </Card>
        )}

        {/* Lista de Transferencias */}
        <Card>
          <CardHeader>
            <CardTitle>Transferencias</CardTitle>
            <CardDescription>
              Historial de transferencias de tu sucursal (como origen y destino)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg animate-pulse">
                    <div className="w-10 h-10 bg-muted rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-1/3"></div>
                      <div className="h-3 bg-muted rounded w-1/4"></div>
                    </div>
                    <div className="w-20 h-8 bg-muted rounded"></div>
                  </div>
                ))}
              </div>
            }>
              <TransferenciasTable transferencias={data.transferencias} sucursalId={data.sucursalId} />
            </Suspense>
          </CardContent>
        </Card>

        {/* Información adicional */}
        <Card>
          <CardHeader>
            <CardTitle>¿Cómo funcionan las transferencias?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="font-semibold">Proceso de Transferencia</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Casa Central crea la transferencia</li>
                  <li>Almacén prepara y pesa los productos</li>
                  <li>Se asigna a una ruta de reparto</li>
                  <li>Repartidor entrega en tu sucursal</li>
                  <li><strong>Tú confirmas la recepción</strong></li>
                  <li>Stock se actualiza automáticamente</li>
                </ol>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">Estados de Transferencia</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <span className="text-blue-600">En Almacén</span>: En preparación</li>
                  <li>• <span className="text-purple-600">Preparado</span>: Listo para envío</li>
                  <li>• <span className="text-indigo-600">En Ruta</span>: En camino</li>
                  <li>• <span className="text-orange-600">Entregado</span>: Esperando tu confirmación</li>
                  <li>• <span className="text-green-600">Recibido</span>: Completada exitosamente</li>
                  <li>• <span className="text-red-600">Cancelada</span>: Transferencia cancelada</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  } catch (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Truck className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error al cargar transferencias</h3>
              <p className="text-muted-foreground">
                {error instanceof Error ? error.message : 'Error desconocido'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }
}
