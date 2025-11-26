import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { AsistenciaTable } from '@/components/tables/AsistenciaTable'
import { Button } from '@/components/ui/button'
import { Clock, CheckCircle, AlertTriangle, XCircle, Plus } from 'lucide-react'
import Link from 'next/link'
import type { Asistencia } from '@/types/domain.types'

async function getAsistenciaHoy() {
  const supabase = await createClient()
  const hoy = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('rrhh_asistencia')
    .select(`
      *,
      empleado:rrhh_empleados(
        id,
        legajo,
        usuario:usuarios(nombre, apellido)
      )
    `)
    .eq('fecha', hoy)
    .order('hora_entrada', { ascending: false })

  if (error) {
    console.error('Error fetching asistencia:', error)
    return []
  }

  return data as Asistencia[]
}

export default async function AsistenciaPage() {
  const asistenciaHoy = await getAsistenciaHoy()

  // Calcular estadísticas del día
  const totalEmpleadosActivos = await getTotalEmpleadosActivos()
  const presentes = asistenciaHoy.filter(a => a.estado === 'presente').length
  const ausentes = asistenciaHoy.filter(a => a.estado === 'ausente').length
  const retrasos = asistenciaHoy.filter(a => a.retraso_minutos > 0).length
  const faltasSinAviso = asistenciaHoy.filter(a => a.falta_sin_aviso).length

  // Calcular porcentaje de asistencia
  const porcentajeAsistencia = totalEmpleadosActivos > 0
    ? Math.round((presentes / totalEmpleadosActivos) * 100)
    : 0

  async function getTotalEmpleadosActivos() {
    const supabase = await createClient()
    const { count, error } = await supabase
      .from('rrhh_empleados')
      .select('*', { count: 'exact', head: true })
      .eq('activo', true)

    return count || 0
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Control de Asistencia</h1>
          <p className="text-gray-600 mt-1">
            Registro y control diario de asistencia del personal
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/rrhh/asistencia/marcar">
            <Plus className="w-4 h-4 mr-2" />
            Marcar Asistencia
          </Link>
        </Button>
      </div>

      {/* Estadísticas del día */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Presentes Hoy</p>
              <p className="text-2xl font-bold text-gray-900">{presentes}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">% Asistencia</p>
              <p className="text-2xl font-bold text-gray-900">{porcentajeAsistencia}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Retrasos</p>
              <p className="text-2xl font-bold text-gray-900">{retrasos}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Ausentes</p>
              <p className="text-2xl font-bold text-gray-900">{ausentes}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Faltas S/A</p>
              <p className="text-2xl font-bold text-gray-900">{faltasSinAviso}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Información importante */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="p-1 bg-blue-100 rounded-lg">
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-blue-900">Reglas de Asistencia</h3>
            <ul className="text-blue-700 text-sm mt-1 space-y-1">
              <li>• <strong>Faltas sin aviso:</strong> Una sola falta sin aviso previo implica pérdida de presentismo y jornal completo</li>
              <li>• <strong>Retrasos:</strong> Llegadas con más de 15 minutos tarde se consideran faltas sin aviso</li>
              <li>• <strong>Horarios:</strong> Mañana (hasta 15:00), Tarde (desde 15:00)</li>
              <li>• <strong>Cálculo automático:</strong> El sistema calcula horas trabajadas y marca retrasos automáticamente</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Asistencia del día */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Asistencia de Hoy</h3>
          <p className="text-sm text-muted-foreground">
            Registro de asistencia del día {new Date().toLocaleDateString('es-ES', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>
        <div className="p-6">
          <Suspense fallback={<div>Cargando asistencia...</div>}>
            <AsistenciaTable asistencia={asistenciaHoy} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
