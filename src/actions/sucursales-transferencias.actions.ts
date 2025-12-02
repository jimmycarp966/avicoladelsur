'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Regex para validar formato UUID (menos estricto que z.string().uuid())
const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

// Schemas
const crearTransferenciaSchema = z.object({
    sucursal_origen_id: z.string().regex(uuidRegex, 'UUID inválido'),
    sucursal_destino_id: z.string().regex(uuidRegex, 'UUID inválido'),
    motivo: z.string().optional(),
    observaciones: z.string().optional(),
    items: z.array(z.object({
        producto_id: z.string().regex(uuidRegex, 'UUID inválido'),
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
// Listar sucursales operativas (excluyendo Sistema Central)
export async function listarSucursales() {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('sucursales')
            .select('*')
            .eq('active', true)
            .neq('id', '00000000-0000-0000-0000-000000000001') // Excluir Sistema Central
            .order('nombre')

        if (error) throw error
        return data || []
    } catch (error) {
        console.error('Error en listarSucursales:', error)
        return []
    }
}

// Obtener almacén central (Sistema Central)
export async function obtenerAlmacenCentral() {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('sucursales')
            .select('*')
            .eq('id', '00000000-0000-0000-0000-000000000001')
            .single()

        if (error) throw error
        return data
    } catch (error) {
        console.error('Error obteniendo almacén central:', error)
        return null
    }
}

// Obtener productos directamente desde lotes en almacén central (fallback optimizado)
export async function obtenerProductosDesdeLotesCentral() {
    try {
        const supabase = await createClient()

        console.log('🔄 FALLBACK: Obteniendo productos directamente desde lotes (optimizado)...')

        // Misma consulta optimizada que el método principal
        const { data: lotes, error: lotesError } = await supabase
            .from('lotes')
            .select(`
                cantidad_disponible,
                productos!inner(id, nombre, codigo, unidad_medida, is_central_catalog)
            `)
            .eq('sucursal_id', '00000000-0000-0000-0000-000000000001') // Sistema Central
            .eq('estado', 'disponible')
            .gt('cantidad_disponible', 0)

        if (lotesError) {
            console.error('❌ Error en fallback:', lotesError)
            return []
        }

        console.log('📦 Lotes encontrados:', lotes?.length || 0)

        if (!lotes || lotes.length === 0) {
            console.log('⚠️ No hay lotes disponibles en almacén central')
            return []
        }

        // Agrupar por producto (optimizado en memoria)
        const productosMap = new Map()

        for (const lote of lotes) {
            // Manejar caso donde productos puede ser array o objeto
            const productosData = Array.isArray(lote.productos) ? lote.productos[0] : lote.productos
            if (!productosData) continue
            
            const producto = productosData as unknown as { id: string; nombre: string; codigo: string; unidad_medida: string; is_central_catalog: boolean }
            const productoId = producto.id

            if (!productosMap.has(productoId)) {
                productosMap.set(productoId, {
                    producto: producto,
                    cantidad_total: 0
                })
            }

            productosMap.get(productoId).cantidad_total += lote.cantidad_disponible
        }

        const productosConStock = Array.from(productosMap.values())
        console.log('✅ FALLBACK: Productos encontrados:', productosConStock.length)

        return productosConStock

    } catch (error) {
        console.error('❌ Error en fallback:', error)
        return []
    }
}

// Obtener todos los productos disponibles en almacén central (OPTIMIZADO)
export async function obtenerProductosAlmacenCentral() {
    try {
        const supabase = await createClient()

        console.log('🚀 Obteniendo productos del almacén central (optimizado)...')
        const startTime = Date.now()

        // UNA SOLA consulta optimizada que obtiene todo
        const { data: lotesConProductos, error } = await supabase
            .from('lotes')
            .select(`
                cantidad_disponible,
                productos!inner(
                    id,
                    nombre,
                    codigo,
                    unidad_medida,
                    is_central_catalog
                )
            `)
            .eq('sucursal_id', '00000000-0000-0000-0000-000000000001') // Sistema Central
            .eq('estado', 'disponible')
            .gt('cantidad_disponible', 0)
            // Ordenamos en memoria después para evitar error de sintaxis

        if (error) {
            console.error('❌ Error en consulta optimizada:', error)
            throw error
        }

        console.log(`⚡ Consulta ejecutada en ${Date.now() - startTime}ms`)

        if (!lotesConProductos || lotesConProductos.length === 0) {
            console.log('📦 No hay lotes disponibles en almacén central')

            // Verificar si hay productos sin stock
            const { data: productosCatalogo } = await supabase
                .from('productos')
                .select('id, nombre, codigo')
                .eq('is_central_catalog', true)
                .limit(5)

            if (productosCatalogo && productosCatalogo.length > 0) {
                console.log('💡 Hay productos en catálogo pero sin stock. Sugerir crear datos de prueba.')
            }

            return []
        }

        // Agrupar por producto y calcular stock total (en memoria, muy rápido)
        const productosMap = new Map()

        for (const lote of lotesConProductos) {
            // Manejar caso donde productos puede ser array o objeto
            const productosData = Array.isArray(lote.productos) ? lote.productos[0] : lote.productos
            if (!productosData) continue
            
            const producto = productosData as unknown as { id: string; nombre: string; codigo: string; unidad_medida: string; is_central_catalog: boolean }
            const productoId = producto.id

            if (!productosMap.has(productoId)) {
                productosMap.set(productoId, {
                    producto: {
                        id: producto.id,
                        nombre: producto.nombre,
                        codigo: producto.codigo,
                        unidad_medida: producto.unidad_medida
                    },
                    cantidad_total: 0,
                    lotes_count: 0
                })
            }

            const productoData = productosMap.get(productoId)
            productoData.cantidad_total += lote.cantidad_disponible
            productoData.lotes_count += 1
        }

        // Ordenar alfabéticamente por nombre de producto
        const productosConStock = Array.from(productosMap.values())
            .sort((a, b) => a.producto.nombre.localeCompare(b.producto.nombre))

        console.log(`✅ ${productosConStock.length} productos encontrados en ${Date.now() - startTime}ms`)
        console.log(`📊 Total lotes procesados: ${lotesConProductos.length}`)

        return productosConStock

    } catch (error) {
        console.error('❌ Error obteniendo productos almacén central:', error)
        // Intentar fallback en caso de error
        console.log('🔄 Intentando fallback...')
        return await obtenerProductosDesdeLotesCentral()
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

        // Consulta básica compatible con la estructura actual de la BD
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

// =============================================
// NUEVAS FUNCIONES: Flujo integrado con presupuestos
// =============================================

// Obtener transferencias del día para vista de almacén
export async function obtenerTransferenciasDiaAction(
    fecha?: string,
    turno?: string,
    zonaId?: string
) {
    try {
        const supabase = await createClient()
        
        const fechaHoy = fecha || new Date().toISOString().split('T')[0]
        
        let query = supabase
            .from('transferencias_stock')
            .select(`
                *,
                sucursal_origen:sucursales!sucursal_origen_id(id, nombre),
                sucursal_destino:sucursales!sucursal_destino_id(id, nombre),
                zona:zonas(id, nombre),
                items:transferencia_items(
                    id,
                    cantidad_solicitada,
                    cantidad_enviada,
                    peso_preparado,
                    requiere_pesaje,
                    producto:productos(nombre, codigo, unidad_medida, pesable)
                )
            `)
            .in('estado', ['en_almacen', 'preparado'])
            .eq('fecha_entrega', fechaHoy)
            .order('fecha_solicitud', { ascending: true })

        if (turno) {
            query = query.eq('turno', turno)
        }

        if (zonaId) {
            query = query.eq('zona_id', zonaId)
        }

        const { data, error } = await query

        if (error) throw error
        return data || []
    } catch (error) {
        console.error('Error en obtenerTransferenciasDiaAction:', error)
        return []
    }
}

// Preparar transferencia (almacenista)
export async function prepararTransferenciaAction(
    transferenciaId: string,
    itemsPesados?: { item_id: string; peso_preparado: number }[]
) {
    try {
        const supabase = await createClient()

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
            return { success: false, message: 'Usuario no autenticado' }
        }

        const { data: result, error } = await supabase.rpc('fn_preparar_transferencia', {
            p_transferencia_id: transferenciaId,
            p_user_id: user.id,
            p_items_pesados: itemsPesados || null,
        })

        if (error) throw error
        if (!result.success) {
            return { success: false, message: result.error }
        }

        revalidatePath('/sucursales/transferencias')
        revalidatePath('/almacen/presupuestos-dia')

        return {
            success: true,
            message: 'Transferencia preparada exitosamente',
        }
    } catch (error: any) {
        console.error('Error en prepararTransferenciaAction:', error)
        return { success: false, message: error.message || 'Error al preparar transferencia' }
    }
}

// Asignar transferencia a ruta
export async function asignarTransferenciaRutaAction(
    transferenciaId: string,
    rutaId: string
) {
    try {
        const supabase = await createClient()

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
            return { success: false, message: 'Usuario no autenticado' }
        }

        const { data: result, error } = await supabase.rpc('fn_asignar_transferencia_a_ruta', {
            p_transferencia_id: transferenciaId,
            p_ruta_id: rutaId,
            p_user_id: user.id,
        })

        if (error) throw error
        if (!result.success) {
            return { success: false, message: result.error }
        }

        revalidatePath('/sucursales/transferencias')
        revalidatePath('/reparto')

        return {
            success: true,
            message: 'Transferencia asignada a ruta',
        }
    } catch (error: any) {
        console.error('Error en asignarTransferenciaRutaAction:', error)
        return { success: false, message: error.message || 'Error al asignar a ruta' }
    }
}

// Marcar transferencia como entregada (repartidor)
export async function entregarTransferenciaAction(transferenciaId: string) {
    try {
        const supabase = await createClient()

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
            return { success: false, message: 'Usuario no autenticado' }
        }

        const { data: result, error } = await supabase.rpc('fn_entregar_transferencia', {
            p_transferencia_id: transferenciaId,
            p_user_id: user.id,
        })

        if (error) throw error
        if (!result.success) {
            return { success: false, message: result.error }
        }

        revalidatePath('/sucursales/transferencias')
        revalidatePath('/reparto')

        return {
            success: true,
            message: 'Transferencia marcada como entregada',
        }
    } catch (error: any) {
        console.error('Error en entregarTransferenciaAction:', error)
        return { success: false, message: error.message || 'Error al entregar transferencia' }
    }
}

// Confirmar recepción con posibles diferencias
export async function confirmarRecepcionTransferenciaAction(
    transferenciaId: string,
    itemsRecibidos?: { item_id: string; cantidad_recibida: number }[]
) {
    try {
        const supabase = await createClient()

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
            return { success: false, message: 'Usuario no autenticado' }
        }

        const { data: result, error } = await supabase.rpc('fn_recibir_transferencia', {
            p_transferencia_id: transferenciaId,
            p_user_id: user.id,
            p_items_recibidos: itemsRecibidos || null,
        })

        if (error) throw error
        if (!result.success) {
            return { success: false, message: result.error }
        }

        revalidatePath('/sucursales/transferencias')
        revalidatePath('/sucursal/transferencias')

        return {
            success: true,
            message: 'Transferencia recibida exitosamente',
        }
    } catch (error: any) {
        console.error('Error en confirmarRecepcionTransferenciaAction:', error)
        return { success: false, message: error.message || 'Error al confirmar recepción' }
    }
}

// Cancelar transferencia
export async function cancelarTransferenciaAction(
    transferenciaId: string,
    motivo?: string
) {
    try {
        const supabase = await createClient()

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
            return { success: false, message: 'Usuario no autenticado' }
        }

        const { data: result, error } = await supabase.rpc('fn_cancelar_transferencia', {
            p_transferencia_id: transferenciaId,
            p_user_id: user.id,
            p_motivo: motivo || 'Cancelada por usuario',
        })

        if (error) throw error
        if (!result.success) {
            return { success: false, message: result.error }
        }

        revalidatePath('/sucursales/transferencias')

        return {
            success: true,
            message: 'Transferencia cancelada y stock devuelto',
        }
    } catch (error: any) {
        console.error('Error en cancelarTransferenciaAction:', error)
        return { success: false, message: error.message || 'Error al cancelar transferencia' }
    }
}

// Obtener transferencias pendientes de recibir para una sucursal
export async function obtenerTransferenciasPendientesRecepcion(sucursalId: string) {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
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
                    producto:productos(nombre, codigo, unidad_medida)
                )
            `)
            .eq('sucursal_destino_id', sucursalId)
            .in('estado', ['entregado', 'en_ruta'])
            .order('fecha_solicitud', { ascending: false })

        if (error) throw error
        return data || []
    } catch (error) {
        console.error('Error en obtenerTransferenciasPendientesRecepcion:', error)
        return []
    }
}
