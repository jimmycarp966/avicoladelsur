'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type {
  CrearPedidoParams,
  CrearPedidoBotParams,
  CrearPedidoBotResponse,
  CrearCotizacionParams,
  CrearReclamoParams,
  CrearReclamoBotParams,
  ApiResponse
} from '@/types/api.types'

// Crear cliente
export async function crearCliente(
  clienteData: {
    nombre: string
    telefono?: string
    whatsapp?: string
    email?: string
    direccion?: string
    zona_entrega?: string
    coordenadas?: { lat: number; lng: number }
    tipo_cliente?: string
    limite_credito?: number
  }
): Promise<ApiResponse<{ clienteId: string }>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('clientes')
      .insert({
        ...clienteData,
        activo: true,
      })
      .select()
      .single()

    if (error) throw error

    revalidatePath('/(admin)/(dominios)/ventas/clientes')

    return {
      success: true,
      data: { clienteId: data.id },
      message: 'Cliente creado exitosamente',
    }
  } catch (error: any) {
    console.error('Error al crear cliente:', error)
    return {
      success: false,
      error: error.message || 'Error al crear cliente',
    }
  }
}

// Crear cliente desde bot (WhatsApp)
export async function crearClienteDesdeBot(
  clienteData: {
    nombre: string
    apellido?: string
    telefono?: string
    whatsapp: string
    direccion: string
    localidad_id: string
  }
): Promise<ApiResponse<{ clienteId: string; cliente: any }>> {
  try {
    const supabase = await createClient()

    // Validar que la localidad existe y está activa
    const { data: localidad, error: localidadError } = await supabase
      .from('localidades')
      .select('id, nombre, zona_id')
      .eq('id', clienteData.localidad_id)
      .eq('activo', true)
      .single()

    if (localidadError || !localidad) {
      return {
        success: false,
        error: 'Localidad no válida o no encontrada',
      }
    }

    // Construir nombre completo
    const nombreCompleto = clienteData.apellido
      ? `${clienteData.nombre} ${clienteData.apellido}`
      : clienteData.nombre

    // Obtener zona_id de la localidad
    const { data: cliente, error } = await supabase
      .from('clientes')
      .insert({
        nombre: nombreCompleto,
        telefono: clienteData.telefono || clienteData.whatsapp,
        whatsapp: clienteData.whatsapp,
        direccion: clienteData.direccion,
        localidad_id: clienteData.localidad_id,
        tipo_cliente: 'minorista',
        limite_credito: 0,
        activo: true,
      })
      .select()
      .single()

    if (error) throw error

    // Crear cuenta corriente para el nuevo cliente
    await supabase.rpc('fn_asegurar_cuenta_corriente', {
      p_cliente_id: cliente.id,
    })

    revalidatePath('/(admin)/(dominios)/ventas/clientes')

    return {
      success: true,
      data: {
        clienteId: cliente.id,
        cliente: cliente,
      },
      message: 'Cliente creado exitosamente',
    }
  } catch (error: any) {
    console.error('Error al crear cliente desde bot:', error)
    return {
      success: false,
      error: error.message || 'Error al crear cliente',
    }
  }
}

// Eliminar cliente (soft delete)
export async function eliminarCliente(
  clienteId: string
): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    // Verificar permisos (admin o vendedor)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'vendedor'].includes(usuario.rol)) {
      return { success: false, error: 'No tienes permisos para eliminar clientes' }
    }

    const { error } = await supabase
      .from('clientes')
      .update({
        activo: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', clienteId)

    if (error) throw error

    revalidatePath('/(admin)/(dominios)/ventas/clientes')

    return {
      success: true,
      message: 'Cliente desactivado exitosamente',
    }
  } catch (error: any) {
    console.error('Error al eliminar cliente:', error)
    return {
      success: false,
      error: error.message || 'Error al eliminar cliente',
    }
  }
}

