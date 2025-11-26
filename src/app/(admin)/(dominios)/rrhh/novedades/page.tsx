import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { NovedadesTable } from '@/components/tables/NovedadesTable'
import { Button } from '@/components/ui/button'
import { Megaphone, Plus, AlertTriangle, Info, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import type { NovedadRRHH } from '@/types/domain.types'

async function getNovedades() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('rrhh_novedades')
    .select(`
      *,
      sucursal:sucursales(id, nombre),
      categoria:rrhh_categorias(id, nombre),
      created_by:usuarios(id, nombre, apellido)
    `)
    .order('fecha_publicacion', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Error fetching novedades:', error)
    return []
  }

  return data as NovedadRRHH[]
}

export default async function NovedadesPage() {
  const novedades = await getNovedades()

  // Calcular estadísticas
  const activas = novedades.filter(n => n.activo).length
  const generales = novedades.filter(n => n.tipo === 'general').length
  const porSucursal = novedades.filter(n => n.tipo === 'sucursal').length
  const porCategoria = novedades.filter(n => n.tipo === 'categoria').length

  // Contar por prioridad
  const porPrioridad = {
    urgente: novedades.filter(n => n.prioridad === 'urgente').length,
    alta: novedades.filter(n => n.prioridad === 'alta').length,
    normal: novedades.filter(n => n.prioridad === 'normal').length,
    baja: novedades.filter(n => n.prioridad === 'baja').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Novedades RRHH</h1>
          <p className="text-gray-600 mt-1">
            Comunicación interna y anuncios para el personal
          </p>
        </div>
        <Button asChild>
          <Link href="/rrhh/novedades/nueva">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Novedad
          </Link>
        </Button>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Megaphone className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Novedades</p>
              <p className="text-2xl font-bold text-gray-900">{novedades.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Activas</p>
              <p className="text-2xl font-bold text-gray-900">{activas}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Info className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Generales</p>
              <p className="text-2xl font-bold text-gray-900">{generales}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Urgentes</p>
              <p className="text-2xl font-bold text-gray-900">{porPrioridad.urgente}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Distribución por tipo */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Distribución por Tipo</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{generales}</div>
            <div className="text-sm text-blue-700">Generales</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{porSucursal}</div>
            <div className="text-sm text-green-700">Por Sucursal</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{porCategoria}</div>
            <div className="text-sm text-purple-700">Por Categoría</div>
          </div>
        </div>
      </div>

      {/* Información importante */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="p-1 bg-blue-100 rounded-lg">
            <Megaphone className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-blue-900">Sistema de Comunicación Interna</h3>
            <p className="text-blue-700 text-sm mt-1">
              Las novedades se muestran automáticamente a los empleados según su sucursal y categoría.
              Las novedades generales son visibles para todo el personal activo.
            </p>
          </div>
        </div>
      </div>

      {/* Tabla de novedades */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6">
          <Suspense fallback={<div>Cargando novedades...</div>}>
            <NovedadesTable novedades={novedades} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
