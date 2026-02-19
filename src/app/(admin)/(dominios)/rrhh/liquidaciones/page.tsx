import { Suspense } from 'react'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { LiquidacionesTable } from '@/components/tables/LiquidacionesTable'
import { Button } from '@/components/ui/button'
import { Calculator, FileText, Settings } from 'lucide-react'
import Link from 'next/link'
import type { Liquidacion } from '@/types/domain.types'
import { ejecutarLiquidacionAutomatica } from '@/lib/services/rrhh-liquidaciones-automaticas'

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Liquidaciones de Sueldos</h1>
          <p className="text-gray-600 mt-1">
            Cálculo y gestión de sueldos mensuales del personal
          </p>
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

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Liquidaciones</p>
              <p className="text-2xl font-bold text-gray-900">{liquidaciones.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Aprobadas</p>
              <p className="text-2xl font-bold text-gray-900">
                {liquidaciones.filter(l => l.estado === 'aprobada').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pendientes</p>
              <p className="text-2xl font-bold text-gray-900">
                {liquidaciones.filter(l => l.estado === 'borrador' || l.estado === 'calculada').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Pagado</p>
              <p className="text-2xl font-bold text-gray-900">
                ${liquidaciones
                  .filter(l => l.pagado)
                  .reduce((sum, l) => sum + l.total_neto, 0)
                  .toLocaleString()
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de liquidaciones */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6">
          <Suspense fallback={<div>Cargando liquidaciones...</div>}>
            <LiquidacionesTable liquidaciones={liquidaciones} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
