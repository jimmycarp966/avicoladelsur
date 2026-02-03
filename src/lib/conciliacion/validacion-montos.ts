/**
 * Validación cruzada de montos entre comprobantes y sábana bancaria
 * Detecta discrepancias, posibles duplicaciones o errores
 */

import { DatosComprobante, MovimientoBancario, ResultadoValidacion } from "@/types/conciliacion"

export interface AlertaValidacion {
    tipo: 'error' | 'warning' | 'info'
    codigo: string
    mensaje: string
    detalles?: Record<string, number>
}

export interface ResultadoValidacionMontos {
    esValido: boolean
    alertas: AlertaValidacion[]
    estadisticas: {
        totalComprobantes: number
        totalMovimientosSabana: number
        montoComprobantes: number
        montoSabana: number
        diferencia: number
        diferenciaPorcentaje: number
    }
}

/**
 * Valida que los montos totales de comprobantes coincidan razonablemente con la sábana
 */
export function validarMontosCruzados(
    comprobantes: DatosComprobante[],
    movimientosSabana: MovimientoBancario[],
    comprobantesValidados: ResultadoValidacion[]
): ResultadoValidacionMontos {
    const alertas: AlertaValidacion[] = []

    // Calcular totales
    const montoTotalComprobantes = comprobantes.reduce((sum, c) => sum + c.monto, 0)
    const montoTotalSabana = movimientosSabana.reduce((sum, m) => sum + m.monto, 0)
    const montoComprobantesValidados = comprobantesValidados
        .filter(r => r.estado === 'validado')
        .reduce((sum, r) => sum + r.comprobante.monto, 0)

    const diferencia = Math.abs(montoTotalComprobantes - montoTotalSabana)
    const diferenciaPorcentaje = montoTotalSabana > 0 
        ? (diferencia / montoTotalSabana) * 100 
        : 0

    console.log('[ValidacionMontos] ========== Validación de Montos ==========')
    console.log(`[ValidacionMontos] Total comprobantes: ${comprobantes.length} ($${montoTotalComprobantes})`)
    console.log(`[ValidacionMontos] Total movimientos sábana: ${movimientosSabana.length} ($${montoTotalSabana})`)
    console.log(`[ValidacionMontos] Comprobantes validados: $${montoComprobantesValidados}`)
    console.log(`[ValidacionMontos] Diferencia: $${diferencia} (${diferenciaPorcentaje.toFixed(2)}%)`)

    // Validación 1: Comprobantes exceden total de sábana
    if (montoTotalComprobantes > montoTotalSabana * 1.1) {
        alertas.push({
            tipo: 'error',
            codigo: 'MONTO_EXCEDE_SABANA',
            mensaje: `El monto total de comprobantes ($${montoTotalComprobantes.toLocaleString('es-AR')}) excede el 10% del total de la sábana ($${montoTotalSabana.toLocaleString('es-AR')}). Posible duplicación de comprobantes o errores de extracción.`,
            detalles: {
                montoComprobantes: montoTotalComprobantes,
                montoSabana: montoTotalSabana,
                excesoPorcentaje: ((montoTotalComprobantes / montoTotalSabana) - 1) * 100
            }
        })
    }

    // Validación 2: Diferencia significativa entre validados y comprobantes
    const diferenciaValidados = Math.abs(montoComprobantesValidados - montoTotalComprobantes)
    const porcentajeNoValidado = montoTotalComprobantes > 0 
        ? (diferenciaValidados / montoTotalComprobantes) * 100 
        : 0

    if (porcentajeNoValidado > 50) {
        alertas.push({
            tipo: 'warning',
            codigo: 'MUCHOS_NO_VALIDADOS',
            mensaje: `El ${porcentajeNoValidado.toFixed(1)}% de los comprobantes no pudieron ser validados contra la sábana. Revisar los comprobantes marcados como "No encontrados".`,
            detalles: {
                montoValidado: montoComprobantesValidados,
                montoTotal: montoTotalComprobantes,
                porcentajeNoValidado
            }
        })
    }

    // Validación 3: Sábana tiene mucho más dinero que comprobantes
    if (montoTotalSabana > montoTotalComprobantes * 2) {
        alertas.push({
            tipo: 'warning',
            codigo: 'SABANA_MAYOR_COMPROBANTES',
            mensaje: `La sábana bancaria tiene $${(montoTotalSabana - montoTotalComprobantes).toLocaleString('es-AR')} más que los comprobantes subidos. Puede haber comprobantes faltantes o movimientos que no corresponden a pagos de clientes.`,
            detalles: {
                montoSabana: montoTotalSabana,
                montoComprobantes: montoTotalComprobantes,
                diferencia: montoTotalSabana - montoTotalComprobantes
            }
        })
    }

    // Validación 4: Comprobantes sin monto
    const comprobantesSinMonto = comprobantes.filter(c => !c.monto || c.monto <= 0).length
    if (comprobantesSinMonto > 0) {
        alertas.push({
            tipo: 'error',
            codigo: 'COMPROBANTES_SIN_MONTO',
            mensaje: `${comprobantesSinMonto} comprobante(s) no tienen monto válido. Verificar la calidad de las imágenes subidas.`,
            detalles: { cantidad: comprobantesSinMonto }
        })
    }

    // Validación 5: Montos muy altos individuales (posible error de OCR)
    const comprobantesMontosAltos = comprobantes.filter(c => c.monto > 10000000) // > 10 millones
    if (comprobantesMontosAltos.length > 0) {
        alertas.push({
            tipo: 'warning',
            codigo: 'MONTOS_SOSPECHOSOS',
            mensaje: `${comprobantesMontosAltos.length} comprobante(s) tienen montos superiores a $10.000.000. Verificar que no sean errores de lectura (OCR).`,
            detalles: { 
                cantidad: comprobantesMontosAltos.length,
                montos: comprobantesMontosAltos.map(c => c.monto)
            }
        })
    }

    // Info: Resumen general
    if (alertas.length === 0) {
        alertas.push({
            tipo: 'info',
            codigo: 'VALIDACION_OK',
            mensaje: `Validación de montos exitosa. Diferencia: ${diferenciaPorcentaje.toFixed(2)}%`,
            detalles: {
                montoComprobantes: montoTotalComprobantes,
                montoSabana: montoTotalSabana,
                diferenciaPorcentaje
            }
        })
    }

    return {
        esValido: !alertas.some(a => a.tipo === 'error'),
        alertas,
        estadisticas: {
            totalComprobantes: comprobantes.length,
            totalMovimientosSabana: movimientosSabana.length,
            montoComprobantes: montoTotalComprobantes,
            montoSabana: montoTotalSabana,
            diferencia,
            diferenciaPorcentaje
        }
    }
}

