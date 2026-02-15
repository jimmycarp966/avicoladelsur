'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { devError, devLog } from '@/lib/utils/logger'

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

function esErrorColumnaCostoUnitarioLotes(error: unknown): boolean {
    const texto =
        typeof error === 'string'
            ? error
            : JSON.stringify(error || {})

    const normalizado = texto.toLowerCase()
    return normalizado.includes('costo_unitario') && normalizado.includes('lotes')
}

async function confirmarRecepcionTransferenciaFallbackCompat(
    transferenciaId: string,
    userId: string,
    itemsRecibidos?: { item_id: string; cantidad_recibida: number }[]
): Promise<{ success: boolean; error?: string }> {
    const admin = createAdminClient()

    const { data: transferencia, error: transferenciaError } = await admin
        .from('transferencias_stock')
        .select('id, numero_transferencia, estado, sucursal_destino_id')
        .eq('id', transferenciaId)
        .maybeSingle()

    if (transferenciaError) {
        throw transferenciaError
    }

    if (!transferencia) {
        return { success: false, error: 'Transferencia no encontrada' }
    }

    if (!['entregado', 'en_ruta', 'en_transito', 'preparado'].includes(transferencia.estado)) {
        return { success: false, error: 'Transferencia no esta en estado para recibir' }
    }

    if (itemsRecibidos && itemsRecibidos.length > 0) {
        for (const itemRecibido of itemsRecibidos) {
            const { error: updateRecibidoError } = await admin
                .from('transferencia_items')
                .update({ cantidad_recibida: itemRecibido.cantidad_recibida })
                .eq('id', itemRecibido.item_id)
                .eq('transferencia_id', transferenciaId)

            if (updateRecibidoError) {
                throw updateRecibidoError
            }
        }
    }

    const { data: itemsTransferencia, error: itemsError } = await admin
        .from('transferencia_items')
        .select('id, producto_id, lote_origen_id, cantidad_solicitada, cantidad_enviada, cantidad_recibida')
        .eq('transferencia_id', transferenciaId)

    if (itemsError) {
        throw itemsError
    }

    for (const item of itemsTransferencia || []) {
        const cantidadRecibida = Number(
            item.cantidad_recibida ?? item.cantidad_enviada ?? item.cantidad_solicitada ?? 0
        )

        if (cantidadRecibida <= 0) {
            continue
        }

        if (item.cantidad_recibida == null) {
            const { error: updateItemError } = await admin
                .from('transferencia_items')
                .update({ cantidad_recibida: cantidadRecibida })
                .eq('id', item.id)

            if (updateItemError) {
                throw updateItemError
            }
        }

        let numeroLoteOrigen: string | null = null
        let fechaVencimientoOrigen: string | null = null
        let proveedorOrigen: string | null = null

        if (item.lote_origen_id) {
            const { data: loteOrigen, error: loteOrigenError } = await admin
                .from('lotes')
                .select('numero_lote, fecha_vencimiento, proveedor')
                .eq('id', item.lote_origen_id)
                .maybeSingle()

            if (loteOrigenError) {
                throw loteOrigenError
            }

            numeroLoteOrigen = loteOrigen?.numero_lote ?? null
            fechaVencimientoOrigen = loteOrigen?.fecha_vencimiento ?? null
            proveedorOrigen = loteOrigen?.proveedor ?? null
        }

        const baseNumeroLote = numeroLoteOrigen || transferencia.numero_transferencia || transferencia.id
        const numeroLoteDestino = `TRANS-${baseNumeroLote}-${item.id.slice(0, 8)}`.slice(0, 50)

        const { data: loteDestino, error: loteDestinoError } = await admin
            .from('lotes')
            .insert({
                producto_id: item.producto_id,
                sucursal_id: transferencia.sucursal_destino_id,
                cantidad_ingresada: cantidadRecibida,
                cantidad_disponible: cantidadRecibida,
                fecha_ingreso: new Date().toISOString().slice(0, 10),
                fecha_vencimiento: fechaVencimientoOrigen,
                proveedor: proveedorOrigen || 'Transferencia',
                estado: 'disponible',
                numero_lote: numeroLoteDestino,
            })
            .select('id')
            .single()

        if (loteDestinoError || !loteDestino) {
            throw loteDestinoError || new Error('No se pudo crear lote destino')
        }

        const { error: movimientoError } = await admin
            .from('movimientos_stock')
            .insert({
                lote_id: loteDestino.id,
                tipo_movimiento: 'ingreso',
                cantidad: cantidadRecibida,
                motivo: `Transferencia recibida: ${transferencia.numero_transferencia}`,
                usuario_id: userId,
            })

        if (movimientoError) {
            throw movimientoError
        }

        const { error: linkLoteError } = await admin
            .from('transferencia_items')
            .update({ lote_destino_id: loteDestino.id })
            .eq('id', item.id)

        if (linkLoteError) {
            throw linkLoteError
        }
    }

    const { error: updateTransferenciaError } = await admin
        .from('transferencias_stock')
        .update({
            estado: 'recibido',
            fecha_recepcion: new Date().toISOString(),
            recibido_por: userId,
            updated_at: new Date().toISOString(),
        })
        .eq('id', transferenciaId)

    if (updateTransferenciaError) {
        throw updateTransferenciaError
    }

    return { success: true }
}

