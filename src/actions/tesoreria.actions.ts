'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

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
      return { success: false, message: 'Usuario no autenticado' }
    }

    // Verificar permisos (admin o tesorero)
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'vendedor'].includes(usuario.rol)) {
      return { success: false, message: 'No tienes permisos para ver movimientos' }
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
    console.error('Error en obtenerMovimientosTiempoRealAction:', error)
    return { success: false, message: error.message || 'Error al obtener movimientos' }
  }
}

// Crear cierre de caja
export async function crearCierreCajaAction(formData: FormData) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, message: 'Usuario no autenticado' }
    }

    // Verificar permisos (admin o tesorero)
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'vendedor'].includes(usuario.rol)) {
      return { success: false, message: 'No tienes permisos para crear cierres de caja' }
    }

    // Parsear y validar datos
    const rawData = Object.fromEntries(formData)
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
      .single()

    if (cierreExistente) {
      if (cierreExistente.estado === 'abierto') {
        return { success: false, message: 'Ya existe un cierre abierto para esta caja y fecha' }
      }
      return { success: false, message: 'Ya existe un cierre cerrado para esta caja y fecha' }
    }

    // Obtener saldo inicial de la caja
    const { data: caja } = await supabase
      .from('tesoreria_cajas')
      .select('saldo_actual')
      .eq('id', data.caja_id)
      .single()

    if (!caja) {
      return { success: false, message: 'Caja no encontrada' }
    }

    // Crear cierre
    const { data: cierre, error } = await supabase
      .from('cierres_caja')
      .insert({
        caja_id: data.caja_id,
        fecha: data.fecha,
        saldo_inicial: caja.saldo_actual,
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
    console.error('Error en crearCierreCajaAction:', error)
    if (error instanceof z.ZodError) {
      return { success: false, message: 'Datos inválidos: ' + error.issues[0].message }
    }
    return { success: false, message: error.message || 'Error al crear cierre de caja' }
  }
}

// Cerrar cierre de caja
export async function cerrarCierreCajaAction(formData: FormData) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, message: 'Usuario no autenticado' }
    }

    // Verificar permisos (admin o tesorero)
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'vendedor'].includes(usuario.rol)) {
      return { success: false, message: 'No tienes permisos para cerrar cierres de caja' }
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
    })

    // Obtener cierre
    const { data: cierre, error: cierreError } = await supabase
      .from('cierres_caja')
      .select('*')
      .eq('id', data.cierre_id)
      .single()

    if (cierreError || !cierre) {
      return { success: false, message: 'Cierre no encontrado' }
    }

    if (cierre.estado === 'cerrado') {
      return { success: false, message: 'El cierre ya está cerrado' }
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
        estado: 'cerrado',
        updated_at: new Date().toISOString(),
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
    console.error('Error en cerrarCierreCajaAction:', error)
    if (error instanceof z.ZodError) {
      return { success: false, message: 'Datos inválidos: ' + error.issues[0].message }
    }
    return { success: false, message: error.message || 'Error al cerrar cierre de caja' }
  }
}

// Registrar retiro al tesoro
export async function registrarRetiroTesoroAction(formData: FormData) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, message: 'Usuario no autenticado' }
    }

    // Verificar permisos (admin o tesorero)
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'vendedor'].includes(usuario.rol)) {
      return { success: false, message: 'No tienes permisos para registrar retiros' }
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
    console.error('Error en registrarRetiroTesoroAction:', error)
    if (error instanceof z.ZodError) {
      return { success: false, message: 'Datos inválidos: ' + error.issues[0].message }
    }
    return { success: false, message: error.message || 'Error al registrar retiro' }
  }
}

// Registrar depósito bancario
export async function registrarDepositoBancarioAction(formData: FormData) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, message: 'Usuario no autenticado' }
    }

    // Verificar permisos (admin o tesorero)
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'vendedor'].includes(usuario.rol)) {
      return { success: false, message: 'No tienes permisos para registrar depósitos' }
    }

    // Parsear datos
    const monto = parseFloat(formData.get('monto') as string)
    const numero_transaccion = formData.get('numero_transaccion') as string

    if (!monto || !numero_transaccion) {
      return { success: false, message: 'Faltan datos requeridos' }
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
    console.error('Error en registrarDepositoBancarioAction:', error)
    return { success: false, message: error.message || 'Error al registrar depósito' }
  }
}

