'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@/types/api.types'

// ===========================================
// TIPOS
// ===========================================

export interface ItemVentaSucursal {
  productoId: string
  cantidad: number
  precioUnitario?: number
}

export interface RegistrarVentaSucursalParams {
  sucursalId: string
  clienteId: string
  listaPrecioId: string
  items: ItemVentaSucursal[]
  pago?: {
    estado: 'pagado' | 'pendiente' | 'parcial'
    metodoPago?: string
    monto?: number
  }
}

export interface VentaSucursalResult {
  pedidoId: string
  numeroPedido: string
  total: number
  costoTotal: number
  margenBruto: number
  tipoLista: string
}

export interface ConteoStockItem {
  productoId: string
  productoNombre: string
  cantidadTeorica: number
  cantidadContada: number | null
  diferencia: number
  costoUnitario: number
  valorDiferencia: number
}

export interface ConteoStock {
  id: string
  sucursalId: string
  fechaConteo: string
  estado: string
  realizadoPor: string
  totalDiferencias: number
  totalMermaValor: number
  items: ConteoStockItem[]
}

export interface ReporteUsoListas {
  usuarioId: string
  usuarioNombre: string
  tipoLista: string
  cantidadVentas: number
  kgTotales: number
  montoTotal: number
  porcentajeVentas: number
}

export interface ReporteMargenes {
  fecha: string
  tipoLista: string
  cantidadVentas: number
  ventaTotal: number
  costoTotal: number
  margenBruto: number
  porcentajeMargen: number
}

export interface AlertaComportamiento {
  usuarioId: string
  usuarioNombre: string
  tipoAlerta: string
  descripcion: string
  valorActual: number
  valorPromedio: number
  fechaDeteccion: string
}

// ===========================================
// VENTAS EN SUCURSAL
// ===========================================

/**
 * Registra una venta en sucursal con control de lista de precios y cálculo de margen
 */
export async function registrarVentaSucursalConControlAction(
  params: RegistrarVentaSucursalParams
): Promise<ApiResponse<VentaSucursalResult>> {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Obtener ID de usuario en tabla usuarios
    const { data: userData, error: userDataError } = await supabase
      .from('usuarios')
      .select('id')
      .eq('email', user.email)
      .single()

    if (userDataError || !userData) {
      return { success: false, error: 'Usuario no encontrado en el sistema' }
    }

    // Preparar items para la función RPC
    const itemsJson = params.items.map(item => ({
      producto_id: item.productoId,
      cantidad: item.cantidad,
      precio_unitario: item.precioUnitario
    }))

    // Llamar a la función RPC
    const { data, error } = await supabase.rpc('fn_registrar_venta_sucursal', {
      p_sucursal_id: params.sucursalId,
      p_cliente_id: params.clienteId,
      p_usuario_id: userData.id,
      p_lista_precio_id: params.listaPrecioId,
      p_items: itemsJson,
      p_pago: params.pago ? {
        estado: params.pago.estado,
        metodo_pago: params.pago.metodoPago,
        monto: params.pago.monto
      } : null
    })

    if (error) {
      return { success: false, error: `Error al registrar venta: ${error.message}` }
    }

    if (!data.success) {
      return { success: false, error: data.error || 'Error desconocido al registrar venta' }
    }

    revalidatePath('/sucursal/ventas')
    revalidatePath('/sucursal/dashboard')
    revalidatePath('/sucursal/inventario')

    return {
      success: true,
      data: {
        pedidoId: data.pedido_id,
        numeroPedido: data.numero_pedido,
        total: data.total,
        costoTotal: data.costo_total,
        margenBruto: data.margen_bruto,
        tipoLista: data.tipo_lista
      }
    }
  } catch (error) {
    return {
      success: false,
      error: `Error interno: ${error instanceof Error ? error.message : 'Error desconocido'}`
    }
  }
}

// ===========================================
// CONTEOS DE STOCK
// ===========================================

/**
 * Inicia un nuevo conteo de stock en una sucursal
 */
