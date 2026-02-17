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

// ==================== GESTIÓN FINANCIERA DE PROVEEDORES ====================

// Schema para facturas
const facturaProveedorSchema = z.object({
    proveedor_id: z.string().uuid(),
    numero_factura: z.string().min(1, 'Número de factura requerido'),
    tipo_comprobante: z.enum(['factura', 'remito', 'recibo', 'nota_credito']).default('factura'),
    fecha_emision: z.string().min(1, 'Fecha de emisión requerida'),
    fecha_vencimiento: z.string().optional(),
    monto_total: z.number().positive('El monto debe ser mayor a 0'),
    descripcion: z.string().optional(),
})

// Schema para pagos
const pagoProveedorSchema = z.object({
    proveedor_id: z.string().uuid(),
    factura_id: z.string().uuid().optional(),
    caja_id: z.string().uuid(),
    monto: z.number().positive('El monto debe ser mayor a 0'),
    metodo_pago: z.enum(['efectivo', 'transferencia']).default('transferencia'),
    numero_transaccion: z.string().optional(),
    descripcion: z.string().optional(),
})

// Listar facturas de un proveedor
export async function listarFacturasProveedorAction(proveedorId: string) {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('proveedores_facturas')
            .select('*')
            .eq('proveedor_id', proveedorId)
            .order('fecha_emision', { ascending: false })

        if (error) throw error

        return { success: true, data: data || [] }
    } catch (error: any) {
        devError('Error en listarFacturasProveedorAction:', error)
        return { success: false, error: error.message || 'Error al listar facturas' }
    }
}

// Crear factura de proveedor
export async function crearFacturaProveedorAction(formData: FormData) {
    try {
        const supabase = await createClient()

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return { success: false, error: 'Usuario no autenticado' }
        }

        const rawData = Object.fromEntries(formData)
        const data = facturaProveedorSchema.parse({
            proveedor_id: rawData.proveedor_id,
            numero_factura: rawData.numero_factura,
            tipo_comprobante: rawData.tipo_comprobante || 'factura',
            fecha_emision: rawData.fecha_emision,
            fecha_vencimiento: rawData.fecha_vencimiento || undefined,
            monto_total: parseFloat(rawData.monto_total as string),
            descripcion: rawData.descripcion || undefined,
        })

        const { data: factura, error } = await supabase
            .from('proveedores_facturas')
            .insert({
                ...data,
                estado: 'pendiente',
                monto_pagado: 0,
                creado_por: user.id,
            })
            .select()
            .single()

        if (error) throw error

        revalidatePath('/(admin)/(dominios)/tesoreria/proveedores')

        return { success: true, data: factura, message: 'Factura registrada exitosamente' }
    } catch (error: any) {
        devError('Error en crearFacturaProveedorAction:', error)
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message }
        }
        return { success: false, error: error.message || 'Error al crear factura' }
    }
}

// Actualizar factura de proveedor
export async function actualizarFacturaProveedorAction(id: string, formData: FormData) {
    try {
        const supabase = await createClient()

        const rawData = Object.fromEntries(formData)

        const updateData: Record<string, any> = {
            updated_at: new Date().toISOString(),
        }

        if (rawData.numero_factura) updateData.numero_factura = rawData.numero_factura
        if (rawData.tipo_comprobante) updateData.tipo_comprobante = rawData.tipo_comprobante
        if (rawData.fecha_emision) updateData.fecha_emision = rawData.fecha_emision
        if (rawData.fecha_vencimiento) updateData.fecha_vencimiento = rawData.fecha_vencimiento
        if (rawData.monto_total) updateData.monto_total = parseFloat(rawData.monto_total as string)
        if (rawData.descripcion !== undefined) updateData.descripcion = rawData.descripcion

        const { error } = await supabase
            .from('proveedores_facturas')
            .update(updateData)
            .eq('id', id)

        if (error) throw error

        revalidatePath('/(admin)/(dominios)/tesoreria/proveedores')

        return { success: true, message: 'Factura actualizada exitosamente' }
    } catch (error: any) {
        devError('Error en actualizarFacturaProveedorAction:', error)
        return { success: false, error: error.message || 'Error al actualizar factura' }
    }
}

// Anular factura de proveedor
export async function anularFacturaProveedorAction(id: string) {
    try {
        const supabase = await createClient()

        const { error } = await supabase
            .from('proveedores_facturas')
            .update({
                estado: 'anulada',
                updated_at: new Date().toISOString()
            })
            .eq('id', id)

        if (error) throw error

        revalidatePath('/(admin)/(dominios)/tesoreria/proveedores')

        return { success: true, message: 'Factura anulada exitosamente' }
    } catch (error: any) {
        devError('Error en anularFacturaProveedorAction:', error)
        return { success: false, error: error.message || 'Error al anular factura' }
    }
}

