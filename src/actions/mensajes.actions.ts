'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Schemas de validación
const enviarMensajeSchema = z.object({
    destinatario_id: z.string().uuid('ID de destinatario inválido'),
    asunto: z.string().min(1, 'El asunto es requerido').max(255, 'Asunto muy largo'),
    contenido: z.string().min(1, 'El contenido es requerido'),
})

const marcarLeidoSchema = z.object({
    mensaje_id: z.string().uuid('ID de mensaje inválido'),
})

// Tipos
export interface MensajeInterno {
    id: string
    remitente_id: string
    destinatario_id: string
    asunto: string
    contenido: string
    leido: boolean
    archivado_remitente: boolean
    archivado_destinatario: boolean
    eliminado_remitente: boolean
    eliminado_destinatario: boolean
    fecha_lectura: string | null
    created_at: string
    updated_at: string
    remitente?: {
        id: string
        nombre: string
        apellido: string
        email: string
    }
    destinatario?: {
        id: string
        nombre: string
        apellido: string
        email: string
    }
}

// Obtener bandeja de entrada
export async function obtenerBandejaEntradaAction() {
    const supabase = await createClient()

    const { data: user } = await supabase.auth.getUser()
    if (!user.user) {
        return { success: false, error: 'No autenticado' }
    }

    const { data, error } = await supabase
        .from('mensajes_internos')
        .select(`
      *,
      remitente:usuarios!mensajes_internos_remitente_id_fkey(id, nombre, apellido, email)
    `)
        .eq('destinatario_id', user.user.id)
        .eq('eliminado_destinatario', false)
        .eq('archivado_destinatario', false)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error al obtener bandeja de entrada:', error)
        return { success: false, error: error.message }
    }

    return { success: true, data: data as MensajeInterno[] }
}

// Obtener mensajes enviados
export async function obtenerMensajesEnviadosAction() {
    const supabase = await createClient()

    const { data: user } = await supabase.auth.getUser()
    if (!user.user) {
        return { success: false, error: 'No autenticado' }
    }

    const { data, error } = await supabase
        .from('mensajes_internos')
        .select(`
      *,
      destinatario:usuarios!mensajes_internos_destinatario_id_fkey(id, nombre, apellido, email)
    `)
        .eq('remitente_id', user.user.id)
        .eq('eliminado_remitente', false)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error al obtener mensajes enviados:', error)
        return { success: false, error: error.message }
    }

    return { success: true, data: data as MensajeInterno[] }
}

// Obtener mensaje por ID
export async function obtenerMensajeAction(mensajeId: string) {
    const supabase = await createClient()

    const { data: user } = await supabase.auth.getUser()
    if (!user.user) {
        return { success: false, error: 'No autenticado' }
    }

    const { data, error } = await supabase
        .from('mensajes_internos')
        .select(`
      *,
      remitente:usuarios!mensajes_internos_remitente_id_fkey(id, nombre, apellido, email),
      destinatario:usuarios!mensajes_internos_destinatario_id_fkey(id, nombre, apellido, email)
    `)
        .eq('id', mensajeId)
        .single()

    if (error) {
        console.error('Error al obtener mensaje:', error)
        return { success: false, error: error.message }
    }

    // Verificar que el usuario tenga acceso al mensaje
    if (data.remitente_id !== user.user.id && data.destinatario_id !== user.user.id) {
        return { success: false, error: 'No tienes acceso a este mensaje' }
    }

    return { success: true, data: data as MensajeInterno }
}

