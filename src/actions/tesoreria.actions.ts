'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getNowArgentina, getTodayArgentina } from '@/lib/utils'
import { devError } from '@/lib/utils/logger'

// Schemas de validación
const crearCierreCajaSchema = z.object({
  caja_id: z.string().uuid(),
  fecha: z.string(),
})

const cerrarCierreCajaSchema = z.object({
  cierre_id: z.string().uuid(),
  saldo_final: z.number(),
  total_ingresos: z.number(),
  total_egresos: z.number(),
  cobranzas_cuenta_corriente: z.number(),
  gastos: z.number(),
  retiro_tesoro: z.number(),
  arqueo_efectivo: z.number().min(0).default(0),
  arqueo_transferencia: z.number().min(0).default(0),
  arqueo_tarjeta: z.number().min(0).default(0),
  arqueo_qr: z.number().min(0).default(0),
})

const registrarRetiroTesoroSchema = z.object({
  tipo: z.enum(['efectivo', 'transferencia', 'qr', 'tarjeta']),
  monto: z.number().positive(),
  descripcion: z.string().optional(),
})

const validarTransferenciaBNASchema = z.object({
  numero_transaccion: z.string().min(1),
})

// Obtener movimientos en tiempo real
export async function obtenerMovimientosTiempoRealAction(
  cajaId?: string,
  fecha?: string
) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Verificar permisos (admin o tesorero)
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'vendedor', 'encargado_sucursal'].includes(usuario.rol)) {
      return { success: false, error: 'No tienes permisos para ver movimientos' }
    }

    let query = supabase
      .from('tesoreria_movimientos')
      .select(`
        *,
        caja:tesoreria_cajas(nombre),
        usuario:usuarios(nombre, apellido),
        pedido:pedidos(numero_pedido, cliente:clientes(nombre))
      `)
      .order('created_at', { ascending: false })
      .limit(100)

    if (cajaId) {
      query = query.eq('caja_id', cajaId)
    }

    if (fecha) {
      const fechaInicio = `${fecha}T00:00:00Z`
      const fechaFin = `${fecha}T23:59:59Z`
      query = query.gte('created_at', fechaInicio).lte('created_at', fechaFin)
    }

    const { data, error } = await query

    if (error) throw error

    // Obtener saldo actual de cajas
    const { data: cajas } = await supabase
      .from('tesoreria_cajas')
      .select('id, nombre, saldo_actual, moneda')
      .order('created_at', { ascending: false })

    const totalesPorMetodo: Record<string, { ingresos: number; egresos: number }> = {}
    const totalesPorCaja: Record<string, { ingresos: number; egresos: number }> = {}
    let totalIngresos = 0
    let totalEgresos = 0

    // Buscar caja central con búsqueda flexible
    const cajaCentral = cajas?.find((c) => {
      const nombreNormalizado = c.nombre?.toLowerCase().trim().replace(/\s+/g, ' ') || ''
      return (
        nombreNormalizado.includes('caja central') ||
        nombreNormalizado.includes('casa central') ||
        nombreNormalizado === 'caja central' ||
        nombreNormalizado === 'casa central'
      )
    })
    let cajaCentralIngresos = 0
    let cajaCentralEgresos = 0
    const cajaCentralMetodos: Record<string, number> = {}

    data?.forEach((movimiento) => {
      const monto = Number(movimiento.monto) || 0
      const metodo = (movimiento.metodo_pago || 'efectivo').toLowerCase()
      const cajaId = movimiento.caja_id

      if (movimiento.tipo === 'ingreso') {
        totalIngresos += monto
      } else {
        totalEgresos += monto
      }

      if (!totalesPorMetodo[metodo]) {
        totalesPorMetodo[metodo] = { ingresos: 0, egresos: 0 }
      }
      totalesPorMetodo[metodo][movimiento.tipo === 'ingreso' ? 'ingresos' : 'egresos'] += monto

      if (cajaId) {
        if (!totalesPorCaja[cajaId]) {
          totalesPorCaja[cajaId] = { ingresos: 0, egresos: 0 }
        }
        totalesPorCaja[cajaId][movimiento.tipo === 'ingreso' ? 'ingresos' : 'egresos'] += monto
      }

      if (cajaCentral?.id && cajaId === cajaCentral.id) {
        if (movimiento.tipo === 'ingreso') {
          cajaCentralIngresos += monto
          cajaCentralMetodos[metodo] = (cajaCentralMetodos[metodo] || 0) + monto
        } else {
          cajaCentralEgresos += monto
        }
      }
    })

    return {
      success: true,
      data: {
        movimientos: data || [],
        cajas: cajas || [],
        total_movimientos: data?.length || 0,
        totales_por_metodo: totalesPorMetodo,
        totales_por_tipo: {
          ingresos: totalIngresos,
          egresos: totalEgresos,
        },
        totales_por_caja: totalesPorCaja,
        caja_central: cajaCentral
          ? {
            id: cajaCentral.id,
            nombre: cajaCentral.nombre,
            ingresos: cajaCentralIngresos,
            egresos: cajaCentralEgresos,
            totales_por_metodo: cajaCentralMetodos,
          }
          : null,
      },
    }
  } catch (error: any) {
    devError('Error en obtenerMovimientosTiempoRealAction:', error)
    return { success: false, error: error.message || 'Error al obtener movimientos' }
  }
}

