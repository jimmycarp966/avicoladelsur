'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@/types/api.types'
import { sincronizarSolicitudesAutomaticasStockBajo } from '@/lib/services/sucursales-stock-sync'

// Tipos para sucursales
export interface CrearSucursalParams {
  nombre: string
  direccion?: string
  telefono?: string
  active?: boolean
}

export interface ActualizarSettingSucursalParams {
  sucursalId: string
  lowStockThresholdDefault: number
}

export interface RegistrarVentaSucursalParams {
  sucursalId: string
  clienteId: string
  items: Array<{
    productoId: string
    cantidad: number
    precioUnitario: number
  }>
  pago: {
    metodoPago: string
    montoTotal: number
    comprobanteUrl?: string
  }
  cajaId: string
}

export interface ObtenerInventarioSucursalParams {
  sucursalId: string
  includeAlerts?: boolean
}

export interface GenerarAlertaStockParams {
  sucursalId: string
  productoId: string
  cantidadActual: number
  umbral: number
}

export interface ResolverAlertaParams {
  alertaId: string
  accion: 'en_transito' | 'resuelto'
}

// Crear sucursal
export async function crearSucursalAction(
  params: CrearSucursalParams
): Promise<ApiResponse<{ sucursalId: string }>> {
  try {
    const supabase = await createClient()

    // Insertar sucursal
    const { data: sucursal, error: sucursalError } = await supabase
      .from('sucursales')
      .insert({
        nombre: params.nombre,
        direccion: params.direccion,
        telefono: params.telefono,
        active: params.active ?? true
      })
      .select('id')
      .single()

    if (sucursalError) {
      return {
        success: false,
        error: `Error al crear sucursal: ${sucursalError.message}`
      }
    }

    // Crear configuración por defecto
    const { error: settingsError } = await supabase
      .from('sucursal_settings')
      .insert({
        sucursal_id: sucursal.id,
        low_stock_threshold_default: 5
      })

    if (settingsError) {
      // Si falla la configuración, eliminar sucursal y retornar error
      await supabase.from('sucursales').delete().eq('id', sucursal.id)
      return {
        success: false,
        error: `Error al crear configuración: ${settingsError.message}`
      }
    }

    // Crear caja para la sucursal
    const { error: cajaError } = await supabase
      .from('tesoreria_cajas')
      .insert({
        nombre: `Caja ${params.nombre}`,
        sucursal_id: sucursal.id,
        saldo_actual: 0,
        saldo_inicial: 0,
        moneda: 'ARS',
        active: true
      })

    if (cajaError) {
      return {
        success: false,
        error: `Error al crear caja: ${cajaError.message}`
      }
    }

    revalidatePath('/admin/sucursales')
    revalidatePath('/sucursal/dashboard')

    return {
      success: true,
      data: { sucursalId: sucursal.id }
    }
  } catch (error) {
    return {
      success: false,
      error: `Error interno: ${error instanceof Error ? error.message : 'Error desconocido'}`
    }
  }
}

// Actualizar configuración de sucursal
export async function actualizarSettingSucursalAction(
  params: ActualizarSettingSucursalParams
): Promise<ApiResponse<void>> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('sucursal_settings')
      .upsert({
        sucursal_id: params.sucursalId,
        low_stock_threshold_default: params.lowStockThresholdDefault
      })

    if (error) {
      return {
        success: false,
        error: `Error al actualizar configuración: ${error.message}`
      }
    }

    revalidatePath('/admin/sucursales')
    revalidatePath('/sucursal/dashboard')

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: `Error interno: ${error instanceof Error ? error.message : 'Error desconocido'}`
    }
  }
}