// Crear transferencia
export async function crearTransferenciaAction(formData: FormData) {
    try {
        const supabase = await createClient()

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
            return { success: false, error: 'Usuario no autenticado' }
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
            return { success: false, error: result.error }
        }

        revalidatePath('/sucursales')
        revalidatePath('/sucursales/transferencias')

        return {
            success: true,
            message: `Transferencia ${result.numero_transferencia} creada exitosamente`,
            data: result,
        }
    } catch (error: any) {
        devError('Error en crearTransferenciaAction:', error)
        return { success: false, error: error.message || 'Error al crear transferencia' }
    }
}

// Aprobar transferencia
export async function aprobarTransferenciaAction(transferenciaId: string) {
    try {
        const supabase = await createClient()

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
            return { success: false, error: 'Usuario no autenticado' }
        }

        const { data: result, error } = await supabase.rpc('fn_aprobar_transferencia', {
            p_transferencia_id: transferenciaId,
            p_user_id: user.id,
        })

        if (error) throw error
        if (!result.success) {
            return { success: false, error: result.error }
        }

        revalidatePath('/sucursales/transferencias')

        return {
            success: true,
            message: 'Transferencia aprobada y enviada',
        }
    } catch (error: any) {
        devError('Error en aprobarTransferenciaAction:', error)
        return { success: false, error: error.message || 'Error al aprobar transferencia' }
    }
}

// Recibir transferencia
export async function recibirTransferenciaAction(transferenciaId: string) {
    try {
        const supabase = await createClient()

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
            return { success: false, error: 'Usuario no autenticado' }
        }

        const { data: result, error } = await supabase.rpc('fn_recibir_transferencia', {
            p_transferencia_id: transferenciaId,
            p_user_id: user.id,
        })

        if (error) throw error
        if (!result.success) {
            return { success: false, error: result.error }
        }

        revalidatePath('/sucursales/transferencias')

        return {
            success: true,
            message: 'Transferencia recibida exitosamente',
        }
    } catch (error: any) {
        devError('Error en recibirTransferenciaAction:', error)
        return { success: false, error: error.message || 'Error al recibir transferencia' }
    }
}

// Listar sucursales
// Listar sucursales operativas (excluyendo Sistema Central)
export async function listarSucursalesAction() {
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
        devError('Error en listarSucursales:', error)
        return []
    }
}

// Obtener almacén central (Sistema Central)
export async function obtenerAlmacenCentralAction() {
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
        devError('Error obteniendo almacén central:', error)
        return null
    }
}

// Obtener productos directamente desde lotes en almacén central (fallback optimizado)
export async function obtenerProductosDesdeLotesCentralAction() {
    try {
        const supabase = await createClient()

        devLog('🔄 FALLBACK: Obteniendo productos directamente desde lotes (optimizado)...')

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
            devError('❌ Error en fallback:', lotesError)
            return []
        }

        devLog('📦 Lotes encontrados:', lotes?.length || 0)

        if (!lotes || lotes.length === 0) {
            devLog('⚠️ No hay lotes disponibles en almacén central')
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
        devLog('✅ FALLBACK: Productos encontrados:', productosConStock.length)

        return productosConStock

    } catch (error) {
        devError('❌ Error en fallback:', error)
        return []
    }
}

