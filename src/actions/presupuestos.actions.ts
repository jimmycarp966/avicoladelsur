'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createNotification } from './index'
import { generateRutaOptimizada } from '@/lib/services/ruta-optimizer'
import { confirmarPresupuestosAgrupadosSchema } from '@/lib/schemas/presupuestos.schema'
import { esVentaMayorista, getNowArgentina } from '@/lib/utils'
import { esItemPesable } from '@/lib/utils/pesaje'
import { enviarNotificacionWhatsApp } from '@/lib/services/notificaciones'
import { devError, devLog } from '@/lib/utils/logger'

// Schemas de validación
const crearPresupuestoSchema = z.object({
  cliente_id: z.string().uuid(),
  zona_id: z.string().uuid().optional(),
  fecha_entrega_estimada: z.string().optional(),
  observaciones: z.string().optional(),
  lista_precio_id: z.string().uuid().optional(), // Lista global (por defecto)
  tipo_venta: z.enum(['reparto', 'retira_casa_central']).default('reparto'),
  turno: z.enum(['mañana', 'tarde']).optional(),
  items: z.array(z.object({
    producto_id: z.string().uuid(),
    cantidad_solicitada: z.number().positive(),
    precio_unit_est: z.number().positive(),
    lista_precio_id: z.string().uuid().optional(), // Lista individual por producto
  })).min(1),
})

const reservarStockSchema = z.object({
  presupuesto_id: z.string().uuid(),
})

const confirmarPresupuestoSchema = z.object({
  presupuesto_id: z.string().uuid(),
  caja_id: z.string().uuid().optional(),
})

const actualizarPesoItemSchema = z.object({
  presupuesto_item_id: z.string().uuid(),
  peso_final: z.number().nonnegative(),
})

type PresupuestoItemFinalContext = {
  id: string
  presupuesto_id: string
  producto_id: string
  cantidad_solicitada: number | null
  peso_final: number | null
  pesable: boolean | null
  precio_unit_est: number | null
  precio_unit_final: number | null
  subtotal_est: number | null
  subtotal_final: number | null
  lista_precio_id: string | null
  lista_precio?: {
    tipo?: string | null
  } | null
  producto?: {
    nombre?: string | null
    categoria?: string | null
    precio_venta?: number | null
    requiere_pesaje?: boolean | null
    venta_mayor_habilitada?: boolean | null
  } | null
}

type PresupuestoFinalContext = {
  id: string
  recargo_total: number | null
  lista_precio_id: string | null
  lista_precio?: {
    tipo?: string | null
  } | null
  items?: PresupuestoItemFinalContext[] | null
}

function toFiniteNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toPositiveNumber(value: number | string | null | undefined): number | null {
  const parsed = toFiniteNumber(value)
  return parsed != null && parsed > 0 ? parsed : null
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function sameCurrencyValue(
  currentValue: number | string | null | undefined,
  nextValue: number
): boolean {
  const currentNumber = toFiniteNumber(currentValue)
  if (currentNumber == null) {
    return false
  }

  return roundCurrency(currentNumber) === roundCurrency(nextValue)
}

async function resolverPrecioUnitarioItem(
  supabase: ReturnType<typeof createAdminClient>,
  item: PresupuestoItemFinalContext,
  presupuesto: PresupuestoFinalContext
): Promise<number> {
  const precioFinalActual = toPositiveNumber(item.precio_unit_final)
  if (precioFinalActual != null) {
    return precioFinalActual
  }

  const precioEstimado = toPositiveNumber(item.precio_unit_est)
  if (precioEstimado != null) {
    return precioEstimado
  }

  const listaPrecioId = item.lista_precio_id || presupuesto.lista_precio_id
  if (listaPrecioId) {
    const { data: precioLista, error: precioListaError } = await supabase.rpc('fn_obtener_precio_producto', {
      p_lista_precio_id: listaPrecioId,
      p_producto_id: item.producto_id,
    })

    if (precioListaError) {
      devError('[PRESUPUESTOS] Error obteniendo precio desde lista para reconciliar item:', precioListaError)
    } else {
      const precioDesdeLista = toPositiveNumber(precioLista as number | null | undefined)
      if (precioDesdeLista != null) {
        return precioDesdeLista
      }
    }
  }

  return toPositiveNumber(item.producto?.precio_venta) ?? 0
}

async function reconciliarFinalesPresupuesto(
  presupuestoId: string
) {
  const supabase = createAdminClient()

  const { data: presupuestoData, error: presupuestoError } = await supabase
    .from('presupuestos')
    .select(`
      id,
      recargo_total,
      lista_precio_id,
      lista_precio:listas_precios(tipo),
      items:presupuesto_items(
        id,
        presupuesto_id,
        producto_id,
        cantidad_solicitada,
        peso_final,
        pesable,
        precio_unit_est,
        precio_unit_final,
        subtotal_est,
        subtotal_final,
        lista_precio_id,
        lista_precio:listas_precios(tipo),
        producto:productos(nombre, categoria, precio_venta, requiere_pesaje, venta_mayor_habilitada)
      )
    `)
    .eq('id', presupuestoId)
    .single()

  if (presupuestoError || !presupuestoData) {
    devError('[PRESUPUESTOS] No se pudo cargar el presupuesto para reconciliar finales:', presupuestoError)
    return {
      success: false,
      error: presupuestoError?.message || 'Presupuesto no encontrado',
    }
  }

  let subtotalReconciliado = 0
  const nowIso = getNowArgentina().toISOString()

  for (const item of presupuestoData.items || []) {
    const esMayorista = esVentaMayorista(presupuestoData, item)
    const esPesable = esItemPesable(item, esMayorista)
    const precioUnitario = await resolverPrecioUnitarioItem(supabase, item, presupuestoData)
    const cantidadBase = esPesable
      ? (toFiniteNumber(item.peso_final) ?? toFiniteNumber(item.cantidad_solicitada) ?? 0)
      : (toFiniteNumber(item.cantidad_solicitada) ?? 0)
    const subtotalCalculado = roundCurrency(cantidadBase * precioUnitario)

    const subtotalItem = esPesable
      ? subtotalCalculado
      : toPositiveNumber(item.subtotal_final)
        ?? toPositiveNumber(item.subtotal_est)
        ?? subtotalCalculado

    subtotalReconciliado += subtotalItem

    const updateData: Record<string, unknown> = {}

    if (esPesable && item.pesable !== true) {
      updateData.pesable = true
    }

    if (esPesable && item.peso_final != null) {
      if (!sameCurrencyValue(item.precio_unit_final, precioUnitario)) {
        updateData.precio_unit_final = precioUnitario
      }

      if (!sameCurrencyValue(item.subtotal_final, subtotalCalculado)) {
        updateData.subtotal_final = subtotalCalculado
      }
    }

    if (Object.keys(updateData).length > 0) {
      updateData.updated_at = nowIso

      const { error: updateItemError } = await supabase
        .from('presupuesto_items')
        .update(updateData)
        .eq('id', item.id)
        .select('id')
        .single()

      if (updateItemError) {
        devError('[PRESUPUESTOS] Error reconciliando item pesado:', updateItemError)
        return {
          success: false,
          error: updateItemError.message,
        }
      }
    }
  }

  const totalFinal = roundCurrency(subtotalReconciliado + (toFiniteNumber(presupuestoData.recargo_total) ?? 0))

  const { error: updatePresupuestoError } = await supabase
    .from('presupuestos')
    .update({
      total_final: totalFinal,
      updated_at: nowIso,
    })
    .eq('id', presupuestoId)
    .select('id')
    .single()

  if (updatePresupuestoError) {
    devError('[PRESUPUESTOS] Error actualizando total final reconciliado:', updatePresupuestoError)
    return {
      success: false,
      error: updatePresupuestoError.message,
    }
  }

  return {
    success: true,
    total_final: totalFinal,
  }
}

// Acción para crear presupuesto
export async function crearPresupuestoAction(formData: FormData) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Verificar permisos (vendedor o admin)
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'vendedor'].includes(usuario.rol)) {
      return { success: false, error: 'No tienes permisos para crear presupuestos' }
    }

    // Parsear y validar datos
    const rawData = Object.fromEntries(formData)
    const data = crearPresupuestoSchema.parse({
      cliente_id: rawData.cliente_id,
      zona_id: rawData.zona_id || undefined,
      fecha_entrega_estimada: rawData.fecha_entrega_estimada || undefined,
      observaciones: rawData.observaciones || undefined,
      lista_precio_id: rawData.lista_precio_id || undefined,
      tipo_venta: rawData.tipo_venta || 'reparto',
      turno: rawData.turno || undefined,
      items: JSON.parse(rawData.items as string),
    })

    // Preparar items para RPC (incluyendo lista_precio_id por item)
    const itemsJson = data.items.map(item => ({
      producto_id: item.producto_id,
      cantidad: item.cantidad_solicitada,
      precio_unitario: item.precio_unit_est,
      lista_precio_id: item.lista_precio_id || data.lista_precio_id || null, // Usar lista individual o global
    }))

    // Llamar RPC para crear presupuesto (ahora con asignación automática de turno y lista_precio_id por item)
    const { data: result, error } = await supabase.rpc('fn_crear_presupuesto_desde_bot', {
      p_cliente_id: data.cliente_id,
      p_items: itemsJson,
      p_observaciones: data.observaciones,
      p_zona_id: data.zona_id,
      p_fecha_entrega_estimada: data.fecha_entrega_estimada || null,
      p_lista_precio_id: data.lista_precio_id || null, // Lista global (opcional)
    })

    if (error) {
      devError('[SERVER] Error creando presupuesto RPC:', error)
      return { success: false, error: 'Error al crear presupuesto: ' + error.message }
    }

    devLog('[SERVER] Resultado RPC crear presupuesto:', JSON.stringify(result, null, 2))

    if (!result || !result.success) {
      devError('[SERVER] Error: result.success es false:', result)
      return { success: false, error: result?.error || 'Error en la creación del presupuesto' }
    }

    devLog('[SERVER] Presupuesto creado exitosamente:', {
      presupuesto_id: result.presupuesto_id,
      numero_presupuesto: result.numero_presupuesto,
      result_keys: Object.keys(result),
      result_completo: result
    })

    // Asignar usuario vendedor, lista de precios, y tipo de venta
    const updateData: { usuario_vendedor: string; lista_precio_id?: string; tipo_venta?: string; turno?: 'mañana' | 'tarde' } = {
      usuario_vendedor: user.id,
    }
    if (data.lista_precio_id) {
      updateData.lista_precio_id = data.lista_precio_id
    }
    if (data.tipo_venta) {
      updateData.tipo_venta = data.tipo_venta
    }
    if (data.turno) {
      updateData.turno = data.turno
    }
    await supabase
      .from('presupuestos')
      .update(updateData)
      .eq('id', result.presupuesto_id)

    // Crear notificación para admin
    await createNotification({
      titulo: 'Nuevo presupuesto creado',
      mensaje: `Presupuesto ${result.numero_presupuesto} creado por ${usuario.rol}`,
      tipo: 'info',
      usuario_id: null, // Para todos los admins
      metadata: { presupuesto_id: result.presupuesto_id }
    })

    // Enviar notificación por WhatsApp al cliente
    try {
      await enviarNotificacionWhatsApp(
        data.cliente_id,
        'presupuesto_creado',
        {
          numero: result.numero_presupuesto,
          total: result.total_estimado,
          fecha_entrega: result.fecha_entrega_estimada || data.fecha_entrega_estimada,
          turno: result.turno
        }
      )
    } catch (notifError) {
      devError('Error enviando notificación WhatsApp:', notifError)
      // No bloqueamos la operación si falla la notificación
    }

    revalidatePath('/ventas/presupuestos')
    if (result.presupuesto_id) {
      revalidatePath(`/ventas/presupuestos/${result.presupuesto_id}`)
    }

    return {
      success: true,
      message: `Presupuesto ${result.numero_presupuesto} creado exitosamente`,
      data: result
    }

  } catch (error) {
    console.error('Error en crearPresupuestoAction:', error)
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Datos inválidos: ' + error.issues[0].message }
    }
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Acción para reservar stock de un presupuesto
export async function reservarStockAction(formData: FormData) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Parsear y validar datos
    const rawData = Object.fromEntries(formData)
    const data = reservarStockSchema.parse({
      presupuesto_id: rawData.presupuesto_id,
    })

    // Llamar RPC para reservar stock
    const { data: result, error } = await supabase.rpc('fn_reservar_stock_por_presupuesto', {
      p_presupuesto_id: data.presupuesto_id,
    })

    if (error) {
      devError('Error reservando stock:', error)
      return { success: false, error: 'Error al reservar stock' }
    }

    if (!result.success) {
      return { success: false, error: result.error || 'Error en la reserva de stock' }
    }

    // Actualizar estado del presupuesto
    await supabase
      .from('presupuestos')
      .update({
        estado: result.errores.length === 0 ? 'pendiente' : 'pendiente',
        updated_at: getNowArgentina().toISOString()
      })
      .eq('id', data.presupuesto_id)

    revalidatePath('/ventas/presupuestos')
    revalidatePath(`/ventas/presupuestos/${data.presupuesto_id}`)

    return {
      success: true,
      message: result.errores.length === 0
        ? 'Stock reservado exitosamente'
        : 'Stock reservado parcialmente. Algunos items sin stock suficiente.',
      data: result
    }

  } catch (error) {
    console.error('Error en reservarStockAction:', error)
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Datos inválidos: ' + error.issues[0].message }
    }
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Acción para confirmar presupuesto (convertir a pedido)
export async function confirmarPresupuestoAction(formData: FormData) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Verificar permisos (admin, vendedor o almacenista)
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'vendedor', 'almacenista'].includes(usuario.rol)) {
      return { success: false, error: 'No tienes permisos para confirmar presupuestos' }
    }

    // Parsear y validar datos
    const rawData = Object.fromEntries(formData)
    const data = confirmarPresupuestoSchema.parse({
      presupuesto_id: rawData.presupuesto_id,
      caja_id: rawData.caja_id || undefined,
    })

    // DEBUG: Obtener datos del presupuesto antes de convertir
    const { data: presupuestoDebug } = await supabase
      .from('presupuestos')
      .select('id, numero_presupuesto, turno, zona_id, fecha_entrega_estimada, estado')
      .eq('id', data.presupuesto_id)
      .single()

    devLog('🔍 DEBUG confirmarPresupuestoAction - Presupuesto:', JSON.stringify(presupuestoDebug, null, 2))

    const reconcileBeforeConvert = await reconciliarFinalesPresupuesto(data.presupuesto_id)
    if (!reconcileBeforeConvert.success) {
      return {
        success: false,
        message: reconcileBeforeConvert.error || 'No se pudo preparar el presupuesto antes de convertirlo',
        debug: { presupuesto: presupuestoDebug }
      }
    }

    // Llamar RPC para convertir presupuesto a pedido
    devLog('🔍 DEBUG - Llamando fn_convertir_presupuesto_a_pedido con:', {
      p_presupuesto_id: data.presupuesto_id,
      p_user_id: user.id,
      p_caja_id: data.caja_id,
    })

    const { data: result, error } = await supabase.rpc('fn_convertir_presupuesto_a_pedido', {
      p_presupuesto_id: data.presupuesto_id,
      p_user_id: user.id,
      p_caja_id: data.caja_id,
    })

    devLog('🔍 DEBUG - Resultado RPC:', JSON.stringify(result, null, 2))
    devLog('🔍 DEBUG - Error RPC:', error ? JSON.stringify(error, null, 2) : 'null')

    if (error) {
      devError('❌ Error convirtiendo presupuesto:', error)
      return {
        success: false,
        message: `Error al convertir presupuesto: ${error.message || error.code || 'Error desconocido'}`,
        debug: { error, presupuesto: presupuestoDebug }
      }
    }

    if (!result || !result.success) {
      devError('❌ RPC devolvió error:', result?.error)
      return {
        success: false,
        message: result?.error || 'Error en la conversión del presupuesto',
        debug: { result, presupuesto: presupuestoDebug }
      }
    }

    // Crear factura interna desde el pedido generado
    if (result.pedido_id) {
      try {
        const { data: facturaResult, error: facturaError } = await supabase.rpc(
          'fn_crear_factura_desde_pedido',
          {
            p_pedido_id: result.pedido_id,
            p_user_id: user.id,
          }
        )

        if (facturaError) {
          devError(
            'Error creando factura desde pedido (presupuesto individual):',
            facturaError
          )
        } else if (!facturaResult?.success) {
          devError(
            'RPC fn_crear_factura_desde_pedido devolvió error:',
            facturaResult?.error
          )
        }
      } catch (factError) {
        devError('Excepción creando factura desde pedido:', factError)
      }
    }

    if (result.ruta_id) {
      try {
        await generateRutaOptimizada({
          supabase,
          rutaId: result.ruta_id,
          usarGoogle: true,
        })
      } catch (optError) {
        devError('No se pudo optimizar la ruta planificada automáticamente:', optError)
      }
    }

    // Crear notificación
    await createNotification({
      titulo: 'Presupuesto convertido a pedido',
      mensaje: `Pedido ${result.numero_pedido} creado desde presupuesto`,
      tipo: 'success',
      usuario_id: null,
      metadata: {
        pedido_id: result.pedido_id,
        presupuesto_id: data.presupuesto_id
      }
    })

    // Obtener datos del presupuesto para la notificación
    const { data: presupuesto } = await supabase
      .from('presupuestos')
      .select('cliente_id, total_final, total_estimado, fecha_entrega_estimada, turno')
      .eq('id', data.presupuesto_id)
      .single()

    // Enviar notificación por WhatsApp al cliente
    if (presupuesto) {
      try {
        await enviarNotificacionWhatsApp(
          presupuesto.cliente_id,
          'pedido_confirmado',
          {
            numero: result.numero_pedido,
            total: presupuesto.total_final || presupuesto.total_estimado,
            fecha_entrega: presupuesto.fecha_entrega_estimada,
            turno: presupuesto.turno
          }
        )
      } catch (notifError) {
        devError('Error enviando notificación WhatsApp:', notifError)
      }
    }

    revalidatePath('/ventas/presupuestos')
    revalidatePath('/almacen/pedidos')
    revalidatePath('/tesoreria/cajas')
    revalidatePath('/almacen/presupuestos-dia')

    return {
      success: true,
      message: `Presupuesto convertido a pedido ${result.numero_pedido} exitosamente`,
      data: {
        ...result,
        total_presupuesto_reconciliado: reconcileBeforeConvert.total_final,
      }
    }

  } catch (error) {
    console.error('Error en confirmarPresupuestoAction:', error)
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Datos inválidos: ' + error.issues[0].message }
    }
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Acción para finalizar pesaje sin convertir a pedido (solo recalcula totales)
export async function finalizarPesajeAction(formData: FormData) {
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
      return { success: false, error: 'No tienes permisos para finalizar pesaje' }
    }

    // Parsear y validar datos
    const rawData = Object.fromEntries(formData)
    const presupuestoId = rawData.presupuesto_id as string

    if (!presupuestoId) {
      return { success: false, error: 'ID de presupuesto requerido' }
    }

    const reconcileBeforeFinalize = await reconciliarFinalesPresupuesto(presupuestoId)
    if (!reconcileBeforeFinalize.success) {
      return {
        success: false,
        error: reconcileBeforeFinalize.error || 'No se pudo preparar el presupuesto para finalizar el pesaje'
      }
    }

    // Llamar RPC para finalizar pesaje sin convertir a pedido
    const { data: result, error } = await supabase.rpc('fn_finalizar_pesaje_presupuesto', {
      p_presupuesto_id: presupuestoId,
    })

    if (error) {
      devError('Error finalizando pesaje:', error)
      return { success: false, error: 'Error al finalizar pesaje: ' + error.message }
    }

    if (!result.success) {
      return { success: false, error: result.error || 'Error al finalizar pesaje' }
    }

    const reconcileAfterFinalize = await reconciliarFinalesPresupuesto(presupuestoId)
    if (!reconcileAfterFinalize.success) {
      devError('[PRESUPUESTOS] El pesaje se finalizo pero la reconciliacion posterior fallo:', reconcileAfterFinalize.error)
    }

    revalidatePath('/almacen/presupuestos-dia')
    revalidatePath('/almacen/presupuesto/*')

    return {
      success: true,
      message: result.message || 'Pesaje finalizado correctamente. El presupuesto seguirá disponible en Presupuestos del Día.',
      data: {
        ...result,
        total_final: reconcileAfterFinalize.success
          ? reconcileAfterFinalize.total_final
          : reconcileBeforeFinalize.total_final,
      }
    }

  } catch (error) {
    console.error('Error en finalizarPesajeAction:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Acción para convertir múltiples presupuestos (cada uno se agrega al pedido abierto de su turno/zona/fecha)
export async function confirmarPresupuestosAgrupadosAction(formData: FormData) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Verificar permisos (admin, vendedor o almacenista)
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'vendedor', 'almacenista'].includes(usuario.rol)) {
      return { success: false, error: 'No tienes permisos para confirmar presupuestos' }
    }

    // Parsear y validar datos
    const rawData = Object.fromEntries(formData)
    const presupuestosIds = rawData.presupuestos_ids
      ? (typeof rawData.presupuestos_ids === 'string'
        ? JSON.parse(rawData.presupuestos_ids)
        : rawData.presupuestos_ids)
      : []

    const data = confirmarPresupuestosAgrupadosSchema.parse({
      presupuestos_ids: presupuestosIds,
      caja_id: rawData.caja_id || undefined,
    })

    // Convertir cada presupuesto usando la función que agrupa automáticamente por turno/zona/fecha
    let exitosos = 0
    let errores = 0
    const erroresDetalle: string[] = []
    const pedidosAfectados = new Set<string>()
    let ultimoResultado: any = null

    for (const presupuestoId of data.presupuestos_ids) {
      const reconcileBeforeConvert = await reconciliarFinalesPresupuesto(presupuestoId)
      if (!reconcileBeforeConvert.success) {
        errores++
        erroresDetalle.push(`Presupuesto ${presupuestoId}: ${reconcileBeforeConvert.error || 'No se pudo reconciliar el presupuesto'}`)
        continue
      }

      const { data: result, error } = await supabase.rpc('fn_convertir_presupuesto_a_pedido', {
        p_presupuesto_id: presupuestoId,
        p_user_id: user.id,
        p_caja_id: data.caja_id,
      })

      if (error) {
        errores++
        erroresDetalle.push(`Presupuesto ${presupuestoId}: ${error.message}`)
      } else if (!result.success) {
        errores++
        erroresDetalle.push(`Presupuesto ${presupuestoId}: ${result.error}`)
      } else {
        exitosos++
        pedidosAfectados.add(result.pedido_id)
        ultimoResultado = {
          ...result,
          total_presupuesto_reconciliado: reconcileBeforeConvert.total_final,
        }
      }
    }

    if (errores > 0) {
      devError('Errores en conversión masiva:', erroresDetalle)
    }

    // Crear notificación
    if (exitosos > 0) {
      await createNotification({
        titulo: 'Presupuestos convertidos',
        mensaje: `${exitosos} presupuesto(s) agregado(s) a ${pedidosAfectados.size} pedido(s)`,
        tipo: 'success',
        usuario_id: null,
        metadata: {
          presupuestos_convertidos: exitosos,
          pedidos_afectados: Array.from(pedidosAfectados)
        }
      })
    }

    revalidatePath('/ventas/presupuestos')
    revalidatePath('/almacen/pedidos')
    revalidatePath('/tesoreria/cajas')
    revalidatePath('/almacen/presupuestos-dia')

    if (exitosos === 0) {
      return {
        success: false,
        message: `No se pudo convertir ningún presupuesto. ${erroresDetalle[0] || 'Error desconocido'}`
      }
    }

    return {
      success: true,
      message: `${exitosos} presupuesto(s) agregado(s) a ${pedidosAfectados.size} pedido(s)${errores > 0 ? ` (${errores} con errores)` : ''}`,
      data: {
        exitosos,
        errores,
        pedidos_afectados: Array.from(pedidosAfectados),
        ultimo_resultado: ultimoResultado
      }
    }

  } catch (error) {
    console.error('Error en confirmarPresupuestosAgrupadosAction:', error)
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Datos inválidos: ' + error.issues[0].message }
    }
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Acción para actualizar peso de item de presupuesto
export async function actualizarPesoItemAction(formData: FormData) {
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
      return { success: false, error: 'No tienes permisos para actualizar pesos' }
    }

    // Parsear y validar datos
    const rawData = Object.fromEntries(formData)
    const data = actualizarPesoItemSchema.parse({
      presupuesto_item_id: rawData.presupuesto_item_id,
      peso_final: parseFloat(rawData.peso_final as string),
    })

    // Llamar RPC para actualizar peso
    const { data: result, error } = await supabase.rpc('fn_actualizar_peso_item_presupuesto', {
      p_presupuesto_item_id: data.presupuesto_item_id,
      p_peso_final: data.peso_final,
    })

    if (error) {
      devError('Error actualizando peso:', error)
      return { success: false, error: 'Error al actualizar peso del item' }
    }

    if (!result.success) {
      return { success: false, error: result.error || 'Error en la actualización del peso' }
    }

    const adminSupabase = createAdminClient()

    const { data: itemActualizado, error: itemActualizadoError } = await adminSupabase
      .from('presupuesto_items')
      .select('presupuesto_id')
      .eq('id', data.presupuesto_item_id)
      .single()

    if (itemActualizadoError || !itemActualizado?.presupuesto_id) {
      devError('[PRESUPUESTOS] No se pudo obtener el presupuesto del item pesado:', itemActualizadoError)
      return { success: false, error: 'El peso se guardo pero no se pudo reconciliar el presupuesto' }
    }

    const reconcileAfterWeight = await reconciliarFinalesPresupuesto(itemActualizado.presupuesto_id)
    if (!reconcileAfterWeight.success) {
      devError('[PRESUPUESTOS] El peso se guardo pero la reconciliacion fallo:', reconcileAfterWeight.error)
      return { success: false, error: reconcileAfterWeight.error || 'No se pudo reconciliar el presupuesto después del pesaje' }
    }

    revalidatePath(`/almacen/presupuesto/*`)

    return {
      success: true,
      message: 'Peso actualizado exitosamente',
      data: {
        ...result,
        presupuesto_id: itemActualizado.presupuesto_id,
        total_final: reconcileAfterWeight.total_final,
      }
    }

  } catch (error) {
    console.error('Error en actualizarPesoItemAction:', error)
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Datos inválidos: ' + error.issues[0].message }
    }
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Acción para obtener lista de presupuestos
export async function obtenerPresupuestosAction(filtros?: {
  estado?: string
  zona_id?: string
  fecha_desde?: string
  fecha_hasta?: string
}) {
  try {
    const supabase = await createClient()

    let query = supabase
      .from('presupuestos')
      .select(`
        *,
        cliente:clientes!presupuestos_cliente_id_fkey(nombre, telefono, zona_entrega),
        zona:zonas!presupuestos_zona_id_fkey(nombre),
        usuario_vendedor_obj:usuarios!presupuestos_usuario_vendedor_fkey(nombre),
        items:presupuesto_items(
          id,
          producto:productos!presupuesto_items_producto_id_fkey(codigo, nombre),
          cantidad_solicitada,
          cantidad_reservada,
          precio_unit_est,
          precio_unit_final,
          pesable,
          peso_final,
          subtotal_est,
          subtotal_final
        )
      `)
      .order('created_at', { ascending: false })

    // Aplicar filtros
    if (filtros?.estado) {
      query = query.eq('estado', filtros.estado)
    }
    if (filtros?.zona_id) {
      query = query.eq('zona_id', filtros.zona_id)
    }
    if (filtros?.fecha_desde) {
      query = query.gte('fecha_entrega_estimada', filtros.fecha_desde)
    }
    if (filtros?.fecha_hasta) {
      query = query.lte('fecha_entrega_estimada', filtros.fecha_hasta)
    }

    const { data, error } = await query

    if (error) {
      devError('Error obteniendo presupuestos:', error)
      // Mostrar el error real para debugging
      return {
        success: false,
        message: `Error al obtener presupuestos: ${error.message || error.code || 'Error desconocido'}`,
        error: error
      }
    }

    return { success: true, data }

  } catch (error) {
    console.error('Error en obtenerPresupuestosAction:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Acción para obtener detalle de un presupuesto
export async function obtenerPresupuestoAction(presupuestoId: string) {
  try {
    devLog('[SERVER] obtenerPresupuestoAction - ID recibido:', presupuestoId)
    const supabase = await createClient()

    // OPTIMIZADO: Una sola query con todos los joins en lugar de 7 queries separadas
    devLog('[SERVER] Ejecutando query para obtener presupuesto...')
    const { data: presupuestoData, error: presupuestoError } = await supabase
      .from('presupuestos')
      .select(`
        *,
        cliente:clientes(*),
        zona:zonas(nombre),
        lista_precio:listas_precios(tipo),
        usuario_vendedor_obj:usuarios!presupuestos_usuario_vendedor_fkey(nombre),
        usuario_almacen_obj:usuarios!presupuestos_usuario_almacen_fkey(nombre),
        usuario_repartidor_obj:usuarios!presupuestos_usuario_repartidor_fkey(nombre),
        items:presupuesto_items(
          *,
          producto:productos(*),
        lote_reservado:lotes(*),
        lista_precio:listas_precios(tipo)
        )
      `)
      .eq('id', presupuestoId)
      .single()

    if (presupuestoError) {
      devError('[SERVER] Error al obtener presupuesto de BD:', {
        presupuestoId,
        errorCode: presupuestoError.code,
        errorMessage: presupuestoError.message,
        errorDetails: presupuestoError.details,
        errorHint: presupuestoError.hint,
        errorCompleto: presupuestoError
      })

      // Si el error es "no encontrado", dar mensaje más claro
      if (presupuestoError.code === 'PGRST116' || presupuestoError.message?.includes('No rows')) {
        return {
          success: false,
          message: `Presupuesto con ID ${presupuestoId} no encontrado en la base de datos`,
          error: presupuestoError
        }
      }
      return {
        success: false,
        message: `Error al obtener presupuesto: ${presupuestoError.message || presupuestoError.code || 'Error desconocido'}`,
        error: presupuestoError
      }
    }

    if (!presupuestoData) {
      return {
        success: false,
        message: `Presupuesto con ID ${presupuestoId} no encontrado`
      }
    }

    // Obtener reservas de stock (query separada porque no hay relación directa)
    const { data: reservasData } = await supabase
      .from('stock_reservations')
      .select('cantidad, expires_at, estado, producto_id')
      .eq('presupuesto_id', presupuestoId)

    // Obtener pedido convertido si existe (query separada para evitar conflicto de relaciones)
    let pedidoConvertido = null
    if (presupuestoData.pedido_convertido_id) {
      const { data: pedidoData } = await supabase
        .from('pedidos')
        .select('numero_pedido')
        .eq('id', presupuestoData.pedido_convertido_id)
        .single()

      if (pedidoData) {
        pedidoConvertido = { numero_pedido: pedidoData.numero_pedido }
      }
    }

    // Construir objeto de respuesta con reservas agrupadas por producto
    const reservasPorProducto = (reservasData || []).reduce((acc: any, r: any) => {
      if (!acc[r.producto_id]) acc[r.producto_id] = []
      acc[r.producto_id].push(r)
      return acc
    }, {})

    const data = {
      ...presupuestoData,
      pedido_convertido: pedidoConvertido,
      items: (presupuestoData.items || []).map((item: any) => ({
        ...item,
        reservas: reservasPorProducto[item.producto_id] || []
      }))
    }

    return { success: true, data }

  } catch (error) {
    console.error('Error en obtenerPresupuestoAction:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Acción para recalcular presupuesto (actualizar precios y totales)
export async function recalcularPresupuestoAction(presupuestoId: string) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Obtener presupuesto con items
    const { data: presupuesto, error: presupuestoError } = await supabase
      .from('presupuestos')
      .select(`
        *,
        items:presupuesto_items(
          id,
          producto_id,
          cantidad_solicitada,
          producto:productos(precio_venta)
        )
      `)
      .eq('id', presupuestoId)
      .single()

    if (presupuestoError || !presupuesto) {
      return { success: false, error: 'Presupuesto no encontrado' }
    }

    // Solo se puede recalcular si está pendiente
    if (presupuesto.estado !== 'pendiente') {
      return { success: false, error: 'Solo se pueden recalcular presupuestos pendientes' }
    }

    let totalEstimado = 0

    // Recalcular cada item con precios actuales
    for (const item of presupuesto.items || []) {
      let precioActual = item.producto?.precio_venta || 0

      // Si el presupuesto tiene lista de precios, usar precio de la lista
      if (presupuesto.lista_precio_id) {
        const { data: precioLista } = await supabase.rpc('fn_obtener_precio_producto', {
          p_lista_precio_id: presupuesto.lista_precio_id,
          p_producto_id: item.producto_id,
        })
        if (precioLista && precioLista > 0) {
          precioActual = precioLista
        }
      }

      const subtotalEst = item.cantidad_solicitada * precioActual

      // Actualizar item
      await supabase
        .from('presupuesto_items')
        .update({
          precio_unit_est: precioActual,
          subtotal_est: subtotalEst,
          updated_at: getNowArgentina().toISOString(),
        })
        .eq('id', item.id)

      totalEstimado += subtotalEst
    }

    // Actualizar total del presupuesto
    const { error: updateError } = await supabase
      .from('presupuestos')
      .update({
        total_estimado: totalEstimado,
        updated_at: getNowArgentina().toISOString(),
      })
      .eq('id', presupuestoId)

    if (updateError) {
      devError('Error actualizando presupuesto:', updateError)
      return { success: false, error: 'Error al actualizar presupuesto' }
    }

    revalidatePath('/ventas/presupuestos')
    revalidatePath(`/ventas/presupuestos/${presupuestoId}`)

    return {
      success: true,
      message: 'Presupuesto recalculado exitosamente',
      data: { total_estimado: totalEstimado }
    }

  } catch (error) {
    console.error('Error en recalcularPresupuestoAction:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Acción para actualizar presupuesto
export async function actualizarPresupuestoAction(formData: FormData) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const presupuestoId = formData.get('presupuesto_id') as string
    const observaciones = formData.get('observaciones') as string
    const fecha_entrega_estimada = formData.get('fecha_entrega_estimada') as string
    const turnoRaw = formData.get('turno') as string

    if (!presupuestoId) {
      return { success: false, error: 'ID de presupuesto requerido' }
    }

    const turnoNormalizado =
      turnoRaw === 'manana'
        ? 'mañana'
        : turnoRaw === 'mañana' || turnoRaw === 'tarde'
          ? turnoRaw
          : ''

    if (turnoRaw && !turnoNormalizado) {
      return { success: false, error: 'Turno inválido. Debe ser mañana o tarde.' }
    }

    // Verificar que el presupuesto existe y está en estado pendiente
    const { data: presupuesto, error: presupuestoError } = await supabase
      .from('presupuestos')
      .select('estado')
      .eq('id', presupuestoId)
      .single()

    if (presupuestoError || !presupuesto) {
      return { success: false, error: 'Presupuesto no encontrado' }
    }

    if (presupuesto.estado !== 'pendiente') {
      return { success: false, error: 'Solo se pueden editar presupuestos pendientes' }
    }

    // Actualizar presupuesto
    const updateData: any = {
      updated_at: getNowArgentina().toISOString(),
    }

    if (observaciones !== null) {
      updateData.observaciones = observaciones
    }

    if (fecha_entrega_estimada) {
      updateData.fecha_entrega_estimada = fecha_entrega_estimada
    }

    if (turnoNormalizado) {
      updateData.turno = turnoNormalizado
    }

    const { error: updateError } = await supabase
      .from('presupuestos')
      .update(updateData)
      .eq('id', presupuestoId)

    if (updateError) {
      devError('Error actualizando presupuesto:', updateError)
      return { success: false, error: 'Error al actualizar presupuesto' }
    }

    revalidatePath('/ventas/presupuestos')
    revalidatePath(`/ventas/presupuestos/${presupuestoId}`)

    return {
      success: true,
      message: 'Presupuesto actualizado exitosamente',
      data: { presupuesto_id: presupuestoId }
    }

  } catch (error) {
    console.error('Error en actualizarPresupuestoAction:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Acción para enviar presupuesto a almacén
export async function enviarPresupuestoAlmacenAction(presupuestoId: string) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Verificar que el presupuesto tenga turno y zona antes de enviar
    const { data: presupuesto, error: presupuestoError } = await supabase
      .from('presupuestos')
      .select('turno, zona_id, estado')
      .eq('id', presupuestoId)
      .single()

    if (presupuestoError || !presupuesto) {
      return { success: false, error: 'Presupuesto no encontrado' }
    }

    if (presupuesto.estado !== 'pendiente') {
      return { success: false, error: 'Solo se pueden enviar presupuestos pendientes a almacén' }
    }

    if (!presupuesto.zona_id) {
      return { success: false, error: 'El presupuesto debe tener una zona asignada antes de enviar a almacén' }
    }

    // Actualizar estado y usuario almacén
    const { error } = await supabase
      .from('presupuestos')
      .update({
        estado: 'en_almacen',
        usuario_almacen: user.id,
        updated_at: getNowArgentina().toISOString()
      })
      .eq('id', presupuestoId)
      .eq('estado', 'pendiente')

    if (error) {
      devError('Error enviando presupuesto a almacén:', error)
      return { success: false, error: 'Error al enviar presupuesto a almacén' }
    }

    // Crear notificación para almacenistas
    await createNotification({
      titulo: 'Presupuesto enviado a almacén',
      mensaje: `Presupuesto ${presupuestoId} requiere pesaje`,
      tipo: 'warning',
      usuario_id: null, // Para almacenistas
      metadata: { presupuesto_id: presupuestoId }
    })

    revalidatePath('/ventas/presupuestos')
    revalidatePath(`/ventas/presupuestos/${presupuestoId}`)
    revalidatePath('/almacen/presupuestos-dia')

    return { success: true, message: 'Presupuesto enviado a almacén exitosamente' }

  } catch (error) {
    console.error('Error en enviarPresupuestoAlmacenAction:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Acción para asignar turno y zona a presupuesto
export async function asignarTurnoZonaPresupuestoAction(formData: FormData) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Verificar permisos (vendedor o admin)
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'vendedor'].includes(usuario.rol)) {
      return { success: false, error: 'No tienes permisos para asignar turno y zona' }
    }

    // Parsear datos
    const presupuesto_id = formData.get('presupuesto_id') as string
    const turno = formData.get('turno') as string
    const zona_id = formData.get('zona_id') as string
    const metodos_pago = formData.get('metodos_pago') ? JSON.parse(formData.get('metodos_pago') as string) : null
    const recargo_total = formData.get('recargo_total') ? parseFloat(formData.get('recargo_total') as string) : 0

    if (!presupuesto_id || !turno || !zona_id) {
      return { success: false, error: 'Faltan datos requeridos: presupuesto_id, turno, zona_id' }
    }

    if (!['mañana', 'tarde'].includes(turno)) {
      return { success: false, error: 'Turno inválido. Debe ser "mañana" o "tarde"' }
    }

    // Llamar RPC para asignar turno y zona
    const { data: result, error } = await supabase.rpc('fn_asignar_turno_zona_presupuesto', {
      p_presupuesto_id: presupuesto_id,
      p_turno: turno,
      p_zona_id: zona_id,
      p_metodos_pago: metodos_pago,
      p_recargo_total: recargo_total,
    })

    if (error) {
      devError('Error asignando turno y zona:', error)
      return { success: false, error: 'Error al asignar turno y zona' }
    }

    if (!result.success) {
      return { success: false, error: result.error || 'Error en la asignación' }
    }

    revalidatePath('/ventas/presupuestos')
    revalidatePath(`/ventas/presupuestos/${presupuesto_id}`)

    return {
      success: true,
      message: 'Turno y zona asignados exitosamente',
      data: result
    }

  } catch (error) {
    console.error('Error en asignarTurnoZonaPresupuestoAction:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Acción para convertir presupuesto a cotización
export async function convertirPresupuestoACotizacionAction(presupuestoId: string) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Verificar permisos (vendedor o admin)
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'vendedor'].includes(usuario.rol)) {
      return { success: false, error: 'No tienes permisos para convertir presupuestos' }
    }

    // Llamar RPC para convertir a cotización
    const { data: result, error } = await supabase.rpc('fn_convertir_presupuesto_a_cotizacion', {
      p_presupuesto_id: presupuestoId,
    })

    if (error) {
      devError('Error convirtiendo presupuesto a cotización:', error)
      return { success: false, error: 'Error al convertir presupuesto a cotización' }
    }

    if (!result.success) {
      return { success: false, error: result.error || 'Error en la conversión' }
    }

    revalidatePath('/ventas/presupuestos')
    revalidatePath(`/ventas/presupuestos/${presupuestoId}`)

    return {
      success: true,
      message: `Presupuesto convertido a cotización ${result.numero_cotizacion} exitosamente`,
      data: result
    }

  } catch (error) {
    console.error('Error en convertirPresupuestoACotizacionAction:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Acción para recalcular recargos por métodos de pago
export async function recalcularRecargosAction(presupuestoId: string) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Obtener presupuesto con métodos de pago
    const { data: presupuesto, error: presupuestoError } = await supabase
      .from('presupuestos')
      .select('metodos_pago, total_estimado, recargo_total')
      .eq('id', presupuestoId)
      .single()

    if (presupuestoError || !presupuesto) {
      return { success: false, error: 'Presupuesto no encontrado' }
    }

    // Calcular recargos según métodos de pago
    let recargoTotal = 0
    const metodosPago = presupuesto.metodos_pago as any

    if (metodosPago && Array.isArray(metodosPago)) {
      for (const metodo of metodosPago) {
        if (metodo.recargo) {
          recargoTotal += metodo.recargo
        }
      }
    }

    // Actualizar recargo total
    const { error: updateError } = await supabase
      .from('presupuestos')
      .update({
        recargo_total: recargoTotal,
        updated_at: getNowArgentina().toISOString()
      })
      .eq('id', presupuestoId)

    if (updateError) {
      devError('Error actualizando recargos:', updateError)
      return { success: false, error: 'Error al recalcular recargos' }
    }

    revalidatePath('/ventas/presupuestos')
    revalidatePath(`/ventas/presupuestos/${presupuestoId}`)

    return {
      success: true,
      message: 'Recargos recalculados exitosamente',
      data: { recargo_total: recargoTotal }
    }

  } catch (error) {
    console.error('Error en recalcularRecargosAction:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Acción para obtener estadísticas de presupuestos
export async function obtenerEstadisticasPresupuestosAction() {
  try {
    const supabase = await createClient()

    // Obtener fecha actual y inicio del mes
    const now = getNowArgentina()
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const hoy = now.toISOString().split('T')[0]

    // Query para total del mes
    const { count: totalMes } = await supabase
      .from('presupuestos')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', inicioMes)

    // Query para pendientes (estado pendiente o esperando_pesaje)
    const { count: pendientes } = await supabase
      .from('presupuestos')
      .select('*', { count: 'exact', head: true })
      .in('estado', ['pendiente', 'esperando_pesaje'])

    // Query para en almacén (estado en_almacen)
    const { count: enAlmacen } = await supabase
      .from('presupuestos')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'en_almacen')

    // Query para facturados hoy (estado facturado, fecha de hoy)
    const { count: facturadosHoy } = await supabase
      .from('presupuestos')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'facturado')
      .gte('updated_at', `${hoy}T00:00:00`)
      .lte('updated_at', `${hoy}T23:59:59`)

    // Query para anulados este mes
    const { count: anuladosMes } = await supabase
      .from('presupuestos')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'anulado')
      .gte('created_at', inicioMes)

    return {
      success: true,
      data: {
        totalMes: totalMes || 0,
        pendientes: pendientes || 0,
        enAlmacen: enAlmacen || 0,
        facturadosHoy: facturadosHoy || 0,
        anuladosMes: anuladosMes || 0
      }
    }

  } catch (error) {
    console.error('Error en obtenerEstadisticasPresupuestosAction:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}
