import {
    MovimientoBancario,
    DatosComprobante,
    ResultadoValidacion,
    EstadoValidacion,
    TipoMatch
} from '@/types/conciliacion'
import { calculateStringSimilarity } from './utils'
import { differenceInDays, parseISO, format } from 'date-fns'
import { TOLERANCIA_MONTO_PORCENTAJE } from './parsers'

// ===========================================
// CONFIGURACIÓN DE REGLAS
// ===========================================

const REGLAS_PUNTAJE = {
    MONTO_EXACTO: 50,           // Monto idéntico (diferencia < $1)
    MONTO_APROXIMADO_2: 40,     // Diferencia <= 2%
    MONTO_APROXIMADO_5: 30,     // Diferencia <= 5%
    MONTO_APROXIMADO_10: 15,    // Diferencia <= 10%
    DNI_EXACTO: 35,             // DNI/CUIT coincide exactamente
    FECHA_MISMO_DIA: 15,        // Misma fecha
    FECHA_CERCANA_3: 8,         // ±3 días
    FECHA_CERCANA_7: 3,         // ±7 días
    REFERENCIA_SIMILAR_80: 15,  // Referencia muy similar
    REFERENCIA_SIMILAR_60: 8,   // Referencia similar
}

export const UMBRAL_VALIDACION = 70 // Score mínimo para auto-validar

// ===========================================
// MOTOR DE VALIDACIÓN
// ===========================================

/**
 * Valida un comprobante contra los movimientos de la sábana bancaria.
 * Busca el mejor match y retorna el resultado de validación.
 */
export function validarComprobanteContraSabana(
    comprobante: DatosComprobante,
    movimientosSabana: MovimientoBancario[]
): ResultadoValidacion {
    if (!movimientosSabana.length) {
        return {
            comprobante,
            estado: 'no_encontrado',
            confianza_score: 0,
            etiquetas: ['Sin movimientos en sábana'],
            detalles: {},
            acreditado: false
        }
    }

    let mejorMatch: {
        movimiento: MovimientoBancario
        score: number
        etiquetas: string[]
        detalles: Record<string, number>
    } | null = null

    // Buscar el mejor match entre todos los movimientos
    for (const movimiento of movimientosSabana) {
        const resultado = calcularScoreComprobante(comprobante, movimiento)

        if (!mejorMatch || resultado.score > mejorMatch.score) {
            mejorMatch = {
                movimiento,
                score: resultado.score,
                etiquetas: resultado.etiquetas,
                detalles: resultado.detalles
            }
        }
    }

    // Determinar estado según el score
    let estado: EstadoValidacion = 'no_encontrado'
    if (mejorMatch && mejorMatch.score >= UMBRAL_VALIDACION) {
        estado = 'validado'
    } else if (mejorMatch && mejorMatch.score >= 40) {
        estado = 'pendiente' // Requiere revisión manual
    }

    return {
        comprobante,
        estado,
        movimiento_match: mejorMatch?.movimiento,
        confianza_score: mejorMatch?.score || 0,
        etiquetas: mejorMatch?.etiquetas || [],
        detalles: mejorMatch?.detalles || {},
        acreditado: false
    }
}

/**
 * Calcula el score de coincidencia entre un comprobante y un movimiento de sábana.
 */