// Actualizar cliente
export async function actualizarCliente(
  clienteId: string,
  updates: Partial<{
    nombre: string
    telefono?: string
    whatsapp?: string
    email?: string
    direccion?: string
    zona_entrega?: string
    coordenadas?: { lat: number; lng: number }
    tipo_cliente?: string
    limite_credito?: number
    activo?: boolean
  }>
): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('clientes')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', clienteId)

    if (error) throw error

    revalidatePath('/(admin)/(dominios)/ventas/clientes')

    return {
      success: true,
      message: 'Cliente actualizado exitosamente',
    }
  } catch (error: any) {
    console.error('Error al actualizar cliente:', error)
    return {
      success: false,
      error: error.message || 'Error al actualizar cliente',
    }
  }
}

// Obtener clientes
export async function obtenerClientes(
  filtros?: {
    search?: string
    zona_entrega?: string
    activo?: boolean
    page?: number
    limit?: number
  }
): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    let query = supabase
      .from('clientes')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (filtros?.search) {
      query = query.or(`nombre.ilike.%${filtros.search}%,telefono.ilike.%${filtros.search}%`)
    }

    if (filtros?.zona_entrega) {
      query = query.eq('zona_entrega', filtros.zona_entrega)
    }

    if (filtros?.activo !== undefined) {
      query = query.eq('activo', filtros.activo)
    }

    if (filtros?.page && filtros?.limit) {
      const from = (filtros.page - 1) * filtros.limit
      const to = from + filtros.limit - 1
      query = query.range(from, to)
    }

    const { data, error, count } = await query

    if (error) throw error

    return {
      success: true,
      data: data,
      pagination: filtros?.page && filtros?.limit ? {
        page: filtros.page,
        limit: filtros.limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / filtros.limit),
      } : undefined,
    }
  } catch (error: any) {
    console.error('Error al obtener clientes:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener clientes',
    }
  }
}

// Crear pedido
export async function crearPedido(
  params: CrearPedidoParams
): Promise<ApiResponse<{ pedidoId: string }>> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const itemsPayload = params.items.map(item => ({
      producto_id: item.producto_id,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario ?? null,
    }))

    const pagoPayload = params.pago
      ? {
          modalidad: params.pago.modalidad,
          monto: params.pago.monto ?? null,
          caja_id: params.pago.caja_id ?? null,
          tipo_pago: params.pago.tipo_pago ?? 'efectivo',
        }
      : {
          modalidad: 'contado' as const,
          monto: null,
          caja_id: null,
          tipo_pago: 'efectivo' as const,
        }

    const { data, error } = await supabase.rpc('fn_procesar_pedido', {
      p_cliente_id: params.cliente_id,
      p_items: itemsPayload,
      p_usuario_id: user?.id ?? null,
      p_fecha_entrega_estimada: params.fecha_entrega_estimada ?? null,
      p_origen: 'web',
      p_descuento: params.descuento ?? 0,
      p_pago: pagoPayload,
      p_observaciones: params.observaciones ?? null,
    })

    if (error) throw error
    if (!data?.success) {
      throw new Error(data?.error || 'Error al crear pedido')
    }

    revalidatePath('/(admin)/(dominios)/almacen/pedidos')

    return {
      success: true,
      data: { pedidoId: data.pedido_id },
      message: 'Pedido creado exitosamente',
    }
  } catch (error: any) {
    console.error('Error al crear pedido:', error)
    return {
      success: false,
      error: error.message || 'Error al crear pedido',
    }
  }
}

