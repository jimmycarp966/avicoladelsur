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
  listaPrecioId?: string // Lista de precio por producto
}

export interface PagoMetodo {
  metodoPago: 'efectivo' | 'transferencia' | 'tarjeta_debito' | 'tarjeta_credito' | 'mercado_pago' | 'cuenta_corriente'
  monto: number
}

export interface RegistrarVentaSucursalParams {
  sucursalId: string
  clienteId?: string // Opcional para venta genérica
  listaPrecioId?: string // Opcional, solo para compatibilidad (ya no se usa globalmente)
  items: ItemVentaSucursal[]
  cajaId?: string // Opcional
  pago?: {
    pagos: PagoMetodo[] // Multipago: array de métodos
  } | PagoMetodo // Compatibilidad: un solo pago
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

    // Preparar items para la función RPC (incluyendo lista_precio_id por item)
    const itemsJson = params.items.map(item => ({
      producto_id: item.productoId,
      cantidad: item.cantidad,
      precio_unitario: item.precioUnitario,
      lista_precio_id: item.listaPrecioId || params.listaPrecioId || null // Usar lista individual o global (compatibilidad)
    }))

    // Preparar pagos (soporte para multipago)
    let pagoJson = null
    if (params.pago) {
      // Si es array de pagos (multipago)
      if ('pagos' in params.pago && Array.isArray(params.pago.pagos)) {
        pagoJson = {
          pagos: params.pago.pagos.map(p => ({
            metodo_pago: p.metodoPago,
            monto: p.monto
          }))
        }
      }
      // Si es un solo pago (compatibilidad)
      else if ('metodoPago' in params.pago) {
        pagoJson = {
          pagos: [{
            metodo_pago: params.pago.metodoPago,
            monto: params.pago.monto
          }]
        }
      }
    }

    // Llamar a la función RPC actualizada
    const { data, error } = await supabase.rpc('fn_registrar_venta_sucursal', {
      p_sucursal_id: params.sucursalId,
      p_cliente_id: params.clienteId || null, // Puede ser NULL
      p_usuario_id: userData.id,
      p_lista_precio_id: params.listaPrecioId || null, // Opcional, ya no se usa globalmente
      p_items: itemsJson,
      p_pago: pagoJson,
      p_caja_id: params.cajaId || null
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

    // Usar función RPC que bypasea RLS y valida permisos
    const { data, error } = await supabase.rpc('fn_obtener_conteo_stock', {
      p_conteo_id: conteoId
    })

    if (error) {
      return { success: false, error: `Error al obtener conteo: ${error.message}` }
    }

    if (!data || !data.success) {
      return { success: false, error: data?.error || 'Conteo no encontrado' }
    }

    const conteoData = data.data

    // Obtener nombre del usuario que realizó el conteo
    let nombreUsuario = 'Desconocido'
    if (conteoData.realizado_por) {
      const { data: usuarioData, error: usuarioError } = await supabase
        .from('usuarios')
        .select('nombre')
        .eq('id', conteoData.realizado_por)
        .maybeSingle()

      if (!usuarioError && usuarioData) {
        nombreUsuario = usuarioData.nombre || 'Desconocido'
      }
    }

    // Mapear items del resultado
    const items = (conteoData.items || []).map((item: any) => ({
      productoId: item.producto_id,
      productoNombre: item.producto_nombre || 'Producto',
      cantidadTeorica: item.cantidad_teorica,
      cantidadContada: item.cantidad_contada,
      diferencia: item.diferencia || 0,
      costoUnitario: item.costo_unitario_promedio || 0,
      valorDiferencia: item.valor_diferencia || 0
    }))

    return {
      success: true,
      data: {
        id: conteoData.id,
        sucursalId: conteoData.sucursal_id,
        fechaConteo: conteoData.fecha_conteo,
        estado: conteoData.estado,
        realizadoPor: nombreUsuario,
        totalDiferencias: conteoData.total_diferencias || 0,
        totalMermaValor: conteoData.total_merma_valor || 0,
        items
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
      .select('*')
      .eq('sucursal_id', sucursalId)
      .order('fecha_conteo', { ascending: false })
      .limit(50)

    if (error) {
      return { success: false, error: `Error al listar conteos: ${error.message}` }
    }

    // Obtener nombres de usuarios para todos los conteos
    const conteosConUsuarios = await Promise.all(
      (data || []).map(async (conteo) => {
        let nombreRealizadoPor = 'Desconocido'

        if (conteo.realizado_por) {
          const { data: usuarioData, error: usuarioError } = await supabase
            .from('usuarios')
            .select('nombre')
            .eq('id', conteo.realizado_por)
            .maybeSingle()

          if (!usuarioError && usuarioData) {
            nombreRealizadoPor = usuarioData.nombre || 'Desconocido'
          }
        }

        return {
          id: conteo.id,
          fechaConteo: conteo.fecha_conteo,
          estado: conteo.estado,
          realizadoPor: nombreRealizadoPor,
          totalDiferencias: conteo.total_diferencias || 0,
          totalMermaValor: conteo.total_merma_valor || 0
        }
      })
    )

    return {
      success: true,
      data: conteosConUsuarios
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

/**
 * Valida el límite de crédito de un cliente
 */
export async function validarLimiteCreditoAction(
  clienteId: string,
  monto: number
): Promise<ApiResponse<{
  permiteVenta: boolean
  saldoActual: number
  limiteCredito: number
  saldoDespues: number
  excede: boolean
  bloqueado: boolean
}>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.rpc('fn_validar_limite_credito', {
      p_cliente_id: clienteId,
      p_monto: monto
    })

    if (error) {
      return { success: false, error: `Error al validar crédito: ${error.message}` }
    }

    if (!data.success) {
      return { success: false, error: data.error || 'Error al validar crédito' }
    }

    return {
      success: true,
      data: {
        permiteVenta: data.permite_venta as boolean,
        saldoActual: Number(data.saldo_actual),
        limiteCredito: Number(data.limite_credito),
        saldoDespues: Number(data.saldo_despues || 0),
        excede: data.excede as boolean,
        bloqueado: data.bloqueado as boolean || false,
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
 * Obtiene información de crédito del cliente
 */
export async function obtenerInfoCreditoClienteAction(
  clienteId: string
): Promise<ApiResponse<{
  saldo: number
  limiteCredito: number
  bloqueado: boolean
}>> {
  try {
    const supabase = await createClient()

    // Obtener cliente
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('id, bloqueado_por_deuda, limite_credito')
      .eq('id', clienteId)
      .single()

    if (clienteError || !cliente) {
      return { success: false, error: 'Cliente no encontrado' }
    }

    // Obtener saldo de cuenta corriente
    const { data: cuenta, error: cuentaError } = await supabase
      .from('cuentas_corrientes')
      .select('saldo, limite_credito')
      .eq('cliente_id', clienteId)
      .single()

    return {
      success: true,
      data: {
        saldo: cuenta?.saldo || 0,
        limiteCredito: cuenta?.limite_credito || cliente.limite_credito || 0,
        bloqueado: cliente.bloqueado_por_deuda || false,
      }
    }
  } catch (error) {
    return {
      success: false,
      error: `Error interno: ${error instanceof Error ? error.message : 'Error desconocido'}`
    }
  }
}