export async function iniciarConteoStockAction(
  sucursalId: string
): Promise<ApiResponse<{ conteoId: string }>> {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Obtener ID de usuario
    const { data: userData, error: userDataError } = await supabase
      .from('usuarios')
      .select('id')
      .eq('email', user.email)
      .single()

    if (userDataError || !userData) {
      return { success: false, error: 'Usuario no encontrado' }
    }

    // Llamar a la función RPC
    const { data, error } = await supabase.rpc('fn_iniciar_conteo_stock', {
      p_sucursal_id: sucursalId,
      p_usuario_id: userData.id
    })

    if (error) {
      return { success: false, error: `Error al iniciar conteo: ${error.message}` }
    }

    if (!data.success) {
      return { success: false, error: data.error || 'Error al iniciar conteo' }
    }

    revalidatePath('/sucursal/inventario/conteos')

    return {
      success: true,
      data: { conteoId: data.conteo_id }
    }
  } catch (error) {
    return {
      success: false,
      error: `Error interno: ${error instanceof Error ? error.message : 'Error desconocido'}`
    }
  }
}

/**
 * Obtiene un conteo de stock con sus items
 */
export async function obtenerConteoStockAction(
  conteoId: string
): Promise<ApiResponse<ConteoStock>> {
  try {
    const supabase = await createClient()

    // Obtener conteo
    const { data: conteo, error: conteoError } = await supabase
      .from('conteos_stock')
      .select(`
        *,
        usuarios:realizado_por (nombre)
      `)
      .eq('id', conteoId)
      .single()

    if (conteoError) {
      return { success: false, error: `Error al obtener conteo: ${conteoError.message}` }
    }

    // Obtener items
    const { data: items, error: itemsError } = await supabase
      .from('conteo_stock_items')
      .select(`
        *,
        productos (nombre)
      `)
      .eq('conteo_id', conteoId)
      .order('productos(nombre)')

    if (itemsError) {
      return { success: false, error: `Error al obtener items: ${itemsError.message}` }
    }

    return {
      success: true,
      data: {
        id: conteo.id,
        sucursalId: conteo.sucursal_id,
        fechaConteo: conteo.fecha_conteo,
        estado: conteo.estado,
        realizadoPor: (conteo.usuarios as { nombre: string })?.nombre || 'Desconocido',
        totalDiferencias: conteo.total_diferencias || 0,
        totalMermaValor: conteo.total_merma_valor || 0,
        items: items.map(item => ({
          productoId: item.producto_id,
          productoNombre: (item.productos as { nombre: string })?.nombre || 'Producto',
          cantidadTeorica: item.cantidad_teorica,
          cantidadContada: item.cantidad_contada,
          diferencia: item.diferencia || 0,
          costoUnitario: item.costo_unitario_promedio || 0,
          valorDiferencia: item.valor_diferencia || 0
        }))
      }
    }
  } catch (error) {
    return {
      success: false,
      error: `Error interno: ${error instanceof Error ? error.message : 'Error desconocido'}`
    }
  }
}

/**
 * Actualiza la cantidad contada de un item
 */
export async function actualizarCantidadContadaAction(
  itemId: string,
  cantidadContada: number,
  motivoDiferencia?: string,
  observaciones?: string
): Promise<ApiResponse<void>> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('conteo_stock_items')
      .update({
        cantidad_contada: cantidadContada,
        motivo_diferencia: motivoDiferencia,
        observaciones
      })
      .eq('id', itemId)

    if (error) {
      return { success: false, error: `Error al actualizar: ${error.message}` }
    }

    revalidatePath('/sucursal/inventario/conteos')

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: `Error interno: ${error instanceof Error ? error.message : 'Error desconocido'}`
    }
  }
}

/**
 * Completa un conteo de stock y genera ajustes
 */
