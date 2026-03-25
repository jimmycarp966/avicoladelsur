import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Check } from 'lucide-react'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getEmpleadoNombre } from '@/lib/utils/empleado-display'
import type {
  Liquidacion,
  LiquidacionJornada,
  AdelantoCuota,
  LiquidacionReglaPeriodo,
  LiquidacionReglaPuesto,
  LiquidacionTramoPuesto,
} from '@/types/domain.types'
import { LiquidacionDetalleClient } from './liquidacion-detalle-client'

async function getLiquidacionDetalle(liquidacionId: string) {
  const supabase = await createClient()
  const adminSupabase = createAdminClient()

  const { data: authResult, error: authError } = await supabase.auth.getUser()
  if (authError || !authResult.user) return null

  const { data: userData } = await supabase
    .from('usuarios')
    .select('rol, activo')
    .eq('id', authResult.user.id)
    .maybeSingle()

  const isAdmin = !!userData?.activo && userData.rol === 'admin'
  const db = isAdmin ? adminSupabase : supabase

  const { data: liquidacion, error } = await db
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

  const { data: jornadas } = await db
    .from('rrhh_liquidacion_jornadas')
    .select('*')
    .eq('liquidacion_id', liquidacionId)
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true })

  const { data: cuotas } = await db
    .from('rrhh_adelanto_cuotas')
    .select(`
      *,
      plan:rrhh_adelanto_planes(id, tipo, monto_total, descripcion, cantidad_cuotas)
    `)
    .eq('liquidacion_id', liquidacionId)
    .order('periodo_anio', { ascending: false })
    .order('periodo_mes', { ascending: false })

  const periodoMes = Number(liquidacion.periodo_mes)
  const periodoAnio = Number(liquidacion.periodo_anio)
  const fromDate = `${periodoAnio}-${String(periodoMes).padStart(2, '0')}-01`
  const monthLastDay = new Date(periodoAnio, periodoMes, 0).getDate()
  const toDate = `${periodoAnio}-${String(periodoMes).padStart(2, '0')}-${String(monthLastDay).padStart(2, '0')}`

  const { data: feriados } = await db
    .from('rrhh_feriados')
    .select('fecha, descripcion')
    .eq('activo', true)
    .gte('fecha', fromDate)
    .lte('fecha', toDate)
    .order('fecha', { ascending: true })

  const { data: puestos } = await adminSupabase
    .from('rrhh_liquidacion_reglas_puesto')
    .select('puesto_codigo, grupo_base_dias, horas_jornada, tipo_calculo, tarifa_turno_trabajado')
    .eq('activo', true)
    .order('puesto_codigo', { ascending: true })

  const { data: reglaPeriodo } = await adminSupabase
    .from('rrhh_liquidacion_reglas_periodo')
    .select('periodo_mes, periodo_anio, dias_base_galpon, dias_base_sucursales, dias_base_rrhh, dias_base_lun_sab, activo')
    .eq('periodo_mes', periodoMes)
    .eq('periodo_anio', periodoAnio)
    .eq('activo', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: tramosPuesto } = await adminSupabase
    .from('rrhh_liquidacion_tramos_puesto')
    .select('*')
    .eq('liquidacion_id', liquidacionId)
    .order('orden', { ascending: true })
    .order('fecha_desde', { ascending: true })

  return {
    liquidacion: liquidacion as Liquidacion,
    jornadas: (jornadas || []) as LiquidacionJornada[],
    cuotas: (cuotas || []) as AdelantoCuota[],
    feriados: (feriados || []) as Array<{ fecha: string; descripcion?: string | null }>,
    puestosDisponibles: (puestos || []) as Pick<
      LiquidacionReglaPuesto,
      'puesto_codigo' | 'grupo_base_dias' | 'horas_jornada' | 'tipo_calculo' | 'tarifa_turno_trabajado'
    >[],
    reglaPeriodo: (reglaPeriodo || null) as LiquidacionReglaPeriodo | null,
    tramosPuesto: (tramosPuesto || []) as LiquidacionTramoPuesto[],
  }
}

const ESTADOS = ['borrador', 'calculada', 'aprobada', 'pagada'] as const
type EstadoType = (typeof ESTADOS)[number]

const ESTADO_LABELS: Record<EstadoType, string> = {
  borrador: 'Borrador',
  calculada: 'Calculada',
  aprobada: 'Aprobada',
  pagada: 'Pagada',
}

const ESTADO_BADGE_CLASSES: Record<string, string> = {
  borrador: 'bg-gray-100 text-gray-600 border-gray-300',
  calculada: 'bg-blue-50 text-blue-700 border-blue-200',
  aprobada: 'bg-green-50 text-green-700 border-green-200',
  pagada: 'bg-purple-50 text-purple-700 border-purple-200',
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
  const nombreEmpleado = empleado ? getEmpleadoNombre(empleado) : 'Sin nombre'
  const legajo = empleado?.legajo ? `Legajo ${empleado.legajo}` : ''

  const estado = (data.liquidacion.estado ?? 'borrador') as EstadoType
  const estadoIndex = ESTADOS.indexOf(estado)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Button variant="ghost" asChild className="mb-2 -ml-3">
            <Link href="/rrhh/liquidaciones">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a liquidaciones
            </Link>
          </Button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-gray-900">Planilla de Liquidacion</h1>
            <Badge
              variant="outline"
              className={`text-sm font-semibold px-3 py-1 ${ESTADO_BADGE_CLASSES[estado] ?? ''}`}
            >
              {ESTADO_LABELS[estado] ?? estado}
            </Badge>
          </div>
          <p className="text-gray-600 mt-1">
            {nombreEmpleado || 'Empleado sin nombre'}
            {legajo ? ` — ${legajo}` : ''}
            {` — Período ${data.liquidacion.periodo_mes}/${data.liquidacion.periodo_anio}`}
          </p>
        </div>
      </div>

      {/* Stepper de flujo */}
      <div className="flex items-center py-2">
        {ESTADOS.map((e, i) => {
          const isPast = i < estadoIndex
          const isCurrent = i === estadoIndex
          return (
            <div key={e} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    isPast
                      ? 'bg-green-500 text-white'
                      : isCurrent
                        ? 'bg-blue-500 text-white ring-2 ring-blue-200'
                        : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {isPast ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span
                  className={`text-xs mt-1 whitespace-nowrap font-medium ${
                    isCurrent ? 'text-blue-600' : isPast ? 'text-green-600' : 'text-gray-400'
                  }`}
                >
                  {ESTADO_LABELS[e]}
                </span>
              </div>
              {i < ESTADOS.length - 1 && (
                <div
                  className={`h-0.5 w-12 mx-2 mb-5 rounded-full ${isPast ? 'bg-green-500' : 'bg-gray-200'}`}
                />
              )}
            </div>
          )
        })}
      </div>

      <LiquidacionDetalleClient
        liquidacion={data.liquidacion}
        jornadas={data.jornadas}
        cuotas={data.cuotas}
        feriados={data.feriados}
        puestosDisponibles={data.puestosDisponibles}
        reglaPeriodo={data.reglaPeriodo}
        tramosPuesto={data.tramosPuesto}
      />
    </div>
  )
}