// Validar transferencia BNA (número sin 0 inicial)
export async function validarTransferenciaBNAAction(numeroTransaccion: string) {
  try {
    // Validar formato básico
    if (!numeroTransaccion || numeroTransaccion.length === 0) {
      return { success: false, message: 'Número de transacción requerido' }
    }

    // Validar que no empiece con 0
    if (numeroTransaccion.startsWith('0')) {
      return { success: false, message: 'El número de transacción BNA no debe empezar con 0' }
    }

    // Validar que sea numérico (sin 0 inicial)
    if (!/^\d+$/.test(numeroTransaccion)) {
      return { success: false, message: 'El número de transacción debe contener solo dígitos' }
    }

    // Aquí se podría agregar validación adicional con API del BNA si está disponible
    // Por ahora solo validamos formato

    return {
      success: true,
      message: 'Número de transacción válido',
    }
  } catch (error: any) {
    console.error('Error en validarTransferenciaBNAAction:', error)
    return { success: false, message: error.message || 'Error al validar transferencia' }
  }
}

// Listar cajas
export async function listarCajas() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('tesoreria_cajas')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return data || []
  } catch (error: any) {
    console.error('Error en listarCajas:', error)
    return []
  }
}

// Crear caja
export async function crearCaja(data: { nombre: string; saldo_inicial?: number; moneda?: string }) {
  try {
    const supabase = await createClient()
    const { data: caja, error } = await supabase
      .from('tesoreria_cajas')
      .insert({
        nombre: data.nombre,
        saldo_actual: data.saldo_inicial || 0,
        moneda: data.moneda || 'ARS',
      })
      .select()
      .single()

    if (error) throw error

    revalidatePath('/(admin)/(dominios)/tesoreria/cajas')
    return { success: true, data: caja }
  } catch (error: any) {
    console.error('Error en crearCaja:', error)
    return { success: false, error: error.message || 'Error al crear caja' }
  }
}

// Obtener movimientos de caja (alias para compatibilidad)
export async function obtenerMovimientosCaja(cajaId?: string, fecha?: string) {
  return obtenerMovimientosTiempoRealAction(cajaId, fecha)
}