// Crear pedido desde bot (usa función RPC)
export async function crearPedidoBot(
  params: CrearPedidoBotParams
): Promise<ApiResponse<CrearPedidoBotResponse>> {
  try {
    const supabase = await createClient()

    const itemsJson = params.items.map(item => ({
      producto_id: item.producto_id,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
    }))

    const { data, error } = await supabase.rpc('fn_crear_pedido_bot', {
      p_cliente_id: params.cliente_id,
      p_items_json: itemsJson,
      p_observaciones: params.observaciones,
      p_pago: params.pago
        ? {
            modalidad: params.pago.modalidad,
            monto: params.pago.monto ?? null,
            tipo_pago: params.pago.tipo_pago ?? 'efectivo',
          }
        : null,
      p_fecha_entrega_estimada: params.fecha_entrega_estimada ?? null,
    })

    if (error) throw error

    if (!data.success) {
      throw new Error(data.error || 'Error al crear pedido desde bot')
    }

    revalidatePath('/(admin)/(dominios)/almacen/pedidos')

    return {
      success: true,
      data: {
        pedidoId: data.pedido_id,
        numeroPedido: data.numero_pedido,
        total: data.total,
        referenciaPago: data.referencia_pago || null,
        instruccionRepartidor: data.instruccion_repartidor || null,
      },
      message: 'Pedido creado desde bot exitosamente',
    }
  } catch (error: any) {
    console.error('Error al crear pedido desde bot:', error)
    return {
      success: false,
      error: error.message || 'Error al crear pedido desde bot',
    }
  }
}

// Actualizar estado de pedido
export async function actualizarEstadoPedido(
  pedidoId: string,
  estado: string
): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('pedidos')
      .update({
        estado,
        updated_at: new Date().toISOString(),
        ...(estado === 'entregado' && { fecha_entrega_real: new Date().toISOString() }),
      })
      .eq('id', pedidoId)

    if (error) throw error

    revalidatePath('/(admin)/(dominios)/almacen/pedidos')

    return {
      success: true,
      message: 'Estado del pedido actualizado exitosamente',
    }
  } catch (error: any) {
    console.error('Error al actualizar estado del pedido:', error)
    return {
      success: false,
      error: error.message || 'Error al actualizar estado del pedido',
    }
  }
}

// Crear cotización
export async function crearCotizacion(
  params: CrearCotizacionParams
): Promise<ApiResponse<{ cotizacionId: string }>> {
  try {
    const supabase = await createClient()

    // Generar número de cotización único
    const numeroCotizacion = `COT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`

    // Calcular totales
    let subtotal = 0
    for (const item of params.items) {
      if (item.precio_unitario == null) {
        const { data: producto, error: productoError } = await supabase
          .from('productos')
          .select('precio_venta')
          .eq('id', item.producto_id)
          .single()

        if (productoError) throw productoError
        item.precio_unitario = producto.precio_venta
      }
      subtotal += item.cantidad * (item.precio_unitario ?? 0)
    }

    const total = subtotal - (params.descuento || 0)

    // Crear cotización
    const { data: cotizacion, error: cotizacionError } = await supabase
      .from('cotizaciones')
      .insert({
        numero_cotizacion: numeroCotizacion,
        cliente_id: params.cliente_id,
        fecha_vencimiento: params.fecha_vencimiento,
        estado: 'pendiente',
        subtotal,
        descuento: params.descuento || 0,
        total,
        observaciones: params.observaciones,
      })
      .select()
      .single()

    if (cotizacionError) throw cotizacionError

    // Crear detalles de la cotización
    const detalles = params.items.map(item => ({
      cotizacion_id: cotizacion.id,
      producto_id: item.producto_id,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario ?? 0,
      descuento: 0,
      subtotal: item.cantidad * (item.precio_unitario ?? 0),
    }))

    const { error: detallesError } = await supabase
      .from('detalles_cotizacion')
      .insert(detalles)

    if (detallesError) throw detallesError

    revalidatePath('/(admin)/(dominios)/ventas/cotizaciones')

    return {
      success: true,
      data: { cotizacionId: cotizacion.id },
      message: 'Cotización creada exitosamente',
    }
  } catch (error: any) {
    console.error('Error al crear cotización:', error)
    return {
      success: false,
      error: error.message || 'Error al crear cotización',
    }
  }
}

