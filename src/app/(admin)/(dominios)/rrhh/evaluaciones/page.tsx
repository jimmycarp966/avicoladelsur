import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { EvaluacionesTable } from '@/components/tables/EvaluacionesTable'
import { Button } from '@/components/ui/button'
import { Plus, FileText, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import type { Evaluacion } from '@/types/domain.types'

async function getEvaluaciones() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('rrhh_evaluaciones')
    .select(`
      *,
      empleado:rrhh_empleados(
        id,
        legajo,
        usuario:usuarios(nombre, apellido)
      ),
      sucursal:sucursales(id, nombre),
      evaluador:usuarios(id, nombre, apellido)
    `)
    .order('fecha_evaluacion', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Error fetching evaluaciones:', error)
    return []
  }

  return data as Evaluacion[]
}

export default async function EvaluacionesPage() {
  const evaluaciones = await getEvaluaciones()

  // Calcular estadísticas
  const promedioGeneral = evaluaciones.length > 0
    ? (evaluaciones.reduce((sum, e) => sum + (e.promedio || 0), 0) / evaluaciones.length).toFixed(1)
    : '0'

  const completadas = evaluaciones.filter(e => e.estado === 'completada').length
  const pendientes = evaluaciones.filter(e => e.estado === 'borrador' || e.estado === 'enviada').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Evaluaciones de Desempeño</h1>
          <p className="text-gray-600 mt-1">
            Evaluación del desempeño del personal por sucursal con formularios automatizados
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link href="/rrhh/evaluaciones/reportes">
              <TrendingUp className="w-4 h-4 mr-2" />
              Reportes
            </Link>
          </Button>
          <Button asChild>
            <Link href="/rrhh/evaluaciones/nueva">
              <Plus className="w-4 h-4 mr-2" />
              Nueva Evaluación
            </Link>
          </Button>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Evaluaciones</p>
              <p className="text-2xl font-bold text-gray-900">{evaluaciones.length}</p>
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
              <p className="text-sm font-medium text-gray-600">Completadas</p>
              <p className="text-2xl font-bold text-gray-900">{completadas}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pendientes</p>
              <p className="text-2xl font-bold text-gray-900">{pendientes}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Promedio General</p>
              <p className="text-2xl font-bold text-gray-900">{promedioGeneral}/5.0</p>
            </div>
          </div>
        </div>
      </div>

      {/* Información importante */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="p-1 bg-blue-100 rounded-lg">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-blue-900">Sistema de Evaluaciones Automatizadas</h3>
            <p className="text-blue-700 text-sm mt-1">
              Las evaluaciones se crean por sucursal y período. Una vez enviadas, generan notificaciones automáticas
              en el sistema de avisos del empleado. Las evaluaciones completadas afectan el cálculo de presentismo
              y pueden influir en futuras liquidaciones de sueldo.
            </p>
          </div>
        </div>
      </div>

      {/* Tabla de evaluaciones */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6">
          <Suspense fallback={<div>Cargando evaluaciones...</div>}>
            <EvaluacionesTable evaluaciones={evaluaciones} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
