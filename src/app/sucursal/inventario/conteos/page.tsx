import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ClipboardList, AlertCircle, AlertTriangle, Building2 } from 'lucide-react'
import { ConteosStockContent } from '@/components/sucursales/ConteosStockContent'
import { getSucursalUsuarioConAdmin } from '@/lib/utils'
import Link from 'next/link'

export const revalidate = 60 // Revalidar cada minuto

interface PageProps {
  searchParams: Promise<{
    sid?: string
  }>
}

async function getConteosData(sidParam?: string) {
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
      conteos: [],
      sucursalId: '',
      sucursalNombre: '',
      conteoEnProceso: undefined,
      ultimoConteoCompletado: undefined,
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
    .select('*')
    .eq('sucursal_id', sucursalId)
    .order('fecha_conteo', { ascending: false })
    .limit(20)

  if (conteosError) {
    throw new Error(`Error al obtener conteos: ${conteosError.message}`)
  }

  // Obtener nombres de usuarios para los conteos
  const conteosConUsuarios = await Promise.all(
    (conteos || []).map(async (conteo) => {
      let nombreRealizadoPor = 'Desconocido'
      let nombreAprobadoPor = null

      if (conteo.realizado_por) {
        const { data: usuarioRealizado } = await supabase
          .from('usuarios')
          .select('nombre')
          .eq('id', conteo.realizado_por)
          .single()
        if (usuarioRealizado) {
          nombreRealizadoPor = usuarioRealizado.nombre || 'Desconocido'
        }
      }

      if (conteo.aprobado_por) {
        const { data: usuarioAprobado } = await supabase
          .from('usuarios')
          .select('nombre')
          .eq('id', conteo.aprobado_por)
          .single()
        if (usuarioAprobado) {
          nombreAprobadoPor = usuarioAprobado.nombre
        }
      }

      return {
        ...conteo,
        nombreRealizadoPor,
        nombreAprobadoPor
      }
    })
  )

  // Obtener sucursal info
  const { data: sucursal } = await supabase
    .from('sucursales')
    .select('id, nombre')
    .eq('id', sucursalId)
    .single()

  // Mapear conteos al formato esperado por el componente
  const conteosMapeados = conteosConUsuarios.map(conteo => ({
    id: conteo.id,
    fecha_conteo: conteo.fecha_conteo,
    estado: conteo.estado,
    total_diferencias: conteo.total_diferencias || 0,
    total_merma_valor: conteo.total_merma_valor || 0,
    usuarios: { nombre: conteo.nombreRealizadoPor },
    aprobador: conteo.nombreAprobadoPor ? { nombre: conteo.nombreAprobadoPor } : null
  }))

  // Estadísticas
  const conteoEnProceso = conteosMapeados.find(c => c.estado === 'en_proceso')
  const ultimoConteoCompletado = conteosMapeados.find(c => c.estado === 'completado' || c.estado === 'aprobado')

  return {
    conteos: conteosMapeados,
    sucursalId,
    sucursalNombre: sucursal?.nombre || 'Sucursal',
    conteoEnProceso,
    ultimoConteoCompletado,
    estadisticas: {
      totalConteos: conteosMapeados.length,
      enProceso: conteosMapeados.filter(c => c.estado === 'en_proceso').length,
      completados: conteosMapeados.filter(c => c.estado === 'completado').length,
      aprobados: conteosMapeados.filter(c => c.estado === 'aprobado').length,
    },
    sinSucursal: false,
    esAdmin
  }
}

export default async function ConteosStockPage({ searchParams }: PageProps) {
  const params = await searchParams
  try {
    const data = await getConteosData(params.sid)

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

