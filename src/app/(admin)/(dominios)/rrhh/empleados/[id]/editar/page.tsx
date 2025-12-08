import { notFound } from 'next/navigation'
import { obtenerEmpleadoPorIdAction, obtenerSucursalesActivasAction, obtenerUsuariosConAuthAction } from '@/actions/rrhh.actions'
import { EditarEmpleadoForm } from './editar-empleado-form'
import { createClient } from '@/lib/supabase/server'
import type { Sucursal, Usuario } from '@/types/domain.types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditarEmpleadoPage({ params }: PageProps) {
  const { id } = await params
  const empleadoResult = await obtenerEmpleadoPorIdAction(id)

  if (!empleadoResult.success || !empleadoResult.data) {
    notFound()
  }

  const empleado = empleadoResult.data
  const supabase = await createClient()

  // Cargar datos de referencia
  const [sucursalesResult, usuariosResult, categoriasResult] = await Promise.all([
    obtenerSucursalesActivasAction(),
    obtenerUsuariosConAuthAction(),
    supabase
      .from('rrhh_categorias')
      .select('*')
      .eq('activo', true)
      .order('nombre'),
  ])

  return (
    <EditarEmpleadoForm
      empleado={empleado}
      sucursales={(sucursalesResult.success ? (sucursalesResult.data || []) : []) as Sucursal[]}
      usuarios={(usuariosResult.success ? (usuariosResult.data || []) : []) as Usuario[]}
      categorias={categoriasResult.data || []}
    />
  )
}

