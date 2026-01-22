'use server'

import { createClient } from '@/lib/supabase/server'
import { RemitoService, type RemitoData, type RemitoItem } from '@/lib/services/documents/remito-service'
import { revalidatePath } from 'next/cache'

const EMISOR_DEFAULT = {
    nombre: 'Avícola del Sur',
    cuit: '30-12345678-9',
    direccion: 'Av. Principal 123, Tucumán',
    telefono: '0381-4220000'
}

/**
 * Acción para generar remito de entrega (Externo)
 */
export async function generarRemitoEntregaAction(entregaId: string) {
    try {
        const supabase = await createClient()

        // 0. Verificar si ya existe un remito
        const { data: existente } = await supabase
            .from('remitos')
            .select('*')
            .eq('entidad_relacionada_id', entregaId)
            .eq('entidad_relacionada_tipo', 'entrega')
            .maybeSingle()

        if (existente) {
            return { success: true, data: existente }
        }

        // 1. Obtener datos de la entrega
        const { data: entrega, error: entregaError } = await supabase
            .from('entregas')
            .select(`
        *,
        cliente:clientes(*),
        pedido:pedidos(numero_pedido, fecha_pedido),
        items:detalles_pedido(
          *,
          producto:productos(id, nombre, unidad_medida)
        )
      `)
            .eq('id', entregaId)
            .single()

        if (entregaError || !entrega) throw new Error('Entrega no encontrada')

        // 2. Generar número de remito
        const { data: numero, error: seqError } = await supabase.rpc('fn_generar_numero_remito')
        if (seqError) throw seqError

        // 3. Preparar datos para el PDF
        const remitoData: RemitoData = {
            tipo: 'externo',
            titulo: 'REMITO DE ENTREGA',
            numero: numero,
            fecha: new Date().toLocaleDateString('es-AR'),
            emisor: EMISOR_DEFAULT,
            receptor: {
                nombre: entrega.cliente.nombre,
                cuit: entrega.cliente.cuit || '',
                direccion: entrega.cliente.direccion || ''
            },
            items: (entrega.items || []).map((item: any) => ({
                nombre: item.producto.nombre,
                cantidad: item.cantidad,
                peso: item.peso_final,
                unidad: item.producto.unidad_medida,
                precio: item.precio_unitario,
                subtotal: item.subtotal
            })),
            total: entrega.total,
            notas: entrega.notas_entrega,
            firmaUrl: entrega.firma_url
        }

        // 4. Generar y Subir PDF
        const { url } = await RemitoService.generarYSubir(remitoData)

        // 5. Guardar en tabla remitos
        const { data: remito, error: insertError } = await supabase
            .from('remitos')
            .insert({
                numero: numero,
                tipo: 'externo',
                emisor_id: (await supabase.auth.getUser()).data.user?.id,
                cliente_id: entrega.cliente_id,
                entidad_relacionada_id: entregaId,
                entidad_relacionada_tipo: 'entrega',
                datos_snapshot: remitoData,
                archivo_url: url,
                firma_url: entrega.firma_url,
                notas: entrega.notas_entrega
            })
            .select()
            .single()

        if (insertError) throw insertError

        // 6. Actualizar la entrega con el link al remito si fuera necesario (opcional)
        // Por ahora lo dejamos en la tabla remitos que está vinculada por entidad_relacionada_id

        revalidatePath('/repartidor')
        return { success: true, data: remito }

    } catch (error: any) {
        console.error('Error generando remito entrega:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Acción para generar remito de transferencia (Interno)
 */
export async function generarRemitoTransferenciaAction(transferenciaId: string) {
    try {
        const supabase = await createClient()

        // 0. Verificar existente
        const { data: existente } = await supabase
            .from('remitos')
            .select('*')
            .eq('entidad_relacionada_id', transferenciaId)
            .eq('entidad_relacionada_tipo', 'transferencia')
            .maybeSingle()

        if (existente) return { success: true, data: existente }

        // 1. Obtener datos de la transferencia
        const { data: trans, error: transError } = await supabase
            .from('transferencias_stock')
            .select(`
        *,
        sucursal_origen:sucursales!sucursal_origen_id(id, nombre, direccion),
        sucursal_destino:sucursales!sucursal_destino_id(id, nombre, direccion),
        items:transferencia_items(
          *,
          producto:productos(id, nombre, unidad_medida)
        )
      `)
            .eq('id', transferenciaId)
            .single()

        if (transError || !trans) throw new Error('Transferencia no encontrada')

        // 2. Generar número
        const { data: numero } = await supabase.rpc('fn_generar_numero_remito')

        // 3. Preparar datos
        const remitoData: RemitoData = {
            tipo: 'interno_traslado',
            titulo: 'REMITO INTERNO - TRASLADO',
            numero: numero,
            fecha: new Date().toLocaleDateString('es-AR'),
            emisor: {
                nombre: trans.sucursal_origen.nombre,
                direccion: trans.sucursal_origen.direccion
            },
            receptor: {
                nombre: trans.sucursal_destino.nombre,
                direccion: trans.sucursal_destino.direccion
            },
            items: (trans.items || []).map((item: any) => ({
                nombre: item.producto.nombre,
                cantidad: item.cantidad_enviada || item.cantidad_solicitada,
                peso: item.peso_preparado,
                unidad: item.producto.unidad_medida
            })),
            notas: trans.observaciones
        }

        // 4. Generar y Subir
        const { url } = await RemitoService.generarYSubir(remitoData)

        // 5. Guardar
        const { data: remito, error: insertError } = await supabase
            .from('remitos')
            .insert({
                numero: numero,
                tipo: 'interno_traslado',
                emisor_id: (await supabase.auth.getUser()).data.user?.id,
                sucursal_origen_id: trans.sucursal_origen_id,
                sucursal_destino_id: trans.sucursal_destino_id,
                entidad_relacionada_id: transferenciaId,
                entidad_relacionada_tipo: 'transferencia',
                datos_snapshot: remitoData,
                archivo_url: url
            })
            .select()
            .single()

        if (insertError) throw insertError

        revalidatePath('/sucursales/transferencias')
        return { success: true, data: remito }

    } catch (error: any) {
        console.error('Error generando remito transferencia:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Acción para generar remito de producción (Interno)
 */
export async function generarRemitoProduccionAction(ordenId: string) {
    try {
        const supabase = await createClient()

        // 0. Verificar existente
        const { data: existente } = await supabase
            .from('remitos')
            .select('*')
            .eq('entidad_relacionada_id', ordenId)
            .eq('entidad_relacionada_tipo', 'produccion')
            .maybeSingle()

        if (existente) return { success: true, data: existente }

        // 1. Obtener datos de la orden
        const { data: orden, error: ordenError } = await supabase
            .from('ordenes_produccion')
            .select(`
        *,
        operario:usuarios!operario_id(id, nombre, apellido),
        entradas:orden_produccion_entradas(
          *,
          producto:productos(id, nombre, unidad_medida)
        )
      `)
            .eq('id', ordenId)
            .single()

        if (ordenError || !orden) throw new Error('Orden de producción no encontrada')

        // 2. Generar número
        const { data: numero } = await supabase.rpc('fn_generar_numero_remito')

        // 3. Preparar datos
        const remitoData: RemitoData = {
            tipo: 'interno_produccion',
            titulo: 'REMITO INTERNO - PRODUCCIÓN',
            numero: numero,
            fecha: new Date().toLocaleDateString('es-AR'),
            emisor: {
                nombre: 'Sector Producción / Desposte'
            },
            receptor: EMISOR_DEFAULT, // Entra al stock central
            items: (orden.entradas || []).map((item: any) => ({
                nombre: item.producto.nombre,
                cantidad: item.cantidad,
                peso: item.peso_kg,
                unidad: item.producto.unidad_medida
            })),
            notas: `Orden de producción: ${orden.numero_orden}. Operario: ${orden.operario.nombre} ${orden.operario.apellido}`
        }

        // 4. Generar y Subir
        const { url } = await RemitoService.generarYSubir(remitoData)

        // 5. Guardar
        const { data: remito, error: insertError } = await supabase
            .from('remitos')
            .insert({
                numero: numero,
                tipo: 'interno_produccion',
                emisor_id: (await supabase.auth.getUser()).data.user?.id,
                entidad_relacionada_id: ordenId,
                entidad_relacionada_tipo: 'produccion',
                datos_snapshot: remitoData,
                archivo_url: url
            })
            .select()
            .single()

        if (insertError) throw insertError

        revalidatePath('/almacen/produccion')
        return { success: true, data: remito }

    } catch (error: any) {
        console.error('Error generando remito producción:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Obtener remitos relacionados a una entidad
 */
export async function obtenerRemitosPorEntidadAction(tipo: 'entrega' | 'transferencia' | 'produccion', id: string) {
    try {
        const supabase = await createClient()
        const { data, error } = await supabase
            .from('remitos')
            .select('*')
            .eq('entidad_relacionada_tipo', tipo)
            .eq('entidad_relacionada_id', id)
            .order('created_at', { ascending: false })

        if (error) throw error
        return { success: true, data }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