export async function completarConteoStockAction(
  conteoId: string,
  toleranciaPorcentaje: number = 2.0
): Promise<ApiResponse<{ totalDiferencias: number; totalMermaValor: number }>> {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Obtener ID de usuario
    const { data: userData, error: userDataError } = await supabase
      .from('usuarios')
      .select('id')
      .eq('email', user.email)
      .single()

    if (userDataError || !userData) {
      return { success: false, error: 'Usuario no encontrado' }
    }

    // Llamar a la función RPC
    const { data, error } = await supabase.rpc('fn_completar_conteo_stock', {
      p_conteo_id: conteoId,
      p_usuario_id: userData.id,
      p_tolerancia_porcentaje: toleranciaPorcentaje
    })

    if (error) {
      return { success: false, error: `Error al completar conteo: ${error.message}` }
    }

    if (!data.success) {
      return { success: false, error: data.error || 'Error al completar conteo' }
    }

    revalidatePath('/sucursal/inventario/conteos')
    revalidatePath('/sucursal/inventario')

    return {
      success: true,
      data: {
        totalDiferencias: data.total_diferencias,
        totalMermaValor: data.total_merma_valor
      }
    }
  } catch (error) {
    return {
      success: false,
      error: `Error interno: ${error instanceof Error ? error.message : 'Error desconocido'}`
    }
  }
}

/**
 * Lista los conteos de una sucursal
 */
export async function listarConteosStockAction(
  sucursalId: string
): Promise<ApiResponse<Array<{
  id: string
  fechaConteo: string
  estado: string
  realizadoPor: string
  totalDiferencias: number
  totalMermaValor: number
}>>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('conteos_stock')
      .select(`
        *,
        usuarios:realizado_por (nombre)
      `)
      .eq('sucursal_id', sucursalId)
      .order('fecha_conteo', { ascending: false })
      .limit(50)

    if (error) {
      return { success: false, error: `Error al listar conteos: ${error.message}` }
    }

    return {
      success: true,
      data: data.map(conteo => ({
        id: conteo.id,
        fechaConteo: conteo.fecha_conteo,
        estado: conteo.estado,
        realizadoPor: (conteo.usuarios as { nombre: string })?.nombre || 'Desconocido',
        totalDiferencias: conteo.total_diferencias || 0,
        totalMermaValor: conteo.total_merma_valor || 0
      }))
    }
  } catch (error) {
    return {
      success: false,
      error: `Error interno: ${error instanceof Error ? error.message : 'Error desconocido'}`
    }
  }
}

// ===========================================
// REPORTES
// ===========================================

/**
 * Obtiene el reporte de uso de listas de precio por sucursal
 */
export async function obtenerReporteUsoListasAction(
  sucursalId: string,
  fechaDesde?: string,
  fechaHasta?: string
): Promise<ApiResponse<ReporteUsoListas[]>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.rpc('fn_reporte_uso_listas_sucursal', {
      p_sucursal_id: sucursalId,
      p_fecha_desde: fechaDesde || null,
      p_fecha_hasta: fechaHasta || null
    })

    if (error) {
      return { success: false, error: `Error al obtener reporte: ${error.message}` }
    }

    return {
      success: true,
      data: data.map((row: Record<string, unknown>) => ({
        usuarioId: row.usuario_id as string,
        usuarioNombre: row.usuario_nombre as string,
        tipoLista: row.tipo_lista as string,
        cantidadVentas: Number(row.cantidad_ventas),
        kgTotales: Number(row.kg_totales),
        montoTotal: Number(row.monto_total),
        porcentajeVentas: Number(row.porcentaje_ventas)
      }))
    }
  } catch (error) {
    return {
      success: false,
      error: `Error interno: ${error instanceof Error ? error.message : 'Error desconocido'}`
    }
  }
}

/**
 * Obtiene el reporte de márgenes por sucursal
 */