// Crear cierre de caja
export async function crearCierreCajaAction(formData: FormData) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Verificar permisos (admin o tesorero)
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'vendedor', 'encargado_sucursal'].includes(usuario.rol)) {
      return { success: false, error: 'No tienes permisos para crear cierres de caja' }
    }

    // Parsear y validar datos
    const rawData = Object.fromEntries(formData)
    const saldoInicialManual = rawData.saldo_inicial ? parseFloat(rawData.saldo_inicial as string) : null

    const data = crearCierreCajaSchema.parse({
      caja_id: rawData.caja_id,
      fecha: rawData.fecha,
    })

    // Verificar que no exista un cierre abierto para esta caja y fecha
    const { data: cierreExistente } = await supabase
      .from('cierres_caja')
      .select('id, estado')
      .eq('caja_id', data.caja_id)
      .eq('fecha', data.fecha)
      .maybeSingle()

    if (cierreExistente) {
      if (cierreExistente.estado === 'abierto') {
        return { success: false, error: 'Ya existe un cierre abierto para esta caja y fecha' }
      }
      return { success: false, error: 'Ya existe un cierre cerrado para esta caja y fecha' }
    }

    // Obtener saldo actual de la caja
    const { data: caja } = await supabase
      .from('tesoreria_cajas')
      .select('saldo_actual')
      .eq('id', data.caja_id)
      .single()

    if (!caja) {
      return { success: false, error: 'Caja no encontrada' }
    }

    // Usar saldo manual si se proporcionó, sino usar el saldo actual de la caja
    const saldoInicialFinal = saldoInicialManual !== null ? saldoInicialManual : caja.saldo_actual

    // Crear cierre
    const { data: cierre, error } = await supabase
      .from('cierres_caja')
      .insert({
        caja_id: data.caja_id,
        fecha: data.fecha,
        saldo_inicial: saldoInicialFinal,
        estado: 'abierto',
      })
      .select()
      .single()

    if (error) throw error

    revalidatePath('/(admin)/(dominios)/tesoreria/cierre-caja')

    return {
      success: true,
      message: 'Cierre de caja creado exitosamente',
      data: cierre,
    }
  } catch (error: any) {
    devError('Error en crearCierreCajaAction:', error)
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Datos inválidos: ' + error.issues[0].message }
    }
    return { success: false, error: error.message || 'Error al crear cierre de caja' }
  }
}

// Cerrar cierre de caja
export async function cerrarCierreCajaAction(formData: FormData) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Verificar permisos (admin o tesorero)
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'vendedor', 'encargado_sucursal'].includes(usuario.rol)) {
      return { success: false, error: 'No tienes permisos para cerrar cierres de caja' }
    }

    // Parsear y validar datos
    const rawData = Object.fromEntries(formData)
    const data = cerrarCierreCajaSchema.parse({
      cierre_id: rawData.cierre_id,
      saldo_final: parseFloat(rawData.saldo_final as string),
      total_ingresos: parseFloat(rawData.total_ingresos as string),
      total_egresos: parseFloat(rawData.total_egresos as string),
      cobranzas_cuenta_corriente: parseFloat(rawData.cobranzas_cuenta_corriente as string),
      gastos: parseFloat(rawData.gastos as string),
      retiro_tesoro: parseFloat(rawData.retiro_tesoro as string),
      arqueo_efectivo: parseFloat(rawData.arqueo_efectivo as string) || 0,
      arqueo_transferencia: parseFloat(rawData.arqueo_transferencia as string) || 0,
      arqueo_tarjeta: parseFloat(rawData.arqueo_tarjeta as string) || 0,
      arqueo_qr: parseFloat(rawData.arqueo_qr as string) || 0,
    })

    // Obtener cierre
    const { data: cierre, error: cierreError } = await supabase
      .from('cierres_caja')
      .select('*')
      .eq('id', data.cierre_id)
      .single()

    if (cierreError || !cierre) {
      return { success: false, error: 'Cierre no encontrado' }
    }

    if (cierre.estado === 'cerrado') {
      return { success: false, error: 'El cierre ya está cerrado' }
    }

    // Actualizar cierre
    const { error: updateError } = await supabase
      .from('cierres_caja')
      .update({
        saldo_final: data.saldo_final,
        total_ingresos: data.total_ingresos,
        total_egresos: data.total_egresos,
        cobranzas_cuenta_corriente: data.cobranzas_cuenta_corriente,
        gastos: data.gastos,
        retiro_tesoro: data.retiro_tesoro,
        arqueo_efectivo: data.arqueo_efectivo,
        arqueo_transferencia: data.arqueo_transferencia,
        arqueo_tarjeta: data.arqueo_tarjeta,
        arqueo_qr: data.arqueo_qr,
        estado: 'cerrado',
        updated_at: getNowArgentina().toISOString(),
      })
      .eq('id', data.cierre_id)

    if (updateError) throw updateError

    // Si hay retiro al tesoro, registrar en tesoro
    if (data.retiro_tesoro > 0) {
      await supabase
        .from('tesoro')
        .insert({
          tipo: 'efectivo', // Por defecto, se puede ajustar
          monto: data.retiro_tesoro,
          descripcion: `Retiro desde cierre de caja ${cierre.fecha}`,
          origen_tipo: 'cierre_caja',
          origen_id: data.cierre_id,
        })
    }

    revalidatePath('/(admin)/(dominios)/tesoreria/cierre-caja')
    revalidatePath('/(admin)/(dominios)/tesoreria/tesoro')

    return {
      success: true,
      message: 'Cierre de caja cerrado exitosamente',
    }
  } catch (error: any) {
    devError('Error en cerrarCierreCajaAction:', error)
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Datos inválidos: ' + error.issues[0].message }
    }
    return { success: false, error: error.message || 'Error al cerrar cierre de caja' }
  }
}

// Obtener cierre de caja abierto del día actual
export async function obtenerCierreAbiertoAction(cajaId: string) {
  try {
    const supabase = await createClient()

    // Obtener fecha actual en Argentina
    const hoy = getTodayArgentina()

    const { data: cierre, error } = await supabase
      .from('cierres_caja')
      .select('*')
      .eq('caja_id', cajaId)
      .eq('fecha', hoy)
      .eq('estado', 'abierto')
      .maybeSingle()

    if (error) throw error

    return {
      success: true,
      data: cierre
    }
  } catch (error: any) {
    devError('Error en obtenerCierreAbierto:', error)
    return { success: false, error: error.message || 'Error al obtener cierre abierto' }
  }
}

// Registrar retiro al tesoro
export async function registrarRetiroTesoroAction(formData: FormData) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Verificar permisos (admin o tesorero)
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'vendedor', 'encargado_sucursal'].includes(usuario.rol)) {
      return { success: false, error: 'No tienes permisos para registrar retiros' }
    }

    // Parsear y validar datos
    const rawData = Object.fromEntries(formData)
    const data = registrarRetiroTesoroSchema.parse({
      tipo: rawData.tipo,
      monto: parseFloat(rawData.monto as string),
      descripcion: rawData.descripcion || undefined,
    })

    // Insertar retiro en tesoro
    const { error } = await supabase
      .from('tesoro')
      .insert({
        tipo: data.tipo,
        monto: data.monto,
        descripcion: data.descripcion || `Retiro de ${data.tipo}`,
        origen_tipo: 'retiro',
        origen_id: null,
      })

    if (error) throw error

    revalidatePath('/(admin)/(dominios)/tesoreria/tesoro')

    return {
      success: true,
      message: 'Retiro al tesoro registrado exitosamente',
    }
  } catch (error: any) {
    devError('Error en registrarRetiroTesoroAction:', error)
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Datos inválidos: ' + error.issues[0].message }
    }
    return { success: false, error: error.message || 'Error al registrar retiro' }
  }
}

