import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

async function getDbForCurrentUser() {
  const supabase = await createClient()
  const adminSupabase = createAdminClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { db: supabase }
  }

  const { data: userRow } = await adminSupabase
    .from('usuarios')
    .select('rol, activo')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = !!userRow?.activo && userRow.rol === 'admin'

  return { db: isAdmin ? adminSupabase : supabase }
}

export async function GET(request: NextRequest) {
  try {
    const { db: supabase } = await getDbForCurrentUser()
    const { searchParams } = new URL(request.url)

    const tipo = searchParams.get('tipo') as 'empleados' | 'liquidaciones' | 'adelantos' | 'evaluaciones' | 'asistencia' | 'licencias'
    const formato = searchParams.get('formato') as 'excel' | 'pdf'

    if (!tipo) {
      return NextResponse.json({ error: 'Tipo de reporte requerido' }, { status: 400 })
    }

    let data: any[] = []
    const filename = `reporte_${tipo}_${new Date().toISOString().split('T')[0]}`

    // Construir consulta según el tipo de reporte
    switch (tipo) {
      case 'empleados':
        const { data: empleadosData, error: empleadosError } = await supabase
          .from('rrhh_empleados')
          .select(`
            *,
            usuario:usuarios(nombre, apellido, email),
            sucursal:sucursales(nombre),
            categoria:rrhh_categorias(nombre, sueldo_basico)
          `)
          .eq('activo', true)
          .order('created_at')

        if (empleadosError) throw empleadosError
        data = empleadosData || []
        break

      case 'liquidaciones':
        const mes = searchParams.get('mes')
        const anio = searchParams.get('anio')

        let query = supabase
          .from('rrhh_liquidaciones')
          .select(`
            *,
            empleado:rrhh_empleados(
              id,
              legajo,
              usuario:usuarios(nombre, apellido)
            )
          `)

        if (mes && anio) {
          query = query.eq('periodo_mes', parseInt(mes)).eq('periodo_anio', parseInt(anio))
        }

        const { data: liquidacionesData, error: liquidacionesError } = await query.order('fecha_liquidacion', { ascending: false })

        if (liquidacionesError) throw liquidacionesError
        data = liquidacionesData || []
        break

      case 'adelantos':
        const fechaDesde = searchParams.get('fecha_desde')
        const fechaHasta = searchParams.get('fecha_hasta')

        let adelantosQuery = supabase
          .from('rrhh_adelantos')
          .select(`
            *,
            empleado:rrhh_empleados(
              id,
              legajo,
              usuario:usuarios(nombre, apellido)
            ),
            producto:productos(codigo, nombre)
          `)

        if (fechaDesde) {
          adelantosQuery = adelantosQuery.gte('fecha_solicitud', fechaDesde)
        }
        if (fechaHasta) {
          adelantosQuery = adelantosQuery.lte('fecha_solicitud', fechaHasta)
        }

        const { data: adelantosData, error: adelantosError } = await adelantosQuery.order('fecha_solicitud', { ascending: false })

        if (adelantosError) throw adelantosError
        data = adelantosData || []
        break

      case 'evaluaciones':
        const evalMes = searchParams.get('mes')
        const evalAnio = searchParams.get('anio')

        let evalQuery = supabase
          .from('rrhh_evaluaciones')
          .select(`
            *,
            empleado:rrhh_empleados(
              id,
              legajo,
              usuario:usuarios(nombre, apellido)
            ),
            sucursal:sucursales(nombre),
            evaluador:usuarios(nombre, apellido)
          `)

        if (evalMes && evalAnio) {
          evalQuery = evalQuery.eq('periodo_mes', parseInt(evalMes)).eq('periodo_anio', parseInt(evalAnio))
        }

        const { data: evaluacionesData, error: evaluacionesError } = await evalQuery.order('fecha_evaluacion', { ascending: false })

        if (evaluacionesError) throw evaluacionesError
        data = evaluacionesData || []
        break

      case 'asistencia':
        const asistFechaDesde = searchParams.get('fecha_desde')
        const asistFechaHasta = searchParams.get('fecha_hasta')

        let asistQuery = supabase
          .from('rrhh_asistencia')
          .select(`
            *,
            empleado:rrhh_empleados(
              id,
              legajo,
              usuario:usuarios(nombre, apellido)
            )
          `)

        if (asistFechaDesde) {
          asistQuery = asistQuery.gte('fecha', asistFechaDesde)
        }
        if (asistFechaHasta) {
          asistQuery = asistQuery.lte('fecha', asistFechaHasta)
        }

        const { data: asistenciaData, error: asistenciaError } = await asistQuery.order('fecha', { ascending: false })

        if (asistenciaError) throw asistenciaError
        data = asistenciaData || []
        break

      case 'licencias':
        const licFechaDesde = searchParams.get('fecha_desde')
        const licFechaHasta = searchParams.get('fecha_hasta')

        let licQuery = supabase
          .from('rrhh_licencias')
          .select(`
            *,
            empleado:rrhh_empleados(
              id,
              legajo,
              usuario:usuarios(nombre, apellido)
            ),
            aprobado_por:usuarios!rrhh_licencias_aprobado_por_fkey(nombre, apellido)
          `)

        if (licFechaDesde) {
          licQuery = licQuery.gte('fecha_inicio', licFechaDesde)
        }
        if (licFechaHasta) {
          licQuery = licQuery.lte('fecha_fin', licFechaHasta)
        }

        const { data: licenciasData, error: licenciasError } = await licQuery.order('fecha_inicio', { ascending: false })

        if (licenciasError) throw licenciasError
        data = licenciasData || []
        break

      default:
        return NextResponse.json({ error: 'Tipo de reporte no válido' }, { status: 400 })
    }

    // Generar CSV simple para todos los reportes
    if (formato === 'excel' || !formato) {
      const csvContent = generateCSV(data, tipo)
      const response = new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename=${filename}.csv`,
        },
      })
      return response
    }

    // Para PDF, devolver JSON por ahora (se puede implementar luego con pdfkit)
    return NextResponse.json({
      success: true,
      data,
      message: 'Datos del reporte obtenidos correctamente. PDF próximamente disponible.'
    })

  } catch (error) {
    console.error('Error generando reporte:', error)
    return NextResponse.json({
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}

function generateCSV(data: any[], tipo: string): string {
  if (data.length === 0) {
    return 'No hay datos para mostrar'
  }

  const headers: { [key: string]: string } = {
    empleados: 'Legajo,Nombre,Apellido,Email,Sucursal,Categoria,Sueldo Actual,Fecha Ingreso,Activo',
    liquidaciones: 'Empleado,Período,Sueldo Básico,Adicional Cajero,Total Bruto,Descuentos,Adelantos,Total Neto,Estado',
    adelantos: 'Empleado,Tipo,Monto,Producto,Cantidad,Fecha Solicitud,Aprobado,Fecha Aprobación',
    evaluaciones: 'Empleado,Sucursal,Período,Puntualidad,Rendimiento,Actitud,Responsabilidad,Trabajo Equipo,Promedio,Estado',
    asistencia: 'Empleado,Fecha,Hora Entrada,Hora Salida,Horas Trabajadas,Turno,Estado,Retraso Minutos,Falta Sin Aviso',
    licencias: 'Empleado,Tipo,Fecha Inicio,Fecha Fin,Días Total,Aprobado,Estado'
  }

  const header = headers[tipo] || 'Datos'
  let csv = header + '\n'

  data.forEach(row => {
    const values: string[] = []

    switch (tipo) {
      case 'empleados':
        values.push(
          row.legajo || '',
          row.usuario?.nombre || '',
          row.usuario?.apellido || '',
          row.usuario?.email || '',
          row.sucursal?.nombre || '',
          row.categoria?.nombre || '',
          row.sueldo_actual?.toString() || '',
          row.fecha_ingreso || '',
          row.activo ? 'Sí' : 'No'
        )
        break

      case 'liquidaciones':
        values.push(
          `${row.empleado?.usuario?.nombre} ${row.empleado?.usuario?.apellido}`.trim() || '',
          `${row.periodo_mes}/${row.periodo_anio}`,
          row.sueldo_basico?.toString() || '',
          row.adicional_cajero?.toString() || '',
          row.total_bruto?.toString() || '',
          row.descuentos_total?.toString() || '',
          row.adelantos_total?.toString() || '',
          row.total_neto?.toString() || '',
          row.estado || ''
        )
        break

      case 'adelantos':
        values.push(
          `${row.empleado?.usuario?.nombre} ${row.empleado?.usuario?.apellido}`.trim() || '',
          row.tipo || '',
          row.monto?.toString() || '',
          row.producto?.nombre || '',
          row.cantidad?.toString() || '',
          row.fecha_solicitud || '',
          row.aprobado ? 'Sí' : 'No',
          row.fecha_aprobacion || ''
        )
        break

      case 'evaluaciones':
        values.push(
          `${row.empleado?.usuario?.nombre} ${row.empleado?.usuario?.apellido}`.trim() || '',
          row.sucursal?.nombre || '',
          `${row.periodo_mes}/${row.periodo_anio}`,
          row.puntualidad?.toString() || '',
          row.rendimiento?.toString() || '',
          row.actitud?.toString() || '',
          row.responsabilidad?.toString() || '',
          row.trabajo_equipo?.toString() || '',
          row.promedio?.toString() || '',
          row.estado || ''
        )
        break

      case 'asistencia':
        values.push(
          `${row.empleado?.usuario?.nombre} ${row.empleado?.usuario?.apellido}`.trim() || '',
          row.fecha || '',
          row.hora_entrada || '',
          row.hora_salida || '',
          row.horas_trabajadas?.toString() || '',
          row.turno || '',
          row.estado || '',
          row.retraso_minutos?.toString() || '',
          row.falta_sin_aviso ? 'Sí' : 'No'
        )
        break

      case 'licencias':
        values.push(
          `${row.empleado?.usuario?.nombre} ${row.empleado?.usuario?.apellido}`.trim() || '',
          row.tipo || '',
          row.fecha_inicio || '',
          row.fecha_fin || '',
          row.dias_total?.toString() || '',
          row.aprobado ? 'Sí' : 'No',
          row.aprobado ? 'Aprobada' : 'Pendiente'
        )
        break

      default:
        values.push(JSON.stringify(row))
    }

    csv += values.map(v => `"${v}"`).join(',') + '\n'
  })

  return csv
}
