import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import type { Liquidacion, LiquidacionJornada, AdelantoCuota } from '@/types/domain.types'
import { LiquidacionDetalleClient } from './liquidacion-detalle-client'

async function getLiquidacionDetalle(liquidacionId: string) {
  const supabase = await createClient()

  const { data: liquidacion, error } = await supabase
    .from('rrhh_liquidaciones')
    .select(`
      *,
      empleado:rrhh_empleados(
        id,
        legajo,
        nombre,
        apellido,
        usuario:usuarios(id, nombre, apellido, email),
        categoria:rrhh_categorias(id, nombre)
      ),
      detalles:rrhh_liquidacion_detalles(*)
    `)
    .eq('id', liquidacionId)
    .maybeSingle()

  if (error || !liquidacion) {
    return null
  }

  const { data: jornadas } = await supabase
    .from('rrhh_liquidacion_jornadas')
    .select('*')
    .eq('liquidacion_id', liquidacionId)
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true })

  const { data: cuotas } = await supabase
    .from('rrhh_adelanto_cuotas')
    .select(`
      *,
      plan:rrhh_adelanto_planes(id, tipo, monto_total, descripcion, cantidad_cuotas)
    `)
    .eq('liquidacion_id', liquidacionId)
    .order('periodo_anio', { ascending: false })
    .order('periodo_mes', { ascending: false })

  return {
    liquidacion: liquidacion as Liquidacion,
    jornadas: (jornadas || []) as LiquidacionJornada[],
    cuotas: (cuotas || []) as AdelantoCuota[],
  }
}

export const dynamic = 'force-dynamic'

export default async function LiquidacionDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getLiquidacionDetalle(id)

  if (!data) {
    notFound()
  }

  const empleado = data.liquidacion.empleado
  const nombreEmpleado = `${empleado?.usuario?.nombre || empleado?.nombre || ''} ${empleado?.usuario?.apellido || empleado?.apellido || ''}`.trim()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" asChild className="mb-2 -ml-3">
            <Link href="/rrhh/liquidaciones">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a liquidaciones
            </Link>
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Planilla de Liquidacion</h1>
          <p className="text-gray-600 mt-1">
            {nombreEmpleado || 'Empleado sin nombre'} - {data.liquidacion.periodo_mes}/{data.liquidacion.periodo_anio}
          </p>
        </div>
      </div>

      <LiquidacionDetalleClient
        liquidacion={data.liquidacion}
        jornadas={data.jornadas}
        cuotas={data.cuotas}
      />
    </div>
  )
}

