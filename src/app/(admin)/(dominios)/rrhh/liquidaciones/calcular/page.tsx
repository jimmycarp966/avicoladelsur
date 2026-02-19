import { Suspense } from 'react'
import { CalcularLiquidacionesForm } from './calcular-liquidaciones-form'
import { LiquidacionesFormSkeleton } from './liquidaciones-form-skeleton'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import type { Empleado } from '@/types/domain.types'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Calcular Liquidaciones - Avícola del Sur ERP',
  description: 'Calcular liquidaciones de sueldo mensuales para empleados',
}

async function getEmpleadosActivosParaCalculo(): Promise<Empleado[]> {
  const supabase = await createClient()

  const { data: authResult, error: authError } = await supabase.auth.getUser()
  if (authError || !authResult.user) return []

  const { data: userData } = await supabase
    .from('usuarios')
    .select('rol, activo')
    .eq('id', authResult.user.id)
    .maybeSingle()

  const isAdmin = !!userData?.activo && userData.rol === 'admin'
  const db = isAdmin ? createAdminClient() : supabase

  const { data, error } = await db
    .from('rrhh_empleados')
    .select(`
      *,
      usuario:usuarios(id, nombre, apellido, email),
      sucursal:sucursales(id, nombre),
      categoria:rrhh_categorias(id, nombre, sueldo_basico)
    `)
    .eq('activo', true)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error cargando empleados para calcular liquidaciones:', error)
    return []
  }

  return (data || []) as Empleado[]
}

export default async function CalcularLiquidacionesPage() {
  const initialEmpleados = await getEmpleadosActivosParaCalculo()

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10"></div>
        <h1 className="text-3xl font-bold tracking-tight">Calcular Liquidaciones</h1>
        <p className="text-muted-foreground mt-1">
          Calcula las liquidaciones de sueldo mensuales para el personal basado en asistencia y producción
        </p>
      </div>

      <Suspense fallback={<LiquidacionesFormSkeleton />}>
        <CalcularLiquidacionesForm initialEmpleados={initialEmpleados} />
      </Suspense>
    </div>
  )
}
