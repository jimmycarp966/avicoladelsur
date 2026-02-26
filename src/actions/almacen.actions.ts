'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { useNotificationStore } from '@/store/notificationStore'
import { getNowArgentina } from '@/lib/utils'
import { devError } from '@/lib/utils/logger'
import { buildBarcodeLookupCandidates } from '@/lib/barcode-lookup'
import type {
  IngresarMercaderiaParams,
  MovimientoStockParams,
  ChecklistCalidadParams,
  ApiResponse,
  StockDisponibleResponse
} from '@/types/api.types'
import type { ProductoFormInput } from '@/lib/schemas/productos.schema'

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
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
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
    const unidad_medida = (formData.get('unidad_medida') as string) || 'kg'
    const motivo = (formData.get('motivo') as string) || 'compra'

    const proveedor_id_raw = formData.get('proveedor_id')
    const factura_proveedor_id_raw = formData.get('factura_proveedor_id')
    const numero_comprobante_ref_raw = formData.get('numero_comprobante_ref')
    const tipo_comprobante_ref_raw = formData.get('tipo_comprobante_ref')
    const fecha_comprobante_raw = formData.get('fecha_comprobante')
    const monto_compra_raw = formData.get('monto_compra')

    const proveedor_id =
      typeof proveedor_id_raw === 'string' && proveedor_id_raw.trim() ? proveedor_id_raw.trim() : null
    let factura_proveedor_id =
      typeof factura_proveedor_id_raw === 'string' && factura_proveedor_id_raw.trim()
        ? factura_proveedor_id_raw.trim()
        : null
    let numero_comprobante_ref =
      typeof numero_comprobante_ref_raw === 'string' && numero_comprobante_ref_raw.trim()
        ? numero_comprobante_ref_raw.trim()
        : null
    const tipo_comprobante_ref =
      typeof tipo_comprobante_ref_raw === 'string' && tipo_comprobante_ref_raw.trim()
        ? tipo_comprobante_ref_raw.trim()
        : 'factura'
    const fecha_comprobante =
      typeof fecha_comprobante_raw === 'string' && fecha_comprobante_raw.trim()
        ? fecha_comprobante_raw.trim()
        : null
    const monto_compra =
      typeof monto_compra_raw === 'string' && monto_compra_raw.trim()
        ? parseFloat(monto_compra_raw)
        : null

    if (!producto_id || !cantidad || !motivo) {
      return { success: false, error: 'Faltan datos requeridos' }
    }

    const esCompra = motivo === 'compra'
    if (esCompra && !proveedor_id) {
      return { success: false, error: 'Debe seleccionar proveedor para registrar compras y deuda' }
    }

    if (factura_proveedor_id) {
      const { data: facturaExistente, error: facturaError } = await supabase
        .from('proveedores_facturas')
        .select('id, proveedor_id, numero_factura')
        .eq('id', factura_proveedor_id)
        .single()

      if (facturaError || !facturaExistente) {
        return { success: false, error: 'La factura seleccionada no existe o no esta disponible' }
      }

      if (proveedor_id && facturaExistente.proveedor_id !== proveedor_id) {
        return { success: false, error: 'La factura seleccionada no pertenece al proveedor indicado' }
      }

      if (!numero_comprobante_ref) {
        numero_comprobante_ref = facturaExistente.numero_factura
      }
    } else if (esCompra) {
      if (!numero_comprobante_ref) {
        return { success: false, error: 'Debe informar numero de comprobante para compras nuevas' }
      }

      if (!monto_compra || Number.isNaN(monto_compra) || monto_compra <= 0) {
        return { success: false, error: 'Debe informar un monto de compra mayor a cero' }
      }

      const fechaEmision = fecha_comprobante || new Date().toISOString().slice(0, 10)

      const payloadFactura = {
        proveedor_id,
        numero_factura: numero_comprobante_ref,
        tipo_comprobante: tipo_comprobante_ref || 'factura',
        fecha_emision: fechaEmision,
        monto_total: monto_compra,
        monto_pagado: 0,
        estado: 'pendiente',
        descripcion: 'Generada automaticamente desde recepcion de almacen',
        creado_por: user.id,
      }

      let facturaNueva: { id: string } | null = null
      let facturaNuevaError: any = null

      try {
        const adminClient = createAdminClient()
        const result = await adminClient
          .from('proveedores_facturas')
          .insert(payloadFactura)
          .select('id')
          .single()

        facturaNueva = result.data
        facturaNuevaError = result.error
      } catch (adminClientError) {
        devError('createAdminClient no disponible, intentando con cliente autenticado:', adminClientError)
        const fallback = await supabase
          .from('proveedores_facturas')
          .insert(payloadFactura)
          .select('id')
          .single()

        facturaNueva = fallback.data
        facturaNuevaError = fallback.error
      }

      if (facturaNuevaError) {
        if ((facturaNuevaError as any).code !== '23505') {
          throw facturaNuevaError
        }

        // Si ya existe la factura para ese proveedor/comprobante, la reutilizamos.
        const { data: facturaDuplicada, error: facturaDuplicadaError } = await supabase
          .from('proveedores_facturas')
          .select('id')
          .eq('proveedor_id', proveedor_id)
          .eq('numero_factura', numero_comprobante_ref)
          .single()

        if (facturaDuplicadaError || !facturaDuplicada) {
          throw facturaNuevaError
        }

        factura_proveedor_id = facturaDuplicada.id
      } else {
        factura_proveedor_id = facturaNueva.id
      }
    }

    // Insertar recepcion
    const { error: insertError } = await supabase.from('recepcion_almacen').insert({
      tipo: 'ingreso',
      producto_id,
      lote_id: lote_id || null,
      cantidad,
      unidad_medida,
      motivo,
      proveedor_id,
      factura_proveedor_id,
      numero_comprobante_ref,
      tipo_comprobante_ref,
      fecha_comprobante,
      monto_compra: !monto_compra || Number.isNaN(monto_compra) ? null : monto_compra,
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
    revalidatePath('/tesoreria/proveedores')
    if (proveedor_id) {
      revalidatePath(`/tesoreria/proveedores/${proveedor_id}`)
    }

    return {
      success: true,
      message: 'Recepcion de ingreso registrada y sincronizada con proveedores',
    }
  } catch (error: any) {
    devError('Error al registrar recepcion ingreso:', error)
    return {
      success: false,
      error: error.message || 'Error al registrar recepcion',
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
  data: ProductoFormInput
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
        // Campos de venta por mayor
        venta_mayor_habilitada: data.venta_mayor_habilitada ?? false,
        unidad_mayor_nombre: data.unidad_mayor_nombre || 'caja',
        kg_por_unidad_mayor: data.kg_por_unidad_mayor || 20,
        requiere_pesaje: data.requiere_pesaje ?? false,
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
  data: ProductoFormInput
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
        // Campos de venta por mayor
        venta_mayor_habilitada: data.venta_mayor_habilitada ?? false,
        unidad_mayor_nombre: data.unidad_mayor_nombre || 'caja',
        kg_por_unidad_mayor: data.kg_por_unidad_mayor || 20,
        requiere_pesaje: data.requiere_pesaje ?? false,
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

// Buscar producto por codigo de barras o PLU.
// Soporta codigos EAN-13 con peso embebido de balanza SDP.
export async function buscarProductoPorCodigoBarrasAction(
  codigo: string
): Promise<ApiResponse<{
  producto: any
  stockDisponible: number
}>> {
  try {
    const supabase = await createClient()
    const codigoLimpio = codigo.trim()

    if (!codigoLimpio) {
      return {
        success: false,
        error: 'Codigo vacio',
      }
    }

    const {
      barcodeCandidates,
      productCodeCandidates,
    } = buildBarcodeLookupCandidates(codigoLimpio)

    let producto = null

    // 1) Buscar por codigo_barras exacto (prioridad maxima).
    for (const barcodeCandidate of barcodeCandidates) {
      const { data } = await supabase
        .from('productos')
        .select('*')
        .eq('codigo_barras', barcodeCandidate)
        .eq('activo', true)
        .single()

      if (data) {
        producto = data
        break
      }
    }

    // 2) Buscar por codigo interno / PLU con variantes.
    if (!producto) {
      for (const codeCandidate of productCodeCandidates) {
        const { data } = await supabase
          .from('productos')
          .select('*')
          .eq('codigo', codeCandidate)
          .eq('activo', true)
          .single()

        if (data) {
          producto = data
          break
        }
      }
    }

    if (!producto) {
      return {
        success: false,
        error: `Producto no encontrado para codigo: ${codigoLimpio}`,
      }
    }

    const { data: lotes } = await supabase
      .from('lotes')
      .select('cantidad_disponible')
      .eq('producto_id', producto.id)
      .eq('estado', 'disponible')
      .gt('cantidad_disponible', 0)

    const stockDisponible = lotes?.reduce(
      (sum, lote) => sum + (lote.cantidad_disponible || 0),
      0
    ) || 0

    return {
      success: true,
      data: {
        producto,
        stockDisponible,
      },
    }
  } catch (error: any) {
    devError('Error al buscar producto por codigo de barras:', error)
    return {
      success: false,
      error: error.message || 'Error al buscar producto',
    }
  }
}

