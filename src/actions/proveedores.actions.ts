'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { devError } from '@/lib/utils/logger'

// Schemas de validación
const proveedorSchema = z.object({
    nombre: z.string().min(1, 'Nombre requerido'),
    cuit: z.string().optional(),
    telefono: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    direccion: z.string().optional(),
    categoria: z.string().optional(),
    notas: z.string().optional(),
})

// Listar proveedores
export async function listarProveedoresAction(soloActivos: boolean = true) {
    try {
        const supabase = await createClient()

        let query = supabase
            .from('proveedores')
            .select('*')
            .order('nombre', { ascending: true })

        if (soloActivos) {
            query = query.eq('activo', true)
        }

        const { data, error } = await query

        if (error) throw error

        return { success: true, data: data || [] }
    } catch (error: any) {
        devError('Error en listarProveedoresAction:', error)
        return { success: false, error: error.message || 'Error al listar proveedores' }
    }
}

// Obtener proveedor por ID
export async function obtenerProveedorAction(id: string) {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('proveedores')
            .select('*')
            .eq('id', id)
            .single()

        if (error) throw error

        return { success: true, data }
    } catch (error: any) {
        devError('Error en obtenerProveedorAction:', error)
        return { success: false, error: error.message || 'Error al obtener proveedor' }
    }
}

// Crear proveedor
export async function crearProveedorAction(formData: FormData) {
    try {
        const supabase = await createClient()

        // Obtener usuario actual
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return { success: false, error: 'Usuario no autenticado' }
        }

        // Parsear datos
        const rawData = Object.fromEntries(formData)
        const data = proveedorSchema.parse({
            nombre: rawData.nombre,
            cuit: rawData.cuit || undefined,
            telefono: rawData.telefono || undefined,
            email: rawData.email || '',
            direccion: rawData.direccion || undefined,
            categoria: rawData.categoria || undefined,
            notas: rawData.notas || undefined,
        })

        const { data: proveedor, error } = await supabase
            .from('proveedores')
            .insert({
                ...data,
                activo: true,
            })
            .select()
            .single()

        if (error) throw error

        revalidatePath('/(admin)/(dominios)/tesoreria/proveedores')

        return { success: true, data: proveedor, message: 'Proveedor creado exitosamente' }
    } catch (error: any) {
        devError('Error en crearProveedorAction:', error)
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message }
        }
        return { success: false, error: error.message || 'Error al crear proveedor' }
    }
}

// Actualizar proveedor
export async function actualizarProveedorAction(id: string, formData: FormData) {
    try {
        const supabase = await createClient()

        // Parsear datos
        const rawData = Object.fromEntries(formData)
        const data = proveedorSchema.parse({
            nombre: rawData.nombre,
            cuit: rawData.cuit || undefined,
            telefono: rawData.telefono || undefined,
            email: rawData.email || '',
            direccion: rawData.direccion || undefined,
            categoria: rawData.categoria || undefined,
            notas: rawData.notas || undefined,
        })

        const { error } = await supabase
            .from('proveedores')
            .update({
                ...data,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)

        if (error) throw error

        revalidatePath('/(admin)/(dominios)/tesoreria/proveedores')

        return { success: true, message: 'Proveedor actualizado exitosamente' }
    } catch (error: any) {
        devError('Error en actualizarProveedorAction:', error)
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message }
        }
        return { success: false, error: error.message || 'Error al actualizar proveedor' }
    }
}

// Desactivar proveedor (soft delete)
export async function desactivarProveedorAction(id: string) {
    try {
        const supabase = await createClient()

        const { error } = await supabase
            .from('proveedores')
            .update({ activo: false, updated_at: new Date().toISOString() })
            .eq('id', id)

        if (error) throw error

        revalidatePath('/(admin)/(dominios)/tesoreria/proveedores')

        return { success: true, message: 'Proveedor desactivado exitosamente' }
    } catch (error: any) {
        devError('Error en desactivarProveedorAction:', error)
        return { success: false, error: error.message || 'Error al desactivar proveedor' }
    }
}

// Reactivar proveedor
export async function reactivarProveedorAction(id: string) {
    try {
        const supabase = await createClient()

        const { error } = await supabase
            .from('proveedores')
            .update({ activo: true, updated_at: new Date().toISOString() })
            .eq('id', id)

        if (error) throw error

        revalidatePath('/(admin)/(dominios)/tesoreria/proveedores')

        return { success: true, message: 'Proveedor reactivado exitosamente' }
    } catch (error: any) {
        devError('Error en reactivarProveedorAction:', error)
        return { success: false, error: error.message || 'Error al reactivar proveedor' }
    }
}
