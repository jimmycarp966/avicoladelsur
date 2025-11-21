'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'

const planRutaSchema = z.object({
  zonaId: z.string().uuid('Zona inválida'),
  diaSemana: z.coerce.number().int().min(0).max(6),
  turno: z.enum(['mañana', 'tarde']),
  repartidorId: z.string().uuid().optional().nullable(),
  semanaInicio: z.string().optional(), // Formato: YYYY-MM-DD
})

// Función helper para calcular inicio de semana (lunes)
function calcularInicioSemana(fecha: Date): Date {
  const dia = fecha.getDay() // 0 = domingo, 1 = lunes, ..., 6 = sábado
  const diff = dia === 0 ? -6 : 1 - dia // Si es domingo, retroceder 6 días; si no, retroceder (dia - 1) días
  const lunes = new Date(fecha)
  lunes.setDate(fecha.getDate() + diff)
  lunes.setHours(0, 0, 0, 0)
  return lunes
}

export async function crearPlanRutaAction(formData: FormData) {
  const parseResult = planRutaSchema.safeParse({
    zonaId: formData.get('zonaId'),
    diaSemana: formData.get('diaSemana'),
    turno: formData.get('turno'),
    repartidorId: formData.get('repartidorId') || null,
    semanaInicio: formData.get('semanaInicio') || null,
  })

  if (!parseResult.success) {
    return { success: false, message: parseResult.error.issues[0]?.message || 'Datos inválidos' }
  }

  const data = parseResult.data
  const supabase = await createClient()

  // Calcular semana_inicio si no se proporciona
  let semanaInicio: Date
  if (data.semanaInicio) {
    semanaInicio = new Date(data.semanaInicio)
  } else {
    semanaInicio = calcularInicioSemana(new Date())
  }
  semanaInicio = calcularInicioSemana(semanaInicio) // Asegurar que sea lunes

  // Validar zona existe y está activa
  const { data: zona, error: zonaError } = await supabase
    .from('zonas')
    .select('id, activo')
    .eq('id', data.zonaId)
    .single()

  if (zonaError || !zona) {
    return { success: false, message: 'La zona especificada no existe' }
  }

  if (!zona.activo) {
    return { success: false, message: 'La zona especificada no está activa' }
  }

  // Validar repartidor si está asignado
  if (data.repartidorId) {
    const { data: repartidor, error: repartidorError } = await supabase
      .from('usuarios')
      .select('id, rol, activo')
      .eq('id', data.repartidorId)
      .single()

    if (repartidorError || !repartidor) {
      return { success: false, message: 'El repartidor especificado no existe' }
    }

    if (repartidor.rol !== 'repartidor') {
      return { success: false, message: 'El usuario especificado no es un repartidor' }
    }

    if (!repartidor.activo) {
      return { success: false, message: 'El repartidor especificado no está activo' }
    }

    // Validar conflictos de repartidor usando función RPC
    const { data: conflicto } = await supabase.rpc('fn_validar_plan_ruta', {
      p_zona_id: data.zonaId,
      p_dia_semana: data.diaSemana,
      p_turno: data.turno,
      p_semana_inicio: semanaInicio.toISOString().split('T')[0],
      p_repartidor_id: data.repartidorId,
      p_excluir_plan_id: null,
    })

    if (conflicto && !conflicto.success) {
      const errores = conflicto.errores || []
      if (errores.some((e: string) => e.includes('repartidor ya está asignado'))) {
        return { success: false, message: 'El repartidor ya está asignado a otra zona en el mismo día y turno' }
      }
    }
  }

  // Insertar plan
  const { error } = await supabase.from('plan_rutas_semanal').insert({
    zona_id: data.zonaId,
    dia_semana: data.diaSemana,
    turno: data.turno,
    repartidor_id: data.repartidorId || null,
    semana_inicio: semanaInicio.toISOString().split('T')[0],
  })

  if (error) {
    if (error.code === '23505') {
      return { success: false, message: 'Ya existe un plan para esa zona, día, turno y semana' }
    }
    console.error('crearPlanRutaAction error:', error)
    return { success: false, message: 'No se pudo crear el plan de ruta' }
  }

  revalidatePath('/(admin)/(dominios)/reparto/planificacion')
  revalidatePath('/(admin)/(dominios)/reparto/planificacion/semana')
  return { success: true }
}

export async function eliminarPlanRutaAction(planId: string) {
  if (!planId) {
    return { success: false, message: 'ID inválido' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('plan_rutas_semanal').delete().eq('id', planId)

  if (error) {
    console.error('eliminarPlanRutaAction error:', error)
    return { success: false, message: 'No se pudo eliminar el plan' }
  }

  revalidatePath('/(admin)/(dominios)/reparto/planificacion')
  revalidatePath('/(admin)/(dominios)/reparto/planificacion/semana')
  revalidatePath('/(admin)/(dominios)/reparto/planificacion/historial')
  return { success: true }
}

export async function crearPlanSemanaAction(formData: FormData) {
  const semanaInicioStr = formData.get('semanaInicio') as string
  if (!semanaInicioStr) {
    return { success: false, message: 'Fecha de inicio de semana requerida' }
  }

  const semanaInicio = calcularInicioSemana(new Date(semanaInicioStr))
  const supabase = await createClient()

  // Obtener todas las zonas activas
  const { data: zonas, error: zonasError } = await supabase
    .from('zonas')
    .select('id')
    .eq('activo', true)

  if (zonasError || !zonas || zonas.length === 0) {
    return { success: false, message: 'No hay zonas activas disponibles' }
  }

  const planesCreados: string[] = []
  const errores: string[] = []

  // Crear planes para cada zona, día y turno
  for (const zona of zonas) {
    for (let diaSemana = 0; diaSemana < 7; diaSemana++) {
      for (const turno of ['mañana', 'tarde'] as const) {
        const planFormData = new FormData()
        planFormData.set('zonaId', zona.id)
        planFormData.set('diaSemana', diaSemana.toString())
        planFormData.set('turno', turno)
        planFormData.set('semanaInicio', semanaInicio.toISOString().split('T')[0])

        const resultado = await crearPlanRutaAction(planFormData)
        if (resultado.success) {
          planesCreados.push(`${zona.id}-${diaSemana}-${turno}`)
        } else {
          errores.push(`${zona.id}-${diaSemana}-${turno}: ${resultado.message}`)
        }
      }
    }
  }

  return {
    success: errores.length === 0,
    message: `Creados ${planesCreados.length} planes. ${errores.length > 0 ? `Errores: ${errores.length}` : ''}`,
    planesCreados,
    errores,
  }
}

export async function validarSemanaCompletaAction(semanaInicio: string) {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('fn_validar_semana_completa', {
    p_semana_inicio: semanaInicio,
  })

  if (error) {
    console.error('validarSemanaCompletaAction error:', error)
    return { success: false, message: 'Error al validar la semana' }
  }

  return {
    success: data?.success || false,
    data,
  }
}

