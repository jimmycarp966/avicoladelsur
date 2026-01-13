import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { RetirosPendientesCard } from '@/components/repartidor/RetirosPendientesCard'
import { TransferenciasCard } from '@/components/repartidor/TransferenciasCard'
import { ResumenDiaCard } from '@/components/repartidor/ResumenDiaCard'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Truck, DollarSign } from 'lucide-react'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

async function getRepartidorDashboardData() {
  const supabase = await createClient()

  // Obtener usuario actual
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Usuario no autenticado')
  }

  // Obtener datos del usuario
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!usuario) {
    throw new Error('Usuario no encontrado')
  }

  // Verificar que sea repartidor
  if (usuario.rol !== 'repartidor') {
    redirect('/')
  }

  // Obtener rutas asignadas al repartidor hoy
  const { data: rutasHoy } = await supabase
    .from('rutas_reparto')
    .select('id, zona_id, fecha_ruta, estado')
    .eq('repartidor_id', user.id)
    .eq('fecha_ruta', new Date().toISOString().split('T')[0])

  if (!rutasHoy || rutasHoy.length === 0) {
    return {
      usuario,
      zonas: [],
      retiros: [],
      transferencias: []
    }
  }

  // Obtener zonas únicas de las rutas
  const zonasUnicas = [...new Set(rutasHoy.map(r => r.zona_id).filter(Boolean))]

  // Obtener retiros pendientes de esas zonas
  const retirosPromises = zonasUnicas.map(zonaId =>
    supabase
      .from('rutas_retiros')
      .select(`
        *,
        sucursal:sucursales(id, nombre),
        vehiculo:vehiculos(id, patente, marca, modelo)
      `)
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false })
  )

  const retirosResults = await Promise.all(retirosPromises)
  const retiros = retirosResults.flatMap(r => r.data || [])

  // Obtener transferencias pendientes de esas zonas
  const { data: transferencias } = await supabase
    .from('transferencias_stock')
    .select(`
      *,
      sucursal_origen:sucursales(id, nombre, zona_id),
      sucursal_destino:sucursales(id, nombre, zona_id),
      solicitado_por:usuarios(id, nombre, email),
      aprobado_por:usuarios(id, nombre, email)
    `)
    .in('estado', ['pendiente', 'en_transito'])
    .order('fecha_solicitud', { ascending: false })

  // Filtrar transferencias por zona
  const transferenciasFiltradas = transferencias?.filter((t: any) =>
    zonasUnicas.includes(t.sucursal_origen?.zona_id) ||
    zonasUnicas.includes(t.sucursal_destino?.zona_id)
  ) || []

  return {
    usuario,
    zonas: zonasUnicas,
    retiros,
    transferencias: transferenciasFiltradas
  }
}

export default async function RepartidorDashboardPage() {
  const data = await getRepartidorDashboardData()

  // Si no tiene rutas asignadas hoy
  if (data.zonas.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="text-center">
              <Truck className="h-12 w-12 text-amber-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2 text-amber-900">
                Sin rutas asignadas hoy
              </h3>
              <p className="text-amber-800">
                No tienes rutas asignadas para hoy. Contacta al administrador.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalRetiros = data.retiros.reduce((sum: number, r: any) => sum + r.monto, 0)
  const totalTransferencias = data.transferencias.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Truck className="h-8 w-8" />
          Dashboard de Repartidor
        </h1>
        <p className="text-muted-foreground">
          Gestiona retiros de sucursales y transferencias de stock
        </p>
      </div>

      {/* Resumen del día */}
      <Suspense fallback={<LoadingCard />}>
        <ResumenDiaCard
          totalRetiros={totalRetiros}
          totalTransferencias={totalTransferencias}
        />
      </Suspense>

      {/* Retiros y Transferencias */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense fallback={<LoadingCard />}>
          <RetirosPendientesCard
            retiros={data.retiros}
          />
        </Suspense>

        <Suspense fallback={<LoadingCard />}>
          <TransferenciasCard
            transferencias={data.transferencias}
          />
        </Suspense>
      </div>
    </div>
  )
}

function LoadingCard() {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  )
}