// Registrar depósito bancario
export async function registrarDepositoBancarioAction(formData: FormData) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Verificar permisos (admin o tesorero)
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'vendedor', 'encargado_sucursal'].includes(usuario.rol)) {
      return { success: false, error: 'No tienes permisos para registrar depósitos' }
    }

    // Parsear datos
    const monto = parseFloat(formData.get('monto') as string)
    const numero_transaccion = formData.get('numero_transaccion') as string

    if (!monto || !numero_transaccion) {
      return { success: false, error: 'Faltan datos requeridos' }
    }

    // Validar número de transacción BNA (sin 0 inicial)
    const validacion = await validarTransferenciaBNAAction(numero_transaccion)
    if (!validacion.success) {
      return validacion
    }

    // Registrar depósito (egreso del tesoro)
    const { error } = await supabase
      .from('tesoro')
      .insert({
        tipo: 'transferencia',
        monto: -monto, // Negativo porque es salida del tesoro
        descripcion: `Depósito bancario - Transacción: ${numero_transaccion}`,
        origen_tipo: 'deposito',
        origen_id: null,
      })

    if (error) throw error

    revalidatePath('/(admin)/(dominios)/tesoreria/tesoro')

    return {
      success: true,
      message: 'Depósito bancario registrado exitosamente',
    }
  } catch (error: any) {
    devError('Error en registrarDepositoBancarioAction:', error)
    return { success: false, error: error.message || 'Error al registrar depósito' }
  }
}

// Validar transferencia BNA (número sin 0 inicial)
export async function validarTransferenciaBNAAction(numeroTransaccion: string) {
  try {
    // Validar formato básico
    if (!numeroTransaccion || numeroTransaccion.length === 0) {
      return { success: false, error: 'Número de transacción requerido' }
    }

    // Validar que no empiece con 0
    if (numeroTransaccion.startsWith('0')) {
      return { success: false, error: 'El número de transacción BNA no debe empezar con 0' }
    }

    // Validar que sea numérico (sin 0 inicial)
    if (!/^\d+$/.test(numeroTransaccion)) {
      return { success: false, error: 'El número de transacción debe contener solo dígitos' }
    }

    // Aquí se podría agregar validación adicional con API del BNA si está disponible
    // Por ahora solo validamos formato

    return {
      success: true,
      message: 'Número de transacción válido',
    }
  } catch (error: any) {
    devError('Error en validarTransferenciaBNAAction:', error)
    return { success: false, error: error.message || 'Error al validar transferencia' }
  }
}

// Listar cajas
export async function listarCajasAction() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('tesoreria_cajas')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return data || []
  } catch (error: any) {
    devError('Error en listarCajas:', error)
    return []
  }
}

// Crear caja
export async function crearCajaAction(data: { nombre: string; saldo_inicial?: number; moneda?: string; sucursal_id?: string }) {
  try {
    const supabase = await createClient()
    const { data: caja, error } = await supabase
      .from('tesoreria_cajas')
      .insert({
        nombre: data.nombre,
        saldo_actual: data.saldo_inicial || 0,
        saldo_inicial: data.saldo_inicial || 0,
        moneda: data.moneda || 'ARS',
        sucursal_id: data.sucursal_id || null,
        active: true
      })
      .select()
      .single()

    if (error) throw error

    revalidatePath('/(admin)/(dominios)/tesoreria/cajas')
    return { success: true, data: caja }
  } catch (error: any) {
    devError('Error en crearCaja:', error)
    return { success: false, error: error.message || 'Error al crear caja' }
  }
}

// Obtener movimientos de caja (alias para compatibilidad)
export async function obtenerMovimientosCajaAction(cajaId?: string, fecha?: string) {
  return obtenerMovimientosTiempoRealAction(cajaId, fecha)
}

// Registrar movimiento de caja
export async function registrarMovimientoCajaAction(data: {
  caja_id: string
  tipo: 'ingreso' | 'egreso'
  monto: number
  descripcion?: string
  metodo_pago?: string
}) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Usar RPC para crear movimiento atómicamente
    const { data: result, error } = await supabase.rpc('fn_crear_movimiento_caja', {
      p_caja_id: data.caja_id,
      p_tipo: data.tipo,
      p_monto: data.monto,
      p_descripcion: data.descripcion || null,
      p_origen_tipo: null, // Movimiento manual sin referencia
      p_origen_id: null,
      p_user_id: user.id,
      p_metodo_pago: data.metodo_pago || 'efectivo',
    })

    if (error) throw error

    revalidatePath('/(admin)/(dominios)/tesoreria/movimientos')
    revalidatePath('/(admin)/(dominios)/tesoreria')

    return {
      success: true,
      message: 'Movimiento registrado exitosamente',
      data: result,
    }
  } catch (error: any) {
    devError('Error en registrarMovimientoCaja:', error)
    return { success: false, error: error.message || 'Error al registrar movimiento' }
  }
}

// Obtener resumen de tesorería
export async function obtenerResumenTesoreriaAction() {
  try {
    const supabase = await createClient()

    // Obtener cajas con saldos
    const { data: cajas } = await supabase
      .from('tesoreria_cajas')
      .select('id, nombre, saldo_actual, moneda')

    // Obtener movimientos del día
    const hoy = getTodayArgentina()
    const { data: movimientosHoy } = await supabase
      .from('tesoreria_movimientos')
      .select('tipo, monto')
      .gte('created_at', `${hoy}T00:00:00Z`)
      .lte('created_at', `${hoy}T23:59:59Z`)

    const totalIngresos = movimientosHoy
      ?.filter((m) => m.tipo === 'ingreso')
      .reduce((sum, m) => sum + Number(m.monto), 0) || 0

    const totalEgresos = movimientosHoy
      ?.filter((m) => m.tipo === 'egreso')
      .reduce((sum, m) => sum + Number(m.monto), 0) || 0

    return {
      success: true,
      data: {
        cajas: cajas || [],
        totalIngresos,
        totalEgresos,
        saldoTotal: cajas?.reduce((sum, c) => sum + Number(c.saldo_actual), 0) || 0,
      },
    }
  } catch (error: any) {
    devError('Error en obtenerResumenTesoreria:', error)
    return { success: false, error: error.message || 'Error al obtener resumen' }
  }
}

