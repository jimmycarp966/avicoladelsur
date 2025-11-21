'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'

const planRutaSchema = z.object({
  zonaId: z.string().uuid('Zona inválida'),
  diaSemana: z.coerce.number().int().min(0).max(6),
  turno: z.enum(['mañana', 'tarde']),
  repartidorId: z.string().uuid().optional().nullable(),
})

export async function crearPlanRutaAction(formData: FormData) {
  const parseResult = planRutaSchema.safeParse({
    zonaId: formData.get('zonaId'),
    diaSemana: formData.get('diaSemana'),
    turno: formData.get('turno'),
    repartidorId: formData.get('repartidorId') || null,
  })

  if (!parseResult.success) {
    return { success: false, message: parseResult.error.issues[0]?.message || 'Datos inválidos' }
  }

  const data = parseResult.data

  const supabase = await createClient()

  const { error } = await supabase.from('plan_rutas_semanal').insert({
    zona_id: data.zonaId,
    dia_semana: data.diaSemana,
    turno: data.turno,
    repartidor_id: data.repartidorId || null,
  })

  if (error) {
    if (error.code === '23505') {
      return { success: false, message: 'Ya existe un plan para esa zona, día y turno' }
    }
    console.error('crearPlanRutaAction error:', error)
    return { success: false, message: 'No se pudo crear el plan de ruta' }
  }

  revalidatePath('/(admin)/(dominios)/reparto/planificacion')
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
  return { success: true }
}