// Convertir cotización a pedido
export async function convertirCotizacionAPedido(
  cotizacionId: string
): Promise<ApiResponse<{ pedidoId: string }>> {
  try {
    const supabase = await createClient()

    // Obtener cotización
    const { data: cotizacion, error: cotizacionError } = await supabase
      .from('cotizaciones')
      .select(`
        *,
        detalles_cotizacion (*)
      `)
      .eq('id', cotizacionId)
      .single()

    if (cotizacionError) throw cotizacionError

    // Generar número de pedido único
    const numeroPedido = `PED-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`

    // Crear pedido
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .insert({
        numero_pedido: numeroPedido,
        cliente_id: cotizacion.cliente_id,
        usuario_vendedor: cotizacion.usuario_vendedor,
        estado: 'confirmado',
        tipo_pedido: 'venta',
        origen: 'web',
        subtotal: cotizacion.subtotal,
        descuento: cotizacion.descuento,
        total: cotizacion.total,
        observaciones: cotizacion.observaciones,
      })
      .select()
      .single()

    if (pedidoError) throw pedidoError

    // Crear detalles del pedido desde detalles de cotización
    const detalles = cotizacion.detalles_cotizacion.map((detalle: any) => ({
      pedido_id: pedido.id,
      producto_id: detalle.producto_id,
      cantidad: detalle.cantidad,
      precio_unitario: detalle.precio_unitario,
      descuento: detalle.descuento,
      subtotal: detalle.subtotal,
    }))

    const { error: detallesError } = await supabase
      .from('detalles_pedido')
      .insert(detalles)

    if (detallesError) throw detallesError

    // Actualizar estado de la cotización
    await supabase
      .from('cotizaciones')
      .update({ estado: 'aprobada' })
      .eq('id', cotizacionId)

    revalidatePath('/(admin)/(dominios)/almacen/pedidos')
    revalidatePath('/(admin)/(dominios)/ventas/cotizaciones')

    return {
      success: true,
      data: { pedidoId: pedido.id },
      message: 'Cotización convertida a pedido exitosamente',
    }
  } catch (error: any) {
    console.error('Error al convertir cotización:', error)
    return {
      success: false,
      error: error.message || 'Error al convertir cotización a pedido',
    }
  }
}

// Crear reclamo
export async function crearReclamo(
  params: CrearReclamoParams
): Promise<ApiResponse<{ reclamoId: string }>> {
  try {
    const supabase = await createClient()

    // Generar número de reclamo único
    const numeroReclamo = `REC-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`

    const { data, error } = await supabase
      .from('reclamos')
      .insert({
        numero_reclamo: numeroReclamo,
        ...params,
        estado: 'abierto',
        prioridad: params.prioridad || 'media',
      })
      .select()
      .single()

    if (error) throw error

    revalidatePath('/(admin)/(dominios)/ventas/reclamos')

    return {
      success: true,
      data: { reclamoId: data.id },
      message: 'Reclamo creado exitosamente',
    }
  } catch (error: any) {
    console.error('Error al crear reclamo:', error)
    return {
      success: false,
      error: error.message || 'Error al crear reclamo',
    }
  }
}

// Crear reclamo desde bot
export async function crearReclamoBot(
  params: CrearReclamoBotParams
): Promise<ApiResponse<{ reclamoId: string }>> {
  try {
    const supabase = await createClient()

    // Generar número de reclamo único
    const numeroReclamo = `REC-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`

    const { data, error } = await supabase
      .from('reclamos')
      .insert({
        numero_reclamo: numeroReclamo,
        ...params,
        estado: 'abierto',
        prioridad: params.prioridad || 'media',
        origen: 'whatsapp',
      })
      .select()
      .single()

    if (error) throw error

    revalidatePath('/(admin)/(dominios)/ventas/reclamos')

    return {
      success: true,
      data: { reclamoId: data.id },
      message: 'Reclamo creado desde bot exitosamente',
    }
  } catch (error: any) {
    console.error('Error al crear reclamo desde bot:', error)
    return {
      success: false,
      error: error.message || 'Error al crear reclamo desde bot',
    }
  }
}