// Registrar pago de pedido
export async function registrarPagoPedidoAction(data: {
  pedido_id: string
  caja_id: string
  monto: number
  metodo_pago: string
  numero_transaccion?: string
}) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Validar número de transacción BNA si es transferencia
    if (data.metodo_pago === 'transferencia' && data.numero_transaccion) {
      const validacion = await validarTransferenciaBNAAction(data.numero_transaccion)
      if (!validacion.success) {
        return validacion
      }
    }

    // Registrar movimiento de caja
    const movimiento = await registrarMovimientoCajaAction({
      caja_id: data.caja_id,
      tipo: 'ingreso',
      monto: data.monto,
      descripcion: `Pago de pedido ${data.pedido_id}`,
      metodo_pago: data.metodo_pago,
    })

    if (!movimiento.success) {
      return movimiento
    }

    // Actualizar estado de pago del pedido
    const { error: updateError } = await supabase
      .from('pedidos')
      .update({
        pago_estado: 'pagado',
        updated_at: getNowArgentina().toISOString(),
      })
      .eq('id', data.pedido_id)

    if (updateError) throw updateError

    revalidatePath('/(admin)/(dominios)/almacen/pedidos')
    revalidatePath('/(admin)/(dominios)/tesoreria')

    return {
      success: true,
      message: 'Pago registrado exitosamente',
    }
  } catch (error: any) {
    devError('Error en registrarPagoPedido:', error)
    return { success: false, error: error.message || 'Error al registrar pago' }
  }
}

