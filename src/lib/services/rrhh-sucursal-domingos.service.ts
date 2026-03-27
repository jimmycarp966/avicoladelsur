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
  tarea: string | null
  origen: string
  horas_mensuales: number | null
  horas_adicionales: number | null
  turno_especial_unidades: number | null
  tarifa_hora_base: number | null
  tarifa_hora_extra: number | null
  monto_mensual: number | null
  monto_extra: number | null
}

type LiquidacionBaseRow = {
  id: string
  empleado_id: string
  grupo_base_snapshot: string | null
  puesto_override: string | null
  periodo_mes: number | null
  periodo_anio: number | null
  sueldo_basico: number | null
  horas_jornada: number | null
  valor_jornal: number | null
  total_sin_descuentos: number | null
  total_bruto: number | null
  total_neto: number | null
  control_30_anticipos: number | null
}

type ReglaPeriodoRow = {
  dias_base_galpon: number | null
  dias_base_sucursales: number | null
  dias_base_rrhh: number | null
  dias_base_lun_sab: number | null
}

type PuestoConfigRow = {
  puesto_codigo: string
  grupo_base_dias: string | null
  horas_jornada: number | null
  tipo_calculo: string | null
}

type TramoPuestoRow = {
  fecha_desde: string
  fecha_hasta: string
  puesto_codigo: string
}

