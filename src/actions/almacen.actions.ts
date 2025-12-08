'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { useNotificationStore } from '@/store/notificationStore'
import { getNowArgentina } from '@/lib/utils'
import { devError } from '@/lib/utils/logger'
import type {
  IngresarMercaderiaParams,
  MovimientoStockParams,
  ChecklistCalidadParams,
  ApiResponse,
  StockDisponibleResponse
} from '@/types/api.types'
import type { ProductoFormData } from '@/lib/schemas/productos.schema'

// Ingreso de mercadería
export async function ingresarMercaderiaAction(
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
    devError('Error al ingresar mercadería:', error)
    return {
      success: false,
      error: error.message || 'Error al ingresar mercadería',
    }
  }
}

// Actualizar lote
export async function actualizarLoteAction(
  loteId: string,
  updates: Partial<IngresarMercaderiaParams>
): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('lotes')
      .update({
        ...updates,
        updated_at: getNowArgentina().toISOString(),
      })
      .eq('id', loteId)

    if (error) throw error

    revalidatePath('/(admin)/(dominios)/almacen')

    return {
      success: true,
      message: 'Lote actualizado exitosamente',
    }
  } catch (error: any) {
    devError('Error al actualizar lote:', error)
    return {
      success: false,
      error: error.message || 'Error al actualizar lote',
    }
  }
}

// Registrar checklist de calidad
export async function registrarChecklistCalidadAction(
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
    devError('Error al registrar checklist:', error)
    return {
      success: false,
      error: error.message || 'Error al registrar checklist',
    }
  }
}

// Obtener stock disponible
export async function obtenerStockDisponibleAction(
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
    devError('Error al obtener stock:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener stock disponible',
    }
  }
}

// Ajustar stock
export async function ajustarStockAction(
  params: MovimientoStockParams
): Promise<ApiResponse> {
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
      return { success: false, error: 'No tienes permisos para ajustar stock' }
    }

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
        updated_at: getNowArgentina().toISOString(),
      })
      .eq('id', params.lote_id)

    if (updateError) throw updateError

    // Registrar movimiento con usuario_id
    const movimientoData: any = {
      lote_id: params.lote_id,
      tipo_movimiento: params.tipo_movimiento,
      cantidad: params.cantidad,
      motivo: params.motivo || 'Ajuste de stock',
      usuario_id: user.id,
    }
    
    const { error: movimientoError } = await supabase.from('movimientos_stock').insert(movimientoData)

    if (movimientoError) throw movimientoError

    revalidatePath('/(admin)/(dominios)/almacen')
    revalidatePath(`/(admin)/(dominios)/almacen/lotes/${params.lote_id}`)

    return {
      success: true,
      message: 'Stock ajustado exitosamente',
    }
  } catch (error: any) {
    devError('Error al ajustar stock:', error)
    return {
      success: false,
      error: error.message || 'Error al ajustar stock',
    }
  }
}

// Obtener lote por ID
export async function obtenerLotePorIdAction(loteId: string): Promise<ApiResponse<any>> {
  try {
    const supabase = await createClient()

    const { data: lote, error } = await supabase
      .from('lotes')
      .select(`
        *,
        producto:productos(id, codigo, nombre, unidad_medida, categoria)
      `)
      .eq('id', loteId)
      .single()

    if (error) throw error
    if (!lote) {
      return {
        success: false,
        error: 'Lote no encontrado',
      }
    }

    return {
      success: true,
      data: lote,
    }
  } catch (error: any) {
    devError('Error al obtener lote:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener lote',
    }
  }
}

// Obtener todos los lotes
export async function obtenerLotesAction(): Promise<ApiResponse> {
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
    devError('Error al obtener lotes:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener lotes',
    }
  }
}

// Reservar stock para picking
export async function reservarStockPickingAction(
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
    devError('Error al reservar stock:', error)
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
    devError('Error al registrar recepción ingreso:', error)
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
    devError('Error al registrar recepción egreso:', error)
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
    devError('Error al obtener presupuestos por zona/fecha:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener presupuestos',
    }
  }
}

