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

async function getLiquidaciones() {
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
    .from('rrhh_liquidaciones')
    .select(`
      *,
      empleado:rrhh_empleados(
        id,
        legajo,
        nombre,
        apellido,
        usuario:usuarios(nombre, apellido, email)
      )
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Error fetching liquidaciones:', error)
    return []
  }

  return data as Liquidacion[]
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
export default async function LiquidacionesPage() {
  await ejecutarFallbackMesVencido()
  const liquidaciones = await getLiquidaciones()

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
          <Button variant="outline" asChild>
            <Link href="/rrhh/liquidaciones/configuracion">
              <Settings className="w-4 h-4 mr-2" />
              Configuracion
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/rrhh/liquidaciones/reportes">
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
          value={`$${totalPagado.toLocaleString()}`}
          subtitle="Liquidaciones pagadas"
          icon={FileText}
        />
      </div>

      {/* Tabla de liquidaciones con filtros y bulk actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <LiquidacionesTableWrapper liquidaciones={liquidaciones} />
      </div>
    </div>
  )
}