// Obtener todos los productos disponibles en almacén central (OPTIMIZADO)
export async function obtenerProductosAlmacenCentralAction() {
    try {
        const supabase = await createClient()

        devLog('🚀 Obteniendo productos del almacén central (optimizado)...')
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
            devError('❌ Error en consulta optimizada:', error)
            throw error
        }

        devLog(`⚡ Consulta ejecutada en ${Date.now() - startTime}ms`)

        if (!lotesConProductos || lotesConProductos.length === 0) {
            devLog('📦 No hay lotes disponibles en almacén central')

            // Verificar si hay productos sin stock
            const { data: productosCatalogo } = await supabase
                .from('productos')
                .select('id, nombre, codigo')
                .eq('is_central_catalog', true)
                .limit(5)

            if (productosCatalogo && productosCatalogo.length > 0) {
                devLog('💡 Hay productos en catálogo pero sin stock. Sugerir crear datos de prueba.')
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

        devLog(`✅ ${productosConStock.length} productos encontrados en ${Date.now() - startTime}ms`)
        devLog(`📊 Total lotes procesados: ${lotesConProductos.length}`)

        return productosConStock

    } catch (error) {
        devError('❌ Error obteniendo productos almacén central:', error)
        // Intentar fallback en caso de error
        devLog('🔄 Intentando fallback...')
        return await obtenerProductosDesdeLotesCentralAction()
    }
}

// Obtener stock por sucursal
export async function obtenerStockPorSucursalAction(sucursalId: string) {
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
        devError('Error en obtenerStockPorSucursal:', error)
        return []
    }
}

// Listar transferencias
export async function listarTransferenciasAction(sucursalId?: string, estado?: string) {
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
        devError('Error en listarTransferencias:', error)
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
        devError('Error en obtenerTransferenciaAction:', error)
        return null
    }
}

// =============================================
// GESTIÓN STOCK MÍNIMO POR SUCURSAL
// =============================================

// Obtener stock mínimo de un producto para una sucursal específica
export async function obtenerStockMinimoSucursalAction(sucursalId: string, productoId: string) {
  try {
    const supabase = await createClient()

    // Primero buscar en la tabla específica de sucursal
    const { data: minimoSucursal, error: errorSucursal } = await supabase
      .from('producto_sucursal_minimos')
      .select('stock_minimo')
      .eq('sucursal_id', sucursalId)
      .eq('producto_id', productoId)
      .single()

    if (minimoSucursal) {
      return { stock_minimo: minimoSucursal.stock_minimo, tipo: 'sucursal' }
    }

    // Si no existe, usar el global del producto
    const { data: producto, error: errorProducto } = await supabase
      .from('productos')
      .select('stock_minimo')
      .eq('id', productoId)
      .single()

    if (errorProducto) throw errorProducto

    return {
      stock_minimo: producto?.stock_minimo || 0,
      tipo: 'global'
    }
  } catch (error) {
    devError('Error en obtenerStockMinimoSucursalAction:', error)
    return { stock_minimo: 0, tipo: 'error' }
  }
}

// Actualizar stock mínimo de un producto para una sucursal específica
export async function actualizarStockMinimoSucursalAction(
  sucursalId: string,
  productoId: string,
  stockMinimo: number
) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('producto_sucursal_minimos')
      .upsert({
        sucursal_id: sucursalId,
        producto_id: productoId,
        stock_minimo: stockMinimo,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'sucursal_id,producto_id'
      })
      .select()

    if (error) throw error

    return { success: true, data }
  } catch (error) {
    devError('Error en actualizarStockMinimoSucursalAction:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

// Obtener todos los stock mínimos de una sucursal (para gestión masiva)
export async function obtenerTodosStockMinimosSucursalAction(sucursalId: string) {
  try {
    const supabase = await createClient()

    // Obtener productos con stock mínimo configurado para la sucursal
    const { data: minimosSucursal, error: errorSucursal } = await supabase
      .from('producto_sucursal_minimos')
      .select(`
        producto_id,
        stock_minimo,
        updated_at,
        producto:productos(id, nombre, codigo, unidad_medida, stock_minimo)
      `)
      .eq('sucursal_id', sucursalId)

    if (errorSucursal) throw errorSucursal

    return minimosSucursal || []
  } catch (error) {
    devError('Error en obtenerTodosStockMinimosSucursalAction:', error)
    return []
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
        devError('Error en obtenerTransferenciasDiaAction:', error)
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
            return { success: false, error: 'Usuario no autenticado' }
        }

        const { data: result, error } = await supabase.rpc('fn_preparar_transferencia', {
            p_transferencia_id: transferenciaId,
            p_user_id: user.id,
            p_items_pesados: itemsPesados || null,
        })

        if (error) throw error
        if (!result.success) {
            return { success: false, error: result.error }
        }

        revalidatePath('/sucursales/transferencias')
        revalidatePath('/almacen/presupuestos-dia')

        return {
            success: true,
            message: 'Transferencia preparada exitosamente',
        }
    } catch (error: any) {
        devError('Error en prepararTransferenciaAction:', error)
        return { success: false, error: error.message || 'Error al preparar transferencia' }
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
            return { success: false, error: 'Usuario no autenticado' }
        }

        const { data: result, error } = await supabase.rpc('fn_asignar_transferencia_a_ruta', {
            p_transferencia_id: transferenciaId,
            p_ruta_id: rutaId,
            p_user_id: user.id,
        })

        if (error) throw error
        if (!result.success) {
            return { success: false, error: result.error }
        }

        revalidatePath('/sucursales/transferencias')
        revalidatePath('/reparto')

        return {
            success: true,
            message: 'Transferencia asignada a ruta',
        }
    } catch (error: any) {
        devError('Error en asignarTransferenciaRutaAction:', error)
        return { success: false, error: error.message || 'Error al asignar a ruta' }
    }
}

