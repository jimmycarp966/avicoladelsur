/**
 * Next Client Selector
 * 
 * Algoritmo que calcula el próximo cliente óptimo a visitar basado en:
 * 1. Horario de apertura (prioridad máxima si está por cerrar)
 * 2. Distancia desde posición actual
 * 3. Urgencia del pedido
 */

/**
 * Fórmula Haversine para calcular distancia entre dos puntos geográficos
 */
function haversineDistance(
    lat1: number, lng1: number,
    lat2: number, lng2: number
): number {
    const R = 6371 // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c // Distancia en km
}

/**
 * Verifica si un cliente está abierto en un horario dado
 */
function verificarHorarioAbierto(horario: string | undefined, hora: Date): {
    abierto: boolean
    minutosParaCerrar: number | null
} {
    if (!horario || horario.trim() === '') {
        // Sin horario = siempre abierto
        return { abierto: true, minutosParaCerrar: null }
    }

    const horaActual = hora.getHours() * 60 + hora.getMinutes()

    // Soportar horarios partidos: "08:00-12:00,16:00-20:00"
    const rangos = horario.split(',').map(r => r.trim())

    for (const rango of rangos) {
        const [inicio, fin] = rango.split('-').map(t => {
            const [h, m] = t.split(':').map(Number)
            return h * 60 + (m || 0)
        })

        if (horaActual >= inicio && horaActual < fin) {
            return {
                abierto: true,
                minutosParaCerrar: fin - horaActual
            }
        }
    }

    return { abierto: false, minutosParaCerrar: null }
}

export interface ClientePendiente {
    id: string
    nombre: string
    lat: number
    lng: number
    horarioApertura?: string  // "08:00-18:00" o "08:00-12:00,16:00-20:00"
    esUrgente?: boolean
    pedidoId?: string
    peso?: number
}

export interface NextClientOptions {
    posicionActual: { lat: number; lng: number }
    clientesPendientes: ClientePendiente[]
    horaActual: Date
}

export interface ClienteCalificado extends ClientePendiente {
    distanciaKm: number
    score: number
    abierto: boolean
    minutosParaCerrar: number | null
    razon: string
}

/**
 * Calcula el próximo cliente óptimo a visitar
 * 
 * Algoritmo de priorización:
 * - Factor horario: 3.0 si cierra en <30min, 1.0 si abierto normal, 0.1 si cerrado
 * - Factor urgencia: 2.0 si es urgente, 1.0 si no
 * - Score final: (1/distancia) × factorHorario × factorUrgencia
 */
export function calcularProximosClientes(options: NextClientOptions): ClienteCalificado[] {
    const { posicionActual, clientesPendientes, horaActual } = options

    if (clientesPendientes.length === 0) {
        return []
    }

    const clientesCalificados: ClienteCalificado[] = clientesPendientes.map(cliente => {
        // Calcular distancia
        const distanciaKm = haversineDistance(
            posicionActual.lat, posicionActual.lng,
            cliente.lat, cliente.lng
        )

        // Verificar horario
        const { abierto, minutosParaCerrar } = verificarHorarioAbierto(
            cliente.horarioApertura,
            horaActual
        )

        // Calcular factor de horario
        let factorHorario = 1.0
        let razon = 'Disponible'

        if (!abierto) {
            factorHorario = 0.1
            razon = '⚫ Cerrado'
        } else if (minutosParaCerrar !== null && minutosParaCerrar < 30) {
            factorHorario = 3.0
            razon = `🔴 Cierra en ${minutosParaCerrar} min`
        } else if (minutosParaCerrar !== null) {
            razon = `🟢 Abierto (cierra en ${minutosParaCerrar} min)`
        } else {
            razon = '🟢 Disponible todo el día'
        }

        // Factor de urgencia
        const factorUrgencia = cliente.esUrgente ? 2.0 : 1.0
        if (cliente.esUrgente) {
            razon = `⚡ URGENTE - ${razon}`
        }

        // Score: inversamente proporcional a la distancia
        // Evitar división por cero
        const score = (1 / Math.max(distanciaKm, 0.1)) * factorHorario * factorUrgencia

        return {
            ...cliente,
            distanciaKm: Math.round(distanciaKm * 10) / 10, // Redondear a 1 decimal
            score,
            abierto,
            minutosParaCerrar,
            razon
        }
    })

    // Ordenar por score descendente (mayor score = mayor prioridad)
    clientesCalificados.sort((a, b) => b.score - a.score)

    console.log('[NextClientSelector] Clientes ordenados por prioridad:')
    clientesCalificados.forEach((c, i) => {
        console.log(`  ${i + 1}. ${c.nombre} - ${c.distanciaKm}km - Score: ${c.score.toFixed(2)} - ${c.razon}`)
    })

    return clientesCalificados
}

/**
 * Obtiene solo el próximo cliente sugerido (el de mayor score)
 */
export function obtenerProximoCliente(options: NextClientOptions): ClienteCalificado | null {
    const clientes = calcularProximosClientes(options)
    return clientes.length > 0 ? clientes[0] : null
}
