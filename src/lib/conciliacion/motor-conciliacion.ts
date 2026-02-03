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
import { analizarMatchDudoso } from './gemini-matcher-v2'

// ===========================================
// CONFIGURACIÓN DE REGLAS
// ===========================================

const REGLAS_PUNTAJE = {
    REFERENCIA_EXACTA: 100,      // Match PERFECTO (Prioridad Absoluta)
    MONTO_EXACTO: 40,            // Bajamos peso (req match + nombre/dni/fecha)
    MONTO_APROXIMADO_2: 20,      // Diferencia <= 2%
    MONTO_APROXIMADO_5: 10,      // Diferencia <= 5%
    DNI_EXACTO: 40,              // Identidad Fuerte
    NOMBRE_EN_DESCRIPCION: 40,   // Nuevo: Nombre cliente en descripción movimiento
    FECHA_MISMO_DIA: 20,         // Fecha exacta
    FECHA_CERCANA_1: 10,         // ±1 día
    FECHA_CERCANA_3: 5,          // ±3 días
    REFERENCIA_SIMILAR_80: 15,   // Referencia similar (fuzzy)
}

export const UMBRAL_VALIDACION = 80 // Límite exigente para evitar falsos positivos
export const UMBRAL_REVISION_IA = 40 // Umbral para activar revisión con IA secundaria
export const UMBRAL_MAXIMO_SIN_IA = 79 // Máximo score que puede tener sin revisión IA

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
    console.log('[Motor] ========== validarComprobanteContraSabana ==========')
    console.log('[Motor] Comprobante:', { monto: comprobante.monto, dni: comprobante.dni_cuit, fecha: comprobante.fecha, ref: comprobante.referencia })

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

        // Log solo de scores relevantes para no saturar
        if (resultado.score > 20) {
            console.log(`[Motor] Score vs mov ${movimiento.id?.substring(0, 8)} ($${movimiento.monto}): ${resultado.score} pts`)
        }

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
        console.log(`[Motor] ✅ VALIDADO con score ${mejorMatch.score} >= ${UMBRAL_VALIDACION}`)
    } else if (mejorMatch && mejorMatch.score >= 40) {
        estado = 'pendiente' // Requiere revisión manual
        console.log(`[Motor] ⚠️ PENDIENTE con score ${mejorMatch.score}`)
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

    // 0. Regla de ORO: Referencia Bancaria Exacta
    // Normalizar referencias: quitar ceros a la izquierda, espacios, guiones
    const cleanRefComp = comprobante.referencia?.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+/, '') || ''
    const cleanRefMov = movimiento.referencia?.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+/, '') || ''

    if (cleanRefComp.length > 4 && cleanRefMov.length > 4 && cleanRefComp === cleanRefMov) {
        // Match casi seguro
        score += REGLAS_PUNTAJE.REFERENCIA_EXACTA
        detalles['referencia_exacta'] = REGLAS_PUNTAJE.REFERENCIA_EXACTA
        etiquetas.push('✅ Referencia IDÉNTICA')
        // Si la referencia es idéntica, retornamos score alto directo
        return { score, etiquetas, detalles }
    }

    // 1. Regla de Monto
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
        etiquetas.push(`✅ Monto ≈ (${porcDiff.toFixed(1)}%)`)
    } else if (porcDiff <= 5) {
        score += REGLAS_PUNTAJE.MONTO_APROXIMADO_5
        detalles['monto_aprox_5'] = REGLAS_PUNTAJE.MONTO_APROXIMADO_5
        etiquetas.push(`⚠️ Monto dif. (${porcDiff.toFixed(1)}%)`)
    }

    // 2. Regla de Identidad Fuerte (DNI/CUIT)
    const cleanDniComp = comprobante.dni_cuit?.replace(/\D/g, '') || ''
    const cleanDniMov = movimiento.dni_cuit?.replace(/\D/g, '') || ''

    if (cleanDniComp.length > 6 && cleanDniMov.length > 6 && cleanDniComp === cleanDniMov) {
        score += REGLAS_PUNTAJE.DNI_EXACTO
        detalles['dni_exacto'] = REGLAS_PUNTAJE.DNI_EXACTO
        etiquetas.push('✅ DNI/CUIT coincide')
    } else if (comprobante.nombre_cliente_identificado && movimiento.descripcion) {
        // 2b. Regla de Nombre en Descripción (Fuzzy Match)
        // Buscar si el nombre del cliente aparece en la descripción del movimiento
        const nombreCliente = comprobante.nombre_cliente_identificado.toUpperCase()
        const descMov = movimiento.descripcion.toUpperCase()

        // Estrategia simple: Tokenize y buscar coincidencia parcial
        // Ejemplo: "Agustina Girard" vs "ING TRANSF:AGUSTINA GIRARD-"
        const tokensNombre = nombreCliente.split(' ').filter(t => t.length > 2)
        const tokensCoincidentes = tokensNombre.filter(token => descMov.includes(token))

        // Si coinciden al menos 2 tokens importantes o el 100% si es nombre corto
        if (tokensCoincidentes.length >= 2 || (tokensNombre.length === 1 && tokensCoincidentes.length === 1)) {
            score += REGLAS_PUNTAJE.NOMBRE_EN_DESCRIPCION
            detalles['nombre_match'] = REGLAS_PUNTAJE.NOMBRE_EN_DESCRIPCION
            etiquetas.push('✅ Nombre coincide en descripción')
        }
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
            } else if (diffDias <= 1) {
                score += REGLAS_PUNTAJE.FECHA_CERCANA_1
                detalles['fecha_cercana_1'] = REGLAS_PUNTAJE.FECHA_CERCANA_1
                etiquetas.push(`📅 ±1 día`)
            } else if (diffDias <= 3) {
                score += REGLAS_PUNTAJE.FECHA_CERCANA_3
                detalles['fecha_cercana_3'] = REGLAS_PUNTAJE.FECHA_CERCANA_3
                etiquetas.push(`📅 ±${diffDias} días`)
            }
        } catch {
            // Ignorar errores de fecha
        }
    }

    // 4. Regla "Bonus" para referencias similares si no hubo match exacto
    if (!detalles['referencia_exacta']) {
        const textoComp = ((comprobante.referencia || '') + ' ' + (comprobante.descripcion || '')).trim()
        const textoMov = ((movimiento.referencia || '') + ' ' + (movimiento.descripcion || '')).trim()

        if (textoComp.length > 5 && textoMov.length > 5) {
            const similitud = calculateStringSimilarity(textoComp, textoMov)
            if (similitud >= 0.85) {
                score += REGLAS_PUNTAJE.REFERENCIA_SIMILAR_80
                detalles['ref_similar'] = REGLAS_PUNTAJE.REFERENCIA_SIMILAR_80
                etiquetas.push('📝 Referencia similar')
            }
        }
    }

    return { score, etiquetas, detalles }
}