/**
 * Detecta posibles duplicaciones de comprobantes basándose en monto y fecha
 */
export function detectarDuplicadosProbables(
    comprobantes: DatosComprobante[]
): Array<{ comprobante1: number; comprobante2: number; razon: string }> {
    const duplicados: Array<{ comprobante1: number; comprobante2: number; razon: string }> = []

    for (let i = 0; i < comprobantes.length; i++) {
        for (let j = i + 1; j < comprobantes.length; j++) {
            const c1 = comprobantes[i]
            const c2 = comprobantes[j]

            // Comparar monto (exacto o muy cercano)
            const montoIgual = Math.abs(c1.monto - c2.monto) < 1
            
            // Comparar fecha (mismo día)
            const fechaIgual = c1.fecha && c2.fecha && c1.fecha === c2.fecha
            
            // Comparar DNI
            const dniIgual = c1.dni_cuit && c2.dni_cuit && 
                c1.dni_cuit.replace(/\D/g, '') === c2.dni_cuit.replace(/\D/g, '')

            if (montoIgual && (fechaIgual || dniIgual)) {
                duplicados.push({
                    comprobante1: i,
                    comprobante2: j,
                    razon: `Monto igual ($${c1.monto})${fechaIgual ? ' y misma fecha' : ''}${dniIgual ? ' y mismo DNI' : ''}`
                })
            }
        }
    }

    if (duplicados.length > 0) {
        console.warn('[ValidacionMontos] Posibles duplicados detectados:', duplicados)
    }

    return duplicados
}