function calcularScoreComprobante(
    comprobante: DatosComprobante,
    movimiento: MovimientoBancario
): { score: number; etiquetas: string[]; detalles: Record<string, number> } {
    let score = 0
    const etiquetas: string[] = []
    const detalles: Record<string, number> = {}

    // 1. Regla de Monto (más importante)
    const diffMonto = Math.abs(comprobante.monto - movimiento.monto)
    const porcDiff = movimiento.monto > 0
        ? Math.abs((diffMonto / movimiento.monto) * 100)
        : 100

    if (diffMonto < 1) {
        score += REGLAS_PUNTAJE.MONTO_EXACTO
        detalles['monto_exacto'] = REGLAS_PUNTAJE.MONTO_EXACTO
        etiquetas.push('✅ Monto exacto')
    } else if (porcDiff <= TOLERANCIA_MONTO_PORCENTAJE) {
        score += REGLAS_PUNTAJE.MONTO_APROXIMADO_2
        detalles['monto_aprox_2'] = REGLAS_PUNTAJE.MONTO_APROXIMADO_2
        etiquetas.push(`✅ Monto ≈ (diff ${porcDiff.toFixed(1)}%)`)
    } else if (porcDiff <= 5) {
        score += REGLAS_PUNTAJE.MONTO_APROXIMADO_5
        detalles['monto_aprox_5'] = REGLAS_PUNTAJE.MONTO_APROXIMADO_5
        etiquetas.push(`⚠️ Monto aprox. (diff ${porcDiff.toFixed(1)}%)`)
    } else if (porcDiff <= 10) {
        score += REGLAS_PUNTAJE.MONTO_APROXIMADO_10
        detalles['monto_aprox_10'] = REGLAS_PUNTAJE.MONTO_APROXIMADO_10
        etiquetas.push(`⚠️ Monto diff (${porcDiff.toFixed(1)}%)`)
    }

    // 2. Regla de DNI/CUIT
    const cleanDniComp = comprobante.dni_cuit?.replace(/\D/g, '') || ''
    const cleanDniMov = movimiento.dni_cuit?.replace(/\D/g, '') || ''

    if (cleanDniComp && cleanDniMov && cleanDniComp === cleanDniMov) {
        score += REGLAS_PUNTAJE.DNI_EXACTO
        detalles['dni_exacto'] = REGLAS_PUNTAJE.DNI_EXACTO
        etiquetas.push('✅ DNI/CUIT coincide')
    }

    // 3. Regla de Fecha
    if (comprobante.fecha && movimiento.fecha) {
        try {
            const fechaComp = typeof comprobante.fecha === 'string'
                ? parseISO(comprobante.fecha)
                : new Date(comprobante.fecha)
            const fechaMov = typeof movimiento.fecha === 'string'
                ? parseISO(movimiento.fecha)
                : new Date(movimiento.fecha)

            const diffDias = Math.abs(differenceInDays(fechaComp, fechaMov))

            if (diffDias === 0) {
                score += REGLAS_PUNTAJE.FECHA_MISMO_DIA
                detalles['fecha_exacta'] = REGLAS_PUNTAJE.FECHA_MISMO_DIA
                etiquetas.push('✅ Mismo día')
            } else if (diffDias <= 3) {
                score += REGLAS_PUNTAJE.FECHA_CERCANA_3
                detalles['fecha_cercana_3'] = REGLAS_PUNTAJE.FECHA_CERCANA_3
                etiquetas.push(`📅 ±${diffDias} días`)
            } else if (diffDias <= 7) {
                score += REGLAS_PUNTAJE.FECHA_CERCANA_7
                detalles['fecha_cercana_7'] = REGLAS_PUNTAJE.FECHA_CERCANA_7
                etiquetas.push(`📅 ±${diffDias} días`)
            }
        } catch {
            // Ignorar errores de parseo de fecha
        }
    }

    // 4. Regla de Referencia/Descripción
    const textoComp = ((comprobante.referencia || '') + ' ' + (comprobante.descripcion || '')).trim()
    const textoMov = ((movimiento.referencia || '') + ' ' + (movimiento.descripcion || '')).trim()

    if (textoComp && textoMov) {
        const similitud = calculateStringSimilarity(textoComp, textoMov)

        if (similitud >= 0.8) {
            score += REGLAS_PUNTAJE.REFERENCIA_SIMILAR_80
            detalles['ref_similar_80'] = REGLAS_PUNTAJE.REFERENCIA_SIMILAR_80
            etiquetas.push('✅ Referencia muy similar')
        } else if (similitud >= 0.6) {
            score += REGLAS_PUNTAJE.REFERENCIA_SIMILAR_60
            detalles['ref_similar_60'] = REGLAS_PUNTAJE.REFERENCIA_SIMILAR_60
            etiquetas.push('📝 Referencia similar')
        }
    }

    return { score, etiquetas, detalles }
}

/**
 * Valida múltiples comprobantes contra la sábana bancaria.
 * Evita asignar el mismo movimiento a múltiples comprobantes.
 */
export function validarComprobantesContraSabana(
    comprobantes: DatosComprobante[],
    movimientosSabana: MovimientoBancario[]
): ResultadoValidacion[] {
    const resultados: ResultadoValidacion[] = []
    const movimientosUsados = new Set<string>()

    // Ordenar comprobantes por monto (de mayor a menor) para priorizar
    const comprobantesOrdenados = [...comprobantes].sort((a, b) => b.monto - a.monto)

    for (const comprobante of comprobantesOrdenados) {
        // Filtrar movimientos que ya fueron usados
        const movimientosDisponibles = movimientosSabana.filter(
            m => !movimientosUsados.has(m.id!)
        )

        const resultado = validarComprobanteContraSabana(comprobante, movimientosDisponibles)

        // Si se encontró match, marcar el movimiento como usado
        if (resultado.movimiento_match && resultado.estado === 'validado') {
            movimientosUsados.add(resultado.movimiento_match.id!)
        }

        resultados.push(resultado)
    }

    return resultados
}

// ===========================================
// FUNCIONES LEGACY (para compatibilidad)
// ===========================================

interface MatchResult {
    pagoId: string
    score: number
    etiquetas: string[]
    tipo: TipoMatch
    detalles: Record<string, number>
}

/**
 * @deprecated Usar validarComprobanteContraSabana en su lugar
 */
export function calcularScore(movimiento: MovimientoBancario, pago: {
    id?: string
    monto_esperado: number
    dni_cuit?: string
    fecha_esperada?: string
    referencia?: string
    cliente?: { cuit?: string; nombre?: string }
}): MatchResult {
    const comprobante: DatosComprobante = {
        monto: movimiento.monto,
        dni_cuit: movimiento.dni_cuit,
        fecha: movimiento.fecha,
        referencia: movimiento.referencia,
        descripcion: movimiento.descripcion
    }

    const movPago: MovimientoBancario = {
        id: pago.id,
        monto: pago.monto_esperado,
        dni_cuit: pago.dni_cuit || pago.cliente?.cuit,
        fecha: pago.fecha_esperada || format(new Date(), 'yyyy-MM-dd'),
        referencia: pago.referencia,
        descripcion: pago.cliente?.nombre,
        estado_conciliacion: 'pendiente'
    }

    const resultado = calcularScoreComprobante(comprobante, movPago)

    return {
        pagoId: pago.id || '',
        score: resultado.score,
        etiquetas: resultado.etiquetas,
        tipo: resultado.score >= UMBRAL_VALIDACION ? 'automatico' : 'manual',
        detalles: resultado.detalles
    }
}

export { UMBRAL_VALIDACION as UMBRAL_AUTOCONCILIACION }
