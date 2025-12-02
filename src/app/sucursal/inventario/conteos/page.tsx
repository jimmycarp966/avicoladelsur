import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ClipboardList, AlertCircle, AlertTriangle, Building2 } from 'lucide-react'
import { ConteosStockContent } from '@/components/sucursales/ConteosStockContent'
import { getSucursalUsuarioConAdmin } from '@/lib/utils'
import Link from 'next/link'

export const revalidate = 60 // Revalidar cada minuto

async function getConteosData() {
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
      conteos: [],
      sucursalId: '',
      sucursalNombre: '',
      conteoEnProceso: null,
      ultimoConteoCompletado: null,
      estadisticas: {
        totalConteos: 0,
        enProceso: 0,
        completados: 0,
        aprobados: 0
      },
      sinSucursal: true,
      esAdmin: true
    }
  }

  // Obtener conteos de la sucursal
  const { data: conteos, error: conteosError } = await supabase
    .from('conteos_stock')
    .select(`
      *,
      usuarios:realizado_por (nombre),
      aprobador:aprobado_por (nombre)
    `)
    .eq('sucursal_id', sucursalId)
    .order('fecha_conteo', { ascending: false })
    .limit(20)

  if (conteosError) {
    throw new Error(`Error al obtener conteos: ${conteosError.message}`)
  }

  // Obtener sucursal info
  const { data: sucursal } = await supabase
    .from('sucursales')
    .select('id, nombre')
    .eq('id', sucursalId)
    .single()

  // Estadísticas
  const conteoEnProceso = conteos?.find(c => c.estado === 'en_proceso')
  const ultimoConteoCompletado = conteos?.find(c => c.estado === 'completado' || c.estado === 'aprobado')

  return {
    conteos: conteos || [],
    sucursalId,
    sucursalNombre: sucursal?.nombre || 'Sucursal',
    conteoEnProceso,
    ultimoConteoCompletado,
    estadisticas: {
      totalConteos: conteos?.length || 0,
      enProceso: conteos?.filter(c => c.estado === 'en_proceso').length || 0,
      completados: conteos?.filter(c => c.estado === 'completado').length || 0,
      aprobados: conteos?.filter(c => c.estado === 'aprobado').length || 0,
    },
    sinSucursal: false,
    esAdmin
  }
}

export default async function ConteosStockPage() {
  try {
    const data = await getConteosData()

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
                  Como administrador, necesitas crear una sucursal antes de poder realizar conteos de stock.
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

    return <ConteosStockContent data={data} />
  } catch (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error al cargar conteos</h3>
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

