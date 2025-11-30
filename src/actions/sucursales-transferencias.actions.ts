'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Schemas
const crearTransferenciaSchema = z.object({
    sucursal_origen_id: z.string().uuid(),
    sucursal_destino_id: z.string().uuid(),
    motivo: z.string().optional(),
    observaciones: z.string().optional(),
    items: z.array(z.object({
        producto_id: z.string().uuid(),
        cantidad: z.number().positive(),
    })),
})

// Crear transferencia
export async function crearTransferenciaAction(formData: FormData) {
    try {
        const supabase = await createClient()

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
            return { success: false, message: 'Usuario no autenticado' }
        }

        const rawData = Object.fromEntries(formData)
        const data = crearTransferenciaSchema.parse({
            sucursal_origen_id: rawData.sucursal_origen_id,
            sucursal_destino_id: rawData.sucursal_destino_id,
            motivo: rawData.motivo || undefined,
            observaciones: rawData.observaciones || undefined,
            items: JSON.parse(rawData.items as string),
        })

        const itemsJson = data.items.map(item => ({
            producto_id: item.producto_id,
            cantidad: item.cantidad,
        }))

        const { data: result, error } = await supabase.rpc('fn_crear_transferencia_stock', {
            p_sucursal_origen_id: data.sucursal_origen_id,
            p_sucursal_destino_id: data.sucursal_destino_id,
            p_items: itemsJson,
            p_motivo: data.motivo,
            p_observaciones: data.observaciones,
            p_user_id: user.id,
        })

        if (error) throw error
        if (!result.success) {
            return { success: false, message: result.error }
        }

        revalidatePath('/sucursales')
        revalidatePath('/sucursales/transferencias')

        return {
            success: true,
            message: `Transferencia ${result.numero_transferencia} creada exitosamente`,
            data: result,
        }
    } catch (error: any) {
        console.error('Error en crearTransferenciaAction:', error)
        return { success: false, message: error.message || 'Error al crear transferencia' }
    }
}

// Aprobar transferencia
export async function aprobarTransferenciaAction(transferenciaId: string) {
    try {
        const supabase = await createClient()

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
            return { success: false, message: 'Usuario no autenticado' }
        }

        const { data: result, error } = await supabase.rpc('fn_aprobar_transferencia', {
            p_transferencia_id: transferenciaId,
            p_user_id: user.id,
        })

        if (error) throw error
        if (!result.success) {
            return { success: false, message: result.error }
        }

        revalidatePath('/sucursales/transferencias')

        return {
            success: true,
            message: 'Transferencia aprobada y enviada',
        }
    } catch (error: any) {
        console.error('Error en aprobarTransferenciaAction:', error)
        return { success: false, message: error.message || 'Error al aprobar transferencia' }
    }
}

// Recibir transferencia
export async function recibirTransferenciaAction(transferenciaId: string) {
    try {
        const supabase = await createClient()

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
            return { success: false, message: 'Usuario no autenticado' }
        }

        const { data: result, error } = await supabase.rpc('fn_recibir_transferencia', {
            p_transferencia_id: transferenciaId,
            p_user_id: user.id,
        })

        if (error) throw error
        if (!result.success) {
            return { success: false, message: result.error }
        }

        revalidatePath('/sucursales/transferencias')

        return {
            success: true,
            message: 'Transferencia recibida exitosamente',
        }
    } catch (error: any) {
        console.error('Error en recibirTransferenciaAction:', error)
        return { success: false, message: error.message || 'Error al recibir transferencia' }
    }
}

// Listar sucursales
export async function listarSucursales() {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('sucursales')
            .select('*')
            .eq('active', true)
            .order('nombre')

        if (error) throw error
        return data || []
    } catch (error) {
        console.error('Error en listarSucursales:', error)
        return []
    }
}

// Obtener stock por sucursal
export async function obtenerStockPorSucursal(sucursalId: string) {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('lotes')
            .select(`
        id,
        cantidad_disponible,
        producto:productos(id, nombre, codigo, unidad_medida)
      `)
            .eq('sucursal_id', sucursalId)
            .eq('estado', 'disponible')
            .gt('cantidad_disponible', 0)

        if (error) throw error

        // Agrupar por producto
        const stockPorProducto = (data || []).reduce((acc: any, lote: any) => {
            const productoId = lote.producto.id
            if (!acc[productoId]) {
                acc[productoId] = {
                    producto: lote.producto,
                    cantidad_total: 0,
                    lotes: [],
                }
            }
            acc[productoId].cantidad_total += Number(lote.cantidad_disponible)
            acc[productoId].lotes.push(lote)
            return acc
        }, {})

        return Object.values(stockPorProducto)
    } catch (error) {
        console.error('Error en obtenerStockPorSucursal:', error)
        return []
    }
}

// Listar transferencias
export async function listarTransferencias(sucursalId?: string, estado?: string) {
    try {
        const supabase = await createClient()

        let query = supabase
            .from('transferencias_stock')
            .select(`
        *,
        sucursal_origen:sucursales!sucursal_origen_id(id, nombre),
        sucursal_destino:sucursales!sucursal_destino_id(id, nombre),
        items:transferencia_items(
          id,
          cantidad_solicitada,
          cantidad_enviada,
          cantidad_recibida,
          producto:productos(nombre, codigo)
        )
      `)
            .order('fecha_solicitud', { ascending: false })

        if (sucursalId) {
            query = query.or(`sucursal_origen_id.eq.${sucursalId},sucursal_destino_id.eq.${sucursalId}`)
        }

        if (estado) {
            query = query.eq('estado', estado)
        }

        const { data, error } = await query

        if (error) throw error
        return data || []
    } catch (error) {
        console.error('Error en listarTransferencias:', error)
        return []
    }
}

// Obtener transferencia por ID
export async function obtenerTransferenciaAction(id: string) {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('transferencias_stock')
            .select(`
        *,
        sucursal_origen:sucursales!sucursal_origen_id(id, nombre),
        sucursal_destino:sucursales!sucursal_destino_id(id, nombre),
        solicitado_por_user:usuarios!solicitado_por(nombre, apellido),
        aprobado_por_user:usuarios!aprobado_por(nombre, apellido),
        recibido_por_user:usuarios!recibido_por(nombre, apellido),
        items:transferencia_items(
          id,
          cantidad_solicitada,
          cantidad_enviada,
          cantidad_recibida,
          producto:productos(nombre, codigo, unidad_medida)
        )
      `)
            .eq('id', id)
            .single()

        if (error) throw error
        return data
    } catch (error) {
        console.error('Error en obtenerTransferenciaAction:', error)
        return null
    }
}