// Crear producto
export async function crearProductoAction(
  data: ProductoFormData
): Promise<ApiResponse<{ productoId: string }>> {
  try {
    const supabase = await createClient()

    // Verificar permisos (admin o almacenista)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'almacenista'].includes(usuario.rol)) {
      return { success: false, error: 'No tienes permisos para crear productos' }
    }

    // Verificar que el código no exista
    const { data: productoExistente } = await supabase
      .from('productos')
      .select('id')
      .eq('codigo', data.codigo)
      .single()

    if (productoExistente) {
      return { success: false, error: 'Ya existe un producto con ese código' }
    }

    const { data: producto, error } = await supabase
      .from('productos')
      .insert({
        codigo: data.codigo,
        nombre: data.nombre,
        descripcion: data.descripcion || null,
        categoria: data.categoria || null,
        precio_venta: data.precio_venta,
        precio_costo: data.precio_costo || null,
        unidad_medida: data.unidad_medida,
        stock_minimo: data.stock_minimo,
        activo: data.activo ?? true,
      })
      .select()
      .single()

    if (error) throw error

    revalidatePath('/(admin)/(dominios)/almacen/productos')

    return {
      success: true,
      data: { productoId: producto.id },
      message: 'Producto creado exitosamente',
    }
  } catch (error: any) {
    devError('Error al crear producto:', error)
    return {
      success: false,
      error: error.message || 'Error al crear producto',
    }
  }
}

// Actualizar producto
export async function actualizarProductoAction(
  productoId: string,
  data: ProductoFormData
): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    // Verificar permisos (admin o almacenista)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'almacenista'].includes(usuario.rol)) {
      return { success: false, error: 'No tienes permisos para actualizar productos' }
    }

    // Verificar que el código no exista en otro producto
    const { data: productoExistente } = await supabase
      .from('productos')
      .select('id')
      .eq('codigo', data.codigo)
      .neq('id', productoId)
      .single()

    if (productoExistente) {
      return { success: false, error: 'Ya existe otro producto con ese código' }
    }

    const { error } = await supabase
      .from('productos')
      .update({
        codigo: data.codigo,
        nombre: data.nombre,
        descripcion: data.descripcion || null,
        categoria: data.categoria || null,
        precio_venta: data.precio_venta,
        precio_costo: data.precio_costo || null,
        unidad_medida: data.unidad_medida,
        stock_minimo: data.stock_minimo,
        activo: data.activo ?? true,
        updated_at: getNowArgentina().toISOString(),
      })
      .eq('id', productoId)

    if (error) throw error

    revalidatePath('/(admin)/(dominios)/almacen/productos')

    return {
      success: true,
      message: 'Producto actualizado exitosamente',
    }
  } catch (error: any) {
    devError('Error al actualizar producto:', error)
    return {
      success: false,
      error: error.message || 'Error al actualizar producto',
    }
  }
}

// Eliminar producto (soft delete)
export async function eliminarProductoAction(
  productoId: string
): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    // Verificar permisos (admin o almacenista)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'almacenista'].includes(usuario.rol)) {
      return { success: false, error: 'No tienes permisos para eliminar productos' }
    }

    const { error } = await supabase
      .from('productos')
      .update({
        activo: false,
        updated_at: getNowArgentina().toISOString(),
      })
      .eq('id', productoId)

    if (error) throw error

    revalidatePath('/(admin)/(dominios)/almacen/productos')

    return {
      success: true,
      message: 'Producto desactivado exitosamente',
    }
  } catch (error: any) {
    devError('Error al eliminar producto:', error)
    return {
      success: false,
      error: error.message || 'Error al eliminar producto',
    }
  }
}