// Registrar pago a proveedor (usa RPC atómico)
export async function registrarPagoProveedorAction(formData: FormData) {
    try {
        const supabase = await createClient()

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return { success: false, error: 'Usuario no autenticado' }
        }

        const rawData = Object.fromEntries(formData)
        const data = pagoProveedorSchema.parse({
            proveedor_id: rawData.proveedor_id,
            factura_id: rawData.factura_id || undefined,
            caja_id: rawData.caja_id,
            monto: parseFloat(rawData.monto as string),
            metodo_pago: rawData.metodo_pago || 'transferencia',
            numero_transaccion: rawData.numero_transaccion || undefined,
            descripcion: rawData.descripcion || undefined,
        })

        // Usar RPC atómico
        const { data: result, error } = await supabase.rpc('fn_registrar_pago_proveedor', {
            p_proveedor_id: data.proveedor_id,
            p_factura_id: data.factura_id || null,
            p_caja_id: data.caja_id,
            p_monto: data.monto,
            p_metodo_pago: data.metodo_pago,
            p_numero_transaccion: data.numero_transaccion || null,
            p_descripcion: data.descripcion || null,
            p_user_id: user.id,
        })

        if (error) throw error
        if (!result?.success) {
            throw new Error(result?.error || 'Error al registrar pago')
        }

        revalidatePath('/(admin)/(dominios)/tesoreria/proveedores')
        revalidatePath('/(admin)/(dominios)/tesoreria/movimientos')
        revalidatePath('/(admin)/(dominios)/tesoreria')

        return {
            success: true,
            data: { pagoId: result.pago_id, movimientoId: result.movimiento_id },
            message: 'Pago registrado exitosamente'
        }
    } catch (error: any) {
        devError('Error en registrarPagoProveedorAction:', error)
        if (error instanceof z.ZodError) {
            return { success: false, error: error.issues[0].message }
        }
        return { success: false, error: error.message || 'Error al registrar pago' }
    }
}

// Listar pagos de un proveedor
export async function listarPagosProveedorAction(proveedorId: string) {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('proveedores_pagos')
            .select(`
                *,
                factura:proveedores_facturas(numero_factura),
                caja:tesoreria_cajas(nombre)
            `)
            .eq('proveedor_id', proveedorId)
            .order('fecha', { ascending: false })

        if (error) throw error

        return { success: true, data: data || [] }
    } catch (error: any) {
        devError('Error en listarPagosProveedorAction:', error)
        return { success: false, error: error.message || 'Error al listar pagos' }
    }
}

// Listar movimientos de almacen vinculados al proveedor
export async function listarMovimientosProveedorAction(proveedorId: string) {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('recepcion_almacen')
            .select(`
                id,
                created_at,
                tipo,
                cantidad,
                unidad_medida,
                motivo,
                numero_comprobante_ref,
                tipo_comprobante_ref,
                fecha_comprobante,
                monto_compra,
                producto:productos(id, codigo, nombre),
                factura:proveedores_facturas(id, numero_factura, estado, monto_total, monto_pagado)
            `)
            .eq('proveedor_id', proveedorId)
            .order('created_at', { ascending: false })
            .limit(200)

        if (error) throw error

        return { success: true, data: data || [] }
    } catch (error: any) {
        devError('Error en listarMovimientosProveedorAction:', error)
        return { success: false, error: error.message || 'Error al listar movimientos' }
    }
}

// Obtener estado de cuenta de un proveedor
export async function obtenerEstadoCuentaProveedorAction(proveedorId: string) {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase.rpc('fn_obtener_estado_cuenta_proveedor', {
            p_proveedor_id: proveedorId
        })

        if (error) throw error

        return { success: true, data }
    } catch (error: any) {
        devError('Error en obtenerEstadoCuentaProveedorAction:', error)
        return { success: false, error: error.message || 'Error al obtener estado de cuenta' }
    }
}

// Obtener resumen global de proveedores (para dashboard)
export async function obtenerResumenProveedoresAction() {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase.rpc('fn_obtener_resumen_proveedores')

        if (error) throw error

        return { success: true, data }
    } catch (error: any) {
        devError('Error en obtenerResumenProveedoresAction:', error)
        return { success: false, error: error.message || 'Error al obtener resumen' }
    }
}

// Obtener facturas vencidas (para alertas)
export async function obtenerFacturasVencidasAction() {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('proveedores_facturas')
            .select(`
                *,
                proveedor:proveedores(nombre)
            `)
            .in('estado', ['pendiente', 'parcial'])
            .lt('fecha_vencimiento', new Date().toISOString().split('T')[0])
            .order('fecha_vencimiento', { ascending: true })

        if (error) throw error

        return { success: true, data: data || [] }
    } catch (error: any) {
        devError('Error en obtenerFacturasVencidasAction:', error)
        return { success: false, error: error.message || 'Error al obtener facturas vencidas' }
    }
}

// Obtener facturas pendientes de un proveedor (para selector de pago)
export async function obtenerFacturasPendientesProveedorAction(proveedorId: string) {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('proveedores_facturas')
            .select('id, numero_factura, monto_total, monto_pagado, fecha_vencimiento')
            .eq('proveedor_id', proveedorId)
            .in('estado', ['pendiente', 'parcial'])
            .order('fecha_vencimiento', { ascending: true })

        if (error) throw error

        // Calcular saldo pendiente por factura
        const facturasConSaldo = (data || []).map(f => ({
            ...f,
            saldo_pendiente: f.monto_total - f.monto_pagado
        }))

        return { success: true, data: facturasConSaldo }
    } catch (error: any) {
        devError('Error en obtenerFacturasPendientesProveedorAction:', error)
        return { success: false, error: error.message || 'Error al obtener facturas pendientes' }
    }
}
