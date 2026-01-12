import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

/**
 * Resultado de una acreditación de saldo
 */
export interface ResultadoAcreditacion {
    success: boolean
    movimientoId?: string
    nuevoSaldo?: number
    error?: string
}

/**
 * Acredita saldo a la cuenta corriente del cliente.
 * - Crea movimiento en cuentas_movimientos
 * - Actualiza saldo de cuenta_corriente
 * - Registra en caja si corresponde
 * 
 * @param clienteId - ID del cliente
 * @param monto - Monto a acreditar (positivo)
 * @param referencia - Referencia del comprobante
 * @param sesionConciliacionId - ID de la sesión de conciliación
 * @param notas - Notas adicionales
 */
export async function acreditarSaldoCliente(
    clienteId: string,
    monto: number,
    referencia: string,
    sesionConciliacionId: string,
    notas?: string
): Promise<ResultadoAcreditacion> {
    console.log(`[acreditarSaldoCliente] Iniciando acreditación atómica para cliente ${clienteId}, monto ${monto}, referencia ${referencia}`)

    if (monto <= 0) {
        console.error(`[acreditarSaldoCliente] Error: Monto debe ser positivo para cliente ${clienteId}. Monto recibido: ${monto}`)
        return { success: false, error: 'El monto debe ser positivo' }
    }

    const supabase = await createClient()

    try {
        // Llamada a la función RPC atómica que maneja CC y Caja
        const { data, error } = await supabase.rpc('fn_acreditar_saldo_cliente_v2', {
            p_cliente_id: clienteId,
            p_monto: monto,
            p_referencia: referencia,
            p_sesion_id: sesionConciliacionId,
            p_notas: notas
        })

        if (error) {
            console.error(`[acreditarSaldoCliente] Error RPC:`, error)
            return { success: false, error: error.message }
        }

        const result = data as { success: boolean, movimiento_id?: string, nuevo_saldo?: number, error?: string }

        if (!result.success) {
            console.error(`[acreditarSaldoCliente] Error en función SQL:`, result.error)
            return { success: false, error: result.error }
        }

        console.log(`[acreditarSaldoCliente] ✅ Acreditación exitosa. Movimiento: ${result.movimiento_id}, Nuevo Saldo: ${result.nuevo_saldo}`)

        return {
            success: true,
            movimientoId: result.movimiento_id,
            nuevoSaldo: result.nuevo_saldo
        }

    } catch (error) {
        console.error('Error en acreditación:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido'
        }
    }
}

/**
 * Registra un ingreso en la caja central por pago conciliado.
 */
async function registrarIngresoCaja(
    monto: number,
    clienteId: string,
    referencia: string,
    sesionConciliacionId: string
): Promise<void> {
    const supabase = await createClient()
    const fechaHoy = format(new Date(), 'yyyy-MM-dd HH:mm:ss')

    try {
        // Obtener caja central activa (o la primera caja activa)
        const { data: caja } = await supabase
            .from('cajas')
            .select('id, saldo')
            .eq('activa', true)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle()

        if (!caja) {
            console.warn('No hay caja activa para registrar el ingreso')
            return
        }

        // Registrar movimiento de caja
        await supabase
            .from('movimientos_caja')
            .insert({
                caja_id: caja.id,
                tipo: 'ingreso',
                monto: monto,
                metodo_pago: 'transferencia',
                descripcion: `Pago conciliado - Cliente ID: ${clienteId}`,
                referencia: referencia || `CONC-${sesionConciliacionId.slice(0, 8)}`,
                fecha: fechaHoy
            })

        // Actualizar saldo de caja
        await supabase
            .from('cajas')
            .update({
                saldo: caja.saldo + monto,
                updated_at: new Date().toISOString()
            })
            .eq('id', caja.id)

    } catch (error) {
        console.error('Error registrando ingreso en caja:', error)
        // No fallar la acreditación por esto
    }
}

/**
 * Acredita múltiples pagos en batch.
 * Optimizado para procesar varias acreditaciones de una sesión.
 */
export async function acreditarPagosBatch(
    pagos: Array<{
        clienteId: string
        monto: number
        referencia: string
        comprobanteId: string
    }>,
    sesionConciliacionId: string
): Promise<{
    exitosos: number
    fallidos: number
    montoTotal: number
    errores: string[]
}> {
    console.log('[acreditarPagosBatch] ========== INICIO BATCH ==========')
    console.log(`[acreditarPagosBatch] Procesando ${pagos.length} pagos para la sesión ${sesionConciliacionId}`)

    let exitosos = 0
    let fallidos = 0
    let montoTotal = 0
    const errores: string[] = []

    for (const [index, pago] of pagos.entries()) {
        console.log(`[acreditarPagosBatch] [${index + 1}/${pagos.length}] Procesando pago: Cliente=${pago.clienteId} Monto=$${pago.monto} Ref=${pago.referencia}`)

        const resultado = await acreditarSaldoCliente(
            pago.clienteId,
            pago.monto,
            pago.referencia,
            sesionConciliacionId,
            `Comprobante: ${pago.comprobanteId}`
        )

        if (resultado.success) {
            exitosos++
            montoTotal += pago.monto
            console.log(`[acreditarPagosBatch] [${index + 1}/${pagos.length}] ✅ Éxito. Nuevo saldo: ${resultado.nuevoSaldo}`)
        } else {
            fallidos++
            errores.push(`Cliente ${pago.clienteId}: ${resultado.error}`)
            console.error(`[acreditarPagosBatch] [${index + 1}/${pagos.length}] ❌ Error: ${resultado.error}`)
        }
    }

    console.log('[acreditarPagosBatch] ========== FIN BATCH ==========')
    console.log(`[acreditarPagosBatch] Resumen: Exitosos=${exitosos}, Fallidos=${fallidos}, Total=$${montoTotal}`)
    console.log(`[acreditarPagosBatch] Errores acumulados: ${errores.length}`)

    return { exitosos, fallidos, montoTotal, errores }
}
