/**
 * Constantes y funciones para recargos por método de pago
 * Aplicable a todo el sistema: sucursales, reparto, tesorería
 */

// Tipos de método de pago disponibles en el sistema
export type MetodoPago =
    | 'efectivo'
    | 'transferencia'
    | 'tarjeta_debito'
    | 'tarjeta_credito'
    | 'mercado_pago'
    | 'cuenta_corriente'
    | 'qr'

// Recargos por método de pago (en porcentaje decimal)
export const RECARGOS_METODO_PAGO: Record<MetodoPago, number> = {
    efectivo: 0,
    transferencia: 0.05, // 5%
    tarjeta_debito: 0.15, // 15%
    tarjeta_credito: 0.20, // 20%
    mercado_pago: 0,
    cuenta_corriente: 0,
    qr: 0,
}

// Nombres legibles para UI
export const METODO_PAGO_LABELS: Record<MetodoPago, string> = {
    efectivo: 'Efectivo',
    transferencia: 'Transferencia (+5%)',
    tarjeta_debito: 'Tarjeta Débito (+15%)',
    tarjeta_credito: 'Tarjeta Crédito (+20%)',
    mercado_pago: 'Mercado Pago',
    cuenta_corriente: 'Cuenta Corriente',
    qr: 'QR',
}

// Nombres cortos para tablas y badges
export const METODO_PAGO_SHORT_LABELS: Record<MetodoPago, string> = {
    efectivo: 'Efectivo',
    transferencia: 'Transf.',
    tarjeta_debito: 'Débito',
    tarjeta_credito: 'Crédito',
    mercado_pago: 'MP',
    cuenta_corriente: 'CC',
    qr: 'QR',
}

/**
 * Calcula el recargo para un monto dado según el método de pago
 * @param monto - Monto base sin recargo
 * @param metodoPago - Método de pago seleccionado
 * @returns El monto del recargo (no el total)
 */
export function calcularRecargo(monto: number, metodoPago: MetodoPago): number {
    const porcentajeRecargo = RECARGOS_METODO_PAGO[metodoPago] || 0
    return Math.round(monto * porcentajeRecargo * 100) / 100 // Redondeo a 2 decimales
}

/**
 * Calcula el monto total incluyendo el recargo
 * @param monto - Monto base sin recargo
 * @param metodoPago - Método de pago seleccionado
 * @returns Monto + recargo
 */
export function calcularMontoConRecargo(monto: number, metodoPago: MetodoPago): number {
    return monto + calcularRecargo(monto, metodoPago)
}

/**
 * Obtiene el porcentaje de recargo para un método de pago
 * @param metodoPago - Método de pago
 * @returns Porcentaje (ej: 5 para 5%, 15 para 15%)
 */
export function obtenerPorcentajeRecargo(metodoPago: MetodoPago): number {
    return (RECARGOS_METODO_PAGO[metodoPago] || 0) * 100
}

/**
 * Verifica si un método de pago tiene recargo
 */
export function tieneRecargo(metodoPago: MetodoPago): boolean {
    return RECARGOS_METODO_PAGO[metodoPago] > 0
}

/**
 * Calcula el total con recargos para múltiples pagos
 * @param pagos - Array de pagos con método y monto base
 * @returns Total incluyendo todos los recargos
 */
export function calcularTotalConRecargos(
    pagos: Array<{ metodoPago: MetodoPago; monto: number }>
): { subtotal: number; totalRecargos: number; total: number } {
    let subtotal = 0
    let totalRecargos = 0

    for (const pago of pagos) {
        subtotal += pago.monto
        totalRecargos += calcularRecargo(pago.monto, pago.metodoPago)
    }

    return {
        subtotal,
        totalRecargos,
        total: subtotal + totalRecargos,
    }
}

// Mapeo de métodos antiguos ('tarjeta') a nuevos para compatibilidad
export function normalizarMetodoPago(metodo: string): MetodoPago {
    if (metodo === 'tarjeta') {
        return 'tarjeta_debito' // Default para datos históricos
    }
    return metodo as MetodoPago
}
