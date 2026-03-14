import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { Loader2, Truck } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { RetirosPendientesCard } from '@/components/repartidor/RetirosPendientesCard'
import { TransferenciasCard } from '@/components/repartidor/TransferenciasCard'
import { ResumenDiaCard } from '@/components/repartidor/ResumenDiaCard'
import { Card, CardContent } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

function getTodayLocalDate() {
  return new Date().toLocaleDateString('en-CA')
}

async function getRepartidorDashboardData() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Error('Usuario no autenticado')
  }

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!usuario) {
    throw new Error('Usuario no encontrado')
  }

  if (usuario.rol !== 'repartidor') {
    redirect('/')
  }

  const { data: rutasHoy } = await supabase
    .from('rutas_reparto')
    .select('id, zona_id, fecha_ruta, estado')
    .eq('repartidor_id', user.id)
    .eq('fecha_ruta', getTodayLocalDate())

  if (!rutasHoy || rutasHoy.length === 0) {
    return {
      usuario,
      zonas: [],
      retiros: [],
      transferencias: [],
      cajaCentralId: null as string | null,
    }
  }

  const rutaIds = rutasHoy.map((ruta) => ruta.id)
  const zonasUnicas = Array.from(new Set(rutasHoy.map((ruta) => ruta.zona_id).filter(Boolean)))

  const [{ data: retirosData }, { data: transferenciasData }, { data: cajasActivas }] = await Promise.all([
    supabase
      .from('rutas_retiros')
      .select(`
        *,
        sucursal:sucursales(id, nombre, zona_id),
        vehiculo:vehiculos(id, patente, marca, modelo)
      `)
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false }),
    supabase
      .from('transferencias_stock')
      .select(`
        *,
        sucursal_origen:sucursales(id, nombre, zona_id),
        sucursal_destino:sucursales(id, nombre, zona_id),
        solicitado_por:usuarios(id, nombre, email),
        aprobado_por:usuarios(id, nombre, email)
      `)
      .in('estado', ['pendiente', 'en_transito'])
      .order('fecha_solicitud', { ascending: false }),
    supabase
      .from('tesoreria_cajas')
      .select('id, nombre, sucursal_id')
      .eq('activa', true),
  ])

  const retiros = (retirosData || []).filter((retiro: any) => {
    const zonaSucursal = retiro.sucursal?.zona_id
    const zonaMatch = zonaSucursal && zonasUnicas.includes(zonaSucursal)
    const rutaMatch = retiro.ruta_id && rutaIds.includes(retiro.ruta_id)
    return Boolean(zonaMatch || rutaMatch)
  })

  const transferencias = (transferenciasData || []).filter((transferencia: any) => {
    const zonaOrigen = transferencia.sucursal_origen?.zona_id
    const zonaDestino = transferencia.sucursal_destino?.zona_id
    return zonasUnicas.includes(zonaOrigen) || zonasUnicas.includes(zonaDestino)
  })

  const cajaCentralCandidata = (cajasActivas || [])
    .sort((a: any, b: any) => {
      const aScore = Number(!a.sucursal_id) + Number((a.nombre || '').toLowerCase().includes('caja central'))
      const bScore = Number(!b.sucursal_id) + Number((b.nombre || '').toLowerCase().includes('caja central'))
      return bScore - aScore
    })
    .at(0)

  return {
    usuario,
    zonas: zonasUnicas,
    retiros,
    transferencias,
    cajaCentralId: cajaCentralCandidata?.id || null,
  }
}

export default async function RepartidorDashboardPage() {
  const data = await getRepartidorDashboardData()

  if (data.zonas.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Card className="w-full max-w-md border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="text-center">
              <Truck className="mx-auto mb-4 h-12 w-12 text-amber-600" />
              <h3 className="mb-2 text-lg font-semibold text-amber-900">Sin rutas asignadas hoy</h3>
              <p className="text-amber-800">No tienes rutas asignadas para hoy. Contacta al administrador.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const totalRetiros = data.retiros.reduce((sum: number, retiro: any) => sum + Number(retiro.monto || 0), 0)
  const totalTransferencias = data.transferencias.length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Truck className="h-8 w-8" />
          Dashboard de repartidor
        </h1>
        <p className="text-muted-foreground">Gestiona retiros de sucursales y transferencias de stock</p>
      </div>

      <Suspense fallback={<LoadingCard />}>
        <ResumenDiaCard totalRetiros={totalRetiros} totalTransferencias={totalTransferencias} />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense fallback={<LoadingCard />}>
          <RetirosPendientesCard retiros={data.retiros} cajaCentralId={data.cajaCentralId} />
        </Suspense>

        <Suspense fallback={<LoadingCard />}>
          <TransferenciasCard transferencias={data.transferencias} />
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