// Registrar venta en sucursal
export async function registrarVentaSucursalAction(
  params: RegistrarVentaSucursalParams
): Promise<ApiResponse<{ pedidoId: string }>> {
  try {
    const supabase = await createClient()

    // Obtener usuario actual para sucursal_id
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Obtener sucursal del usuario
    const { data: userData, error: userDataError } = await supabase
      .from('user_metadata')
      .select('sucursal_id')
      .eq('user_id', user.id)
      .single()

    if (userDataError || !userData?.sucursal_id) {
      return { success: false, error: 'Usuario no tiene sucursal asignada' }
    }

    // Verificar stock disponible antes de proceder
    for (const item of params.items) {
      const { data: stockDisponible, error: stockError } = await supabase
        .rpc('fn_consultar_stock_por_lote', {
          p_sucursal_id: userData.sucursal_id,
          p_producto_id: item.productoId
        })

      if (stockError) {
        return {
          success: false,
          error: `Error al verificar stock: ${stockError.message}`
        }
      }

      const totalDisponible = stockDisponible?.reduce((sum: number, lote: any) => sum + lote.cantidad_disponible, 0) || 0

      if (totalDisponible < item.cantidad) {
        return {
          success: false,
          error: `Stock insuficiente para ${item.productoId}. Disponible: ${totalDisponible}, solicitado: ${item.cantidad}`
        }
      }
    }

    // Crear pedido
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .insert({
        cliente_id: params.clienteId,
        sucursal_id: userData.sucursal_id,
        total: params.pago.montoTotal,
        estado: 'completado',
        metodo_pago: params.pago.metodoPago,
        comprobante_url: params.pago.comprobanteUrl,
        fecha_entrega: new Date().toISOString()
      })
      .select('id')
      .single()

    if (pedidoError) {
      return {
        success: false,
        error: `Error al crear pedido: ${pedidoError.message}`
      }
    }

    // Insertar items del pedido
    const pedidoItems = params.items.map(item => ({
      pedido_id: pedido.id,
      producto_id: item.productoId,
      cantidad: item.cantidad,
      precio_unitario: item.precioUnitario,
      subtotal: item.cantidad * item.precioUnitario
    }))

    const { error: itemsError } = await supabase
      .from('pedido_items')
      .insert(pedidoItems)

    if (itemsError) {
      return {
        success: false,
        error: `Error al insertar items: ${itemsError.message}`
      }
    }

    // Registrar movimiento en tesorería
    const { error: movimientoError } = await supabase
      .rpc('fn_crear_movimiento_caja_sucursal', {
        p_caja_id: params.cajaId,
        p_tipo: 'ingreso',
        p_monto: params.pago.montoTotal,
        p_descripcion: `Venta sucursal - Pedido ${pedido.id}`,
        p_origen_tipo: 'venta',
        p_origen_id: pedido.id,
        p_comprobante_url: params.pago.comprobanteUrl
      })

    if (movimientoError) {
      return {
        success: false,
        error: `Error al registrar movimiento: ${movimientoError.message}`
      }
    }

    // Evaluar stock bajo despues de la venta y sincronizar solicitudes automaticas
    try {
      for (const item of params.items) {
        await sincronizarSolicitudesAutomaticasStockBajo(
          supabase as any,
          userData.sucursal_id,
          item.productoId
        )
      }
    } catch (stockError) {
      console.warn('Error al sincronizar stock bajo:', stockError)
      // No fallar la venta por esto
    }

    revalidatePath('/sucursal/dashboard')
    revalidatePath('/sucursal/alerts')
    revalidatePath('/tesoreria/movimientos')

    return {
      success: true,
      data: { pedidoId: pedido.id }
    }
  } catch (error) {
    return {
      success: false,
      error: `Error interno: ${error instanceof Error ? error.message : 'Error desconocido'}`
    }
  }
}

// Obtener inventario de sucursal
export async function obtenerInventarioSucursalAction(
  params: ObtenerInventarioSucursalParams
): Promise<ApiResponse<Array<{
  productoId: string
  codigo: string
  nombre: string
  cantidadActual: number
  bajoStock: boolean
  umbral: number
}>>> {
  try {
    const supabase = await createClient()

    // Obtener umbral de la sucursal
    const { data: settings, error: settingsError } = await supabase
      .from('sucursal_settings')
      .select('low_stock_threshold_default')
      .eq('sucursal_id', params.sucursalId)
      .single()

    const umbral = settings?.low_stock_threshold_default || 5

    // Obtener inventario agrupado por producto
    const { data: inventario, error: inventarioError } = await supabase
      .from('lotes')
      .select(`
        producto_id,
        cantidad_disponible,
        productos (
          codigo,
          nombre
        )
      `)
      .eq('sucursal_id', params.sucursalId)
      .gt('cantidad_disponible', 0)

    if (inventarioError) {
      return {
        success: false,
        error: `Error al obtener inventario: ${inventarioError.message}`
      }
    }

    // Agrupar por producto
    const inventarioAgrupado = inventario?.reduce((acc, lote) => {
      const productoId = lote.producto_id
      const cantidad = lote.cantidad_disponible || 0

      if (!acc[productoId]) {
        acc[productoId] = {
          productoId,
          codigo: (lote as any).productos?.codigo || '-',
          nombre: (lote as any).productos?.nombre || 'Producto desconocido',
          cantidadActual: 0,
          bajoStock: false,
          umbral
        }
      }

      acc[productoId].cantidadActual += cantidad
      return acc
    }, {} as Record<string, any>)

    // Marcar productos con bajo stock
    const resultado = Object.values(inventarioAgrupado).map((item: any) => ({
      ...item,
      bajoStock: item.cantidadActual <= umbral
    }))

    return {
      success: true,
      data: resultado
    }
  } catch (error) {
    return {
      success: false,
      error: `Error interno: ${error instanceof Error ? error.message : 'Error desconocido'}`
    }
  }
}

