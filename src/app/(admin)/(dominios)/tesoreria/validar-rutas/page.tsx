import { createClient } from '@/lib/supabase/server'
import { obtenerRutasPendientesValidacionAction, listarCajasAction, obtenerTodosRetirosPendientesAction } from '@/actions/tesoreria.actions'
import { Button } from '@/components/ui/button'
import { ValidarRutasRealtime } from './validar-rutas-realtime'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function ValidarRutasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <div className="p-6">No autorizado</div>
  }

  const { data: usuarioRol } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!usuarioRol || !['admin', 'vendedor'].includes(usuarioRol.rol)) {
    return <div className="p-6">No tienes permisos para validar rutas</div>
  }

  const [rutasResult, cajas, retirosResult] = await Promise.all([
    obtenerRutasPendientesValidacionAction(),
    listarCajasAction(),
    obtenerTodosRetirosPendientesAction()
  ])

  const rutas = rutasResult.success ? (rutasResult.data || []) : []
  const retiros = retirosResult.success ? (retirosResult.data || []) : []

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Validar Rutas Completadas</h1>
          <p className="text-muted-foreground mt-1">
            Verifica y valida la recaudación de las rutas completadas por los repartidores, incluyendo retiros de sucursales
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/tesoreria">Volver a Tesorería</Link>
        </Button>
      </div>

      {/* Componente con Realtime */}
      <ValidarRutasRealtime rutasIniciales={rutas} cajas={cajas || []} retirosIniciales={retiros} />
    </div>
  )
}