// Eliminar lote (solo si no tiene movimientos y no está asociado a pedidos)
export async function eliminarLoteAction(loteId: string): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    // Verificar permisos (almacenista o admin)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'almacenista'].includes(usuario.rol)) {
      return { success: false, error: 'No tienes permisos para eliminar lotes' }
    }

    // Obtener lote para validar condiciones
    const { data: lote, error: loteError } = await supabase
      .from('lotes')
      .select('cantidad_disponible, cantidad_ingresada')
      .eq('id', loteId)
      .single()

    if (loteError) throw loteError
    if (!lote) {
      return { success: false, error: 'Lote no encontrado' }
    }

    // Validar que cantidad_disponible === cantidad_ingresada (sin movimientos)
    if (lote.cantidad_disponible !== lote.cantidad_ingresada) {
      return {
        success: false,
        error: 'No se puede eliminar un lote que tiene movimientos de stock. La cantidad disponible debe ser igual a la cantidad ingresada.',
      }
    }

    // Verificar que el lote no esté asociado a pedidos activos
    const { data: detallesPedido, error: detallesError } = await supabase
      .from('detalles_pedido')
      .select('pedido_id, pedidos!inner(estado)')
      .eq('lote_id', loteId)
      .in('pedidos.estado', ['pendiente', 'confirmado', 'preparando', 'enviado'])

    if (detallesError) throw detallesError

    if (detallesPedido && detallesPedido.length > 0) {
      return {
        success: false,
        error: 'No se puede eliminar un lote que está asociado a pedidos activos',
      }
    }

    // Eliminar lote (DELETE real)
    const { error: deleteError } = await supabase
      .from('lotes')
      .delete()
      .eq('id', loteId)

    if (deleteError) throw deleteError

    revalidatePath('/(admin)/(dominios)/almacen/lotes')
    revalidatePath('/(admin)/(dominios)/almacen')

    return {
      success: true,
      message: 'Lote eliminado exitosamente',
    }
  } catch (error: any) {
    devError('Error al eliminar lote:', error)
    return {
      success: false,
      error: error.message || 'Error al eliminar lote',
    }
  }
}

// Obtener productos
export async function obtenerProductosAction(): Promise<ApiResponse<any[]>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .order('nombre', { ascending: true })

    if (error) throw error

    return {
      success: true,
      data: data || [],
    }
  } catch (error: any) {
    devError('Error al obtener productos:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener productos',
    }
  }
}

// Obtener producto por ID
export async function obtenerProductoPorIdAction(productoId: string): Promise<ApiResponse<any>> {
  try {
    const supabase = await createClient()

    const { data: producto, error } = await supabase
      .from('productos')
      .select('*')
      .eq('id', productoId)
      .single()

    if (error) throw error
    if (!producto) {
      return {
        success: false,
        error: 'Producto no encontrado',
      }
    }

    // Normalizar valores null a valores por defecto para el formulario
    const productoNormalizado = {
      ...producto,
      descripcion: producto.descripcion ?? '',
      categoria: producto.categoria ?? '',
      precio_costo: producto.precio_costo ?? 0,
    }

    return {
      success: true,
      data: productoNormalizado,
    }
  } catch (error: any) {
    devError('Error al obtener producto:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener producto',
    }
  }
}

export async function buscarProductosPorCodigosAction(
  codigos: string[]
): Promise<ApiResponse<any[]>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .in('codigo', codigos)
      .order('codigo', { ascending: true })

    if (error) throw error

    return {
      success: true,
      data: data || [],
    }
  } catch (error: any) {
    devError('Error al buscar productos por códigos:', error)
    return {
      success: false,
      error: error.message || 'Error al buscar productos',
    }
  }
}

export async function actualizarCategoriaProductosAction(
  codigos: string[],
  categoria: string
): Promise<ApiResponse<{ actualizados: number }>> {
  try {
    const supabase = await createClient()

    // Verificar permisos (admin o almacenista)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'almacenista'].includes(usuario.rol)) {
      return { success: false, error: 'No tienes permisos para actualizar productos' }
    }

    // Actualizar categoría de todos los productos con esos códigos
    const { data, error } = await supabase
      .from('productos')
      .update({
        categoria: categoria,
        updated_at: getNowArgentina().toISOString(),
      })
      .in('codigo', codigos)
      .select('id, codigo, nombre')

    if (error) throw error

    revalidatePath('/(admin)/(dominios)/almacen/productos')

    return {
      success: true,
      message: `Categoría actualizada para ${data?.length || 0} productos`,
      data: { actualizados: data?.length || 0 },
    }
  } catch (error: any) {
    devError('Error al actualizar categoría de productos:', error)
    return {
      success: false,
      error: error.message || 'Error al actualizar categoría de productos',
    }
  }
}