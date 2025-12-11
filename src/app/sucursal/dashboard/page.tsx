import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'
import { getSucursalUsuario } from '@/lib/utils'
import { DashboardClient } from '@/components/sucursal/DashboardClient'

interface PageProps {
  searchParams: Promise<{
    sid?: string
  }>
}

async function getSucursalData(searchParams?: { sid?: string }) {
  const supabase = await createClient()

  // Obtener usuario actual
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Usuario no autenticado')
  }

  // Obtener rol del usuario
  const { data: usuarioData, error: usuarioError } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('email', user.email)
    .single()

  // Si hay error al obtener el usuario, verificar también por auth.users
  let esAdmin = false
  if (usuarioData?.rol === 'admin') {
    esAdmin = true
  } else if (usuarioError) {
    // Si no existe en usuarios, verificar si es admin en auth.users metadata
    const { data: { user: authUser } } = await supabase.auth.getUser()
    esAdmin = authUser?.user_metadata?.rol === 'admin' || authUser?.user_metadata?.role === 'admin'
  }

  // Obtener sucursal del usuario
  const sucursalId = await getSucursalUsuario(supabase, user.id)

  // Si es admin y hay un parámetro sid en la URL, usar ese (permite cambiar de sucursal)
  let sucursalIdFinal = sucursalId
  if (esAdmin && searchParams?.sid) {
    // Validar que la sucursal existe y está activa
    const { data: sucursalParam } = await supabase
      .from('sucursales')
      .select('id, active')
      .eq('id', searchParams.sid)
      .single()
    
    if (sucursalParam && sucursalParam.active) {
      sucursalIdFinal = searchParams.sid
    }
  }

  if (!sucursalIdFinal && !esAdmin) {
    // Usuario no tiene sucursal asignada y no es admin - redirigir a página de configuración
    redirect('/sucursal/configuracion?mensaje=sucursal-requerida')
  }

  // Si es admin y no tiene sucursal asignada, obtener la primera sucursal activa
  if (!sucursalIdFinal && esAdmin) {
    const { data: sucursalesActivas } = await supabase
      .from('sucursales')
      .select('id')
      .eq('active', true)
      .order('nombre')
      .limit(1)
    
    if (sucursalesActivas && sucursalesActivas.length > 0) {
      sucursalIdFinal = sucursalesActivas[0].id
    } else {
      // Si es admin y no hay sucursales, permitir acceso pero mostrar mensaje
      // No lanzar error, permitir que el admin vea el dashboard vacío
      // Esto permite que el admin pueda crear sucursales desde el sistema
      console.warn('Admin sin sucursal asignada y sin sucursales activas en el sistema')
    }
  }

  // Obtener información de la sucursal
  let sucursal = null
  if (sucursalIdFinal) {
    const { data: sucursalData, error: sucursalError } = await supabase
      .from('sucursales')
      .select('*')
      .eq('id', sucursalIdFinal)
      .single()

    if (sucursalError) {
      throw new Error('Error al obtener datos de sucursal')
    }
    sucursal = sucursalData
  }

  // Si es admin y no hay sucursal, crear un objeto dummy para evitar errores
  if (!sucursal && esAdmin) {
    sucursal = {
      id: null,
      nombre: 'Sin sucursal asignada',
      direccion: null,
      telefono: null,
      active: false
    }
  }

  if (!sucursal) {
    throw new Error('No se pudo obtener información de la sucursal')
  }

  // Si es admin, obtener lista de todas las sucursales para el selector
  let todasLasSucursales: Array<{ id: string; nombre: string }> = []
  if (esAdmin) {
    const { data: sucursales } = await supabase
      .from('sucursales')
      .select('id, nombre')
      .eq('active', true)
      .order('nombre')
    
    todasLasSucursales = sucursales || []
  }

  // Obtener datos solo si hay una sucursal válida
  let ventasDia: any[] = []
  let alertas: any[] = []
  let caja: any = null
  let transferencias: any[] = []

  if (sucursalIdFinal) {
    // Obtener ventas del día
    const hoy = new Date().toISOString().split('T')[0]
    const { data: ventasDiaData } = await supabase
      .from('pedidos')
      .select('total, estado')
      .eq('sucursal_id', sucursalIdFinal)
      .eq('estado', 'completado')
      .gte('created_at', `${hoy}T00:00:00.000Z`)
      .lte('created_at', `${hoy}T23:59:59.999Z`)
    ventasDia = ventasDiaData || []

    // Obtener alertas activas
    const { data: alertasData } = await supabase
      .from('alertas_stock')
      .select('id, producto_id, cantidad_actual, umbral')
      .eq('sucursal_id', sucursalIdFinal)
      .eq('estado', 'pendiente')
    alertas = alertasData || []

    // Obtener saldo de caja
    const { data: cajaData } = await supabase
      .from('tesoreria_cajas')
      .select('saldo_actual')
      .eq('sucursal_id', sucursalIdFinal)
      .eq('active', true)
      .maybeSingle()
    caja = cajaData

    // Obtener transferencias pendientes
    const { data: transferenciasData } = await supabase
      .from('transferencias_stock')
      .select('id, estado')
      .or(`sucursal_origen_id.eq.${sucursalIdFinal},sucursal_destino_id.eq.${sucursalIdFinal}`)
      .in('estado', ['pendiente', 'en_transito'])
    transferencias = transferenciasData || []
  }

  return {
    sucursal,
    ventasDia: ventasDia || [],
    alertas: alertas || [],
    caja,
    transferencias: transferencias || [],
    esAdmin,
    todasLasSucursales,
    sucursalId: sucursalIdFinal
  }
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 bg-muted rounded w-64 animate-pulse"></div>
          <div className="h-4 bg-muted rounded w-96 animate-pulse"></div>
        </div>
      </div>

      {/* Cards Skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-24"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-16 mb-2"></div>
              <div className="h-3 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default async function SucursalDashboardPage(props: PageProps) {
  try {
    const searchParams = await props.searchParams
    const data = await getSucursalData(searchParams)

    const sinSucursal = data.esAdmin && !data.sucursalId

    return (
      <DashboardClient
        sucursal={data.sucursal}
        ventasDiaInicial={data.ventasDia}
        alertasInicial={data.alertas}
        cajaInicial={data.caja}
        transferenciasInicial={data.transferencias}
        esAdmin={data.esAdmin}
        todasLasSucursales={data.todasLasSucursales}
        sinSucursal={sinSucursal}
      />
    )
  } catch (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error al cargar dashboard</h3>
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
