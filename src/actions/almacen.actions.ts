'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { useNotificationStore } from '@/store/notificationStore'
import type {
  IngresarMercaderiaParams,
  MovimientoStockParams,
  ChecklistCalidadParams,
  ApiResponse,
  StockDisponibleResponse
} from '@/types/api.types'

// Ingreso de mercadería
export async function ingresarMercaderia(
  params: IngresarMercaderiaParams
): Promise<ApiResponse<{ loteId: string }>> {
  try {
    const supabase = await createClient()

    // Generar número de lote único
    const numeroLote = `LOTE-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`

    // Insertar lote
    const { data: lote, error } = await supabase
      .from('lotes')
      .insert({
        numero_lote: numeroLote,
        ...params,
        cantidad_disponible: params.cantidad,
        estado: 'disponible',
      })
      .select()
      .single()

    if (error) throw error

    // Registrar movimiento de stock
    await supabase.from('movimientos_stock').insert({
      lote_id: lote.id,
      tipo_movimiento: 'ingreso',
      cantidad: params.cantidad,
      motivo: 'Ingreso de mercadería',
    })

    revalidatePath('/(admin)/(dominios)/almacen')
    revalidatePath('/(admin)/(dominios)/almacen/ingresos')

    return {
      success: true,
      data: { loteId: lote.id },
      message: 'Mercadería ingresada exitosamente',
    }
  } catch (error: any) {
    console.error('Error al ingresar mercadería:', error)
    return {
      success: false,
      error: error.message || 'Error al ingresar mercadería',
    }
  }
}

// Actualizar lote
export async function actualizarLote(
  loteId: string,
  updates: Partial<IngresarMercaderiaParams>
): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('lotes')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', loteId)

    if (error) throw error

    revalidatePath('/(admin)/(dominios)/almacen')

    return {
      success: true,
      message: 'Lote actualizado exitosamente',
    }
  } catch (error: any) {
    console.error('Error al actualizar lote:', error)
    return {
      success: false,
      error: error.message || 'Error al actualizar lote',
    }
  }
}

// Registrar checklist de calidad
export async function registrarChecklistCalidad(
  params: ChecklistCalidadParams
): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('checklists_calidad')
      .insert(params)
      .select()
      .single()

    if (error) throw error

    // Si no está aprobado, actualizar estado del lote
    if (!params.aprobado) {
      await supabase
        .from('lotes')
        .update({ estado: 'rechazado' })
        .eq('id', params.lote_id)
    }

    revalidatePath('/(admin)/(dominios)/almacen')

    return {
      success: true,
      message: 'Checklist de calidad registrado exitosamente',
    }
  } catch (error: any) {
    console.error('Error al registrar checklist:', error)
    return {
      success: false,
      error: error.message || 'Error al registrar checklist',
    }
  }
}

// Obtener stock disponible
export async function obtenerStockDisponible(
  productoId: string
): Promise<ApiResponse<StockDisponibleResponse>> {
  try {
    const supabase = await createClient()

    const { data: lotes, error } = await supabase
      .from('lotes')
      .select(`
        id,
        numero_lote,
        cantidad_disponible,
        fecha_vencimiento,
        estado
      `)
      .eq('producto_id', productoId)
      .eq('estado', 'disponible')
      .gt('cantidad_disponible', 0)
      .order('fecha_vencimiento', { ascending: true })

    if (error) throw error

    const stockTotal = lotes.reduce((sum, lote) => sum + lote.cantidad_disponible, 0)

    return {
      success: true,
      data: {
        producto_id: productoId,
        stock_disponible: stockTotal,
        lotes: lotes.map(lote => ({
          lote_id: lote.id,
          cantidad_disponible: lote.cantidad_disponible,
          fecha_vencimiento: lote.fecha_vencimiento,
        })),
      },
    }
  } catch (error: any) {
    console.error('Error al obtener stock:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener stock disponible',
    }
  }
}

