/**
 * Utilidades para el cálculo de ETA (Estimated Time of Arrival) y tiempo de descarga
 * para la optimización de rutas de reparto
 */

// Constantes de configuración
const TIEMPO_BASE_DESCARGA_MIN = 5  // 5 minutos base por cliente
const KG_POR_UNIDAD_TIEMPO = 20     // 20 kg por unidad de tiempo
const MINUTOS_POR_UNIDAD_KG = 2     // 2 minutos adicionales por cada 20 kg

/**
 * Calcula el tiempo de descarga basado en el peso
 * Fórmula: 5 min base + ceil(peso/20) * 2 min
 */
export function calcularTiempoDescarga(pesoKg: number): number {
    if (!pesoKg || pesoKg <= 0) {
        return TIEMPO_BASE_DESCARGA_MIN
    }
    const unidades = Math.ceil(pesoKg / KG_POR_UNIDAD_TIEMPO)
    return TIEMPO_BASE_DESCARGA_MIN + (unidades * MINUTOS_POR_UNIDAD_KG)
}

/**
 * Obtiene el horario del cliente según el día de la semana
 */
export function obtenerHorarioDelDia(
    cliente: {
        horario_lunes?: string | null
        horario_martes?: string | null
        horario_miercoles?: string | null
        horario_jueves?: string | null
        horario_viernes?: string | null
        horario_sabado?: string | null
        horario_domingo?: string | null
    },
    fecha: Date
): string | null {
    const diaSemana = fecha.getDay() // 0=domingo, 1=lunes, ..., 6=sábado

    switch (diaSemana) {
        case 0: return cliente.horario_domingo || null
        case 1: return cliente.horario_lunes || null
        case 2: return cliente.horario_martes || null
        case 3: return cliente.horario_miercoles || null
        case 4: return cliente.horario_jueves || null
        case 5: return cliente.horario_viernes || null
        case 6: return cliente.horario_sabado || null
        default: return null
    }
}

/**
 * Verifica si una hora está dentro del horario de apertura
 * El horario puede tener múltiples intervalos separados por coma
 * Ejemplo: "08:00-12:00,16:00-20:00"
 */
export function verificarEnHorario(horario: string | null | undefined, hora: Date): boolean {
    // Si no hay horario definido, siempre está disponible
    if (!horario || horario.trim() === '') {
        return true
    }

    const horaStr = hora.toTimeString().substring(0, 5) // "HH:mm"
    const horaMinutos = parseInt(horaStr.substring(0, 2)) * 60 + parseInt(horaStr.substring(3, 5))

    // Separar por comas para horarios partidos
    const intervalos = horario.split(',')

    for (const intervalo of intervalos) {
        const partes = intervalo.trim().split('-')
        if (partes.length !== 2) continue

        const inicioStr = partes[0].trim()
        const finStr = partes[1].trim()

        const inicioMinutos = parseInt(inicioStr.substring(0, 2)) * 60 + parseInt(inicioStr.substring(3, 5))
        const finMinutos = parseInt(finStr.substring(0, 2)) * 60 + parseInt(finStr.substring(3, 5))

        if (horaMinutos >= inicioMinutos && horaMinutos <= finMinutos) {
            return true
        }
    }

    return false
}

/**
 * Calcula la ETA (hora estimada de llegada) para cada cliente en la ruta
 */
export interface PuntoConETA {
    cliente_id: string
    cliente_nombre: string
    lat: number
    lng: number
    orden: number
    detalle_ruta_id?: string
    pedido_id?: string
    // Campos de ETA
    eta: Date
    eta_str: string           // Formato "HH:mm"
    tiempo_descarga_min: number
    peso_entrega_kg: number
    en_horario: boolean
    horario_cliente: string | null
}

/**
 * Obtiene el nombre del día de la semana en español
 */
export function getNombreDia(fecha: Date): string {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
    return dias[fecha.getDay()]
}

/**
 * Calcula ETAs para todos los puntos de la ruta
 */
export function calcularETAs(
    puntos: Array<{
        cliente_id?: string
        cliente_nombre?: string
        lat: number
        lng: number
        orden: number
        detalle_ruta_id?: string
        pedido_id?: string
        peso_kg?: number
        horario_cliente?: string | null
        tiempo_viaje_min?: number // Tiempo de viaje desde el punto anterior
    }>,
    horaInicio: Date,
    fechaRuta: Date
): PuntoConETA[] {
    let tiempoAcumulado = 0 // minutos desde hora inicio

    return puntos.map((punto, index) => {
        // Tiempo de viaje desde el punto anterior
        const tiempoViaje = punto.tiempo_viaje_min || 0

        // Para el primer punto, solo considerar el tiempo de viaje desde el depósito
        if (index === 0) {
            tiempoAcumulado = tiempoViaje
        } else {
            // Para los demás puntos, sumar tiempo de viaje + tiempo de descarga del punto anterior
            tiempoAcumulado += tiempoViaje
        }

        // Calcular ETA
        const eta = new Date(horaInicio.getTime() + tiempoAcumulado * 60 * 1000)
        const eta_str = eta.toTimeString().substring(0, 5)

        // Calcular tiempo de descarga
        const peso_kg = punto.peso_kg || 0
        const tiempo_descarga_min = calcularTiempoDescarga(peso_kg)

        // Verificar si está en horario
        const horario_cliente = punto.horario_cliente || null
        const en_horario = verificarEnHorario(horario_cliente, eta)

        // Sumar tiempo de descarga para el siguiente punto
        tiempoAcumulado += tiempo_descarga_min

        return {
            cliente_id: punto.cliente_id || '',
            cliente_nombre: punto.cliente_nombre || '',
            lat: punto.lat,
            lng: punto.lng,
            orden: punto.orden,
            detalle_ruta_id: punto.detalle_ruta_id,
            pedido_id: punto.pedido_id,
            eta,
            eta_str,
            tiempo_descarga_min,
            peso_entrega_kg: peso_kg,
            en_horario,
            horario_cliente,
        }
    })
}

/**
 * Formatea la hora para mostrar
 */
export function formatearHora(fecha: Date): string {
    return fecha.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    })
}