export async function obtenerReporteMargenesAction(
  sucursalId: string,
  fechaDesde?: string,
  fechaHasta?: string
): Promise<ApiResponse<ReporteMargenes[]>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.rpc('fn_reporte_margenes_sucursal', {
      p_sucursal_id: sucursalId,
      p_fecha_desde: fechaDesde || null,
      p_fecha_hasta: fechaHasta || null
    })

    if (error) {
      return { success: false, error: `Error al obtener reporte: ${error.message}` }
    }

    return {
      success: true,
      data: data.map((row: Record<string, unknown>) => ({
        fecha: row.fecha as string,
        tipoLista: row.tipo_lista as string,
        cantidadVentas: Number(row.cantidad_ventas),
        ventaTotal: Number(row.venta_total),
        costoTotal: Number(row.costo_total),
        margenBruto: Number(row.margen_bruto),
        porcentajeMargen: Number(row.porcentaje_margen)
      }))
    }
  } catch (error) {
    return {
      success: false,
      error: `Error interno: ${error instanceof Error ? error.message : 'Error desconocido'}`
    }
  }
}

/**
 * Obtiene las alertas de comportamiento sospechoso
 */
export async function obtenerAlertasComportamientoAction(
  sucursalId: string,
  diasAtras: number = 7
): Promise<ApiResponse<AlertaComportamiento[]>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.rpc('fn_detectar_comportamiento_sospechoso', {
      p_sucursal_id: sucursalId,
      p_dias_atras: diasAtras
    })

    if (error) {
      return { success: false, error: `Error al obtener alertas: ${error.message}` }
    }

    return {
      success: true,
      data: data.map((row: Record<string, unknown>) => ({
        usuarioId: row.usuario_id as string,
        usuarioNombre: row.usuario_nombre as string,
        tipoAlerta: row.tipo_alerta as string,
        descripcion: row.descripcion as string,
        valorActual: Number(row.valor_actual),
        valorPromedio: Number(row.valor_promedio),
        fechaDeteccion: row.fecha_deteccion as string
      }))
    }
  } catch (error) {
    return {
      success: false,
      error: `Error interno: ${error instanceof Error ? error.message : 'Error desconocido'}`
    }
  }
}

// ===========================================
// UTILIDADES
// ===========================================

/**
 * Obtiene el costo promedio de un producto en una sucursal
 */
export async function obtenerCostoPromedioAction(
  sucursalId: string,
  productoId: string
): Promise<ApiResponse<{ costoPromedio: number }>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.rpc('fn_obtener_costo_promedio_sucursal', {
      p_sucursal_id: sucursalId,
      p_producto_id: productoId
    })

    if (error) {
      return { success: false, error: `Error al obtener costo: ${error.message}` }
    }

    return {
      success: true,
      data: { costoPromedio: data || 0 }
    }
  } catch (error) {
    return {
      success: false,
      error: `Error interno: ${error instanceof Error ? error.message : 'Error desconocido'}`
    }
  }
}

/**
 * Obtiene las listas de precio disponibles para una sucursal
 */
export async function obtenerListasPrecioDisponiblesAction(): Promise<ApiResponse<Array<{
  id: string
  codigo: string
  nombre: string
  tipo: string
  margenGanancia: number | null
}>>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('listas_precios')
      .select('id, codigo, nombre, tipo, margen_ganancia')
      .eq('activa', true)
      .order('tipo')

    if (error) {
      return { success: false, error: `Error al obtener listas: ${error.message}` }
    }

    return {
      success: true,
      data: data.map(lista => ({
        id: lista.id,
        codigo: lista.codigo,
        nombre: lista.nombre,
        tipo: lista.tipo,
        margenGanancia: lista.margen_ganancia
      }))
    }
  } catch (error) {
    return {
      success: false,
      error: `Error interno: ${error instanceof Error ? error.message : 'Error desconocido'}`
    }
  }
}

/**
 * Obtiene el precio de un producto en una lista específica
 */
export async function obtenerPrecioProductoAction(
  listaPrecioId: string,
  productoId: string
): Promise<ApiResponse<{ precio: number }>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.rpc('fn_obtener_precio_producto', {
      p_lista_precio_id: listaPrecioId,
      p_producto_id: productoId
    })

    if (error) {
      return { success: false, error: `Error al obtener precio: ${error.message}` }
    }

    return {
      success: true,
      data: { precio: data || 0 }
    }
  } catch (error) {
    return {
      success: false,
      error: `Error interno: ${error instanceof Error ? error.message : 'Error desconocido'}`
    }
  }
}