// Marcar transferencia como entregada (repartidor)
export async function entregarTransferenciaAction(transferenciaId: string) {
    try {
        const supabase = await createClient()

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
            return { success: false, error: 'Usuario no autenticado' }
        }

        const { data: result, error } = await supabase.rpc('fn_entregar_transferencia', {
            p_transferencia_id: transferenciaId,
            p_user_id: user.id,
        })

        if (error) throw error
        if (!result.success) {
            return { success: false, error: result.error }
        }

        revalidatePath('/sucursales/transferencias')
        revalidatePath('/reparto')

        return {
            success: true,
            message: 'Transferencia marcada como entregada',
        }
    } catch (error: any) {
        devError('Error en entregarTransferenciaAction:', error)
        return { success: false, error: error.message || 'Error al entregar transferencia' }
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
            return { success: false, error: 'Usuario no autenticado' }
        }

        const { data: result, error } = await supabase.rpc('fn_recibir_transferencia', {
            p_transferencia_id: transferenciaId,
            p_user_id: user.id,
            p_items_recibidos: itemsRecibidos || null,
        })

        if (error) {
            if (esErrorColumnaCostoUnitarioLotes(error)) {
                devLog('[Transferencias] Fallback compat para recepcion por columna lotes.costo_unitario inexistente')
                const fallback = await confirmarRecepcionTransferenciaFallbackCompat(
                    transferenciaId,
                    user.id,
                    itemsRecibidos
                )

                if (!fallback.success) {
                    return { success: false, error: fallback.error || 'Error al confirmar recepcion (fallback)' }
                }
            } else {
                throw error
            }
        } else if (!result?.success) {
            if (esErrorColumnaCostoUnitarioLotes(result?.error)) {
                devLog('[Transferencias] Fallback compat activado por error SQL en resultado RPC')
                const fallback = await confirmarRecepcionTransferenciaFallbackCompat(
                    transferenciaId,
                    user.id,
                    itemsRecibidos
                )

                if (!fallback.success) {
                    return { success: false, error: fallback.error || 'Error al confirmar recepcion (fallback)' }
                }
            } else {
                return { success: false, error: result.error }
            }
        }

        revalidatePath('/sucursales/transferencias')
        revalidatePath('/sucursal/transferencias')

        return {
            success: true,
            message: 'Transferencia recibida exitosamente',
        }
    } catch (error: any) {
        devError('Error en confirmarRecepcionTransferenciaAction:', error)
        return { success: false, error: error.message || 'Error al confirmar recepción' }
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
            return { success: false, error: 'Usuario no autenticado' }
        }

        const { data: result, error } = await supabase.rpc('fn_cancelar_transferencia', {
            p_transferencia_id: transferenciaId,
            p_user_id: user.id,
            p_motivo: motivo || 'Cancelada por usuario',
        })

        if (error) throw error
        if (!result.success) {
            return { success: false, error: result.error }
        }

        revalidatePath('/sucursales/transferencias')

        return {
            success: true,
            message: 'Transferencia cancelada y stock devuelto',
        }
    } catch (error: any) {
        devError('Error en cancelarTransferenciaAction:', error)
        return { success: false, error: error.message || 'Error al cancelar transferencia' }
    }
}

// Obtener transferencias pendientes de recibir para una sucursal
export async function obtenerTransferenciasPendientesRecepcionAction(sucursalId: string) {
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
        devError('Error en obtenerTransferenciasPendientesRecepcion:', error)
        return []
    }
}

// =============================================
// NUEVAS FUNCIONES: Gestión de Solicitudes Automáticas
// =============================================

