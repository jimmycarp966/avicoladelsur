'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
    ResultadoValidacion,
    ResumenConciliacion,
    MovimientoBancario,
    DatosComprobante,
    SesionConciliacion,
    ComprobanteConciliacion
} from '@/types/conciliacion'
import { parsearSabanaBancaria, parsearComprobantesEnLote } from '@/lib/conciliacion/parsers'
import { validarComprobantesContraSabana } from '@/lib/conciliacion/motor-conciliacion'
import { buscarClientesPorDNIBatch } from '@/lib/conciliacion/cliente-lookup'
import { acreditarPagosBatch } from '@/lib/conciliacion/acreditacion'
import { generarReporteConciliacion } from '@/lib/conciliacion/reporte-conciliacion'
import { format } from 'date-fns'

// ===========================================
// ACTION PRINCIPAL: Procesar Conciliación Completa
// ===========================================

/**
 * Procesa una sesión completa de conciliación bancaria.
 * 
 * Flujo:
 * 1. Recibe PDF sábana + array de imágenes de comprobantes
 * 2. Extrae datos con Gemini de ambos tipos de archivos
 * 3. Cruza comprobantes vs sábana
 * 4. Busca clientes por DNI
 * 5. Acredita saldos automáticamente
 * 6. Genera reporte PDF
 */
