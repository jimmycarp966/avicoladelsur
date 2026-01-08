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
    console.log(`[acreditarSaldoCliente] Iniciando acreditación para cliente ${clienteId}, monto ${monto}, referencia ${referencia}`)

    if (monto <= 0) {
        console.error(`[acreditarSaldoCliente] Error: Monto debe ser positivo para cliente ${clienteId}. Monto recibido: ${monto}`)
        return { success: false, error: 'El monto debe ser positivo' }
    }

    const supabase = await createClient()
    const fechaHoy = format(new Date(), 'yyyy-MM-dd', { locale: es })

    try {
        // 1. Obtener cuenta corriente del cliente
        console.log(`[acreditarSaldoCliente] Buscando cuenta corriente para cliente ${clienteId}`)
        const { data: cuentaCliente, error: errorCuenta } = await supabase
            .from('cuentas_corrientes')
            .select('id, saldo, limite_credito')
            .eq('cliente_id', clienteId)
            .maybeSingle()

        if (errorCuenta) {
            console.error(`[acreditarSaldoCliente] Error obteniendo cuenta corriente para cliente ${clienteId}:`, errorCuenta)
            return { success: false, error: 'Error al obtener cuenta corriente del cliente' }
        }

        // Si no tiene cuenta corriente, intentar crearla
        let cuentaId = cuentaCliente?.id
        let saldoActual = cuentaCliente?.saldo || 0
        console.log(`[acreditarSaldoCliente] Cuenta corriente encontrada: ${cuentaId || 'No existe, se creará'}, Saldo actual: ${saldoActual}`)


        if (!cuentaId) {
            console.log(`[acreditarSaldoCliente] Creando nueva cuenta corriente para cliente ${clienteId}`)
            // Crear cuenta corriente para el cliente
            const { data: nuevaCuenta, error: errorNueva } = await supabase
                .from('cuentas_corrientes')
                .insert({
                    cliente_id: clienteId,
                    saldo: 0,
                    limite_credito: 0
                })
                .select('id')
                .single()

            if (errorNueva) {
                console.error(`[acreditarSaldoCliente] Error creando cuenta corriente para cliente ${clienteId}:`, errorNueva)
                return { success: false, error: 'Error al crear cuenta corriente para el cliente' }
            }

            cuentaId = nuevaCuenta.id
            console.log(`[acreditarSaldoCliente] Nueva cuenta corriente creada con ID: ${cuentaId}`)
        }

        // 2. Registrar movimiento en cuentas_movimientos (abono = reduce deuda)
        const descripcionMov = `Pago conciliado - ${referencia || 'Sin referencia'}`
        console.log(`[acreditarSaldoCliente] Registrando movimiento de abono en cuenta ${cuentaId} por ${monto}`)

        const { data: movimiento, error: errorMov } = await supabase
            .from('cuentas_movimientos')
            .insert({
                cuenta_corriente_id: cuentaId,
                tipo: 'abono', // Abono = pago del cliente
                monto: monto,
                fecha: fechaHoy,
                descripcion: descripcionMov,
                referencia: `CONC-${sesionConciliacionId.slice(0, 8)}`,
                notas: notas || `Acreditado automáticamente por conciliación bancaria`
            })
            .select('id')
            .single()

        if (errorMov) {
            console.error(`[acreditarSaldoCliente] Error registrando movimiento para cuenta ${cuentaId}:`, errorMov)
            return { success: false, error: 'Error al registrar movimiento en cuenta corriente' }
        }
        console.log(`[acreditarSaldoCliente] Movimiento registrado con ID: ${movimiento.id}`)


        // 3. Actualizar saldo de la cuenta corriente (reducir deuda)
        const nuevoSaldo = saldoActual - monto // Saldo negativo = a favor del cliente
        console.log(`[acreditarSaldoCliente] Actualizando saldo de cuenta ${cuentaId}: ${saldoActual} -> ${nuevoSaldo}`)

        const { error: errorUpdate } = await supabase
            .from('cuentas_corrientes')
            .update({
                saldo: nuevoSaldo,
                updated_at: new Date().toISOString()
            })
            .eq('id', cuentaId)

        if (errorUpdate) {
            console.error(`[acreditarSaldoCliente] Error actualizando saldo para cuenta ${cuentaId}:`, errorUpdate)
            // No fallar completamente, el movimiento ya se registró
            // Considerar revertir el movimiento si esto es crítico
        } else {
            console.log(`[acreditarSaldoCliente] Saldo de cuenta ${cuentaId} actualizado a ${nuevoSaldo}`)
        }


        // 4. (Opcional) Registrar ingreso en caja central
        // Esto depende de si quieren que afecte la caja automáticamente
        await registrarIngresoCaja(monto, clienteId, referencia, sesionConciliacionId)

        return {
            success: true,
            movimientoId: movimiento.id,
            nuevoSaldo
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
