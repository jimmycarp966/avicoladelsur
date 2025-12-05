import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { AdelantosTableWrapper } from './adelantos-table-wrapper'
import { Button } from '@/components/ui/button'
import { Plus, DollarSign, Package, CheckCircle, Clock } from 'lucide-react'
import Link from 'next/link'
import type { Adelanto } from '@/types/domain.types'

async function getAdelantos() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('rrhh_adelantos')
    .select(`
      *,
      empleado:rrhh_empleados(
        id,
        legajo,
        usuario:usuarios(id, nombre, apellido, email)
      ),
      producto:productos(id, codigo, nombre),
      aprobador:usuarios(id, nombre, apellido)
    `)
    .order('fecha_solicitud', { ascending: false })
    .limit(100)

  if (error) {
    console.error('Error fetching adelantos:', error)
    return []
  }

  return data as Adelanto[]
}

export const dynamic = 'force-dynamic'
export default async function AdelantosPage() {
  const adelantos = await getAdelantos()

  // Calcular estadísticas
  const total = adelantos.length
  const aprobados = adelantos.filter(a => a.aprobado).length
  const pendientes = adelantos.filter(a => !a.aprobado).length
  const dinero = adelantos.filter(a => a.tipo === 'dinero').length
  const productos = adelantos.filter(a => a.tipo === 'producto').length

  // Calcular totales
  const totalDinero = adelantos
    .filter(a => a.tipo === 'dinero' && a.aprobado)
    .reduce((sum, a) => sum + (a.monto || 0), 0)

  const totalProductos = adelantos
    .filter(a => a.tipo === 'producto' && a.aprobado)
    .reduce((sum, a) => sum + ((a.cantidad || 0) * (a.precio_unitario || 0)), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Adelantos</h1>
          <p className="text-gray-600 mt-1">
            Gestión de adelantos en dinero y productos para empleados
          </p>
        </div>
        <Button asChild>
          <Link href="/rrhh/adelantos/nuevo">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Adelanto
          </Link>
        </Button>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Adelantos</p>
              <p className="text-2xl font-bold text-gray-900">{total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Aprobados</p>
              <p className="text-2xl font-bold text-gray-900">{aprobados}</p>
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
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Package className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Aprobado</p>
              <p className="text-2xl font-bold text-gray-900">
                ${(totalDinero + totalProductos).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Distribución por tipo */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Distribución por Tipo</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{dinero}</div>
            <div className="text-sm text-green-700">Adelantos en Dinero</div>
            <div className="text-xs text-green-600 mt-1">
              Total: ${totalDinero.toLocaleString()}
            </div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{productos}</div>
            <div className="text-sm text-blue-700">Adelantos en Productos</div>
            <div className="text-xs text-blue-600 mt-1">
              Total: ${totalProductos.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Información importante */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="p-1 bg-blue-100 rounded-lg">
            <DollarSign className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-blue-900">Límite de Adelantos</h3>
            <p className="text-blue-700 text-sm mt-1">
              Los adelantos en dinero están limitados al 30% del sueldo básico mensual del empleado.
              El sistema valida automáticamente este límite antes de aprobar cualquier adelanto.
            </p>
          </div>
        </div>
      </div>

      {/* Tabla de adelantos */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6">
          <Suspense fallback={<div>Cargando adelantos...</div>}>
            <AdelantosTableWrapper adelantos={adelantos} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