// Generar alerta de stock
export async function generarAlertaStockAction(
  params: GenerarAlertaStockParams
): Promise<ApiResponse<{ alertaId: string }>> {
  try {
    const supabase = await createClient()

    const { data: alerta, error } = await supabase
      .from('alertas_stock')
      .insert({
        sucursal_id: params.sucursalId,
        producto_id: params.productoId,
        cantidad_actual: params.cantidadActual,
        umbral: params.umbral,
        estado: 'pendiente'
      })
      .select('id')
      .single()

    if (error) {
      return {
        success: false,
        error: `Error al crear alerta: ${error.message}`
      }
    }

    revalidatePath('/sucursal/alerts')
    revalidatePath('/admin/sucursales')

    return {
      success: true,
      data: { alertaId: alerta.id }
    }
  } catch (error) {
    return {
      success: false,
      error: `Error interno: ${error instanceof Error ? error.message : 'Error desconocido'}`
    }
  }
}

// Resolver alerta de stock
export async function resolverAlertaAction(
  params: ResolverAlertaParams
): Promise<ApiResponse<void>> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('alertas_stock')
      .update({
        estado: params.accion,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.alertaId)

    if (error) {
      return {
        success: false,
        error: `Error al resolver alerta: ${error.message}`
      }
    }

    revalidatePath('/sucursal/alerts')
    revalidatePath('/admin/sucursales')

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: `Error interno: ${error instanceof Error ? error.message : 'Error desconocido'}`
    }
  }
}

// Obtener sucursales (para admin)
export async function obtenerSucursalesAction(): Promise<ApiResponse<Array<{
  id: string
  nombre: string
  active: boolean
  alertasPendientes: number
  inventarioCritico: number
}>>> {
  try {
    const supabase = await createClient()

    const { data: sucursales, error: sucursalesError } = await supabase
      .from('sucursales')
      .select('*')
      .order('created_at', { ascending: false })

    if (sucursalesError) {
      return {
        success: false,
        error: `Error al obtener sucursales: ${sucursalesError.message}`
      }
    }

    // Obtener estadísticas para cada sucursal
    const resultado = await Promise.all(
      sucursales.map(async (sucursal) => {
        // Contar alertas pendientes
        const { count: alertasCount, error: alertasError } = await supabase
          .from('alertas_stock')
          .select('*', { count: 'exact', head: true })
          .eq('sucursal_id', sucursal.id)
          .eq('estado', 'pendiente')

        // Contar productos con bajo stock
        const { data: inventarioCritico, error: inventarioError } = await supabase
          .rpc('fn_evaluar_stock_bajo_sucursal', {
            p_sucursal_id: sucursal.id
          })

        return {
          id: sucursal.id,
          nombre: sucursal.nombre,
          active: sucursal.active,
          alertasPendientes: alertasCount || 0,
          inventarioCritico: inventarioCritico || 0
        }
      })
    )

    return {
      success: true,
      data: resultado
    }
  } catch (error) {
    return {
      success: false,
      error: `Error interno: ${error instanceof Error ? error.message : 'Error desconocido'}`
    }
  }
}

// =============================================
// STOCK MÍNIMO POR SUCURSAL
// =============================================

export interface ObtenerStockMinimoSucursalParams {
  sucursalId: string
}

export interface ConfigurarStockMinimoParams {
  sucursalId: string
  productoId: string
  stockMinimo: number | null
}

export interface EliminarStockMinimoParams {
  sucursalId: string
  productoId: string
}

export interface StockMinimoProducto {
  productoId: string
  productoNombre: string
  productoCodigo: string
  stockMinimoGlobal: number | null
  stockMinimoSucursal: number | null
  stockActual: number
}