/**
 * Valida múltiples comprobantes contra la sábana bancaria.
 * Evita asignar el mismo movimiento a múltiples comprobantes.
 * 
 * NUEVO: Usa IA secundaria para matches dudosos (score 40-79)
 */
export async function validarComprobantesContraSabana(
    comprobantes: DatosComprobante[],
    movimientosSabana: MovimientoBancario[]
): Promise<ResultadoValidacion[]> {
    console.log('[Motor] ========== validarComprobantesContraSabana ==========')
    console.log('[Motor] Total comprobantes:', comprobantes.length)
    console.log('[Motor] Total movimientos sábana:', movimientosSabana.length)

    const resultados: ResultadoValidacion[] = []
    const movimientosUsados = new Set<string>()
    const casosParaRevisionIA: Array<{
        index: number
        comprobante: DatosComprobante
        movimiento: MovimientoBancario
        score: number
        detalles: Record<string, number>
    }> = []

    // Ordenar comprobantes por monto (de mayor a menor) para priorizar
    const comprobantesOrdenados = [...comprobantes].sort((a, b) => b.monto - a.monto)
    console.log('[Motor] Comprobantes ordenados por monto (mayor a menor)')

    // PRIMERA PASADA: Calcular scores básicos
    for (let i = 0; i < comprobantesOrdenados.length; i++) {
        const comprobante = comprobantesOrdenados[i]
        console.log(`[Motor] === Procesando comprobante ${i + 1}/${comprobantesOrdenados.length}: $${comprobante.monto} ===`)

        // Filtrar movimientos que ya fueron usados
        const movimientosDisponibles = movimientosSabana.filter(
            m => !movimientosUsados.has(m.id!)
        )
        console.log(`[Motor] Movimientos disponibles (no usados): ${movimientosDisponibles.length}`)

        const resultado = validarComprobanteContraSabana(comprobante, movimientosDisponibles)

        // Si está en zona de revisión (40-79), guardar para análisis con IA
        if (resultado.confianza_score >= UMBRAL_REVISION_IA && 
            resultado.confianza_score <= UMBRAL_MAXIMO_SIN_IA &&
            resultado.movimiento_match) {
            console.log(`[Motor] Score ${resultado.confianza_score} en zona de revisión IA, guardando para análisis`)
            casosParaRevisionIA.push({
                index: resultados.length,
                comprobante,
                movimiento: resultado.movimiento_match,
                score: resultado.confianza_score,
                detalles: resultado.detalles
            })
        }

        // Si el score es >= 80, marcar como usado inmediatamente
        if (resultado.movimiento_match && resultado.estado === 'validado') {
            movimientosUsados.add(resultado.movimiento_match.id!)
            console.log(`[Motor] Movimiento ${resultado.movimiento_match.id} marcado como usado (score ${resultado.confianza_score})`)
        }

        resultados.push(resultado)
    }

    // SEGUNDA PASADA: Procesar casos dudosos con IA secundaria
    if (casosParaRevisionIA.length > 0) {
        console.log(`[Motor] ========== REVISIÓN CON IA SECUNDARIA ==========`)
        console.log(`[Motor] ${casosParaRevisionIA.length} casos para revisar`)

        for (const caso of casosParaRevisionIA) {
            console.log(`[Motor] Revisando caso con IA: comprobante $${caso.comprobante.monto} vs movimiento $${caso.movimiento.monto}`)
            
            const decisionIA = await analizarMatchDudoso(
                caso.comprobante,
                caso.movimiento,
                caso.score,
                caso.detalles
            )

            console.log(`[Motor] Decisión IA: ${decisionIA.esValido ? 'VALIDAR' : 'RECHAZAR'} (confianza: ${decisionIA.confianzaFinal})`)
            console.log(`[Motor] Razón: ${decisionIA.razon}`)

            // Actualizar resultado según decisión de IA
            const resultado = resultados[caso.index]
            if (decisionIA.esValido) {
                resultado.estado = 'validado'
                resultado.confianza_score = Math.round(decisionIA.confianzaFinal * 100)
                resultado.etiquetas.push('✅ Validado por IA', ...decisionIA.etiquetasExtra)
                resultado.detalles['revision_ia'] = Math.round(decisionIA.confianzaFinal * 100)
                resultado.detalles['razon_ia'] = decisionIA.razon
                
                // Marcar movimiento como usado
                if (resultado.movimiento_match) {
                    movimientosUsados.add(resultado.movimiento_match.id!)
                }
            } else {
                resultado.estado = 'no_encontrado'
                resultado.confianza_score = Math.round(decisionIA.confianzaFinal * 100)
                resultado.etiquetas.push('❌ Rechazado por IA', ...decisionIA.etiquetasExtra)
                resultado.detalles['revision_ia'] = Math.round(decisionIA.confianzaFinal * 100)
                resultado.detalles['razon_ia'] = decisionIA.razon
            }

            // Pausa entre llamadas para no saturar la API
            await new Promise(r => setTimeout(r, 300))
        }
    }

    // Resumen final
    const validados = resultados.filter(r => r.estado === 'validado').length
    const pendientes = resultados.filter(r => r.estado === 'pendiente').length
    const noEncontrados = resultados.filter(r => r.estado === 'no_encontrado').length
    const sinCliente = resultados.filter(r => r.estado === 'sin_cliente').length

    console.log('[Motor] ========== RESUMEN VALIDACIÓN ==========')
    console.log(`[Motor] Validados: ${validados}`)
    console.log(`[Motor] Pendientes: ${pendientes}`)
    console.log(`[Motor] No encontrados: ${noEncontrados}`)
    console.log(`[Motor] Sin cliente: ${sinCliente}`)
    console.log(`[Motor] Movimientos usados: ${movimientosUsados.size}/${movimientosSabana.length}`)

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