// Validar ruta completada (crear movimientos de caja y marcar como validada)
export async function validarRutaAction(formData: FormData) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Verificar que sea tesorero o admin
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'vendedor'].includes(usuario.rol)) {
      return { success: false, error: 'Solo tesoreros y administradores pueden validar rutas' }
    }

    // Parsear datos
    const ruta_id = formData.get('ruta_id') as string
    const monto_fisico_recibido = parseFloat(formData.get('monto_fisico_recibido') as string)
    const observaciones = formData.get('observaciones') as string || null
    const caja_id = formData.get('caja_id') as string

    if (!ruta_id || !caja_id) {
      return { success: false, error: 'Faltan datos requeridos' }
    }

    // Obtener ruta con detalles de pagos registrados
    const { data: ruta, error: rutaError } = await supabase
      .from('rutas_reparto')
      .select(`
        *,
        detalles_ruta (
          id,
          pedido_id,
          pago_registrado,
          metodo_pago_registrado,
          monto_cobrado_registrado,
          numero_transaccion_registrado,
          comprobante_url_registrado,
          pago_validado,
          pedido:pedidos(id, numero_pedido, total, cliente_id)
        )
      `)
      .eq('id', ruta_id)
      .single()

    if (rutaError || !ruta) {
      return { success: false, error: 'Ruta no encontrada' }
    }

    if (ruta.estado !== 'completada') {
      return { success: false, error: 'La ruta debe estar completada para validar' }
    }

    if (ruta.validada_por_tesorero) {
      return { success: false, error: 'Esta ruta ya fue validada' }
    }

    // Para pedidos agrupados, obtener entregas individuales con sus pagos
    const pedidosAgrupados = ruta.detalles_ruta?.filter((d: any) => !d.pedido?.cliente_id).map((d: any) => d.pedido_id) || []
    let entregasIndividuales: any[] = []

    if (pedidosAgrupados.length > 0) {
      const { data: entregas } = await supabase
        .from('entregas')
        .select(`
          id,
          pedido_id,
          cliente_id,
          estado_pago,
          monto_cobrado,
          metodo_pago,
          total,
          cliente:clientes(id, nombre)
        `)
        .in('pedido_id', pedidosAgrupados)

      entregasIndividuales = entregas || []
    }

    // Agrupar pagos por método de pago
    const pagosPorMetodo: Record<string, { total: number; detalles: any[] }> = {}
    const pagosCuentaCorriente: any[] = []

    // Procesar pagos de detalles_ruta (pedidos simples con cliente_id)
    ruta.detalles_ruta?.forEach((detalle: any) => {
      // Solo procesar pedidos simples (con cliente_id)
      if (detalle.pedido?.cliente_id && detalle.pago_registrado && detalle.monto_cobrado_registrado > 0) {
        const metodo = detalle.metodo_pago_registrado || 'efectivo'

        // Separar cuenta corriente de otros métodos
        if (metodo === 'cuenta_corriente') {
          pagosCuentaCorriente.push({ ...detalle, cliente_id: detalle.pedido.cliente_id })
        } else {
          if (!pagosPorMetodo[metodo]) {
            pagosPorMetodo[metodo] = { total: 0, detalles: [] }
          }
          pagosPorMetodo[metodo].total += Number(detalle.monto_cobrado_registrado)
          pagosPorMetodo[metodo].detalles.push({ ...detalle, cliente_id: detalle.pedido.cliente_id })
        }
      }
    })

    // Procesar pagos de entregas individuales (pedidos agrupados)
    entregasIndividuales.forEach((entrega: any) => {
      const estadoPagoResuelto = ['pagado', 'cuenta_corriente', 'parcial'].includes(entrega.estado_pago)

      if (estadoPagoResuelto) {
        const metodo = entrega.metodo_pago || 'efectivo'
        const montoCobrado = Number(entrega.monto_cobrado) || 0

        // Separar cuenta corriente de otros métodos
        if (metodo === 'cuenta_corriente' || entrega.estado_pago === 'cuenta_corriente') {
          // Para cuenta corriente, el monto a registrar es el total (no el monto_cobrado que es 0)
          pagosCuentaCorriente.push({
            ...entrega,
            monto_cobrado_registrado: entrega.total,
            es_entrega_individual: true
          })
        } else if (montoCobrado > 0) {
          if (!pagosPorMetodo[metodo]) {
            pagosPorMetodo[metodo] = { total: 0, detalles: [] }
          }
          pagosPorMetodo[metodo].total += montoCobrado
          pagosPorMetodo[metodo].detalles.push({ ...entrega, es_entrega_individual: true })

          // Si es pago parcial, también agregar el resto a cuenta corriente
          if (entrega.estado_pago === 'parcial') {
            const restoCuentaCorriente = Number(entrega.total) - montoCobrado
            if (restoCuentaCorriente > 0) {
              pagosCuentaCorriente.push({
                ...entrega,
                monto_cobrado_registrado: restoCuentaCorriente,
                es_entrega_individual: true
              })
            }
          }
        }
      }
    })

    // Crear movimientos de caja agrupados por método de pago (excluyendo cuenta_corriente)
    const movimientosCreados: string[] = []

    for (const [metodo, datos] of Object.entries(pagosPorMetodo)) {
      const { data: movimiento, error: movError } = await supabase
        .from('tesoreria_movimientos')
        .insert({
          caja_id,
          tipo: 'ingreso',
          monto: datos.total,
          descripcion: `Validación ruta ${ruta.numero_ruta} - ${metodo}`,
          origen_tipo: 'ruta',
          origen_id: ruta_id,
          metodo_pago: metodo,
          user_id: user.id,
        })
        .select()
        .single()

      if (movError) throw movError
      movimientosCreados.push(movimiento.id)

      // Actualizar saldo de caja
      await supabase.rpc('fn_actualizar_saldo_caja', {
        p_caja_id: caja_id,
        p_monto: datos.total,
      })
    }

    // Procesar pagos en cuenta corriente (aumentar saldo de cuenta, NO crear movimiento de caja)
    for (const detalle of pagosCuentaCorriente) {
      // Para entregas individuales ya tenemos cliente_id, para detalles_ruta lo obtenemos del pedido
      let clienteId = detalle.cliente_id
      let numeroPedido = detalle.numero_pedido || ''

      if (!clienteId && detalle.pedido_id) {
        const { data: pedido } = await supabase
          .from('pedidos')
          .select('cliente_id, numero_pedido')
          .eq('id', detalle.pedido_id)
          .single()

        if (pedido) {
          clienteId = pedido.cliente_id
          numeroPedido = pedido.numero_pedido
        }
      }

      if (!clienteId) {
        devError('No se encontró cliente_id para detalle:', detalle)
        continue
      }

      // Asegurar que existe cuenta corriente (RPC retorna UUID directamente)
      const { data: cuentaIdResult, error: cuentaError } = await supabase.rpc('fn_asegurar_cuenta_corriente', {
        p_cliente_id: clienteId,
      })

      if (cuentaError || !cuentaIdResult) {
        devError('Error al asegurar cuenta corriente:', cuentaError)
        continue
      }

      const cuentaId = cuentaIdResult as string

      // Monto a agregar a cuenta corriente (es deuda, no pago)
      const monto = Number(detalle.monto_cobrado_registrado)

      // Obtener saldo actual y límite
      const { data: cuentaActual } = await supabase
        .from('cuentas_corrientes')
        .select('saldo, limite_credito')
        .eq('id', cuentaId)
        .single()

      if (cuentaActual) {
        // AUMENTAR saldo porque es deuda (no pago)
        const nuevoSaldo = (cuentaActual.saldo || 0) + monto
        const { error: updateCuentaError } = await supabase
          .from('cuentas_corrientes')
          .update({
            saldo: nuevoSaldo,
            updated_at: getNowArgentina().toISOString(),
          })
          .eq('id', cuentaId)

        if (updateCuentaError) throw updateCuentaError

        // Crear movimiento en cuenta corriente (tipo cargo porque es deuda)
        const descripcion = detalle.es_entrega_individual
          ? `Cargo a cuenta corriente ruta ${ruta.numero_ruta} - ${detalle.cliente?.nombre || 'Cliente'}`
          : `Cargo a cuenta corriente ruta ${ruta.numero_ruta} - Pedido ${numeroPedido}`

        const { error: movCuentaError } = await supabase
          .from('cuentas_movimientos')
          .insert({
            cuenta_corriente_id: cuentaId,
            tipo: 'cargo', // Es cargo, no pago
            monto: monto,
            descripcion,
            origen_tipo: detalle.es_entrega_individual ? 'entrega' : 'pedido',
            origen_id: detalle.es_entrega_individual ? detalle.id : detalle.pedido_id,
          })

        if (movCuentaError) throw movCuentaError

        // Verificar si cliente debe ser bloqueado por exceder límite
        const debeBloquear = nuevoSaldo > (cuentaActual.limite_credito || 0)
        const { error: updateClienteError } = await supabase
          .from('clientes')
          .update({
            bloqueado_por_deuda: debeBloquear,
            updated_at: getNowArgentina().toISOString(),
          })
          .eq('id', clienteId)

        if (updateClienteError) throw updateClienteError
      }
    }

    // Actualizar ruta como validada
    const { error: updateRutaError } = await supabase
      .from('rutas_reparto')
      .update({
        validada_por_tesorero: true,
        tesorero_validador_id: user.id,
        fecha_validacion: getNowArgentina().toISOString(),
        recaudacion_total_validada: monto_fisico_recibido || ruta.recaudacion_total_registrada,
        observaciones_validacion: observaciones,
        updated_at: getNowArgentina().toISOString(),
      })
      .eq('id', ruta_id)

    if (updateRutaError) throw updateRutaError

    // Marcar pagos como validados en detalles_ruta
    const { error: updateDetallesError } = await supabase
      .from('detalles_ruta')
      .update({ pago_validado: true })
      .eq('ruta_id', ruta_id)
      .eq('pago_registrado', true)

    if (updateDetallesError) throw updateDetallesError

    // Actualizar estado de pago en pedidos
    const pedidosIds = ruta.detalles_ruta
      ?.filter((d: any) => d.pago_registrado && d.monto_cobrado_registrado > 0)
      .map((d: any) => d.pedido_id) || []

    if (pedidosIds.length > 0) {
      const { error: updatePedidosError } = await supabase
        .from('pedidos')
        .update({ pago_estado: 'pagado' })
        .in('id', pedidosIds)

      if (updatePedidosError) throw updatePedidosError
    }

    revalidatePath('/(admin)/(dominios)/tesoreria/validar-rutas')
    revalidatePath('/(admin)/(dominios)/reparto/rutas')
    revalidatePath('/(admin)/(dominios)/tesoreria')

    const totalMovimientosCaja = movimientosCreados.length
    const totalPagosCuentaCorriente = pagosCuentaCorriente.length
    let mensaje = 'Ruta validada exitosamente.'

    if (totalMovimientosCaja > 0) {
      mensaje += ` Se crearon ${totalMovimientosCaja} movimiento(s) de caja agrupado(s) por método de pago.`
    }

    if (totalPagosCuentaCorriente > 0) {
      mensaje += ` Se procesaron ${totalPagosCuentaCorriente} pago(s) en cuenta corriente (no afectan caja).`
    }

    return {
      success: true,
      message: mensaje,
    }
  } catch (error: any) {
    devError('Error en validarRutaAction:', error)
    return { success: false, error: error.message || 'Error al validar ruta' }
  }
}