// Enviar mensaje
export async function enviarMensajeAction(formData: FormData) {
    const supabase = await createClient()

    const { data: user } = await supabase.auth.getUser()
    if (!user.user) {
        return { success: false, error: 'No autenticado' }
    }

    const rawData = {
        destinatario_id: formData.get('destinatario_id') as string,
        asunto: formData.get('asunto') as string,
        contenido: formData.get('contenido') as string,
    }

    const validation = enviarMensajeSchema.safeParse(rawData)
    if (!validation.success) {
        return { success: false, error: validation.error.issues[0].message }
    }

    const { destinatario_id, asunto, contenido } = validation.data

    // Verificar que el destinatario existe
    const { data: destinatario } = await supabase
        .from('usuarios')
        .select('id')
        .eq('id', destinatario_id)
        .single()

    if (!destinatario) {
        return { success: false, error: 'Destinatario no encontrado' }
    }

    const { data, error } = await supabase
        .from('mensajes_internos')
        .insert({
            remitente_id: user.user.id,
            destinatario_id,
            asunto,
            contenido,
        })
        .select()
        .single()

    if (error) {
        console.error('Error al enviar mensaje:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/rrhh/mensajes')
    return { success: true, data }
}

// Marcar como leído
export async function marcarComoLeidoAction(mensajeId: string) {
    const supabase = await createClient()

    const { data: user } = await supabase.auth.getUser()
    if (!user.user) {
        return { success: false, error: 'No autenticado' }
    }

    const { error } = await supabase
        .from('mensajes_internos')
        .update({
            leido: true,
            fecha_lectura: new Date().toISOString()
        })
        .eq('id', mensajeId)
        .eq('destinatario_id', user.user.id)

    if (error) {
        console.error('Error al marcar como leído:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/rrhh/mensajes')
    return { success: true }
}

// Archivar mensaje
export async function archivarMensajeAction(mensajeId: string, esRemitente: boolean) {
    const supabase = await createClient()

    const { data: user } = await supabase.auth.getUser()
    if (!user.user) {
        return { success: false, error: 'No autenticado' }
    }

    const updateData = esRemitente
        ? { archivado_remitente: true }
        : { archivado_destinatario: true }

    const { error } = await supabase
        .from('mensajes_internos')
        .update(updateData)
        .eq('id', mensajeId)

    if (error) {
        console.error('Error al archivar mensaje:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/rrhh/mensajes')
    return { success: true }
}

// Eliminar mensaje (soft delete)
export async function eliminarMensajeAction(mensajeId: string, esRemitente: boolean) {
    const supabase = await createClient()

    const { data: user } = await supabase.auth.getUser()
    if (!user.user) {
        return { success: false, error: 'No autenticado' }
    }

    const updateData = esRemitente
        ? { eliminado_remitente: true }
        : { eliminado_destinatario: true }

    const { error } = await supabase
        .from('mensajes_internos')
        .update(updateData)
        .eq('id', mensajeId)

    if (error) {
        console.error('Error al eliminar mensaje:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/rrhh/mensajes')
    return { success: true }
}

// Contar mensajes no leídos
export async function contarNoLeidosAction() {
    const supabase = await createClient()

    const { data: user } = await supabase.auth.getUser()
    if (!user.user) {
        return { success: false, error: 'No autenticado', count: 0 }
    }

    const { count, error } = await supabase
        .from('mensajes_internos')
        .select('*', { count: 'exact', head: true })
        .eq('destinatario_id', user.user.id)
        .eq('leido', false)
        .eq('eliminado_destinatario', false)

    if (error) {
        console.error('Error al contar no leídos:', error)
        return { success: false, error: error.message, count: 0 }
    }

    return { success: true, count: count || 0 }
}

// Obtener lista de usuarios para enviar mensajes
export async function obtenerUsuariosDestinatariosAction() {
    const supabase = await createClient()

    const { data: user } = await supabase.auth.getUser()
    if (!user.user) {
        return { success: false, error: 'No autenticado' }
    }

    const { data, error } = await supabase
        .from('usuarios')
        .select('id, nombre, apellido, email, rol')
        .neq('id', user.user.id)
        .eq('activo', true)
        .order('nombre')

    if (error) {
        console.error('Error al obtener usuarios:', error)
        return { success: false, error: error.message }
    }

    return { success: true, data }
}
