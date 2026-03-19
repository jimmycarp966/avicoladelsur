import { Suspense } from 'react'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { LicenciasTable } from '@/components/tables/LicenciasTable'
import { Button } from '@/components/ui/button'
import { Calendar, CalendarDays, Plus, CheckCircle, Clock, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import type { Licencia } from '@/types/domain.types'

async function getLicencias() {
  const supabase = await createClient()
  const adminSupabase = createAdminClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return []
  }

  const { data: userData } = await adminSupabase
    .from('usuarios')
    .select('rol, activo')
    .eq('id', user.id)
    .maybeSingle()

  const db = userData?.activo && userData.rol === 'admin' ? adminSupabase : supabase

  const { data, error } = await db
    .from('rrhh_licencias')
    .select(`
      *,
      empleado:rrhh_empleados(
        id,
        legajo,
        usuario:usuarios(nombre, apellido)
      ),
      aprobado_por:usuarios!rrhh_licencias_aprobado_por_fkey(id, nombre, apellido)
    `)
    .order('fecha_presentacion_certificado', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Error fetching licencias:', error)
    return []
  }

  return data as Licencia[]
}

export const dynamic = 'force-dynamic'
export default async function LicenciasPage() {
  const licencias = await getLicencias()

  // Calcular estadísticas
  const totalLicencias = licencias.length
  const aprobadas = licencias.filter(l => l.aprobado).length
  const pendientes = licencias.filter(l => !l.aprobado).length
  const pendientesRevision = licencias.filter(l => l.estado_revision === 'pendiente').length

  // Licencias por tipo
  const porTipo = {
    vacaciones: licencias.filter(l => l.tipo === 'vacaciones').length,
    enfermedad: licencias.filter(l => l.tipo === 'enfermedad').length,
    maternidad: licencias.filter(l => l.tipo === 'maternidad').length,
    estudio: licencias.filter(l => l.tipo === 'estudio').length,
    otro: licencias.filter(l => l.tipo === 'otro').length,
  }

  // Licencias activas (fecha actual entre inicio y fin)
  const hoy = new Date()
  const licenciasActivas = licencias.filter(l =>
    l.aprobado &&
    new Date(l.fecha_inicio) <= hoy &&
    new Date(l.fecha_fin) >= hoy
  ).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Licencias y Descansos</h1>
          <p className="text-gray-600 mt-1">
            Gestión de licencias, vacaciones y permisos del personal
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/rrhh/licencias/nueva">
              <Plus className="w-4 h-4 mr-2" />
              Nueva Licencia
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
          >
            <Link href="/rrhh/licencias/nueva?tipo=vacaciones">
              <CalendarDays className="w-4 h-4 mr-2" />
              Programar Vacaciones
            </Link>
          </Button>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Licencias</p>
              <p className="text-2xl font-bold text-gray-900">{totalLicencias}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Aprobadas</p>
              <p className="text-2xl font-bold text-gray-900">{aprobadas}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pendientes</p>
              <p className="text-2xl font-bold text-gray-900">{pendientes}</p>
              <p className="text-xs text-muted-foreground">{pendientesRevision} en revision RRHH</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Activas Hoy</p>
              <p className="text-2xl font-bold text-gray-900">{licenciasActivas}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Distribución por tipo */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Distribución por Tipo</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{porTipo.vacaciones}</div>
            <div className="text-sm text-green-700">Vacaciones</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{porTipo.enfermedad}</div>
            <div className="text-sm text-red-700">Enfermedad</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{porTipo.maternidad}</div>
            <div className="text-sm text-purple-700">Maternidad</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{porTipo.estudio}</div>
            <div className="text-sm text-blue-700">Estudio</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-600">{porTipo.otro}</div>
            <div className="text-sm text-gray-700">Otro</div>
          </div>
        </div>
      </div>

      {/* Información importante */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="p-1 bg-blue-100 rounded-lg">
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-blue-900">Sistema de Licencias</h3>
            <p className="text-blue-700 text-sm mt-1">
              Vacaciones se cargan sin certificado ni auditoria IA. Las licencias medicas mantienen la
              revision manual de RRHH y el control de plazo de presentacion dentro de 24 horas
              (con excepciones autorizadas).
            </p>
          </div>
        </div>
      </div>

      {/* Tabla de licencias */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6">
          <Suspense fallback={<div>Cargando licencias...</div>}>
            <LicenciasTable licencias={licencias} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
