'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { EmpleadosTable } from '@/components/tables/EmpleadosTable'
import { Button } from '@/components/ui/button'
import { Plus, Users, UserCheck, TrendingUp, Building2, FileText } from 'lucide-react'
import Link from 'next/link'
import { eliminarEmpleadoAction, obtenerEmpleadosActivosAction } from '@/actions/rrhh.actions'
import { useNotificationStore } from '@/store/notificationStore'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { Card, CardContent } from '@/components/ui/card'
import { EmpleadosFilterBar } from './_components/EmpleadosFilterBar'
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
  const searchParams = useSearchParams()
  const { showToast } = useNotificationStore()
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [empleadoToDelete, setEmpleadoToDelete] = useState<Empleado | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    let mounted = true

    const loadEmpleados = async () => {
      try {
        const result = await Promise.race([
          obtenerEmpleadosActivosAction(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout al cargar empleados')), 12000)
          ),
        ])

        if (!mounted) return

        if (!result.success) {
          console.error('Error fetching empleados:', result.error)
          showToast('error', 'Error al cargar empleados', 'Error')
        } else {
          setEmpleados(result.data || [])
        }
      } catch (error) {
        if (!mounted) return
        console.error('Error loading empleados:', error)
        showToast('error', 'Error al cargar empleados', 'Error')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadEmpleados()

    return () => {
      mounted = false
    }
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
    } catch (error) {
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

  const handleVerDescansosMesActual = () => {
    window.open('/api/rrhh/descansos/mes-actual/pdf', '_blank', 'noopener,noreferrer')
  }

  const busqueda = searchParams.get('q')?.trim() || ''
  const sucursalFiltro = searchParams.get('sucursal') || 'todas'
  const puestoFiltro = searchParams.get('puesto') || 'todos'

  const sucursalesDisponibles = useMemo(
    () =>
      Array.from(
        new Set(
          empleados
            .map((empleado) => empleado.sucursal?.nombre?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b, 'es')),
    [empleados],
  )

  const puestosDisponibles = useMemo(
    () =>
      Array.from(
        new Set(
          empleados
            .map((empleado) => empleado.categoria?.nombre?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b, 'es')),
    [empleados],
  )

  const empleadosFiltrados = useMemo(() => {
    const term = busqueda.toLowerCase()

    return empleados.filter((empleado) => {
      const sucursalNombre = empleado.sucursal?.nombre?.trim() || 'Sin asignar'
      const puestoNombre = empleado.categoria?.nombre?.trim() || 'Sin asignar'

      if (sucursalFiltro !== 'todas' && sucursalNombre !== sucursalFiltro) {
        return false
      }

      if (puestoFiltro !== 'todos' && puestoNombre !== puestoFiltro) {
        return false
      }

      if (!term) {
        return true
      }

      const nombre = empleado.usuario?.nombre || empleado.nombre || ''
      const apellido = empleado.usuario?.apellido || empleado.apellido || ''
      const email = empleado.usuario?.email || ''
      const legajo = empleado.legajo || ''

      const searchable = [nombre, apellido, `${nombre} ${apellido}`.trim(), email, legajo, sucursalNombre, puestoNombre]
        .join(' ')
        .toLowerCase()

      return searchable.includes(term)
    })
  }, [busqueda, empleados, puestoFiltro, sucursalFiltro])

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-32 bg-muted rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-muted rounded-2xl" />)}
        </div>
        <div className="h-96 bg-muted rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header Estandarizado */}
      <PageHeader
        title="Empleados"
        description="Gestión completa del personal de la empresa"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={handleVerDescansosMesActual} className="md:h-10">
              <FileText className="w-4 h-4 mr-2" />
              Ver descansos
            </Button>

            <Button asChild className="bg-primary hover:bg-primary/90 shadow-sm md:h-10 md:px-6 w-fit">
              <Link href="/rrhh/empleados/nuevo">
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Empleado
              </Link>
            </Button>
          </div>
        }
      />

      {/* Estadísticas Rápidas con StatCard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Empleados"
          value={empleados.length}
          subtitle="Registrados"
          icon={Users}
          variant="primary"
        />

        <StatCard
          title="Activos"
          value={empleados.filter(e => e.activo).length}
          subtitle="En plantilla"
          icon={UserCheck}
          variant="success"
        />

        <StatCard
          title="Promedio Salario"
          value={`$${empleados.length > 0
            ? Math.round(empleados.reduce((sum, emp) => sum + (emp.sueldo_actual || 0), 0) / empleados.length).toLocaleString()
            : '0'
            }`}
          subtitle="ARS mensual"
          icon={TrendingUp}
          variant="info"
        />

        <StatCard
          title="Sucursales"
          value={new Set(empleados.map(e => e.sucursal_id).filter(Boolean)).size}
          subtitle="Con personal"
          icon={Building2}
          variant="warning"
        />
      </div>

      {/* Tabla de empleados envuelta en Card Estandarizada */}
      <Card className="overflow-hidden border-border/60">
        <CardContent className="p-6 space-y-4">
          <EmpleadosFilterBar
            busqueda={busqueda}
            sucursal={sucursalFiltro}
            puesto={puestoFiltro}
            sucursales={sucursalesDisponibles}
            puestos={puestosDisponibles}
          />

          <EmpleadosTable
            empleados={empleadosFiltrados}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onCall={handleCall}
            onEmail={handleEmail}
          />
        </CardContent>
      </Card>

      {/* Dialog de confirmación para eliminar */}
      <AlertDialog open={!!empleadoToDelete} onOpenChange={(open) => !open && setEmpleadoToDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Esta acción no se puede deshacer. Se eliminará permanentemente el empleado{' '}
              <strong className="text-foreground">
                {empleadoToDelete?.usuario?.nombre} {empleadoToDelete?.usuario?.apellido}
              </strong>
              {empleadoToDelete?.legajo && ` (Legajo: ${empleadoToDelete.legajo})`}.
              {empleadoToDelete && (
                <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <span className="text-amber-700 text-sm font-semibold">
                    ⚠️ Nota: Solo se puede eliminar si no tiene registros de asistencia o adelantos.
                  </span>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel disabled={isDeleting} className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90 rounded-xl px-6"
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