// Obtener rutas completadas pendientes de validación
export async function obtenerRutasPendientesValidacionAction() {
  try {
    const supabase = await createClient()

    const { data: rutas, error } = await supabase
      .from('rutas_reparto')
      .select(`
        *,
        repartidor:usuarios!rutas_reparto_repartidor_id_fkey(nombre, apellido),
        vehiculo:vehiculos(patente, marca, modelo),
        zona:zonas(nombre),
        detalles_ruta (
          id,
          orden_entrega,
          estado_entrega,
          pago_registrado,
          metodo_pago_registrado,
          monto_cobrado_registrado,
          pedido_id,
          pedido:pedidos(id, numero_pedido, total, cliente_id, cliente:clientes(nombre))
        )
      `)
      .eq('estado', 'completada')
      .eq('validada_por_tesorero', false)
      .order('fecha_ruta', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error

    // Para cada ruta, obtener entregas individuales de pedidos agrupados
    const rutasConEntregas = await Promise.all((rutas || []).map(async (ruta: any) => {
      // Identificar pedidos agrupados (sin cliente_id)
      const pedidosAgrupados = ruta.detalles_ruta?.filter((d: any) => !d.pedido?.cliente_id).map((d: any) => d.pedido_id) || []

      if (pedidosAgrupados.length > 0) {
        const { data: entregas } = await supabase
          .from('entregas')
          .select(`
            id,
            pedido_id,
            cliente_id,
            estado_pago,
            monto_cobrado,
            metodo_pago,
            total,
            orden_entrega,
            cliente:clientes(id, nombre)
          `)
          .in('pedido_id', pedidosAgrupados)

        // Calcular recaudación real desde entregas
        let recaudacionReal = 0
        let totalCuentaCorriente = 0
        const pagosPorMetodo: Record<string, number> = {}

        // Procesar entregas individuales
        entregas?.forEach((e: any) => {
          const monto = Number(e.monto_cobrado) || 0
          const total = Number(e.total) || 0

          if (e.estado_pago === 'cuenta_corriente') {
            // Todo el monto va a cuenta corriente
            totalCuentaCorriente += total
            pagosPorMetodo['cuenta_corriente'] = (pagosPorMetodo['cuenta_corriente'] || 0) + total
          } else if (e.estado_pago === 'parcial') {
            // Parte va a caja, parte a cuenta corriente
            if (monto > 0) {
              recaudacionReal += monto
              const metodo = e.metodo_pago || 'efectivo'
              pagosPorMetodo[metodo] = (pagosPorMetodo[metodo] || 0) + monto
            }
            const restoCuentaCorriente = total - monto
            if (restoCuentaCorriente > 0) {
              totalCuentaCorriente += restoCuentaCorriente
              pagosPorMetodo['cuenta_corriente'] = (pagosPorMetodo['cuenta_corriente'] || 0) + restoCuentaCorriente
            }
          } else if (e.estado_pago === 'pagado' && monto > 0) {
            recaudacionReal += monto
            const metodo = e.metodo_pago || 'efectivo'
            pagosPorMetodo[metodo] = (pagosPorMetodo[metodo] || 0) + monto
          }
        })

        // También procesar detalles_ruta para pedidos simples
        ruta.detalles_ruta?.forEach((d: any) => {
          if (d.pedido?.cliente_id && d.pago_registrado && d.monto_cobrado_registrado > 0) {
            recaudacionReal += Number(d.monto_cobrado_registrado)
            const metodo = d.metodo_pago_registrado || 'efectivo'
            pagosPorMetodo[metodo] = (pagosPorMetodo[metodo] || 0) + Number(d.monto_cobrado_registrado)
          }
        })

        return {
          ...ruta,
          entregas_individuales: entregas || [],
          recaudacion_calculada: recaudacionReal,
          total_cuenta_corriente: totalCuentaCorriente,
          pagos_por_metodo: pagosPorMetodo
        }
      }

      return ruta
    }))

    return {
      success: true,
      data: rutasConEntregas,
    }
  } catch (error: any) {
    devError('Error en obtenerRutasPendientesValidacion:', error)
    return { success: false, error: error.message || 'Error al obtener rutas pendientes' }
  }
}

// ==================== RETIROS DE SUCURSALES ====================

// Registrar retiro de sucursal (entrega de efectivo a chofer)
export async function registrarRetiroSucursalAction(formData: FormData) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Parsear datos
    const monto = parseFloat(formData.get('monto') as string)
    const sucursal_id = formData.get('sucursal_id') as string
    const ruta_id = formData.get('ruta_id') as string | null
    const vehiculo_id = formData.get('vehiculo_id') as string | null
    const chofer_nombre = formData.get('chofer_nombre') as string
    const descripcion = formData.get('descripcion') as string || null

    if (!monto || monto <= 0) {
      return { success: false, error: 'Monto inválido' }
    }
    if (!sucursal_id) {
      return { success: false, error: 'Sucursal requerida' }
    }
    if (!chofer_nombre) {
      return { success: false, error: 'Nombre del chofer requerido' }
    }

    // Obtener caja de la sucursal
    const { data: cajaSucursal, error: cajaError } = await supabase
      .from('tesoreria_cajas')
      .select('id, saldo_actual, nombre')
      .eq('sucursal_id', sucursal_id)
      .single()

    if (cajaError || !cajaSucursal) {
      return { success: false, error: 'No se encontró caja para esta sucursal' }
    }

    // Verificar saldo suficiente
    if (cajaSucursal.saldo_actual < monto) {
      return { success: false, error: `Saldo insuficiente en caja. Disponible: $${cajaSucursal.saldo_actual.toLocaleString()}` }
    }

    // Crear movimiento de egreso en la caja de la sucursal
    const { data: movimientoEgreso, error: movError } = await supabase
      .from('tesoreria_movimientos')
      .insert({
        caja_id: cajaSucursal.id,
        tipo: 'egreso',
        monto: monto,
        descripcion: `Retiro para Casa Central - Chofer: ${chofer_nombre}`,
        origen_tipo: 'retiro_sucursal',
        metodo_pago: 'efectivo',
        user_id: user.id,
      })
      .select()
      .single()

    if (movError) throw movError

    // Actualizar saldo de caja
    const { error: updateCajaError } = await supabase
      .from('tesoreria_cajas')
      .update({
        saldo_actual: cajaSucursal.saldo_actual - monto,
        updated_at: getNowArgentina().toISOString(),
      })
      .eq('id', cajaSucursal.id)

    if (updateCajaError) throw updateCajaError

    // Crear registro de retiro
    const { data: retiro, error: retiroError } = await supabase
      .from('rutas_retiros')
      .insert({
        ruta_id: ruta_id || null,
        sucursal_id,
        vehiculo_id: vehiculo_id || null,
        monto,
        chofer_nombre,
        descripcion,
        estado: 'pendiente',
        movimiento_egreso_id: movimientoEgreso.id,
        created_by: user.id,
      })
      .select()
      .single()

    if (retiroError) throw retiroError

    revalidatePath('/(admin)/(dominios)/tesoreria/sucursales')
    revalidatePath('/(admin)/(dominios)/tesoreria/validar-rutas')
    revalidatePath('/sucursal/dashboard')

    return {
      success: true,
      data: retiro,
      message: `Retiro de $${monto.toLocaleString()} registrado. El dinero será acreditado en Casa Central al validar la ruta.`,
    }
  } catch (error: any) {
    devError('Error en registrarRetiroSucursalAction:', error)
    return { success: false, error: error.message || 'Error al registrar retiro' }
  }
}