type ReglaBaseResuelta = {
  grupoBaseDias: string
  horasJornada: number
  tipoCalculo: 'hora' | 'turno'
  valorHoraBase: number
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function isSunday(fecha?: string | null) {
  const iso = String(fecha || '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && new Date(`${iso}T00:00:00`).getDay() === 0
}

function normalizeCode(value?: string | null) {
  return String(value || '').trim().toLowerCase()
}

function isManualizableOrigen(origen?: string | null) {
  const value = String(origen || '').trim().toLowerCase()
  return value === 'manual' || value === 'auto_hik' || value === 'auto_asistencia'
}

function getDiasBaseForGrupo(
  grupoBaseDias: string,
  reglaPeriodo: ReglaPeriodoRow | null,
  diasEnMes: number,
) {
  switch (grupoBaseDias) {
    case 'sucursales':
      return diasEnMes
    case 'rrhh':
      return Number(reglaPeriodo?.dias_base_rrhh || 22)
    case 'lun_sab':
      return Number(reglaPeriodo?.dias_base_lun_sab || 26)
    case 'galpon':
    default:
      return Number(reglaPeriodo?.dias_base_galpon || 27)
  }
}

function resolveBaseRuleForDate(options: {
  fecha: string
  tarea?: string | null
  liquidacion: LiquidacionBaseRow
  reglaPeriodo: ReglaPeriodoRow | null
  defaultRule: Omit<ReglaBaseResuelta, 'valorHoraBase'>
  configMap: Map<string, PuestoConfigRow>
  tramos: TramoPuestoRow[]
}): ReglaBaseResuelta {
  const normalizedTask = normalizeCode(options.tarea)
  const tramo = options.tramos.find(
    (item) => options.fecha >= item.fecha_desde.slice(0, 10) && options.fecha <= item.fecha_hasta.slice(0, 10),
  )

  const config =
    (tramo?.puesto_codigo ? options.configMap.get(normalizeCode(tramo.puesto_codigo)) : undefined) ||
    (normalizedTask ? options.configMap.get(normalizedTask) : undefined)

  const grupoBaseDias = String(config?.grupo_base_dias || options.defaultRule.grupoBaseDias || 'galpon')
  const horasJornada = Math.max(Number(config?.horas_jornada || options.defaultRule.horasJornada || 9), 1)
  const tipoCalculo = String(config?.tipo_calculo || options.defaultRule.tipoCalculo || 'hora') === 'turno'
    ? 'turno'
    : 'hora'
  const diasEnMes = new Date(
    Number(options.liquidacion.periodo_anio || 0),
    Number(options.liquidacion.periodo_mes || 0),
    0,
  ).getDate()
  const diasBase = Math.max(getDiasBaseForGrupo(grupoBaseDias, options.reglaPeriodo, diasEnMes), 1)
  const sueldoBasico = Number(options.liquidacion.sueldo_basico || 0)
  const valorJornal = diasBase > 0 ? round2(sueldoBasico / diasBase) : 0
  const valorHoraBase = horasJornada > 0 ? round2(valorJornal / horasJornada) : 0

  return {
    grupoBaseDias,
    horasJornada,
    tipoCalculo,
    valorHoraBase,
  }
}

export async function normalizarDomingosSucursalLiquidacion(
  db: SupabaseLike,
  liquidacionId: string,
): Promise<{ success: boolean; adjustedRows: number; error?: string }> {
  const { data: liquidacion, error: liquidacionError } = await db
    .from('rrhh_liquidaciones')
    .select(
      'id, empleado_id, grupo_base_snapshot, puesto_override, periodo_mes, periodo_anio, sueldo_basico, horas_jornada, valor_jornal, total_sin_descuentos, total_bruto, total_neto, control_30_anticipos',
    )
    .eq('id', liquidacionId)
    .maybeSingle()

  const liquidacionBase = liquidacion as LiquidacionBaseRow | null

  if (liquidacionError || !liquidacionBase?.id) {
    return {
      success: false,
      adjustedRows: 0,
      error: liquidacionError?.message || 'No se pudo leer la liquidacion',
    }
  }

  const diasEnMes = new Date(
    Number(liquidacionBase.periodo_anio || 0),
    Number(liquidacionBase.periodo_mes || 0),
    0,
  ).getDate()
  if (diasEnMes <= 0) {
    return { success: true, adjustedRows: 0 }
  }

  const { data: reglaPeriodoData, error: reglaPeriodoError } = await db
    .from('rrhh_liquidacion_reglas_periodo')
    .select('dias_base_galpon, dias_base_sucursales, dias_base_rrhh, dias_base_lun_sab')
    .eq('periodo_mes', liquidacionBase.periodo_mes)
    .eq('periodo_anio', liquidacionBase.periodo_anio)
    .eq('activo', true)
    .maybeSingle()

  if (reglaPeriodoError) {
    return {
      success: false,
      adjustedRows: 0,
      error: reglaPeriodoError.message,
    }
  }

  const { data: empleadoData, error: empleadoError } = await db
    .from('rrhh_empleados')
    .select('categoria:rrhh_categorias(nombre)')
    .eq('id', liquidacionBase.empleado_id)
    .maybeSingle()

  if (empleadoError) {
    return {
      success: false,
      adjustedRows: 0,
      error: empleadoError.message,
    }
  }

  const { data: configRows, error: configError } = await db
    .from('rrhh_configuracion_puestos')
    .select('puesto_codigo, grupo_base_dias, horas_jornada, tipo_calculo')
    .eq('activo', true)

  if (configError) {
    return {
      success: false,
      adjustedRows: 0,
      error: configError.message,
    }
  }

  const configMap = new Map<string, PuestoConfigRow>(
    ((configRows || []) as PuestoConfigRow[]).map((row) => [normalizeCode(row.puesto_codigo), row]),
  )

  const defaultConfig =
    configMap.get(normalizeCode(liquidacionBase.puesto_override)) ||
    configMap.get(normalizeCode((empleadoData as { categoria?: { nombre?: string | null } | null } | null)?.categoria?.nombre))

  const defaultRuleBase: Omit<ReglaBaseResuelta, 'valorHoraBase'> = {
    grupoBaseDias: String(defaultConfig?.grupo_base_dias || liquidacionBase.grupo_base_snapshot || 'galpon'),
    horasJornada: Math.max(Number(defaultConfig?.horas_jornada || liquidacionBase.horas_jornada || 9), 1),
    tipoCalculo: String(defaultConfig?.tipo_calculo || 'hora') === 'turno' ? 'turno' : 'hora',
  }

  const { data: tramoRows, error: tramoError } = await db
    .from('rrhh_liquidacion_tramos_puesto')
    .select('fecha_desde, fecha_hasta, puesto_codigo')
    .eq('liquidacion_id', liquidacionId)
    .order('fecha_desde', { ascending: true })

  if (tramoError) {
    return {
      success: false,
      adjustedRows: 0,
      error: tramoError.message,
    }
  }

  const { data: jornadas, error: jornadasError } = await db
    .from('rrhh_liquidacion_jornadas')
    .select(
      'id, fecha, tarea, origen, horas_mensuales, horas_adicionales, turno_especial_unidades, tarifa_hora_base, tarifa_hora_extra, monto_mensual, monto_extra',
    )
    .eq('liquidacion_id', liquidacionId)

  if (jornadasError) {
    return {
      success: false,
      adjustedRows: 0,
      error: jornadasError.message,
    }
  }

  const fechasJornadas = Array.from(
    new Set(((jornadas || []) as SundayJornadaRow[]).map((row) => String(row.fecha).slice(0, 10)).filter(Boolean)),
  )

  const { data: feriadosRows, error: feriadosError } = await db
    .from('rrhh_feriados')
    .select('fecha')
    .in('fecha', fechasJornadas)
    .eq('activo', true)

  if (feriadosError) {
    return {
      success: false,
      adjustedRows: 0,
      error: feriadosError.message,
    }
  }

  const feriadosSet = new Set((feriadosRows || []).map((row: { fecha: string }) => String(row.fecha).slice(0, 10)))

  const specialRows = ((jornadas || []) as SundayJornadaRow[]).filter(
    (row) => (isSunday(row.fecha) || feriadosSet.has(String(row.fecha).slice(0, 10))) && isManualizableOrigen(row.origen),
  )

  if (specialRows.length === 0) {
    return { success: true, adjustedRows: 0 }
  }

  const sundayDates = Array.from(new Set(specialRows.map((row) => String(row.fecha).slice(0, 10))))
  const { data: asistenciaRows, error: asistenciaError } = await db
    .from('rrhh_asistencia')
    .select('fecha, horas_trabajadas')
    .eq('empleado_id', liquidacionBase.empleado_id)
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

  let adjustedRows = 0
  let deltaMontoMensual = 0

  for (const row of specialRows) {
    const fecha = String(row.fecha).slice(0, 10)
    const horasAsistencia = Number(asistenciaMap.get(fecha) || 0)
    const horasRegistradas =
      Number(row.horas_mensuales || 0) + Number(row.horas_adicionales || 0) + Number(row.turno_especial_unidades || 0)

    if (horasAsistencia <= 0 && horasRegistradas <= 0) {
      continue
    }

    const reglaBase = resolveBaseRuleForDate({
      fecha,
      tarea: row.tarea,
      liquidacion: liquidacionBase,
      reglaPeriodo: (reglaPeriodoData as ReglaPeriodoRow | null) || null,
      defaultRule: defaultRuleBase,
      configMap,
      tramos: (tramoRows || []) as TramoPuestoRow[],
    })

    if (reglaBase.tipoCalculo === 'turno' || reglaBase.valorHoraBase <= 0) {
      continue
    }

    const horasMensuales = reglaBase.horasJornada
    const horasAdicionales = round2(Math.max(horasAsistencia - 4, 0))
    const tarifaHoraBase = reglaBase.valorHoraBase
    const montoMensual = round2(horasMensuales * tarifaHoraBase)
    const montoMensualActual = round2(Number(row.monto_mensual || 0))
    const requiereCambio =
      round2(Number(row.horas_mensuales || 0)) !== horasMensuales ||
      round2(Number(row.tarifa_hora_base || 0)) !== tarifaHoraBase ||
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
        tarifa_hora_base: tarifaHoraBase,
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