// Obtener solicitudes automáticas pendientes
export async function obtenerSolicitudesAutomaticasAction() {
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
                    cantidad_sugerida,
                    cantidad_enviada,
                    cantidad_recibida,
                    producto:productos(id, nombre, codigo, unidad_medida, stock_minimo)
                )
            `)
            .eq('estado', 'solicitud_automatica')
            .eq('origen', 'automatica')
            .order('fecha_solicitud', { ascending: true })

        if (error) throw error
        return data || []
    } catch (error) {
        devError('Error en obtenerSolicitudesAutomaticas:', error)
        return []
    }
}

// Aprobar solicitud automática (convertir a transferencia pendiente)
export async function aprobarSolicitudAutomaticaAction(
    transferenciaId: string,
    itemsModificados?: { item_id: string; cantidad: number }[]
) {
    try {
        const supabase = await createClient()

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
            return { success: false, error: 'Usuario no autenticado' }
        }

        // Obtener la transferencia para verificar que tiene turno y fecha_entrega
        const { data: transferencia } = await supabase
            .from('transferencias_stock')
            .select('turno, fecha_entrega')
            .eq('id', transferenciaId)
            .single()

        // Si hay items modificados, actualizarlos primero
        if (itemsModificados && itemsModificados.length > 0) {
            for (const item of itemsModificados) {
                const { error: updateError } = await supabase
                    .from('transferencia_items')
                    .update({ cantidad_solicitada: item.cantidad })
                    .eq('id', item.item_id)
                    .eq('transferencia_id', transferenciaId)

                if (updateError) {
                    devError('Error actualizando item:', updateError)
                    return { success: false, error: 'Error al actualizar cantidades' }
                }
            }
        }

        // Reservar stock en Casa Central (igual que cuando se crea transferencia manual)
        // Esto descuenta del disponible para que no se venda mientras se prepara
        const { data: reservaResult, error: reservaError } = await supabase.rpc(
            'fn_reservar_stock_solicitud_automatica',
            { p_transferencia_id: transferenciaId }
        )

        if (reservaError || !reservaResult?.success) {
            devError('Error reservando stock:', reservaError || reservaResult?.error)
            return { 
                success: false, 
                error: reservaResult?.error || 'Error al reservar stock. Verifica disponibilidad.' 
            }
        }

        // Cambiar estado de solicitud_automatica a en_almacen (igual que presupuestos)
        // Esto hace que aparezca en "Presupuestos del Día" y siga el mismo flujo
        const { error: updateError } = await supabase
            .from('transferencias_stock')
            .update({
                estado: 'en_almacen', // Estado que aparece en Presupuestos del Día
                aprobado_por: user.id,
                fecha_aprobacion: new Date().toISOString()
            })
            .eq('id', transferenciaId)
            .eq('estado', 'solicitud_automatica')

        if (updateError) throw updateError

        revalidatePath('/sucursales/transferencias')
        revalidatePath('/sucursales/transferencias/solicitudes')

        return {
            success: true,
            message: 'Solicitud aprobada exitosamente'
        }
    } catch (error: any) {
        devError('Error en aprobarSolicitudAutomaticaAction:', error)
        return { success: false, error: error.message || 'Error al aprobar solicitud' }
    }
}

// Rechazar solicitud automática
export async function rechazarSolicitudAutomaticaAction(
    transferenciaId: string,
    motivo?: string
) {
    try {
        const supabase = await createClient()

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
            return { success: false, error: 'Usuario no autenticado' }
        }

        // Obtener observaciones actuales
        const { data: transferencia } = await supabase
            .from('transferencias_stock')
            .select('observaciones')
            .eq('id', transferenciaId)
            .single()

        const observacionesActuales = transferencia?.observaciones || ''
        const nuevaObservacion = observacionesActuales + '\nRechazada: ' + (motivo || 'Sin motivo especificado')

        // Cambiar estado a cancelada
        const { error: updateError } = await supabase
            .from('transferencias_stock')
            .update({
                estado: 'cancelada',
                observaciones: nuevaObservacion
            })
            .eq('id', transferenciaId)
            .eq('estado', 'solicitud_automatica')

        if (updateError) throw updateError

        revalidatePath('/sucursales/transferencias')
        revalidatePath('/sucursales/transferencias/solicitudes')

        return {
            success: true,
            message: 'Solicitud rechazada'
        }
    } catch (error: any) {
        devError('Error en rechazarSolicitudAutomaticaAction:', error)
        return { success: false, error: error.message || 'Error al rechazar solicitud' }
    }
}