// Obtener retiros pendientes por ruta
export async function obtenerRetirosPendientesRutaAction(rutaId: string) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('rutas_retiros')
      .select(`
        *,
        sucursal:sucursales(id, nombre),
        vehiculo:vehiculos(id, patente)
      `)
      .eq('ruta_id', rutaId)
      .eq('estado', 'pendiente')

    if (error) throw error

    return { success: true, data: data || [] }
  } catch (error: any) {
    devError('Error en obtenerRetirosPendientesRutaAction:', error)
    return { success: false, error: error.message || 'Error al obtener retiros' }
  }
}

// Obtener todos los retiros pendientes (para validación)
export async function obtenerTodosRetirosPendientesAction() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('rutas_retiros')
      .select(`
        *,
        sucursal:sucursales(id, nombre),
        vehiculo:vehiculos(id, patente, marca, modelo),
        ruta:rutas_reparto(id, numero_ruta, estado)
      `)
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false })

    if (error) throw error

    return { success: true, data: data || [] }
  } catch (error: any) {
    devError('Error en obtenerTodosRetirosPendientesAction:', error)
    return { success: false, error: error.message || 'Error al obtener retiros pendientes' }
  }
}

// Validar retiro (acreditar en caja central)
export async function validarRetiroAction(retiroId: string, cajaDestinoId: string) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Obtener retiro
    const { data: retiro, error: retiroError } = await supabase
      .from('rutas_retiros')
      .select('*, sucursal:sucursales(nombre)')
      .eq('id', retiroId)
      .single()

    if (retiroError || !retiro) {
      return { success: false, error: 'Retiro no encontrado' }
    }

    if (retiro.estado === 'validado') {
      return { success: false, error: 'Este retiro ya fue validado' }
    }

    // Crear movimiento de ingreso en caja destino (Casa Central)
    const { data: movimientoIngreso, error: movError } = await supabase
      .from('tesoreria_movimientos')
      .insert({
        caja_id: cajaDestinoId,
        tipo: 'ingreso',
        monto: retiro.monto,
        descripcion: `Retiro recibido de ${retiro.sucursal?.nombre || 'Sucursal'} - Chofer: ${retiro.chofer_nombre}`,
        origen_tipo: 'retiro_sucursal_validado',
        origen_id: retiroId,
        metodo_pago: 'efectivo',
        user_id: user.id,
      })
      .select()
      .single()

    if (movError) throw movError

    // Actualizar saldo de caja destino
    await supabase.rpc('fn_actualizar_saldo_caja', {
      p_caja_id: cajaDestinoId,
      p_monto: retiro.monto,
    })

    // Marcar retiro como validado
    const { error: updateError } = await supabase
      .from('rutas_retiros')
      .update({
        estado: 'validado',
        movimiento_ingreso_id: movimientoIngreso.id,
        validado_por: user.id,
        validado_at: getNowArgentina().toISOString(),
      })
      .eq('id', retiroId)

    if (updateError) throw updateError

    revalidatePath('/(admin)/(dominios)/tesoreria/validar-rutas')
    revalidatePath('/(admin)/(dominios)/tesoreria')

    return {
      success: true,
      message: `Retiro de $${retiro.monto.toLocaleString()} validado y acreditado en caja.`,
    }
  } catch (error: any) {
    devError('Error en validarRetiroAction:', error)
    return { success: false, error: error.message || 'Error al validar retiro' }
  }
}

// ==================== RECORDATORIOS DE COBRANZA ====================

// Listar recordatorios de un cliente
export async function listarRecordatoriosClienteAction(clienteId: string) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('clientes_recordatorios')
      .select(`
        *,
        creador:usuarios!clientes_recordatorios_created_by_fkey(nombre, apellido)
      `)
      .eq('cliente_id', clienteId)
      .order('fecha', { ascending: false })

    if (error) throw error

    return { success: true, data: data || [] }
  } catch (error: any) {
    devError('Error en listarRecordatoriosClienteAction:', error)
    return { success: false, error: error.message || 'Error al listar recordatorios' }
  }
}

