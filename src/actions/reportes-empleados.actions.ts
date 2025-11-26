'use server'

import { createClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@/types/api.types'
import { reporteFiltrosSchema } from '@/lib/schemas/reportes.schema'

interface ReporteFiltrosInput {
  fechaDesde: string
  fechaHasta: string
  sector?: string | null
}

/**
 * Obtiene KPIs de empleados
 */
export async function obtenerKpisEmpleados(
  filtros: ReporteFiltrosInput
): Promise<ApiResponse<any>> {
  try {
    const supabase = await createClient()

    const validated = reporteFiltrosSchema.parse({
      fechaDesde: filtros.fechaDesde,
      fechaHasta: filtros.fechaHasta,
    })

    // Obtener asistencia del período
    const { data: asistencia } = await supabase
      .from('rrhh_asistencia')
      .select(
        `
        id,
        fecha,
        horas_trabajadas,
        retraso_minutos,
        falta_sin_aviso,
        estado,
        empleado_id,
        rrhh_empleados!inner(
          id,
          sucursal_id,
          categoria_id,
          rrhh_categorias(nombre)
        )
      `
      )
      .gte('fecha', validated.fechaDesde)
      .lte('fecha', validated.fechaHasta)

    // Calcular KPIs
    const horasTotales = asistencia?.reduce((sum, a) => sum + Number(a.horas_trabajadas || 0), 0) || 0
    const llegadasTarde = asistencia?.filter((a) => (a.retraso_minutos || 0) > 0).length || 0
    const horasExtras = asistencia?.filter((a) => Number(a.horas_trabajadas || 0) > 8).length || 0

    // Agrupar por sector (categoría)
    const asistenciaPorSector: Record<string, { horas: number; empleados: Set<string> }> = {}
    asistencia?.forEach((a: any) => {
      const empleadoData = a.rrhh_empleados as any
      const categoriasData = empleadoData?.rrhh_categorias
      const sector = categoriasData
        ? (Array.isArray(categoriasData) 
            ? categoriasData[0]?.nombre 
            : categoriasData?.nombre)
        : 'Sin categoría'
      if (!asistenciaPorSector[sector]) {
        asistenciaPorSector[sector] = { horas: 0, empleados: new Set() }
      }
      asistenciaPorSector[sector].horas += Number(a.horas_trabajadas || 0)
      asistenciaPorSector[sector].empleados.add(a.empleado_id)
    })

    return {
      success: true,
      data: {
        horasTotales,
        llegadasTarde,
        horasExtras,
        totalAsistencias: asistencia?.length || 0,
        asistenciaPorSector: Object.entries(asistenciaPorSector).map(([sector, datos]) => ({
          sector,
          horas_totales: datos.horas,
          empleados_count: datos.empleados.size,
        })),
      },
    }
  } catch (error: any) {
    console.error('Error al obtener KPIs de empleados:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener KPIs de empleados',
    }
  }
}

/**
 * Obtiene eficiencia de repartidores
 */
export async function obtenerEficienciaRepartidores(
  filtros: ReporteFiltrosInput
): Promise<ApiResponse<any[]>> {
  try {
    const supabase = await createClient()

    const validated = reporteFiltrosSchema.parse({
      fechaDesde: filtros.fechaDesde,
      fechaHasta: filtros.fechaHasta,
    })

    // Obtener rutas completadas
    const { data: rutas } = await supabase
      .from('rutas_reparto')
      .select(
        `
        id,
        repartidor_id,
        tiempo_real_min,
        detalles_ruta(id, estado_entrega)
      `
      )
      .gte('fecha_ruta', validated.fechaDesde)
      .lte('fecha_ruta', validated.fechaHasta)
      .eq('estado', 'completada')

    // Obtener nombres de repartidores
    const repartidoresIds = Array.from(new Set(rutas?.map((r) => r.repartidor_id) || []))
    const { data: repartidores } = await supabase
      .from('usuarios')
      .select('id, nombre, apellido')
      .in('id', repartidoresIds)

    const repartidoresMap = new Map(
      repartidores?.map((r) => [r.id, `${r.nombre} ${r.apellido}`.trim()]) || []
    )

    // Calcular eficiencia
    const eficienciaPorRepartidor: Record<
      string,
      { entregas: number; horas: number; entregasPorHora: number }
    > = {}

    rutas?.forEach((ruta) => {
      const repartidorId = ruta.repartidor_id
      if (!eficienciaPorRepartidor[repartidorId]) {
        eficienciaPorRepartidor[repartidorId] = {
          entregas: 0,
          horas: 0,
          entregasPorHora: 0,
        }
      }
      eficienciaPorRepartidor[repartidorId].entregas +=
        ruta.detalles_ruta?.filter((d: any) => d.estado_entrega === 'entregado').length || 0
      eficienciaPorRepartidor[repartidorId].horas += (ruta.tiempo_real_min || 0) / 60
    })

    const resultado = Object.entries(eficienciaPorRepartidor).map(([id, datos]) => ({
      repartidor_id: id,
      repartidor_nombre: repartidoresMap.get(id) || 'Desconocido',
      entregas: datos.entregas,
      horas: datos.horas,
      entregasPorHora: datos.horas > 0 ? datos.entregas / datos.horas : 0,
    }))

    return {
      success: true,
      data: resultado.sort((a, b) => b.entregasPorHora - a.entregasPorHora),
    }
  } catch (error: any) {
    console.error('Error al obtener eficiencia de repartidores:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener eficiencia de repartidores',
    }
  }
}

