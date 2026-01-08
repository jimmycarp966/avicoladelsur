import { MovimientoBancario, PagoEsperado, TipoMatch } from '@/types/conciliacion'
import { calculateStringSimilarity, normalizeString } from './utils'
import { differenceInDays, parseISO } from 'date-fns'

interface MatchResult {
    pagoId: string
    score: number
    etiquetas: string[]
    tipo: TipoMatch
    detalles: Record<string, number> // Regla -> Puntaje aplicado
}

const REGLES_PUNTAJE = {
    MONTO_EXACTO: 40,
    MONTO_APROXIMADO_5: 25,
    MONTO_APROXIMADO_15: 15,
    DNI_EXACTO: 30,
    FECHA_MISMO_DIA: 10,
    FECHA_CERCANA_3: 5,
    REFERENCIA_SIMILAR_70: 20,
    REFERENCIA_SIMILAR_50: 10,
}

export const UMBRAL_AUTOCONCILIACION = 70

/**
 * Calcula el score de coincidencia entre un movimiento bancario y un pago esperado.
 */
export function calcularScore(movimiento: MovimientoBancario, pago: PagoEsperado): MatchResult {
    let score = 0
    const etiquetas: string[] = []
    const detalles: Record<string, number> = {}

    // 1. Regla de Monto
    const diffMonto = Math.abs(movimiento.monto - pago.monto_esperado)
    const porcDiff = Math.abs((diffMonto / pago.monto_esperado) * 100)

    if (diffMonto < 0.01) {
        score += REGLES_PUNTAJE.MONTO_EXACTO
        detalles['monto_exacto'] = REGLES_PUNTAJE.MONTO_EXACTO
        etiquetas.push('Monto exacto')
    } else if (porcDiff <= 5) {
        score += REGLES_PUNTAJE.MONTO_APROXIMADO_5
        detalles['monto_aprox_5'] = REGLES_PUNTAJE.MONTO_APROXIMADO_5
        etiquetas.push('Monto aproximado (<5%)')
    } else if (porcDiff <= 15) {
        score += REGLES_PUNTAJE.MONTO_APROXIMADO_15
        detalles['monto_aprox_15'] = REGLES_PUNTAJE.MONTO_APROXIMADO_15
        etiquetas.push('Monto aproximado (<15%)')
    }

    // 2. Regla de DNI/CUIT
    // Normalizar: quitar guiones, espacios
    const cleanDniMov = movimiento.dni_cuit?.replace(/\D/g, '') || ''
    const cleanDniPago = pago.dni_cuit?.replace(/\D/g, '') || pago.cliente?.cuit?.replace(/\D/g, '') || ''

    if (cleanDniMov && cleanDniPago && cleanDniMov === cleanDniPago) {
        score += REGLES_PUNTAJE.DNI_EXACTO
        detalles['dni_exacto'] = REGLES_PUNTAJE.DNI_EXACTO
        etiquetas.push('DNI/CUIT coincide')
    }

    // 3. Regla de Fecha
    if (pago.fecha_esperada) {
        const fechaMov = typeof movimiento.fecha === 'string' ? parseISO(movimiento.fecha) : movimiento.fecha
        const fechaPago = typeof pago.fecha_esperada === 'string' ? parseISO(pago.fecha_esperada) : pago.fecha_esperada

        // Asumiendo que fechaMov y fechaPago son objetos Date válidos o strings parseables
        // Si vienen como strings 'YYYY-MM-DD' directo, mejor parsear.
        // Tipos dicen string YYYY-MM-DD.

        const diffDias = Math.abs(differenceInDays(fechaMov, fechaPago))

        if (diffDias === 0) {
            score += REGLES_PUNTAJE.FECHA_MISMO_DIA
            detalles['fecha_exacta'] = REGLES_PUNTAJE.FECHA_MISMO_DIA
            etiquetas.push('Mismo día')
        } else if (diffDias <= 3) {
            score += REGLES_PUNTAJE.FECHA_CERCANA_3
            detalles['fecha_cercana'] = REGLES_PUNTAJE.FECHA_CERCANA_3
            etiquetas.push('Fecha cercana (±3 días)')
        }
    }

    // 4. Regla de Referencia / Descripción
    const textoMov = (movimiento.referencia || '') + ' ' + (movimiento.descripcion || '')
    const textoPago = (pago.referencia || '') + ' ' + (pago.cliente?.nombre || '')

    const similitud = calculateStringSimilarity(textoMov, textoPago)

    if (similitud >= 0.7) {
        score += REGLES_PUNTAJE.REFERENCIA_SIMILAR_70
        detalles['ref_similar_70'] = REGLES_PUNTAJE.REFERENCIA_SIMILAR_70
        etiquetas.push('Referencia muy similar')
    } else if (similitud >= 0.5) {
        score += REGLES_PUNTAJE.REFERENCIA_SIMILAR_50
        detalles['ref_similar_50'] = REGLES_PUNTAJE.REFERENCIA_SIMILAR_50
        etiquetas.push('Referencia similar')
    }

    return {
        pagoId: pago.id!,
        score,
        etiquetas,
        tipo: score >= UMBRAL_AUTOCONCILIACION ? 'automatico' : 'manual',
        detalles
    }
}

/**
 * Encuentra el mejor match para un movimiento entre una lista de candidatos.
 */
export function encontrarMejorMatch(movimiento: MovimientoBancario, candidatos: PagoEsperado[]): MatchResult | null {
    if (!candidatos.length) return null

    let mejorMatch: MatchResult | null = null

    for (const pago of candidatos) {
        const resultado = calcularScore(movimiento, pago)
        if (!mejorMatch || resultado.score > mejorMatch.score) {
            mejorMatch = resultado
        }
    }

    return mejorMatch
}
