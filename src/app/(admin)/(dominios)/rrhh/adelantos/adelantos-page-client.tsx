'use client'

import { useMemo, useSyncExternalStore } from 'react'
import { AdelantosTableWrapper } from './adelantos-table-wrapper'
import { Button } from '@/components/ui/button'
import { Plus, DollarSign, Package, CheckCircle, Clock } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import type { Adelanto } from '@/types/domain.types'

interface AdelantosPageClientProps {
  adelantos: Adelanto[]
}

export function AdelantosPageClient({ adelantos }: AdelantosPageClientProps) {
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  const stats = useMemo(() => {
    const total = adelantos.length
    const aprobados = adelantos.filter((adelanto) => adelanto.aprobado).length
    const pendientes = adelantos.filter((adelanto) => !adelanto.aprobado).length
    const dinero = adelantos.filter((adelanto) => adelanto.tipo === 'dinero').length
    const productos = adelantos.filter((adelanto) => adelanto.tipo === 'producto').length
    const totalDinero = adelantos
      .filter((adelanto) => adelanto.tipo === 'dinero' && adelanto.aprobado)
      .reduce((sum, adelanto) => sum + (adelanto.monto || 0), 0)
    const totalProductos = adelantos
      .filter((adelanto) => adelanto.tipo === 'producto' && adelanto.aprobado)
      .reduce((sum, adelanto) => sum + ((adelanto.cantidad || 0) * (adelanto.precio_unitario || 0)), 0)

    return {
      total,
      aprobados,
      pendientes,
      dinero,
      productos,
      totalDinero,
      totalProductos,
      totalAprobado: totalDinero + totalProductos,
    }
  }, [adelantos])

  if (!isClient) {
    return <div className="min-h-[640px]" aria-hidden="true" />
  }

  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Adelantos</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
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
              <p className="text-2xl font-bold text-gray-900">{stats.aprobados}</p>
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
              <p className="text-2xl font-bold text-gray-900">{stats.pendientes}</p>
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
                {formatCurrency(stats.totalAprobado)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Distribución por Tipo</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{stats.dinero}</div>
            <div className="text-sm text-green-700">Adelantos en Dinero</div>
            <div className="text-xs text-green-600 mt-1">
              Total: {formatCurrency(stats.totalDinero)}
            </div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{stats.productos}</div>
            <div className="text-sm text-blue-700">Adelantos en Productos</div>
            <div className="text-xs text-blue-600 mt-1">
              Total: {formatCurrency(stats.totalProductos)}
            </div>
          </div>
        </div>
      </div>

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

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6">
          <AdelantosTableWrapper adelantos={adelantos} />
        </div>
      </div>
    </div>
  )
}