// Ajustar stock
export async function ajustarStock(
  params: MovimientoStockParams
): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    // Obtener lote actual
    const { data: lote, error: loteError } = await supabase
      .from('lotes')
      .select('cantidad_disponible')
      .eq('id', params.lote_id)
      .single()

    if (loteError) throw loteError

    let nuevaCantidad = lote.cantidad_disponible

    if (params.tipo_movimiento === 'ingreso') {
      nuevaCantidad += params.cantidad
    } else if (params.tipo_movimiento === 'salida' || params.tipo_movimiento === 'ajuste') {
      nuevaCantidad -= params.cantidad
      if (nuevaCantidad < 0) {
        throw new Error('No hay suficiente stock disponible')
      }
    }

    // Actualizar lote
    const { error: updateError } = await supabase
      .from('lotes')
      .update({
        cantidad_disponible: nuevaCantidad,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.lote_id)

    if (updateError) throw updateError

    // Registrar movimiento
    await supabase.from('movimientos_stock').insert(params)

    revalidatePath('/(admin)/(dominios)/almacen')

    return {
      success: true,
      message: 'Stock ajustado exitosamente',
    }
  } catch (error: any) {
    console.error('Error al ajustar stock:', error)
    return {
      success: false,
      error: error.message || 'Error al ajustar stock',
    }
  }
}

// Obtener todos los lotes
export async function obtenerLotes(): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    const { data: lotes, error } = await supabase
      .from('lotes')
      .select(`
        *,
        productos (
          id,
          codigo,
          nombre,
          unidad_medida
        )
      `)
      .order('fecha_ingreso', { ascending: false })

    if (error) throw error

    return {
      success: true,
      data: lotes,
    }
  } catch (error: any) {
    console.error('Error al obtener lotes:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener lotes',
    }
  }
}

// Reservar stock para picking
export async function reservarStockPicking(
  pedidoId: string
): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    // Obtener detalles del pedido
    const { data: detalles, error: detallesError } = await supabase
      .from('detalles_pedido')
      .select(`
        id,
        producto_id,
        cantidad,
        lote_id
      `)
      .eq('pedido_id', pedidoId)

    if (detallesError) throw detallesError

    // Para cada detalle, reservar stock del lote asignado
    for (const detalle of detalles) {
      if (detalle.lote_id) {
        const { error: reservaError } = await supabase.rpc('reservar_stock_lote', {
          p_lote_id: detalle.lote_id,
          p_cantidad: detalle.cantidad,
          p_pedido_id: pedidoId,
        })

        if (reservaError) throw reservaError
      }
    }

    revalidatePath('/(admin)/(dominios)/almacen')
    revalidatePath('/(admin)/(dominios)/ventas')

    return {
      success: true,
      message: 'Stock reservado para picking exitosamente',
    }
  } catch (error: any) {
    console.error('Error al reservar stock:', error)
    return {
      success: false,
      error: error.message || 'Error al reservar stock para picking',
    }
  }
}

// Registrar recepción de ingreso
export async function registrarRecepcionIngresoAction(formData: FormData): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Verificar permisos (almacenista o admin)
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'almacenista'].includes(usuario.rol)) {
      return { success: false, error: 'No tienes permisos para registrar recepciones' }
    }

    // Parsear datos
    const producto_id = formData.get('producto_id') as string
    const lote_id = formData.get('lote_id') as string
    const cantidad = parseFloat(formData.get('cantidad') as string)
    const unidad_medida = formData.get('unidad_medida') as string || 'kg'
    const motivo = formData.get('motivo') as string || 'compra'

    if (!producto_id || !cantidad || !motivo) {
      return { success: false, error: 'Faltan datos requeridos' }
    }

    // Insertar recepción
    const { error: insertError } = await supabase
      .from('recepcion_almacen')
      .insert({
        tipo: 'ingreso',
        producto_id,
        lote_id: lote_id || null,
        cantidad,
        unidad_medida,
        motivo,
        destino_produccion: false,
        usuario_id: user.id,
      })

    if (insertError) throw insertError

    // Si hay lote_id, actualizar cantidad disponible
    if (lote_id) {
      await supabase.rpc('reservar_stock_lote', {
        p_lote_id: lote_id,
        p_cantidad: -cantidad, // Negativo para incrementar
        p_pedido_id: null,
      })
    }

    revalidatePath('/(admin)/(dominios)/almacen/recepcion')

    return {
      success: true,
      message: 'Recepción de ingreso registrada exitosamente',
    }
  } catch (error: any) {
    console.error('Error al registrar recepción ingreso:', error)
    return {
      success: false,
      error: error.message || 'Error al registrar recepción',
    }
  }
}