// Registrar movimiento de caja
export async function registrarMovimientoCaja(data: {
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
      return { success: false, message: 'Usuario no autenticado' }
    }

    // Usar RPC para crear movimiento atómicamente
    const { data: result, error } = await supabase.rpc('fn_crear_movimiento_caja', {
      p_caja_id: data.caja_id,
      p_tipo: data.tipo,
      p_monto: data.monto,
      p_descripcion: data.descripcion || null,
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
    console.error('Error en registrarMovimientoCaja:', error)
    return { success: false, message: error.message || 'Error al registrar movimiento' }
  }
}

// Obtener resumen de tesorería
export async function obtenerResumenTesoreria() {
  try {
    const supabase = await createClient()

    // Obtener cajas con saldos
    const { data: cajas } = await supabase
      .from('tesoreria_cajas')
      .select('id, nombre, saldo_actual, moneda')

    // Obtener movimientos del día
    const hoy = new Date().toISOString().split('T')[0]
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
    console.error('Error en obtenerResumenTesoreria:', error)
    return { success: false, message: error.message || 'Error al obtener resumen' }
  }
}

// Registrar pago de pedido
export async function registrarPagoPedido(data: {
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
      return { success: false, message: 'Usuario no autenticado' }
    }

    // Validar número de transacción BNA si es transferencia
    if (data.metodo_pago === 'transferencia' && data.numero_transaccion) {
      const validacion = await validarTransferenciaBNAAction(data.numero_transaccion)
      if (!validacion.success) {
        return validacion
      }
    }

    // Registrar movimiento de caja
    const movimiento = await registrarMovimientoCaja({
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
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.pedido_id)

    if (updateError) throw updateError

    revalidatePath('/(admin)/(dominios)/ventas/pedidos')
    revalidatePath('/(admin)/(dominios)/tesoreria')

    return {
      success: true,
      message: 'Pago registrado exitosamente',
    }
  } catch (error: any) {
    console.error('Error en registrarPagoPedido:', error)
    return { success: false, message: error.message || 'Error al registrar pago' }
  }
}

// Validar ruta completada (crear movimientos de caja y marcar como validada)
export async function validarRutaAction(formData: FormData) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, message: 'Usuario no autenticado' }
    }

    // Verificar que sea tesorero o admin
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'vendedor'].includes(usuario.rol)) {
      return { success: false, message: 'Solo tesoreros y administradores pueden validar rutas' }
    }

    // Parsear datos
    const ruta_id = formData.get('ruta_id') as string
    const monto_fisico_recibido = parseFloat(formData.get('monto_fisico_recibido') as string)
    const observaciones = formData.get('observaciones') as string || null
    const caja_id = formData.get('caja_id') as string

    if (!ruta_id || !caja_id) {
      return { success: false, message: 'Faltan datos requeridos' }
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
          pedido:pedidos(id, numero_pedido, total)
        )
      `)
      .eq('id', ruta_id)
      .single()

    if (rutaError || !ruta) {
      return { success: false, message: 'Ruta no encontrada' }
    }

    if (ruta.estado !== 'completada') {
      return { success: false, message: 'La ruta debe estar completada para validar' }
    }

    if (ruta.validada_por_tesorero) {
      return { success: false, message: 'Esta ruta ya fue validada' }
    }

    // Agrupar pagos por método de pago
    const pagosPorMetodo: Record<string, { total: number; detalles: any[] }> = {}
    
    ruta.detalles_ruta?.forEach((detalle: any) => {
      if (detalle.pago_registrado && detalle.monto_cobrado_registrado > 0) {
        const metodo = detalle.metodo_pago_registrado || 'efectivo'
        if (!pagosPorMetodo[metodo]) {
          pagosPorMetodo[metodo] = { total: 0, detalles: [] }
        }
        pagosPorMetodo[metodo].total += Number(detalle.monto_cobrado_registrado)
        pagosPorMetodo[metodo].detalles.push(detalle)
      }
    })

    // Crear movimientos de caja agrupados por método de pago
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

    // Actualizar ruta como validada
    const { error: updateRutaError } = await supabase
      .from('rutas_reparto')
      .update({
        validada_por_tesorero: true,
        tesorero_validador_id: user.id,
        fecha_validacion: new Date().toISOString(),
        recaudacion_total_validada: monto_fisico_recibido || ruta.recaudacion_total_registrada,
        observaciones_validacion: observaciones,
        updated_at: new Date().toISOString(),
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

    return {
      success: true,
      message: 'Ruta validada exitosamente. Los movimientos de caja han sido creados.',
    }
  } catch (error: any) {
    console.error('Error en validarRutaAction:', error)
    return { success: false, message: error.message || 'Error al validar ruta' }
  }
}

// Obtener rutas completadas pendientes de validación
export async function obtenerRutasPendientesValidacion() {
  try {
    const supabase = await createClient()

    const { data: rutas, error } = await supabase
      .from('rutas_reparto')
      .select(`
        *,
        repartidor:usuarios(nombre, apellido),
        vehiculo:vehiculos(patente, marca, modelo),
        zona:zonas(nombre),
        detalles_ruta (
          id,
          orden_entrega,
          estado_entrega,
          pago_registrado,
          metodo_pago_registrado,
          monto_cobrado_registrado,
          pedido:pedidos(id, numero_pedido, total, cliente:clientes(nombre))
        )
      `)
      .eq('estado', 'completada')
      .eq('validada_por_tesorero', false)
      .order('fecha_ruta', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error

    return {
      success: true,
      data: rutas || [],
    }
  } catch (error: any) {
    console.error('Error en obtenerRutasPendientesValidacion:', error)
    return { success: false, message: error.message || 'Error al obtener rutas pendientes' }
  }
}
