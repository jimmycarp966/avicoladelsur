import { createClient } from '@/lib/supabase/server'
import { AdelantosPageClient } from './adelantos-page-client'
import type { Adelanto } from '@/types/domain.types'

async function getAdelantos() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('rrhh_adelantos')
    .select(`
      *,
      empleado:rrhh_empleados(
        id,
        legajo,
        usuario:usuarios(id, nombre, apellido, email)
      ),
      producto:productos(id, codigo, nombre),
      aprobador:usuarios(id, nombre, apellido),
      plan:rrhh_adelanto_planes(id, cantidad_cuotas, estado)
    `)
    .order('fecha_solicitud', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Error fetching adelantos:', error)
    return []
  }

  return data as Adelanto[]
}

export const dynamic = 'force-dynamic'

export default async function AdelantosPage() {
  const adelantos = await getAdelantos()

  return <AdelantosPageClient adelantos={adelantos} />
}