// Actualizar estado de reclamo
export async function actualizarEstadoReclamo(
  reclamoId: string,
  estado: string,
  solucion?: string
): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    const updateData: any = {
      estado,
      updated_at: new Date().toISOString(),
    }

    if (estado === 'resuelto' || estado === 'cerrado') {
      updateData.fecha_resolucion = new Date().toISOString()
      updateData.solucion = solucion
    }

    const { error } = await supabase
      .from('reclamos')
      .update(updateData)
      .eq('id', reclamoId)

    if (error) throw error

    revalidatePath('/(admin)/(dominios)/ventas/reclamos')

    return {
      success: true,
      message: 'Estado del reclamo actualizado exitosamente',
    }
  } catch (error: any) {
    console.error('Error al actualizar estado del reclamo:', error)
    return {
      success: false,
      error: error.message || 'Error al actualizar estado del reclamo',
    }
  }
}

// Obtener lista de pedidos
export async function obtenerPedidos(
  filtros?: {
    search?: string
    estado?: string
    cliente_id?: string
    fecha_desde?: string
    fecha_hasta?: string
    fecha_entrega?: string
    turno?: string
    page?: number
    limit?: number
  }
): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    let query = supabase
      .from('pedidos')
      .select(`
        *,
        cliente:clientes(id, nombre, telefono, zona_entrega),
        usuario_vendedor:usuarios(id, nombre, apellido)
      `)
      .order('created_at', { ascending: false })

    // Aplicar filtros
    if (filtros?.estado) {
      query = query.eq('estado', filtros.estado)
    }
    if (filtros?.cliente_id) {
      query = query.eq('cliente_id', filtros.cliente_id)
    }
    if (filtros?.fecha_desde) {
      query = query.gte('fecha_pedido', filtros.fecha_desde)
    }
    if (filtros?.fecha_hasta) {
      query = query.lte('fecha_pedido', filtros.fecha_hasta)
    }
    if (filtros?.fecha_entrega) {
      query = query.eq('fecha_entrega_estimada', filtros.fecha_entrega)
    }
    if (filtros?.turno) {
      query = query.eq('turno', filtros.turno)
    }
    if (filtros?.search) {
      query = query.or(`numero_pedido.ilike.%${filtros.search}%,clientes.nombre.ilike.%${filtros.search}%`)
    }

    // Paginación
    const page = filtros?.page || 1
    const limit = filtros?.limit || 50
    const from = (page - 1) * limit
    const to = from + limit - 1

    query = query.range(from, to)

    const { data, error } = await query

    if (error) throw error

    return {
      success: true,
      data: data || [],
    }
  } catch (error: any) {
    console.error('Error al obtener pedidos:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener pedidos',
    }
  }
}

// Obtener detalle de pedido
export async function obtenerPedidoPorId(pedidoId: string): Promise<ApiResponse<any>> {
  try {
    const supabase = await createClient()

    const { data: pedido, error } = await supabase
      .from('pedidos')
      .select(
        `
        *,
        clientes (*),
        detalles_pedido (
          id,
          cantidad,
          precio_unitario,
          subtotal,
          productos (nombre, codigo)
        )
      `
      )
      .eq('id', pedidoId)
      .single()

    if (error) throw error
    if (!pedido) {
      return { success: false, error: 'Pedido no encontrado' }
    }

    const [{ data: pagos }, { data: cuenta }] = await Promise.all([
      supabase
        .from('tesoreria_movimientos')
        .select(
          `
          id,
          tipo,
          monto,
          metodo_pago,
          created_at,
          tesoreria_cajas (nombre)
        `
        )
        .eq('origen_tipo', 'pedido')
        .eq('origen_id', pedidoId)
        .order('created_at', { ascending: false }),
      supabase
        .from('cuentas_corrientes')
        .select('id, saldo, limite_credito')
        .eq('cliente_id', pedido.cliente_id)
        .single(),
    ])

    return {
      success: true,
      data: {
        pedido,
        pagos: pagos ?? [],
        cuenta,
      },
    }
  } catch (error: any) {
    console.error('obtenerPedidoPorId', error)
    return {
      success: false,
      error: error.message || 'Error al obtener el pedido',
    }
  }
}
