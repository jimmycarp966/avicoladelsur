'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { EmpleadosTable } from '@/components/tables/EmpleadosTable'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { eliminarEmpleadoAction } from '@/actions/rrhh.actions'
import { useNotificationStore } from '@/store/notificationStore'
import { createClient } from '@/lib/supabase/client'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { Empleado } from '@/types/domain.types'

export default function EmpleadosPage() {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [empleadoToDelete, setEmpleadoToDelete] = useState<Empleado | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    const loadEmpleados = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
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
          console.error('Error fetching empleados:', error)
          showToast('error', 'Error al cargar empleados', 'Error')
        } else {
          setEmpleados(data as Empleado[])
        }
      } catch (error) {
        console.error('Error loading empleados:', error)
        showToast('error', 'Error al cargar empleados', 'Error')
      } finally {
        setLoading(false)
      }
    }

    loadEmpleados()
  }, [showToast])

  const handleView = (empleado: Empleado) => {
    router.push(`/rrhh/empleados/${empleado.id}`)
  }

  const handleEdit = (empleado: Empleado) => {
    router.push(`/rrhh/empleados/${empleado.id}/editar`)
  }

  const handleDelete = (empleado: Empleado) => {
    setEmpleadoToDelete(empleado)
  }

  const confirmDelete = async () => {
    if (!empleadoToDelete) return

    setIsDeleting(true)
    try {
      const result = await eliminarEmpleadoAction(empleadoToDelete.id)
      
      if (result.success) {
        showToast('success', result.message || 'Empleado eliminado exitosamente', 'Éxito')
        setEmpleados(empleados.filter(e => e.id !== empleadoToDelete.id))
        setEmpleadoToDelete(null)
      } else {
        showToast('error', result.error || 'Error al eliminar empleado', 'Error')
      }
    } catch (error: any) {
      console.error('Error deleting empleado:', error)
      showToast('error', 'Error al eliminar empleado', 'Error')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCall = (empleado: Empleado) => {
    if (empleado.telefono_personal) {
      window.location.href = `tel:${empleado.telefono_personal}`
    }
  }

  const handleEmail = (empleado: Empleado) => {
    if (empleado.usuario?.email) {
      window.location.href = `mailto:${empleado.usuario.email}`
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Empleados</h1>
            <p className="text-gray-600 mt-1">Cargando...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Empleados</h1>
          <p className="text-gray-600 mt-1">
            Gestión completa del personal de la empresa
          </p>
        </div>
        <Button asChild>
          <Link href="/rrhh/empleados/nuevo">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Empleado
          </Link>
        </Button>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Empleados</p>
              <p className="text-2xl font-bold text-gray-900">{empleados.length}</p>
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
              <p className="text-sm font-medium text-gray-600">Activos</p>
              <p className="text-2xl font-bold text-gray-900">
                {empleados.filter(e => e.activo).length}
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
              <p className="text-sm font-medium text-gray-600">Promedio Salario</p>
              <p className="text-2xl font-bold text-gray-900">
                ${empleados.length > 0
                  ? Math.round(empleados.reduce((sum, emp) => sum + (emp.sueldo_actual || 0), 0) / empleados.length).toLocaleString()
                  : '0'
                }
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Sucursales</p>
              <p className="text-2xl font-bold text-gray-900">
                {new Set(empleados.map(e => e.sucursal_id).filter(Boolean)).size}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de empleados */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6">
          <EmpleadosTable 
            empleados={empleados}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onCall={handleCall}
            onEmail={handleEmail}
          />
        </div>
      </div>

      {/* Dialog de confirmación para eliminar */}
      <AlertDialog open={!!empleadoToDelete} onOpenChange={(open) => !open && setEmpleadoToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el empleado{' '}
              <strong>
                {empleadoToDelete?.usuario?.nombre} {empleadoToDelete?.usuario?.apellido}
              </strong>
              {empleadoToDelete?.legajo && ` (Legajo: ${empleadoToDelete.legajo})`}.
              {empleadoToDelete && (
                <>
                  <br /><br />
                  <span className="text-amber-600 font-semibold">
                    ⚠️ Nota: Solo se puede eliminar si no tiene registros de asistencia o adelantos.
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