// Crear recordatorio de cobranza
export async function crearRecordatorioAction(formData: FormData) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const cliente_id = formData.get('cliente_id') as string
    const nota = formData.get('nota') as string
    const tipo = formData.get('tipo') as string || 'llamada'
    const fecha_proximo_contacto = formData.get('fecha_proximo_contacto') as string || null
    const resultado = formData.get('resultado') as string || null

    if (!cliente_id) {
      return { success: false, error: 'Cliente requerido' }
    }
    if (!nota) {
      return { success: false, error: 'Nota requerida' }
    }

    const { data: recordatorio, error } = await supabase
      .from('clientes_recordatorios')
      .insert({
        cliente_id,
        nota,
        tipo,
        fecha: getTodayArgentina(),
        fecha_proximo_contacto: fecha_proximo_contacto || null,
        resultado,
        estado: 'pendiente',
        created_by: user.id,
      })
      .select()
      .single()

    if (error) throw error

    revalidatePath('/(admin)/(dominios)/tesoreria/cuentas-corrientes')

    return {
      success: true,
      data: recordatorio,
      message: 'Recordatorio creado exitosamente',
    }
  } catch (error: any) {
    devError('Error en crearRecordatorioAction:', error)
    return { success: false, error: error.message || 'Error al crear recordatorio' }
  }
}

// Actualizar estado de recordatorio
export async function actualizarRecordatorioAction(id: string, estado: string, resultado?: string) {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('clientes_recordatorios')
      .update({
        estado,
        resultado: resultado || null,
        updated_at: getNowArgentina().toISOString(),
      })
      .eq('id', id)

    if (error) throw error

    revalidatePath('/(admin)/(dominios)/tesoreria/cuentas-corrientes')

    return { success: true, message: 'Recordatorio actualizado' }
  } catch (error: any) {
    devError('Error en actualizarRecordatorioAction:', error)
    return { success: false, error: error.message || 'Error al actualizar recordatorio' }
  }
}

// Obtener clientes con alertas de moratoria
export async function obtenerClientesMorososAction() {
  try {
    const supabase = await createClient()

    // Obtener cuentas corrientes con saldo > 0
    const { data: cuentas, error } = await supabase
      .from('cuentas_corrientes')
      .select(`
        id,
        saldo,
        limite_credito,
        updated_at,
        cliente:clientes(id, nombre, telefono, email, bloqueado_por_deuda)
      `)
      .gt('saldo', 0)
      .order('saldo', { ascending: false })

    if (error) throw error

    // Clasificar por nivel de alerta
    const ahora = new Date()
    const clientesClasificados = (cuentas || []).map((cuenta: any) => {
      const ultimaActualizacion = new Date(cuenta.updated_at)
      const diasSinMovimiento = Math.floor((ahora.getTime() - ultimaActualizacion.getTime()) / (1000 * 60 * 60 * 24))
      const excedeCredito = cuenta.saldo > (cuenta.limite_credito || 0)

      let nivel: 'verde' | 'amarillo' | 'rojo' = 'verde'
      if (excedeCredito || diasSinMovimiento > 30) {
        nivel = 'rojo'
      } else if (diasSinMovimiento > 15) {
        nivel = 'amarillo'
      }

      return {
        ...cuenta,
        dias_sin_movimiento: diasSinMovimiento,
        excede_credito: excedeCredito,
        nivel_alerta: nivel,
      }
    })

    return {
      success: true,
      data: clientesClasificados,
      resumen: {
        total: clientesClasificados.length,
        rojos: clientesClasificados.filter((c: any) => c.nivel_alerta === 'rojo').length,
        amarillos: clientesClasificados.filter((c: any) => c.nivel_alerta === 'amarillo').length,
        verdes: clientesClasificados.filter((c: any) => c.nivel_alerta === 'verde').length,
      },
    }
  } catch (error: any) {
    devError('Error en obtenerClientesMorososAction:', error)
    return { success: false, error: error.message || 'Error al obtener clientes morosos' }
  }
}

// ==================== RETIROS EN TRÁNSITO ====================

/**
 * Obtener retiros de sucursales en tránsito (pendientes de validación)
 * Incluye alertas para retiros que llevan más de 24 horas sin validar
 */
export async function obtenerRetirosEnTransitoAction() {
  try {
    const supabase = await createClient()

    // Buscar rutas que tengan retiros pendientes de validación
    // Una ruta tiene retiros en tránsito cuando: validado_ruta = true pero validado_caja = false
    const { data: retiros, error } = await supabase
      .from('rutas_retiros')
      .select(`
        id,
        monto,
        metodo_pago,
        descripcion,
        validado_ruta,
        validado_caja,
        created_at,
        ruta:rutas_reparto(
          id,
          fecha,
          sucursal:sucursales(nombre),
          chofer:empleados(nombre, apellido)
        )
      `)
      .eq('validado_ruta', true)
      .eq('validado_caja', false)
      .order('created_at', { ascending: true })

    if (error) throw error

    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Procesar y agregar alertas
    const retirosConAlerta = (retiros || []).map((retiro: any) => {
      const createdAt = new Date(retiro.created_at)
      const esAntiguo = createdAt < oneDayAgo
      const horasDesdeCreacion = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60))

      return {
        ...retiro,
        es_antiguo: esAntiguo,
        horas_pendiente: horasDesdeCreacion,
        alerta: esAntiguo ? 'Más de 24 horas sin validar' : null
      }
    })

    // Calcular totales por método de pago
    const totalesPorMetodo: Record<string, number> = {}
    let montoTotal = 0

    retirosConAlerta.forEach((retiro: any) => {
      const metodo = retiro.metodo_pago || 'efectivo'
      totalesPorMetodo[metodo] = (totalesPorMetodo[metodo] || 0) + Number(retiro.monto)
      montoTotal += Number(retiro.monto)
    })

    return {
      success: true,
      data: retirosConAlerta,
      resumen: {
        cantidad: retirosConAlerta.length,
        monto_total: montoTotal,
        por_metodo: totalesPorMetodo,
        con_alerta: retirosConAlerta.filter((r: any) => r.es_antiguo).length
      }
    }
  } catch (error: any) {
    devError('Error en obtenerRetirosEnTransitoAction:', error)
    return { success: false, error: error.message || 'Error al obtener retiros en tránsito' }
  }
}
