import { createAdminClient, createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import {
  StatCard,
  StatCardSuccess,
  StatCardWarning,
  StatCardPrimary,
} from '@/components/ui/stat-card'
import { Calculator, CheckCircle, FileText, ReceiptText, Settings } from 'lucide-react'
import Link from 'next/link'
import type { Liquidacion } from '@/types/domain.types'
import { ejecutarLiquidacionAutomatica } from '@/lib/services/rrhh-liquidaciones-automaticas'
import { LiquidacionesTableWrapper } from './_components/LiquidacionesTableWrapper'
import { PeriodFilterBar } from './_components/PeriodFilterBar'
import { RecalcularLiquidacionesButton } from './_components/RecalcularLiquidacionesButton'
import { formatCurrency } from '@/lib/utils'

type AmbitoFilter = 'todos' | 'sucursal' | 'galpon'

type SucursalOption = {
  id: string
  nombre: string
}

function resolveAmbitoLiquidacion(liquidacion: Liquidacion): 'sucursal' | 'galpon' | 'rrhh' {
  const snapshot = (liquidacion.grupo_base_snapshot || '').toLowerCase().trim()
  if (snapshot === 'sucursales') return 'sucursal'
  if (snapshot === 'rrhh') return 'rrhh'
  if (snapshot === 'galpon') return 'galpon'

  if (liquidacion.sucursal_snapshot_id || liquidacion.empleado?.sucursal_id) return 'sucursal'

  const categoriaNombre = liquidacion.empleado?.categoria?.nombre?.toLowerCase() || ''
  if (categoriaNombre.includes('sucursal') || categoriaNombre.includes('encargad')) return 'sucursal'

  return 'galpon'
}

async function getLiquidaciones(
  periodoMes?: number,
  periodoAnio?: number,
  ambito: AmbitoFilter = 'todos',
  sucursalId?: string,
) {
  const supabase = await createClient()
  const adminSupabase = createAdminClient()

  const { data: authResult, error: authError } = await supabase.auth.getUser()
  if (authError || !authResult.user) return []

  const { data: userData } = await supabase
    .from('usuarios')
    .select('rol, activo')
    .eq('id', authResult.user.id)
    .maybeSingle()

  const isAdmin = !!userData?.activo && userData.rol === 'admin'
  const db = isAdmin ? adminSupabase : supabase

  let query = db
    .from('rrhh_liquidaciones')
    .select(`
      *,
      empleado:rrhh_empleados(
        id,
        sucursal_id,
        legajo,
        nombre,
        apellido,
        sucursal:sucursales(id, nombre),
        categoria:rrhh_categorias(id, nombre),
        usuario:usuarios(nombre, apellido, email)
      )
    `)
    .order('periodo_anio', { ascending: false })
    .order('periodo_mes', { ascending: false })

  if (periodoMes && periodoAnio) {
    query = query.eq('periodo_mes', periodoMes).eq('periodo_anio', periodoAnio)
  } else if (periodoAnio && !periodoMes) {
    query = query.eq('periodo_anio', periodoAnio)
  } else {
    query = query.limit(50)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching liquidaciones:', error)
    return []
  }

  const base = (data || []) as Liquidacion[]
  const filtered = base.filter((liquidacion) => {
    const ambitoItem = resolveAmbitoLiquidacion(liquidacion)

    if (ambito === 'galpon' && ambitoItem !== 'galpon') return false
    if (ambito === 'sucursal' && ambitoItem !== 'sucursal') return false

    if (ambito === 'sucursal' && sucursalId) {
      const snapshotSucursal = liquidacion.sucursal_snapshot_id || ''
      const empleadoSucursal = liquidacion.empleado?.sucursal_id || ''
      if (snapshotSucursal !== sucursalId && empleadoSucursal !== sucursalId) return false
    }

    return true
  })

  return filtered
}

async function getSucursalesOptions(): Promise<SucursalOption[]> {
  const supabase = await createClient()
  const adminSupabase = createAdminClient()

  const { data: authResult, error: authError } = await supabase.auth.getUser()
  if (authError || !authResult.user) return []

  const { data: userData } = await supabase
    .from('usuarios')
    .select('rol, activo')
    .eq('id', authResult.user.id)
    .maybeSingle()

  const isAdmin = !!userData?.activo && userData.rol === 'admin'
  const db = isAdmin ? adminSupabase : supabase

  const { data, error } = await db
    .from('sucursales')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre', { ascending: true })

  if (error) {
    console.error('Error fetching sucursales for liquidaciones:', error)
    return []
  }

  return (data || []) as SucursalOption[]
}

async function getEmpleadosActivosParaRecalculo() {
  const supabase = await createClient()
  const adminSupabase = createAdminClient()

  const { data: authResult, error: authError } = await supabase.auth.getUser()
  if (authError || !authResult.user) return []

  const { data: userData } = await supabase
    .from('usuarios')
    .select('rol, activo')
    .eq('id', authResult.user.id)
    .maybeSingle()

  const isAdmin = !!userData?.activo && userData.rol === 'admin'
  const db = isAdmin ? adminSupabase : supabase

  const { data } = await db
    .from('rrhh_empleados')
    .select('id, legajo, nombre, apellido, usuario:usuarios(nombre, apellido, email)')
    .eq('activo', true)

  return (data || [])
    .map((row) => {
      const usuario = row.usuario as { nombre?: string | null; apellido?: string | null; email?: string | null } | null
      const nombreUsuario = `${usuario?.nombre || ''} ${usuario?.apellido || ''}`.trim()
      const nombreEmpleado = `${row.nombre || ''} ${row.apellido || ''}`.trim()
      const nombre = nombreUsuario || nombreEmpleado || usuario?.email || (row.legajo ? `Legajo ${row.legajo}` : 'Sin nombre')
      return { id: String(row.id), nombre }
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

async function ejecutarFallbackMesVencido(): Promise<void> {
  if (process.env.RRHH_AUTO_LIQUIDACIONES_UI_FALLBACK === 'false') {
    return
  }

  try {
    const result = await ejecutarLiquidacionAutomatica({ source: 'ui_fallback' })
    if (result.estado === 'error') {
      console.error('[RRHH AUTO LIQ] Fallback UI con error:', result.error || result.mensaje)
      return
    }

    if (result.estado === 'success') {
      console.log('[RRHH AUTO LIQ] Fallback UI ejecutado:', {
        periodo_mes: result.periodo_mes,
        periodo_anio: result.periodo_anio,
        liquidaciones: result.liquidaciones,
        sync: result.sync,
      })
    }
  } catch (error) {
    console.error('[RRHH AUTO LIQ] Fallback UI no pudo ejecutarse:', error)
  }
}

export const dynamic = 'force-dynamic'
export default async function LiquidacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; anio?: string; ambito?: string; sucursal?: string }>
}) {
  const params = await searchParams
  const periodoMes = params.mes ? Number(params.mes) : undefined
  const periodoAnio = params.anio ? Number(params.anio) : new Date().getFullYear()
  const ambito = (params.ambito || 'todos') as AmbitoFilter
  const sucursalId = params.sucursal || undefined

  await ejecutarFallbackMesVencido()
  const liquidaciones = await getLiquidaciones(periodoMes, periodoAnio, ambito, sucursalId)
  const sucursales = await getSucursalesOptions()
  const empleadosActivos = await getEmpleadosActivosParaRecalculo()

  const totalAprobadas = liquidaciones.filter((l) => l.estado === 'aprobada').length
  const totalPendientes = liquidaciones.filter(
    (l) => l.estado === 'borrador' || l.estado === 'calculada',
  ).length
  const totalPagado = liquidaciones
    .filter((l) => l.pagado)
    .reduce((sum, l) => sum + l.total_neto, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Liquidaciones de Sueldos</h1>
          <p className="text-gray-600 mt-1">Cálculo y gestión de sueldos mensuales del personal</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link href="/rrhh/liquidaciones/calcular">
              <Calculator className="w-4 h-4 mr-2" />
              Calcular Liquidaciones
            </Link>
          </Button>
          <RecalcularLiquidacionesButton
            empleados={empleadosActivos}
            defaultMes={periodoMes || new Date().getMonth() + 1}
            defaultAnio={periodoAnio || new Date().getFullYear()}
          />
          <Button variant="outline" asChild>
            <Link href="/rrhh/liquidaciones/configuracion">
              <Settings className="w-4 h-4 mr-2" />
              Configuracion
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/rrhh/reportes">
              <FileText className="w-4 h-4 mr-2" />
              Reportes
            </Link>
          </Button>
        </div>
      </div>

      {/* QW-5: Stat cards usando el componente StatCard reutilizable */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Liquidaciones"
          value={liquidaciones.length}
          icon={ReceiptText}
        />
        <StatCardSuccess
          title="Aprobadas"
          value={totalAprobadas}
          icon={CheckCircle}
        />
        <StatCardWarning
          title="Pendientes"
          value={totalPendientes}
          subtitle="Borrador o calculada"
          icon={Calculator}
        />
        <StatCardPrimary
          title="Total Pagado"
          value={formatCurrency(totalPagado)}
          subtitle="Liquidaciones pagadas"
          icon={FileText}
        />
      </div>

      {/* Tabla de liquidaciones con filtros y bulk actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <PeriodFilterBar
          periodoMes={periodoMes}
          periodoAnio={periodoAnio}
          ambito={ambito}
          sucursalId={sucursalId}
          sucursales={sucursales}
        />
        <LiquidacionesTableWrapper liquidaciones={liquidaciones} />
      </div>
    </div>
  )
}