export async function procesarConciliacionCompletaAction(formData: FormData): Promise<{
    success: boolean
    sesionId?: string
    resumen?: ResumenConciliacion
    error?: string
}> {
    const supabase = await createClient()

    try {
        // 1. Obtener usuario actual
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return { success: false, error: 'Usuario no autenticado' }
        }

        // 2. Obtener archivos del FormData
        const sabanaPdf = formData.get('sabana') as File | null
        const comprobantesFiles = formData.getAll('comprobantes') as File[]

        if (!sabanaPdf) {
            return { success: false, error: 'Debe subir el PDF de la sábana bancaria' }
        }

        if (comprobantesFiles.length === 0) {
            return { success: false, error: 'Debe subir al menos un comprobante' }
        }

        // 3. Crear sesión de conciliación
        const { data: sesion, error: errorSesion } = await supabase
            .from('sesiones_conciliacion')
            .insert({
                sabana_archivo: sabanaPdf.name,
                total_comprobantes: comprobantesFiles.length,
                usuario_id: user.id,
                estado: 'en_proceso'
            })
            .select('id')
            .single()

        if (errorSesion || !sesion) {
            console.error('Error creando sesión:', errorSesion)
            return { success: false, error: 'Error al crear sesión de conciliación' }
        }

        const sesionId = sesion.id

        // 4. Parsear sábana bancaria (PDF)
        console.log('[Conciliación] Parseando sábana bancaria...')
        const movimientosSabana = await parsearSabanaBancaria(sabanaPdf)
        console.log(`[Conciliación] ${movimientosSabana.length} movimientos extraídos de la sábana`)

        // Guardar movimientos en BD
        const movimientosParaDb = movimientosSabana.map(m => ({
            fecha: format(m.fecha, 'yyyy-MM-dd'),
            monto: m.monto,
            referencia: m.referencia,
            dni_cuit: m.dni_cuit,
            descripcion: m.descripcion,
            archivo_origen: sabanaPdf.name,
            estado_conciliacion: 'pendiente' as const
        }))

        const { data: movimientosGuardados } = await supabase
            .from('movimientos_bancarios')
            .insert(movimientosParaDb)
            .select('id, fecha, monto, referencia, dni_cuit, descripcion, estado_conciliacion')

        // Convertir a formato esperado
        const movimientosBd: MovimientoBancario[] = (movimientosGuardados || []).map(m => ({
            ...m,
            estado_conciliacion: m.estado_conciliacion as 'pendiente' | 'conciliado' | 'revisado' | 'descartado'
        }))

        // 5. Parsear comprobantes (imágenes) en lotes
        console.log(`[Conciliación] Parseando ${comprobantesFiles.length} comprobantes...`)
        const comprobantesParseados = await parsearComprobantesEnLote(comprobantesFiles)
        console.log(`[Conciliación] ${comprobantesParseados.length} comprobantes procesados`)

        // 6. Validar comprobantes contra sábana
        console.log('[Conciliación] Validando comprobantes contra sábana...')
        const datosComprobantes: DatosComprobante[] = comprobantesParseados.map(c => c.datos)
        const resultadosValidacion = validarComprobantesContraSabana(datosComprobantes, movimientosBd)

        // 7. Buscar clientes por DNI (batch)
        console.log('[Conciliación] Buscando clientes por DNI...')
        const dnisCuits = datosComprobantes
            .map(c => c.dni_cuit)
            .filter((d): d is string => !!d)

        const clientesMap = await buscarClientesPorDNIBatch(dnisCuits)

        // Enriquecer resultados con clientes encontrados
        for (const resultado of resultadosValidacion) {
            const dniNormalizado = resultado.comprobante.dni_cuit?.replace(/\D/g, '') || ''
            if (dniNormalizado && clientesMap.has(dniNormalizado)) {
                resultado.cliente = clientesMap.get(dniNormalizado)
            } else if (resultado.estado === 'validado' && !resultado.cliente) {
                resultado.estado = 'sin_cliente'
            }
        }

        // 8. Guardar comprobantes en BD
        const comprobantesParaDb = resultadosValidacion.map((r, i) => ({
            sesion_id: sesionId,
            fecha: r.comprobante.fecha || format(new Date(), 'yyyy-MM-dd'),
            monto: r.comprobante.monto,
            dni_cuit: r.comprobante.dni_cuit,
            referencia: r.comprobante.referencia,
            descripcion: r.comprobante.descripcion,
            estado_validacion: r.estado,
            cliente_id: r.cliente?.id || null,
            movimiento_match_id: r.movimiento_match?.id || null,
            confianza_score: r.confianza_score / 100,
            origen: 'manual' as const,
            acreditado: false,
            notas: comprobantesParseados[i].error || null
        }))

        const { data: comprobantesGuardados } = await supabase
            .from('comprobantes_conciliacion')
            .insert(comprobantesParaDb)
            .select('id, cliente_id, monto, referencia')

        // 9. Acreditar saldos a clientes validados
        console.log('[Conciliación] Acreditando saldos...')
        const pagosParaAcreditar = (comprobantesGuardados || [])
            .filter((c, i) =>
                c.cliente_id &&
                resultadosValidacion[i]?.estado === 'validado'
            )
            .map(c => ({
                clienteId: c.cliente_id!,
                monto: c.monto,
                referencia: c.referencia || '',
                comprobanteId: c.id
            }))

        const resultadoAcreditacion = await acreditarPagosBatch(pagosParaAcreditar, sesionId)

        // Marcar como acreditados
        if (resultadoAcreditacion.exitosos > 0) {
            const idsAcreditados = pagosParaAcreditar
                .slice(0, resultadoAcreditacion.exitosos)
                .map(p => p.comprobanteId)

            await supabase
                .from('comprobantes_conciliacion')
                .update({ acreditado: true })
                .in('id', idsAcreditados)

            // Actualizar resultados
            for (const resultado of resultadosValidacion) {
                if (resultado.cliente && resultado.estado === 'validado') {
                    resultado.acreditado = true
                }
            }
        }

        // 10. Calcular resumen
        const resumen: ResumenConciliacion = {
            sesion_id: sesionId,
            total_comprobantes: resultadosValidacion.length,
            validados: resultadosValidacion.filter(r => r.estado === 'validado').length,
            no_encontrados: resultadosValidacion.filter(r => r.estado === 'no_encontrado').length,
            sin_cliente: resultadosValidacion.filter(r => r.estado === 'sin_cliente').length,
            errores: resultadosValidacion.filter(r => r.estado === 'error').length,
            monto_total_acreditado: resultadoAcreditacion.montoTotal,
            detalles: resultadosValidacion
        }

        // 11. Generar reporte PDF
        console.log('[Conciliación] Generando reporte PDF...')
        const { data: userData } = await supabase
            .from('usuarios')
            .select('nombre, email')
            .eq('id', user.id)
            .single()

        const pdfBuffer = await generarReporteConciliacion({
            sesionId,
            fecha: new Date(),
            usuarioNombre: userData?.nombre || userData?.email || user.email || 'Usuario',
            sabanaArchivo: sabanaPdf.name,
            resultados: resultadosValidacion,
            resumen: {
                totalComprobantes: resumen.total_comprobantes,
                validados: resumen.validados,
                noEncontrados: resumen.no_encontrados,
                sinCliente: resumen.sin_cliente,
                errores: resumen.errores,
                montoTotalAcreditado: resumen.monto_total_acreditado
            }
        })

        // Subir PDF a storage
        const nombreReporte = `conciliacion_${sesionId.slice(0, 8)}_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`
        const { data: uploadData } = await supabase
            .storage
            .from('reportes')
            .upload(`conciliacion/${nombreReporte}`, pdfBuffer, {
                contentType: 'application/pdf'
            })

        const reporteUrl = uploadData?.path
            ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/reportes/${uploadData.path}`
            : undefined

        resumen.reporte_url = reporteUrl

        // 12. Actualizar sesión como completada
        await supabase
            .from('sesiones_conciliacion')
            .update({
                total_movimientos_sabana: movimientosSabana.length,
                validados: resumen.validados,
                no_encontrados: resumen.no_encontrados,
                monto_total_acreditado: resumen.monto_total_acreditado,
                estado: 'completada',
                reporte_url: reporteUrl
            })
            .eq('id', sesionId)

        console.log('[Conciliación] Sesión completada:', sesionId)

        revalidatePath('/tesoreria/conciliacion')
        revalidatePath('/tesoreria')

        return {
            success: true,
            sesionId,
            resumen
        }

    } catch (error) {
        console.error('[Conciliación] Error:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido en la conciliación'
        }
    }
}

// ===========================================
// ACTIONS AUXILIARES
// ===========================================

/**
 * Obtiene el historial de sesiones de conciliación
 */
export async function obtenerHistorialSesionesAction(limite: number = 20): Promise<{
    success: boolean
    sesiones?: SesionConciliacion[]
    error?: string
}> {
    const supabase = await createClient()

    try {
        const { data, error } = await supabase
            .from('sesiones_conciliacion')
            .select(`
                *,
                usuario:usuarios(id, nombre, email)
            `)
            .order('created_at', { ascending: false })
            .limit(limite)

        if (error) throw error

        return { success: true, sesiones: data as SesionConciliacion[] }

    } catch (error) {
        console.error('Error obteniendo historial:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error al obtener historial'
        }
    }
}

/**
 * Obtiene los detalles de una sesión de conciliación
 */
export async function obtenerDetalleSesionAction(sesionId: string): Promise<{
    success: boolean
    sesion?: SesionConciliacion
    comprobantes?: ComprobanteConciliacion[]
    error?: string
}> {
    const supabase = await createClient()

    try {
        // Obtener sesión
        const { data: sesion, error: errorSesion } = await supabase
            .from('sesiones_conciliacion')
            .select(`
                *,
                usuario:usuarios(id, nombre, email)
            `)
            .eq('id', sesionId)
            .single()

        if (errorSesion) throw errorSesion

        // Obtener comprobantes
        const { data: comprobantes, error: errorComp } = await supabase
            .from('comprobantes_conciliacion')
            .select(`
                *,
                cliente:clientes(id, nombre, apellido, cuit),
                movimiento_match:movimientos_bancarios(id, fecha, monto, referencia)
            `)
            .eq('sesion_id', sesionId)
            .order('created_at', { ascending: true })

        if (errorComp) throw errorComp

        return {
            success: true,
            sesion: sesion as SesionConciliacion,
            comprobantes: comprobantes as ComprobanteConciliacion[]
        }

    } catch (error) {
        console.error('Error obteniendo detalle sesión:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error al obtener detalle'
        }
    }
}

/**
 * Asigna cliente manualmente a un comprobante sin cliente
 */
export async function asignarClienteComprobanteAction(
    comprobanteId: string,
    clienteId: string,
    acreditar: boolean = true
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()

    try {
        // Obtener comprobante
        const { data: comprobante, error: errorComp } = await supabase
            .from('comprobantes_conciliacion')
            .select('id, monto, referencia, sesion_id, acreditado')
            .eq('id', comprobanteId)
            .single()

        if (errorComp || !comprobante) {
            return { success: false, error: 'Comprobante no encontrado' }
        }

        // Actualizar comprobante
        await supabase
            .from('comprobantes_conciliacion')
            .update({
                cliente_id: clienteId,
                estado_validacion: 'validado'
            })
            .eq('id', comprobanteId)

        // Acreditar si corresponde
        if (acreditar && !comprobante.acreditado) {
            const { acreditarPagosBatch } = await import('@/lib/conciliacion/acreditacion')

            await acreditarPagosBatch([{
                clienteId,
                monto: comprobante.monto,
                referencia: comprobante.referencia || '',
                comprobanteId
            }], comprobante.sesion_id)

            await supabase
                .from('comprobantes_conciliacion')
                .update({ acreditado: true })
                .eq('id', comprobanteId)
        }

        revalidatePath('/tesoreria/conciliacion')
        return { success: true }

    } catch (error) {
        console.error('Error asignando cliente:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error al asignar cliente'
        }
    }
}

/**
 * Descarta un comprobante (no se acreditará)
 */
export async function descartarComprobanteAction(
    comprobanteId: string,
    motivo: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()

    try {
        await supabase
            .from('comprobantes_conciliacion')
            .update({
                estado_validacion: 'error',
                notas: `Descartado: ${motivo}`
            })
            .eq('id', comprobanteId)

        revalidatePath('/tesoreria/conciliacion')
        return { success: true }

    } catch (error) {
        console.error('Error descartando comprobante:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error al descartar'
        }
    }
}

/**
 * Obtiene estadísticas generales de conciliación
 */
export async function obtenerEstadisticasConciliacionAction(): Promise<{
    success: boolean
    stats?: {
        totalSesiones: number
        sesionesHoy: number
        totalAcreditado: number
        tasaExito: number
    }
    error?: string
}> {
    const supabase = await createClient()

    try {
        const hoy = format(new Date(), 'yyyy-MM-dd')

        // Total sesiones
        const { count: totalSesiones } = await supabase
            .from('sesiones_conciliacion')
            .select('*', { count: 'exact', head: true })

        // Sesiones hoy
        const { count: sesionesHoy } = await supabase
            .from('sesiones_conciliacion')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', `${hoy}T00:00:00`)

        // Total acreditado
        const { data: totales } = await supabase
            .from('sesiones_conciliacion')
            .select('monto_total_acreditado, validados, total_comprobantes')
            .eq('estado', 'completada')

        const totalAcreditado = totales?.reduce((sum, s) => sum + (s.monto_total_acreditado || 0), 0) || 0
        const totalValidados = totales?.reduce((sum, s) => sum + (s.validados || 0), 0) || 0
        const totalComprobantes = totales?.reduce((sum, s) => sum + (s.total_comprobantes || 0), 0) || 1

        const tasaExito = Math.round((totalValidados / totalComprobantes) * 100)

        return {
            success: true,
            stats: {
                totalSesiones: totalSesiones || 0,
                sesionesHoy: sesionesHoy || 0,
                totalAcreditado,
                tasaExito
            }
        }

    } catch (error) {
        console.error('Error obteniendo estadísticas:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error al obtener estadísticas'
        }
    }
}
