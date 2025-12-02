import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { AlertCircle, FileBarChart } from 'lucide-react'
import { AuditoriaListasContent } from '@/components/sucursales/AuditoriaListasContent'

export const revalidate = 300 // Revalidar cada 5 minutos

async function getAuditoriaData() {
  const supabase = await createClient()

  // Obtener usuario actual
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Usuario no autenticado')
  }

  // Obtener sucursal del usuario
  const { data: userData } = await supabase
    .from('usuarios')
    .select('id, sucursal_id')
    .eq('email', user.email)
    .single()

  let sucursalId = userData?.sucursal_id
  if (!sucursalId) {
    const { data: empleado } = await supabase
      .from('rrhh_empleados')
      .select('sucursal_id')
      .eq('usuario_id', userData?.id)
      .single()
    
    sucursalId = empleado?.sucursal_id
  }

  if (!sucursalId) {
    throw new Error('Usuario no tiene sucursal asignada')
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
  }
}

export default async function AuditoriaListasPage() {
  try {
    const data = await getAuditoriaData()
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