// Registrar recepción de egreso
export async function registrarRecepcionEgresoAction(formData: FormData): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Verificar permisos (almacenista o admin)
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'almacenista'].includes(usuario.rol)) {
      return { success: false, error: 'No tienes permisos para registrar recepciones' }
    }

    // Parsear datos
    const producto_id = formData.get('producto_id') as string
    const cantidad = parseFloat(formData.get('cantidad') as string)
    const unidad_medida = formData.get('unidad_medida') as string || 'kg'
    const motivo = formData.get('motivo') as string || 'ajuste'
    const destino_produccion = formData.get('destino_produccion') === 'true'

    if (!producto_id || !cantidad || !motivo) {
      return { success: false, error: 'Faltan datos requeridos' }
    }

    // Insertar recepción
    const { error: insertError } = await supabase
      .from('recepcion_almacen')
      .insert({
        tipo: 'egreso',
        producto_id,
        lote_id: null,
        cantidad,
        unidad_medida,
        motivo,
        destino_produccion,
        usuario_id: user.id,
      })

    if (insertError) throw insertError

    // Si es para producción y el producto tiene categoria BALANZA, crear cortes
    if (destino_produccion) {
      // Lógica para crear cortes (productos con categoria BALANZA)
      // Esto se puede implementar más adelante
    }

    revalidatePath('/(admin)/(dominios)/almacen/recepcion')

    return {
      success: true,
      message: 'Recepción de egreso registrada exitosamente',
    }
  } catch (error: any) {
    console.error('Error al registrar recepción egreso:', error)
    return {
      success: false,
      error: error.message || 'Error al registrar recepción',
    }
  }
}

// Obtener presupuestos por zona, fecha y turno
export async function obtenerPresupuestosPorZonaFechaAction(
  zonaId: string,
  fecha: string,
  turno?: 'mañana' | 'tarde'
): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    let query = supabase
      .from('presupuestos')
      .select(`
        *,
        cliente:clientes(nombre, telefono),
        zona:zonas(nombre),
        items:presupuesto_items(
          id,
          cantidad_solicitada,
          cantidad_reservada,
          pesable,
          peso_final,
          producto:productos(nombre, codigo, categoria)
        )
      `)
      .eq('zona_id', zonaId)
      .eq('fecha_entrega_estimada', fecha)
      .eq('estado', 'en_almacen')

    if (turno) {
      query = query.eq('turno', turno)
    }

    const { data, error } = await query.order('created_at', { ascending: true })

    if (error) throw error

    // Calcular total de KG aproximado
    const totalKgAproximado = data?.reduce((acc, presupuesto) => {
      return acc + (presupuesto.items?.reduce((sum: number, item: any) => {
        if (item.pesable) {
          return sum + (item.peso_final || item.cantidad_solicitada || 0)
        }
        return sum
      }, 0) || 0)
    }, 0) || 0

    return {
      success: true,
      data: {
        presupuestos: data,
        total_kg_aproximado: totalKgAproximado,
        total_presupuestos: data?.length || 0,
      },
    }
  } catch (error: any) {
    console.error('Error al obtener presupuestos por zona/fecha:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener presupuestos',
    }
  }
}