// Obtener configuración de stock mínimo para una sucursal
export async function obtenerStockMinimoSucursalAction(params: ObtenerStockMinimoSucursalParams): Promise<ApiResponse<StockMinimoProducto[]>> {
  try {
    const supabase = await createClient()

    // Obtener productos con stock en la sucursal, junto con sus mínimas globales y específicos
    const { data, error } = await supabase
      .from('lotes')
      .select(`
        cantidad_disponible,
        productos!inner (
          id,
          nombre,
          codigo,
          stock_minimo,
          activo
        )
      `)
      .eq('sucursal_id', params.sucursalId)
      .eq('estado', 'disponible')
      .gt('cantidad_disponible', 0)

    if (error) throw error

    // Obtener configuraciones específicas por sucursal
    const { data: minimosSucursal, error: minimosError } = await supabase
      .from('producto_sucursal_minimos')
      .select('producto_id, stock_minimo')
      .eq('sucursal_id', params.sucursalId)

    if (minimosError) throw minimosError

    // Crear mapa de mínimos por sucursal
    const minimosMap = new Map(
      (minimosSucursal || []).map(item => [item.producto_id, item.stock_minimo])
    )

    // Agrupar por producto y calcular stock total
    const productosMap = new Map<string, StockMinimoProducto>()

    for (const lote of data || []) {
      const productos = Array.isArray(lote.productos) ? lote.productos : [lote.productos]
      if (productos.length === 0) continue
      
      const producto = productos[0] as { id: string; nombre: string; codigo: string; stock_minimo: number; activo: boolean }
      if (!producto.activo) continue

      const productoId = producto.id

      if (!productosMap.has(productoId)) {
        productosMap.set(productoId, {
          productoId,
          productoNombre: producto.nombre,
          productoCodigo: producto.codigo,
          stockMinimoGlobal: producto.stock_minimo,
          stockMinimoSucursal: minimosMap.get(productoId) || null,
          stockActual: 0
        })
      }

      // Sumar stock actual
      productosMap.get(productoId)!.stockActual += lote.cantidad_disponible
    }

    const resultado = Array.from(productosMap.values())

    return {
      success: true,
      data: resultado
    }
  } catch (error) {
    return {
      success: false,
      error: `Error al obtener stock mínimo: ${error instanceof Error ? error.message : 'Error desconocido'}`
    }
  }
}

// Configurar stock mínimo específico para una sucursal
export async function configurarStockMinimoAction(params: ConfigurarStockMinimoParams): Promise<ApiResponse<void>> {
  try {
    const supabase = await createClient()

    // Validar que el producto existe
    const { data: producto, error: productoError } = await supabase
      .from('productos')
      .select('id')
      .eq('id', params.productoId)
      .eq('activo', true)
      .single()

    if (productoError || !producto) {
      return {
        success: false,
        error: 'Producto no encontrado o inactivo'
      }
    }

    if (params.stockMinimo === null || params.stockMinimo < 0) {
      // Eliminar configuración específica si existe
      await supabase
        .from('producto_sucursal_minimos')
        .delete()
        .eq('sucursal_id', params.sucursalId)
        .eq('producto_id', params.productoId)
    } else {
      // Insertar o actualizar configuración específica
      const { error: upsertError } = await supabase
        .from('producto_sucursal_minimos')
        .upsert({
          sucursal_id: params.sucursalId,
          producto_id: params.productoId,
          stock_minimo: params.stockMinimo,
          updated_at: new Date().toISOString()
        })

      if (upsertError) throw upsertError
    }

    revalidatePath(`/sucursal/inventario/stock-minimo`)

    return {
      success: true,
      data: undefined
    }
  } catch (error) {
    return {
      success: false,
      error: `Error al configurar stock mínimo: ${error instanceof Error ? error.message : 'Error desconocido'}`
    }
  }
}

// Eliminar configuración específica de stock mínimo
export async function eliminarStockMinimoAction(params: EliminarStockMinimoParams): Promise<ApiResponse<void>> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('producto_sucursal_minimos')
      .delete()
      .eq('sucursal_id', params.sucursalId)
      .eq('producto_id', params.productoId)

    if (error) throw error

    revalidatePath(`/sucursal/inventario/stock-minimo`)

    return {
      success: true,
      data: undefined
    }
  } catch (error) {
    return {
      success: false,
      error: `Error al eliminar configuración: ${error instanceof Error ? error.message : 'Error desconocido'}`
    }
  }
}
