import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, FileBarChart, AlertTriangle, Building2 } from 'lucide-react'
import { AuditoriaListasContent } from '@/components/sucursales/AuditoriaListasContent'
import { getSucursalUsuarioConAdmin } from '@/lib/utils'
import Link from 'next/link'

export const revalidate = 300 // Revalidar cada 5 minutos

interface PageProps {
  searchParams: Promise<{
    sid?: string
  }>
}

async function getAuditoriaData(sidParam?: string) {
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
      sucursalId: '',
      sucursalNombre: '',
      usuarios: [],
      listasPrecio: [],
      sinSucursal: true,
      esAdmin: true
    }
  }

  // Obtener sucursal info
  const { data: sucursal } = await supabase
    .from('sucursales')
    .select('id, nombre')
    .eq('id', sucursalId)
    .single()

  // Obtener usuarios de la sucursal para filtros
  const { data: usuarios } = await supabase
    .from('usuarios')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre')

  // Obtener listas de precios
  const { data: listasPrecio } = await supabase
    .from('listas_precios')
    .select('id, nombre, tipo')
    .eq('activa', true)
    .order('tipo')

  return {
    sucursalId,
    sucursalNombre: sucursal?.nombre || 'Sucursal',
    usuarios: usuarios || [],
    listasPrecio: listasPrecio || [],
    sinSucursal: false,
    esAdmin
  }
}

export default async function AuditoriaListasPage({ searchParams }: PageProps) {
  const params = await searchParams
  try {
    const data = await getAuditoriaData(params.sid)

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
                  Como administrador, necesitas crear una sucursal antes de poder ver los reportes de auditoría.
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

    return <AuditoriaListasContent data={data} />
  } catch (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error al cargar auditoría</h3>
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

