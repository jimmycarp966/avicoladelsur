import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Building2 } from 'lucide-react'
import { getSucursalUsuarioConAdmin } from '@/lib/utils'
import { AlertasContent } from '@/components/shared/AlertasContent'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { AlertasStockRealtime } from '@/components/sucursal/AlertasStockRealtime'

interface PageProps {
  searchParams: Promise<{
    sid?: string
  }>
}

interface AlertaStock {
  id: string
  sucursal_id: string
  producto_id: string
  cantidad_actual: number
  umbral: number
  estado: 'pendiente' | 'en_transito' | 'resuelto'
  created_at: string
  updated_at: string
}

async function getAlertasSucursal(sidParam?: string) {
  const supabase = await createClient()

  // Obtener usuario actual
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Usuario no autenticado')
  }

  // Obtener sucursal del usuario con soporte para admin
  const { sucursalId, esAdmin } = await getSucursalUsuarioConAdmin(supabase, user.id, user.email || '', sidParam)

  if (!sucursalId && !esAdmin) {
    throw new Error('Usuario no tiene sucursal asignada')
  }

  if (!sucursalId) {
    // Admin sin sucursales activas
    return {
      alertas: [],
      estadisticas: {
        pendientes: 0,
        resueltas: 0,
        total: 0
      },
      sinSucursal: true,
      esAdmin: true
    }
  }

  // Obtener alertas
  const { data: alertas, error: alertasError } = await supabase
    .from('alertas_stock')
    .select('*')
    .eq('sucursal_id', sucursalId)
    .order('created_at', { ascending: false })

  if (alertasError) {
    throw new Error('Error al obtener alertas')
  }

  return {
    alertas: alertas || [],
    estadisticas: {
      pendientes: alertas.filter(a => a.estado === 'pendiente').length,
      resueltas: alertas.filter(a => a.estado !== 'pendiente').length,
      total: alertas.length
    },
    sinSucursal: false,
    esAdmin
  }
}

export default async function SucursalAlertsPage({ searchParams }: PageProps) {
  const params = await searchParams
  try {
    const data = await getAlertasSucursal(params.sid)

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
                  Como administrador, necesitas crear una sucursal antes de poder ver alertas.
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

    // Obtener sucursalId para el componente Realtime
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { sucursalId } = await getSucursalUsuarioConAdmin(supabase, user?.id || '', user?.email || '', params.sid)

    return (
      <>
        {sucursalId && <AlertasStockRealtime sucursalId={sucursalId} />}
        <AlertasContent data={data} />
      </>
    )
  } catch (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error al cargar alertas</h3>
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
