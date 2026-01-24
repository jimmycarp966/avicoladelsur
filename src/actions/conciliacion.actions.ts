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
import { getTodayArgentina, getNowArgentina } from '@/lib/utils'

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
    console.log('[Conciliación Server] ========== INICIO procesarConciliacionCompletaAction ==========')
    console.log('[Conciliación Server] Timestamp:', new Date().toISOString())

    const supabase = await createClient()

    try {
        // 1. Obtener usuario actual
        console.log('[Conciliación Server] Paso 1: Obteniendo usuario...')
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            console.error('[Conciliación Server] ERROR: Usuario no autenticado')
            return { success: false, error: 'Usuario no autenticado' }
        }
        console.log('[Conciliación Server] Usuario autenticado:', user.id, user.email)

        // 2. Obtener archivos del FormData
        console.log('[Conciliación Server] Paso 2: Obteniendo archivos del FormData...')
        const sabanaPdf = formData.get('sabana') as File | null
        const comprobantesFiles = formData.getAll('comprobantes') as File[]

        console.log('[Conciliación Server] Sábana PDF:', sabanaPdf ? { name: sabanaPdf.name, size: sabanaPdf.size, type: sabanaPdf.type } : 'NULL')
        console.log('[Conciliación Server] Comprobantes recibidos:', comprobantesFiles.length)
        comprobantesFiles.forEach((f, i) => {
            console.log(`[Conciliación Server]   Comprobante ${i + 1}: ${f.name}, ${f.size} bytes, ${f.type}`)
        })

        if (!sabanaPdf) {
            console.error('[Conciliación Server] ERROR: Falta el PDF de la sábana')
            return { success: false, error: 'Debe subir el PDF de la sábana bancaria' }
        }

        if (comprobantesFiles.length === 0) {
            console.error('[Conciliación Server] ERROR: No hay comprobantes')
            return { success: false, error: 'Debe subir al menos un comprobante' }
        }

        // 3. Crear sesión de conciliación
        console.log('[Conciliación Server] Paso 3: Creando sesión de conciliación en BD...')
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
            console.error('[Conciliación Server] ERROR creando sesión:', errorSesion)
            return { success: false, error: 'Error al crear sesión de conciliación' }
        }
        console.log('[Conciliación Server] Sesión creada con ID:', sesion.id)

        const sesionId = sesion.id

        // 4. Parsear sábana bancaria (PDF)
        console.log('[Conciliación Server] Paso 4: Parseando sábana bancaria con Gemini...')
        console.log('[Conciliación Server] Archivo sábana:', sabanaPdf.name, 'Tamaño:', sabanaPdf.size)
        const tiempoInicioParseoSabana = Date.now()
        let movimientosSabana
        try {
            movimientosSabana = await parsearSabanaBancaria(sabanaPdf)
            console.log(`[Conciliación Server] ✅ Sábana parseada en ${Date.now() - tiempoInicioParseoSabana}ms`)
            console.log(`[Conciliación Server] ${movimientosSabana.length} movimientos extraídos de la sábana`)
            movimientosSabana.forEach((m, i) => {
                console.log(`[Conciliación Server]   Mov ${i + 1}: $${m.monto} - ${m.descripcion?.substring(0, 50)} - DNI: ${m.dni_cuit} - Ref: ${m.referencia}`)
            })
        } catch (errorParseo) {
            console.error('[Conciliación Server] ❌ ERROR parseando sábana:', errorParseo)
            throw new Error(`Error al parsear sábana: ${errorParseo instanceof Error ? errorParseo.message : 'Error desconocido'}`)
        }

        // Guardar movimientos en BD
        console.log('[Conciliación Server] Guardando movimientos en BD...')
        const movimientosParaDb = movimientosSabana.map(m => ({
            fecha: format(m.fecha, 'yyyy-MM-dd'),
            monto: m.monto,
            referencia: m.referencia,
            dni_cuit: m.dni_cuit,
            descripcion: m.descripcion,
            archivo_origen: sabanaPdf.name,
            estado_conciliacion: 'pendiente' as const
        }))

        const { data: movimientosGuardados, error: errorMovimientos } = await supabase
            .from('movimientos_bancarios')
            .insert(movimientosParaDb)
            .select('id, fecha, monto, referencia, dni_cuit, descripcion, estado_conciliacion')

        if (errorMovimientos) {
            console.error('[Conciliación Server] ERROR guardando movimientos:', errorMovimientos)
        }
        console.log('[Conciliación Server] Movimientos guardados:', movimientosGuardados?.length || 0)

        // Convertir a formato esperado
        const movimientosBd: MovimientoBancario[] = (movimientosGuardados || []).map(m => ({
            ...m,
            estado_conciliacion: m.estado_conciliacion as 'pendiente' | 'conciliado' | 'revisado' | 'descartado'
        }))

        // 5. Parsear comprobantes (imágenes) en lotes
        console.log('[Conciliación Server] Paso 5: Parseando comprobantes con Gemini...')
        console.log(`[Conciliación Server] ${comprobantesFiles.length} comprobantes a procesar`)
        const tiempoInicioComprobantes = Date.now()
        let comprobantesParseados
        try {
            comprobantesParseados = await parsearComprobantesEnLote(comprobantesFiles)
            console.log(`[Conciliación Server] ✅ Comprobantes parseados en ${Date.now() - tiempoInicioComprobantes}ms`)
            console.log(`[Conciliación Server] ${comprobantesParseados.length} comprobantes procesados`)
            comprobantesParseados.forEach((c, i) => {
                console.log(`[Conciliación Server]   Comp ${i + 1}: ${c.archivo} - $${c.datos.monto} - DNI: ${c.datos.dni_cuit} - Error: ${c.error || 'ninguno'}`)
            })
        } catch (errorComprobantes) {
            console.error('[Conciliación Server] ❌ ERROR parseando comprobantes:', errorComprobantes)
            throw new Error(`Error al parsear comprobantes: ${errorComprobantes instanceof Error ? errorComprobantes.message : 'Error desconocido'}`)
        }

        // 6. Buscar clientes por DNI (batch) - MOVIDO ANTES DE VALIDACIÓN PARA MATCHING INTELIGENTE
        console.log('[Conciliación Server] Paso 6: Buscando clientes por DNI...')
        const dnisCuits = comprobantesParseados
            .map(c => c.datos.dni_cuit)
            .filter((d): d is string => !!d)

        console.log('[Conciliación Server] DNIs/CUITs a buscar:', dnisCuits)
        const clientesMap = await buscarClientesPorDNIBatch(dnisCuits)
        console.log('[Conciliación Server] Clientes encontrados:', clientesMap.size)
        clientesMap.forEach((cliente, dni) => {
            console.log(`[Conciliación Server]   ${dni} => ${cliente.nombre} (ID: ${cliente.id})`)
        })

        // 7. Validar comprobantes contra sábana (ahora con nombres de clientes)
        console.log('[Conciliación Server] Paso 7: Validando comprobantes contra sábana...')

        // Preparar datos para el motor, enriquecidos con nombre de cliente
        const datosComprobantes: DatosComprobante[] = comprobantesParseados.map(c => {
            const datos = c.datos
            const dniNormalizado = datos.dni_cuit?.replace(/\D/g, '') || ''
            if (dniNormalizado && clientesMap.has(dniNormalizado)) {
                const c = clientesMap.get(dniNormalizado)
                datos.nombre_cliente_identificado = c?.nombre_match_adicional || c?.nombre
            }
            return datos
        })

        console.log('[Conciliación Server] Datos de comprobantes a validar:', datosComprobantes.length)
        const resultadosValidacion = validarComprobantesContraSabana(datosComprobantes, movimientosBd)
        console.log('[Conciliación Server] Resultados de validación:')
        resultadosValidacion.forEach((r, i) => {
            console.log(`[Conciliación Server]   Resultado ${i + 1}: Estado=${r.estado}, Score=${r.confianza_score}, Monto=$${r.comprobante.monto}, Match=${r.movimiento_match?.id || 'ninguno'}`)
        })

        // Enriquecer resultados finales con objetos cliente completos
        console.log('[Conciliación Server] Enriqueciendo resultados con clientes...')
        for (const resultado of resultadosValidacion) {
            const dniNormalizado = resultado.comprobante.dni_cuit?.replace(/\D/g, '') || ''
            if (dniNormalizado && clientesMap.has(dniNormalizado)) {
                resultado.cliente = clientesMap.get(dniNormalizado)
                console.log(`[Conciliación Server]   DNI ${dniNormalizado} => Cliente asignado: ${resultado.cliente?.nombre}`)
            } else if (resultado.estado === 'validado' && !resultado.cliente) {
                // Si se validó por Referencia o Monto pero no tenemos cliente en BD
                resultado.estado = 'sin_cliente'
                console.log(`[Conciliación Server]   Validado sin cliente en BD -> Estado: sin_cliente`)
            }
        }

        // Crear un mapa de errores por nombre de archivo para evitar desincronización de índices
        const erroresPorArchivo = new Map<string, string>()
        comprobantesParseados.forEach(c => {
            if (c.error) {
                erroresPorArchivo.set(c.archivo, c.error)
            }
        })

        // 8. Guardar comprobantes en BD
        console.log('[Conciliación Server] Paso 8: Guardando comprobantes en BD...')
        const comprobantesParaDb = resultadosValidacion.map((r) => {
            const errorParseo = r.comprobante.archivo_origen ? erroresPorArchivo.get(r.comprobante.archivo_origen) : null

            return {
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
                notas: errorParseo || r.error || null,
                etiquetas: r.etiquetas || []
            }
        })
        console.log('[Conciliación Server] Comprobantes a guardar:', comprobantesParaDb.length)

        const { data: comprobantesGuardados, error: errorGuardarComp } = await supabase
            .from('comprobantes_conciliacion')
            .insert(comprobantesParaDb)
            .select('id, cliente_id, monto, referencia')

        if (errorGuardarComp) {
            console.error('[Conciliación Server] ERROR guardando comprobantes:', errorGuardarComp)
        }
        console.log('[Conciliación Server] Comprobantes guardados:', comprobantesGuardados?.length || 0)

        // 9. Acreditar saldos a clientes validados
        console.log('[Conciliación Server] Paso 9: Acreditando saldos...')
        // Usamos comprobantesParaDb porque Supabase no garantiza el orden de retorno
        const pagosParaAcreditar = (comprobantesGuardados || [])
            .map(c => {
                // Buscamos el resultado original por monto y referencia para confirmar que se puede acreditar
                const res = resultadosValidacion.find(r =>
                    r.comprobante.monto === c.monto &&
                    r.comprobante.referencia === c.referencia &&
                    r.cliente?.id === c.cliente_id
                )

                if (c.cliente_id && res?.estado === 'validado') {
                    return {
                        clienteId: c.cliente_id!,
                        monto: c.monto,
                        referencia: c.referencia || '',
                        comprobanteId: c.id
                    }
                }
                return null
            })
            .filter((p): p is NonNullable<typeof p> => p !== null)
        console.log('[Conciliación Server] Pagos a acreditar:', pagosParaAcreditar.length)
        pagosParaAcreditar.forEach((p, i) => {
            console.log(`[Conciliación Server]   Pago ${i + 1}: Cliente=${p.clienteId}, Monto=$${p.monto}, Ref=${p.referencia}`)
        })

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
        console.log('[Conciliación Server] Paso 10: Calculando resumen...')
        const resumen: ResumenConciliacion = {
            sesion_id: sesionId,
            total_comprobantes: resultadosValidacion.length,
            validados: resultadosValidacion.filter(r => r.estado === 'validado').length,
            no_encontrados: resultadosValidacion.filter(r => r.estado === 'no_encontrado').length,
            sin_cliente: resultadosValidacion.filter(r => r.estado === 'sin_cliente').length,
            errores: resultadosValidacion.filter(r => r.estado === 'error').length,
            monto_total_acreditado: resultadoAcreditacion.montoTotal || 0,
            detalles: resultadosValidacion
        }
        console.log('[Conciliación Server] Resumen calculado:')
        console.log('[Conciliación Server]   - Total comprobantes:', resumen.total_comprobantes)
        console.log('[Conciliación Server]   - Validados:', resumen.validados)
        console.log('[Conciliación Server]   - No encontrados:', resumen.no_encontrados)
        console.log('[Conciliación Server]   - Sin cliente:', resumen.sin_cliente)
        console.log('[Conciliación Server]   - Errores:', resumen.errores)
        console.log('[Conciliación Server]   - Monto acreditado:', resumen.monto_total_acreditado)

        // 11. Generar reporte PDF
        console.log('[Conciliación Server] Paso 11: Generando reporte PDF...')
        const { data: userData } = await supabase
            .from('usuarios')
            .select('nombre, email')
            .eq('id', user.id)
            .single()

        let pdfBuffer
        try {
            pdfBuffer = await generarReporteConciliacion({
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
            console.log('[Conciliación Server] ✅ Reporte PDF generado, tamaño:', pdfBuffer.length, 'bytes')
        } catch (errorPdf) {
            console.error('[Conciliación Server] ERROR generando PDF:', errorPdf)
            // Continuamos sin PDF
            pdfBuffer = null
        }

        // Subir PDF a storage
        let reporteUrl: string | undefined
        if (pdfBuffer) {
            console.log('[Conciliación Server] Subiendo PDF a Storage...')
            const nombreReporte = `conciliacion_${sesionId.slice(0, 8)}_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`
            const { data: uploadData, error: errorUpload } = await supabase
                .storage
                .from('reportes')
                .upload(`conciliacion/${nombreReporte}`, pdfBuffer, {
                    contentType: 'application/pdf'
                })

            if (errorUpload) {
                console.error('[Conciliación Server] ERROR subiendo PDF:', errorUpload)
            } else {
                reporteUrl = uploadData?.path
                    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/reportes/${uploadData.path}`
                    : undefined
                console.log('[Conciliación Server] ✅ PDF subido:', reporteUrl)
            }
        }

        resumen.reporte_url = reporteUrl

        // 12. Actualizar sesión como completada
        console.log('[Conciliación Server] Paso 12: Actualizando sesión como completada...')
        const { error: errorActualizarSesion } = await supabase
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

        if (errorActualizarSesion) {
            console.error('[Conciliación Server] ERROR actualizando sesión:', errorActualizarSesion)
        }

        console.log('[Conciliación Server] ✅ Sesión completada:', sesionId)

        revalidatePath('/tesoreria/conciliacion')
        revalidatePath('/tesoreria')

        return {
            success: true,
            sesionId,
            resumen
        }

    } catch (error) {
        console.error('[Conciliación Server] ❌ ERROR GENERAL:', error)
        console.error('[Conciliación Server] Stack:', error instanceof Error ? error.stack : 'N/A')
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
                etiquetas,
                cliente:clientes(id, nombre, cuit),
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
    clienteId: string | null,
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

        // Acreditar si corresponde Y si hay cliente
        if (clienteId && acreditar && !comprobante.acreditado) {
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
        // Usar timezone de Argentina para comparaciones de "hoy"
        const hoy = getTodayArgentina()

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
