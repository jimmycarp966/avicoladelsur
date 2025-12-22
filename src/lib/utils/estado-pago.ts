/**
 * Utilidades para gestión de estado de pago en entregas
 * Centraliza la lógica para evitar inconsistencias entre componentes
 */

/**
 * Representa el estado de pago de una entrega
 */
export type EstadoPagoType =
    | 'pagado'           // Monto completo cobrado
    | 'pendiente'        // Tiene método de pago pero monto = 0
    | 'pagara_despues'   // Sin monto ni método definido
    | 'parcial'          // Monto parcial con saldo pendiente
    | 'cuenta_corriente' // Todo cargado a cuenta corriente del cliente
    | 'rechazado'        // Pedido no entregado

/**
 * Interfaz mínima para verificar estado de pago
 */
export interface EntregaConEstadoPago {
    estado_entrega?: string | null
    pago_registrado?: boolean | null
    monto_cobrado_registrado?: number | null
    metodo_pago_registrado?: string | null
    notas_pago?: string | null
    estado_pago?: string | null // Usado en tabla entregas
}

/**
 * Verifica si una entrega completada tiene un estado de pago definido
 * 
 * Una entrega tiene estado definido si:
 * - Tiene pago_registrado = true con monto > 0 (ya pagó o pago parcial)
 * - Tiene metodo_pago_registrado (pendiente con método)
 * - Tiene notas_pago indicando que pagará después
 * - Fue rechazada (siempre tiene estado definido)
 * - Tiene estado_pago definido en tabla entregas
 */
export function tieneEstadoPagoDefinido(entrega: EntregaConEstadoPago): boolean {
    // Entregas rechazadas siempre tienen pago "definido"
    if (entrega.estado_entrega === 'rechazado') {
        return true
    }

    // Si tiene estado_pago de la tabla entregas
    if (entrega.estado_pago && entrega.estado_pago !== '') {
        return true
    }

    // Si tiene pago registrado con monto > 0
    if (entrega.pago_registrado && (entrega.monto_cobrado_registrado ?? 0) > 0) {
        return true
    }

    // Si tiene método de pago registrado (aunque monto sea 0)
    if (entrega.metodo_pago_registrado && entrega.metodo_pago_registrado !== '') {
        return true
    }

    // Si tiene notas de pago (indica que definió algo)
    if (entrega.notas_pago && entrega.notas_pago.trim() !== '') {
        return true
    }

    return false
}

/**
 * Verifica si una entrega está completamente pagada
 */
/**
 * Verifica si una entrega tiene su pago resuelto (pagado, cuenta corriente, o parcial)
 * Esto NO significa que se cobró dinero, sino que el estado fue definido
 */
export function estaPagado(entrega: EntregaConEstadoPago): boolean {
    const estadosResueltos = ['pagado', 'cuenta_corriente', 'parcial']
    return (
        estadosResueltos.includes(entrega.estado_pago || '') ||
        (entrega.pago_registrado === true && (entrega.monto_cobrado_registrado ?? 0) > 0)
    )
}

/**
 * Obtiene el estado de pago legible para UI
 */
export function getEstadoPagoLabel(entrega: EntregaConEstadoPago): string {
    if (entrega.estado_entrega === 'rechazado') {
        return 'Rechazado'
    }

    if (entrega.estado_pago === 'pagado' ||
        (entrega.pago_registrado && (entrega.monto_cobrado_registrado ?? 0) > 0)) {
        return 'Pagado'
    }

    if (entrega.estado_pago === 'cuenta_corriente') {
        return 'Cuenta corriente'
    }

    if (entrega.estado_pago === 'parcial') {
        return 'Pago parcial'
    }

    if (entrega.metodo_pago_registrado) {
        return 'Pendiente (método definido)'
    }

    if (entrega.notas_pago?.includes('pagará después')) {
        return 'Pagará después'
    }

    return 'Sin definir'
}

/**
 * Obtiene el color/variante de badge para el estado de pago
 */
export function getEstadoPagoBadgeVariant(entrega: EntregaConEstadoPago):
    'default' | 'secondary' | 'destructive' | 'outline' {

    if (entrega.estado_entrega === 'rechazado') {
        return 'destructive'
    }

    if (estaPagado(entrega)) {
        return 'default' // Verde/primario
    }

    if (tieneEstadoPagoDefinido(entrega)) {
        return 'secondary' // Gris
    }

    return 'outline' // Sin estado - requiere acción
}

/**
 * Filtra entregas completadas que no tienen estado de pago definido
 * Útil para validar si se puede finalizar una ruta
 */
export function getEntregasSinEstadoPago<T extends EntregaConEstadoPago>(
    entregas: T[]
): T[] {
    return entregas.filter(e => {
        // Solo verificar entregas completadas
        if (e.estado_entrega !== 'entregado' && e.estado_entrega !== 'rechazado') {
            return false
        }

        return !tieneEstadoPagoDefinido(e)
    })
}
