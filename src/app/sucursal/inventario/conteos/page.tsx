import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ClipboardList, AlertCircle } from 'lucide-react'
import { ConteosStockContent } from '@/components/sucursales/ConteosStockContent'

export const revalidate = 60 // Revalidar cada minuto

async function getConteosData() {
  const supabase = await createClient()

  // Obtener usuario actual
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Usuario no autenticado')
  }

  // Obtener sucursal del usuario desde metadata o tabla usuarios
  const { data: userData, error: userDataError } = await supabase
    .from('usuarios')
    .select('id, sucursal_id')
    .eq('email', user.email)
    .single()

  // Si no tiene sucursal en usuarios, buscar en rrhh_empleados
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
    }
  }
}

export default async function ConteosStockPage() {
  try {
    const data = await getConteosData()
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

