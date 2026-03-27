type SupabaseLike = any

type PrepararLiquidacionArgs = {
  empleadoId: string
  mes: number
  anio: number
  createdBy: string | null
}

type RecalcularLiquidacionArgs = {
  liquidacionId: string
  actorId: string | null
}

type SundayJornadaRow = {
  id: string
  fecha: string
  origen: string
  horas_mensuales: number | null
  horas_adicionales: number | null
  turno_especial_unidades: number | null
  tarifa_hora_base: number | null
  tarifa_hora_extra: number | null
  monto_mensual: number | null
  monto_extra: number | null
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function isSunday(fecha?: string | null) {
  const iso = String(fecha || '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && new Date(`${iso}T00:00:00`).getDay() === 0
}

function isManualizableOrigen(origen?: string | null) {
  const value = String(origen || '').trim().toLowerCase()
  return value === 'manual' || value === 'auto_hik' || value === 'auto_asistencia'
}

export async function normalizarDomingosSucursalLiquidacion(
  db: SupabaseLike,
  liquidacionId: string,
): Promise<{ success: boolean; adjustedRows: number; error?: string }> {
  const { data: liquidacion, error: liquidacionError } = await db
    .from('rrhh_liquidaciones')
    .select(
      'id, empleado_id, grupo_base_snapshot, valor_jornal, total_sin_descuentos, total_bruto, total_neto, control_30_anticipos, turnos_trabajados',
    )
    .eq('id', liquidacionId)
    .maybeSingle()

  if (liquidacionError || !liquidacion?.id) {
    return {
      success: false,
      adjustedRows: 0,
      error: liquidacionError?.message || 'No se pudo leer la liquidacion',
    }
  }

  if (liquidacion.grupo_base_snapshot !== 'sucursales') {
    return { success: true, adjustedRows: 0 }
  }

  const valorJornal = Number(liquidacion.valor_jornal || 0)
  if (valorJornal <= 0) {
    return { success: true, adjustedRows: 0 }
  }

  const { data: jornadas, error: jornadasError } = await db
    .from('rrhh_liquidacion_jornadas')
    .select(
      'id, fecha, origen, horas_mensuales, horas_adicionales, turno_especial_unidades, tarifa_hora_base, tarifa_hora_extra, monto_mensual, monto_extra',
    )
    .eq('liquidacion_id', liquidacionId)

  if (jornadasError) {
    return {
      success: false,
      adjustedRows: 0,
      error: jornadasError.message,
    }
  }

  const sundayRows = ((jornadas || []) as SundayJornadaRow[]).filter(
    (row) => isSunday(row.fecha) && isManualizableOrigen(row.origen),
  )

  if (sundayRows.length === 0) {
    return { success: true, adjustedRows: 0 }
  }

  const sundayDates = Array.from(new Set(sundayRows.map((row) => String(row.fecha).slice(0, 10))))
  const { data: asistenciaRows, error: asistenciaError } = await db
    .from('rrhh_asistencia')
    .select('fecha, horas_trabajadas')
    .eq('empleado_id', liquidacion.empleado_id)
    .in('fecha', sundayDates)

  if (asistenciaError) {
    return {
      success: false,
      adjustedRows: 0,
      error: asistenciaError.message,
    }
  }

  const asistenciaMap = new Map<string, number>(
    (asistenciaRows || []).map((row: { fecha: string; horas_trabajadas: number | null }) => [
      String(row.fecha).slice(0, 10),
      Number(row.horas_trabajadas || 0),
    ]),
  )

  const tarifaDomingo = round2(valorJornal / 4)
  let adjustedRows = 0
  let deltaMontoMensual = 0

  for (const row of sundayRows) {
    const fecha = String(row.fecha).slice(0, 10)
    const horasAsistencia = Number(asistenciaMap.get(fecha) || 0)
    const horasRegistradas =
      Number(row.horas_mensuales || 0) + Number(row.horas_adicionales || 0) + Number(row.turno_especial_unidades || 0)

    if (horasAsistencia <= 0 && horasRegistradas <= 0) {
      continue
    }

    const horasMensuales = 4
    const horasAdicionales = round2(Math.max(horasAsistencia - 4, 0))
    const montoMensual = round2(valorJornal)
    const montoMensualActual = round2(Number(row.monto_mensual || 0))
    const requiereCambio =
      round2(Number(row.horas_mensuales || 0)) !== horasMensuales ||
      round2(Number(row.tarifa_hora_base || 0)) !== tarifaDomingo ||
      montoMensualActual !== montoMensual ||
      round2(Number(row.horas_adicionales || 0)) !== horasAdicionales

    if (!requiereCambio) {
      continue
    }

    const { error: updateError } = await db
      .from('rrhh_liquidacion_jornadas')
      .update({
        horas_mensuales: horasMensuales,
        horas_adicionales: horasAdicionales,
        tarifa_hora_base: tarifaDomingo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)

    if (updateError) {
      return {
        success: false,
        adjustedRows,
        error: updateError.message,
      }
    }

    deltaMontoMensual += montoMensual - montoMensualActual
    adjustedRows += 1
  }

  if (adjustedRows === 0) {
    return { success: true, adjustedRows: 0 }
  }

  const { data: aggregateRows, error: aggregateError } = await db
    .from('rrhh_liquidacion_jornadas')
    .select('fecha, horas_mensuales, horas_adicionales, turno_especial_unidades')
    .eq('liquidacion_id', liquidacionId)

  if (aggregateError) {
    return {
      success: false,
      adjustedRows,
      error: aggregateError.message,
    }
  }

  const horasMensualesTotal = round2(
    (aggregateRows || []).reduce((acc: number, row: any) => acc + Number(row.horas_mensuales || 0), 0),
  )
  const horasAdicionalesTotal = round2(
    (aggregateRows || []).reduce((acc: number, row: any) => acc + Number(row.horas_adicionales || 0), 0),
  )
  const diasTrabajados = new Set(
    (aggregateRows || [])
      .filter(
        (row: any) =>
          Number(row.horas_mensuales || 0) > 0 ||
          Number(row.horas_adicionales || 0) > 0 ||
          Number(row.turno_especial_unidades || 0) > 0,
      )
      .map((row: any) => String(row.fecha).slice(0, 10)),
  ).size

  const totalSinDescuentos = round2(Number(liquidacion.total_sin_descuentos || 0) + deltaMontoMensual)
  const totalBruto = round2(Number(liquidacion.total_bruto || 0) + deltaMontoMensual)
  const totalNeto = round2(Number(liquidacion.total_neto || 0) + deltaMontoMensual)
  const control30Limite = round2(totalSinDescuentos * 0.3)
  const control30Anticipos = round2(Number(liquidacion.control_30_anticipos || 0))
  const totalPorDia = diasTrabajados > 0 ? round2(totalNeto / diasTrabajados) : 0

  const { error: liquidacionUpdateError } = await db
    .from('rrhh_liquidaciones')
    .update({
      horas_trabajadas: round2(horasMensualesTotal + horasAdicionalesTotal),
      horas_extras: horasAdicionalesTotal,
      total_sin_descuentos: totalSinDescuentos,
      total_bruto: totalBruto,
      total_neto: totalNeto,
      total_por_dia: totalPorDia,
      control_30_limite: control30Limite,
      control_30_superado: control30Anticipos > control30Limite,
      updated_at: new Date().toISOString(),
    })
    .eq('id', liquidacionId)

  if (liquidacionUpdateError) {
    return {
      success: false,
      adjustedRows,
      error: liquidacionUpdateError.message,
    }
  }

  return { success: true, adjustedRows }
}

export async function prepararLiquidacionMensualConDomingoSucursal(
  db: SupabaseLike,
  args: PrepararLiquidacionArgs,
) {
  let { data, error } = await db.rpc('fn_rrhh_preparar_liquidacion_mensual', {
    p_empleado_id: args.empleadoId,
    p_mes: args.mes,
    p_anio: args.anio,
    p_created_by: args.createdBy,
  })

  if (error && String(error.message || '').toLowerCase().includes('fn_rrhh_preparar_liquidacion_mensual')) {
    const legacyResult = await db.rpc('fn_calcular_liquidacion_mensual', {
      p_empleado_id: args.empleadoId,
      p_mes: args.mes,
      p_anio: args.anio,
      p_created_by: args.createdBy,
    })
    data = legacyResult.data
    error = legacyResult.error
  }

  if (!error && data) {
    const normalizeResult = await normalizarDomingosSucursalLiquidacion(db, String(data))
    if (!normalizeResult.success) {
      return {
        data,
        error: {
          message: normalizeResult.error || 'No se pudo normalizar domingo sucursal',
        },
      }
    }
  }

  return { data, error }
}

export async function recalcularLiquidacionConDomingoSucursal(
  db: SupabaseLike,
  args: RecalcularLiquidacionArgs,
) {
  const result = await db.rpc('fn_rrhh_recalcular_liquidacion', {
    p_liquidacion_id: args.liquidacionId,
    p_actor: args.actorId,
  })

  if (!result.error) {
    const normalizeResult = await normalizarDomingosSucursalLiquidacion(db, args.liquidacionId)
    if (!normalizeResult.success) {
      return {
        data: result.data,
        error: {
          message: normalizeResult.error || 'No se pudo normalizar domingo sucursal',
        },
      }
    }
  }

  return result
}
