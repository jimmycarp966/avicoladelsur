'use server'

/**
 * Actions mejoradas de conciliación con:
 * - Deduplicación de comprobantes por hash
 * - Validación cruzada de montos
 * - Procesamiento async para archivos grandes
 * - IA secundaria para matches dudosos
 */

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
import { parsearSabanaBancariaConReintentos, parsearComprobantesEnLote } from '@/lib/conciliacion/parsers'
import { validarComprobantesContraSabana } from '@/lib/conciliacion/motor-conciliacion'
import { buscarClientesPorDNIBatch } from '@/lib/conciliacion/cliente-lookup'
import { acreditarPagosBatch } from '@/lib/conciliacion/acreditacion'
import { generarReporteConciliacion } from '@/lib/conciliacion/reporte-conciliacion'
import { calcularHashesBatch, calcularHashArchivo } from '@/lib/conciliacion/file-hash'
import { validarMontosCruzados, detectarDuplicadosProbables, AlertaValidacion } from '@/lib/conciliacion/validacion-montos'
import { crearJobProcesamiento, actualizarProgresoJob, obtenerEstadoJob, tieneJobsActivos } from '@/lib/conciliacion/procesamiento-async'
import { format } from 'date-fns'

// Límite de tamaño para procesamiento síncrono (10 MB)
const LIMITE_SINCRONO_MB = 10
const LIMITE_SINCRONO_BYTES = LIMITE_SINCRONO_MB * 1024 * 1024

// ===========================================
// ACTION PRINCIPAL MEJORADA
// ===========================================

export async function procesarConciliacionMejoradaAction(formData: FormData): Promise<{
    success: boolean
    sesionId?: string
    resumen?: ResumenConciliacion
    jobId?: string
    requiereAsync?: boolean
    alertas?: AlertaValidacion[]
    duplicadosDetectados?: Array<{ comprobante1: number; comprobante2: number; razon: string }>
    error?: string
}> {
    console.log('[Conciliación Mejorada] ========== INICIO ==========')

    const supabase = await createClient()

    try {
        // 1. Autenticación
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return { success: false, error: 'Usuario no autenticado' }
        }

        // 2. Obtener archivos
        const sabanaPdf = formData.get('sabana') as File | null
        const comprobantesFiles = formData.getAll('comprobantes') as File[]

        if (!sabanaPdf || comprobantesFiles.length === 0) {
            return { success: false, error: 'Debe subir la sábana y al menos un comprobante' }
        }

        // 3. Verificar si ya hay jobs activos para este usuario
        const tieneJobs = await tieneJobsActivos(user.id)
        if (tieneJobs) {
            return { 
                success: false, 
                error: 'Ya tienes una conciliación en proceso. Por favor espera a que termine o cancela la anterior.' 
            }
        }

        // 4. Calcular tamaño total
        const sizeTotal = sabanaPdf.size + comprobantesFiles.reduce((acc, f) => acc + f.size, 0)
        console.log(`[Conciliación Mejorada] Tamaño total: ${(sizeTotal / 1024 / 1024).toFixed(2)} MB`)

        // 5. Si es muy grande, usar procesamiento async
        if (sizeTotal > LIMITE_SINCRONO_BYTES) {
            console.log('[Conciliación Mejorada] Archivo grande, usando procesamiento async')
            
            // Subir archivos a storage temporal (implementación simplificada)
            // En producción, deberías subir los archivos a un bucket temporal
            
            const { jobId, error } = await crearJobProcesamiento(
                sabanaPdf.name,
                comprobantesFiles.length,
                user.id
            )

            if (error) {
                return { success: false, error: `Error creando job: ${error}` }
            }

            // Iniciar procesamiento en background (en producción, esto sería un webhook o cron)
            // Por ahora, procesamos async pero retornamos inmediatamente
            procesarEnBackground(jobId, formData, user.id).catch(console.error)

            return {
                success: true,
                jobId,
                requiereAsync: true,
                alertas: [{
                    tipo: 'info',
                    codigo: 'PROCESAMIENTO_ASYNC',
                    mensaje: `El archivo es grande (${(sizeTotal / 1024 / 1024).toFixed(1)} MB). El procesamiento se realizará en segundo plano. Puedes revisar el progreso más tarde.`
                }]
            }
        }

        // 6. Procesamiento síncrono (archivos pequeños)
        return await procesarConciliacionCompleta(sabanaPdf, comprobantesFiles, user.id, supabase)

    } catch (error) {
        console.error('[Conciliación Mejorada] ERROR:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido'
        }
    }
}

// ===========================================
// PROCESAMIENTO COMPLETO (SÍNCRONO)
// ===========================================

async function procesarConciliacionCompleta(
    sabanaPdf: File,
    comprobantesFiles: File[],
    userId: string,
    supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{
    success: boolean
    sesionId?: string
    resumen?: ResumenConciliacion
    alertas?: AlertaValidacion[]
    duplicadosDetectados?: Array<{ comprobante1: number; comprobante2: number; razon: string }>
    error?: string
}> {
    console.log('[Procesamiento Completo] Iniciando procesamiento síncrono...')

    // 1. DEDUPLICACIÓN: Calcular hashes y verificar duplicados
    console.log('[Procesamiento Completo] Paso 1: Verificando duplicados por hash...')
    const hashesComprobantes = await calcularHashesBatch(comprobantesFiles)
    
    // Verificar contra hashes existentes en BD
    const hashesArray = hashesComprobantes.map(h => h.hash)
    const { data: hashesExistentes } = await supabase
        .from('comprobantes_hashes')
        .select('hash_sha256, nombre_archivo, sesion_id')
        .in('hash_sha256', hashesArray)

    if (hashesExistentes && hashesExistentes.length > 0) {
        const nombresDuplicados = hashesExistentes.map(h => h.nombre_archivo).join(', ')
        return {
            success: false,
            error: `Los siguientes comprobantes ya fueron procesados anteriormente: ${nombresDuplicados}. No se permite duplicar comprobantes.`
        }
    }

    // Detectar duplicados dentro del lote actual
    const duplicadosEnLote = detectarDuplicadosPorHash(hashesComprobantes)
    if (duplicadosEnLote.length > 0) {
        const indicesDuplicados = new Set<number>()
        duplicadosEnLote.forEach(d => {
            indicesDuplicados.add(d.index1)
            indicesDuplicados.add(d.index2)
        })
        
        // Filtrar duplicados
        const archivosUnicos = comprobantesFiles.filter((_, i) => !indicesDuplicados.has(i))
        console.log(`[Procesamiento Completo] Filtrados ${duplicadosEnLote.length} duplicados del lote`)
        
        if (archivosUnicos.length === 0) {
            return {
                success: false,
                error: 'Todos los comprobantes subidos son duplicados (mismo archivo).'
            }
        }
        
        // Continuar con archivos únicos
        comprobantesFiles = archivosUnicos
    }

    // 2. Crear sesión
    const { data: sesion, error: errorSesion } = await supabase
        .from('sesiones_conciliacion')
        .insert({
            sabana_archivo: sabanaPdf.name,
            total_comprobantes: comprobantesFiles.length,
            usuario_id: userId,
            estado: 'en_proceso'
        })
        .select('id')
        .single()

    if (errorSesion || !sesion) {
        return { success: false, error: 'Error al crear sesión de conciliación' }
    }

    const sesionId = sesion.id

    // 3. Guardar hashes de comprobantes
    await guardarHashesComprobantes(hashesComprobantes, sesionId, userId, supabase)

    // 4. Parsear sábana (con reintentos)
    console.log('[Procesamiento Completo] Paso 2: Parseando sábana bancaria...')
    let movimientosSabana
    try {
        movimientosSabana = await parsearSabanaBancariaConReintentos(sabanaPdf)
    } catch (error) {
        await supabase.from('sesiones_conciliacion').update({ estado: 'con_errores' }).eq('id', sesionId)
        return { success: false, error: `Error al parsear sábana: ${error instanceof Error ? error.message : 'Error desconocido'}` }
    }

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

    const movimientosBd: MovimientoBancario[] = (movimientosGuardados || []).map(m => ({
        ...m,
        estado_conciliacion: m.estado_conciliacion as 'pendiente' | 'conciliado' | 'revisado' | 'descartado'
    }))

    // 5. Parsear comprobantes (con reintentos automáticos)
    console.log('[Procesamiento Completo] Paso 3: Parseando comprobantes...')
    const comprobantesParseados = await parsearComprobantesEnLote(comprobantesFiles)

    // 6. Buscar clientes por DNI
    console.log('[Procesamiento Completo] Paso 4: Buscando clientes...')
    const dnisCuits = comprobantesParseados
        .map(c => c.datos.dni_cuit)
        .filter((d): d is string => !!d)
    const clientesMap = await buscarClientesPorDNIBatch(dnisCuits)

    // 7. VALIDACIÓN CRUZADA DE MONTOS
    console.log('[Procesamiento Completo] Paso 5: Validación cruzada de montos...')
    const datosComprobantes = comprobantesParseados.map(c => {
        const datos = c.datos
        const dniNormalizado = datos.dni_cuit?.replace(/\D/g, '') || ''
        if (dniNormalizado && clientesMap.has(dniNormalizado)) {
            const cliente = clientesMap.get(dniNormalizado)
            datos.nombre_cliente_identificado = cliente?.nombre_match_adicional || cliente?.nombre
        }
        return datos
    })

    const validacionMontos = validarMontosCruzados(datosComprobantes, movimientosBd, [])
    const duplicadosProbables = detectarDuplicadosProbables(datosComprobantes)

    // Si hay errores críticos, guardar alertas y retornar
    if (!validacionMontos.esValido) {
        await guardarAlertas(sesionId, validacionMontos.alertas, supabase)
        await supabase.from('sesiones_conciliacion').update({ estado: 'con_errores' }).eq('id', sesionId)
        
        return {
            success: false,
            sesionId,
            alertas: validacionMontos.alertas,
            duplicadosDetectados: duplicadosProbables,
            error: 'Se detectaron errores en la validación de montos. Revise las alertas.'
        }
    }

    // 8. Validar comprobantes contra sábana (ahora con IA secundaria)
    console.log('[Procesamiento Completo] Paso 6: Validando comprobantes contra sábana (con IA secundaria)...')
    const resultadosValidacion = await validarComprobantesContraSabana(datosComprobantes, movimientosBd)

    // 9. Enriquecer resultados con clientes
    for (const resultado of resultadosValidacion) {
        const dniNormalizado = resultado.comprobante.dni_cuit?.replace(/\D/g, '') || ''
        if (dniNormalizado && clientesMap.has(dniNormalizado)) {
            resultado.cliente = clientesMap.get(dniNormalizado)
        } else if (resultado.estado === 'validado' && !resultado.cliente) {
            resultado.estado = 'sin_cliente'
        }
    }

    // 10. Guardar comprobantes en BD
    const erroresPorArchivo = new Map<string, string>()
    comprobantesParseados.forEach(c => {
        if (c.error) erroresPorArchivo.set(c.archivo, c.error)
    })

    const comprobantesParaDb = resultadosValidacion.map((r, idx) => ({
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
        notas: r.comprobante.archivo_origen ? erroresPorArchivo.get(r.comprobante.archivo_origen) || null : null,
        etiquetas: r.etiquetas || [],
        hash_archivo: hashesComprobantes[idx]?.hash || null,
        metadata_validacion: { detalles: r.detalles }
    }))

    const { data: comprobantesGuardados } = await supabase
        .from('comprobantes_conciliacion')
        .insert(comprobantesParaDb)
        .select('id, cliente_id, monto, referencia')

    // 11. Acreditar saldos
    const pagosParaAcreditar = (comprobantesGuardados || [])
        .map(c => {
            const res = resultadosValidacion.find(r =>
                r.comprobante.monto === c.monto &&
                r.comprobante.referencia === c.referencia &&
                r.cliente?.id === c.cliente_id
            )
            if (c.cliente_id && res?.estado === 'validado') {
                return {
                    clienteId: c.cliente_id,
                    monto: c.monto,
                    referencia: c.referencia || '',
                    comprobanteId: c.id
                }
            }
            return null
        })
        .filter((p): p is NonNullable<typeof p> => p !== null)

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

        for (const resultado of resultadosValidacion) {
            if (resultado.cliente && resultado.estado === 'validado') {
                resultado.acreditado = true
            }
        }
    }

    // 12. Guardar alertas de validación
    await guardarAlertas(sesionId, validacionMontos.alertas, supabase)

    // 13. Generar reporte PDF
    const { data: userData } = await supabase
        .from('usuarios')
        .select('nombre, email')
        .eq('id', userId)
        .single()

    let reporteUrl: string | undefined
    try {
        const pdfBuffer = await generarReporteConciliacion({
            sesionId,
            fecha: new Date(),
            usuarioNombre: userData?.nombre || userData?.email || 'Usuario',
            sabanaArchivo: sabanaPdf.name,
            resultados: resultadosValidacion,
            resumen: {
                totalComprobantes: resultadosValidacion.length,
                validados: resultadosValidacion.filter(r => r.estado === 'validado').length,
                noEncontrados: resultadosValidacion.filter(r => r.estado === 'no_encontrado').length,
                sinCliente: resultadosValidacion.filter(r => r.estado === 'sin_cliente').length,
                errores: resultadosValidacion.filter(r => r.estado === 'error').length,
                montoTotalAcreditado: resultadoAcreditacion.montoTotal
            }
        })

        const nombreReporte = `conciliacion_${sesionId.slice(0, 8)}_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`
        const { data: uploadData } = await supabase
            .storage
            .from('reportes')
            .upload(`conciliacion/${nombreReporte}`, pdfBuffer, { contentType: 'application/pdf' })

        if (uploadData?.path) {
            reporteUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/reportes/${uploadData.path}`
        }
    } catch (error) {
        console.error('[Procesamiento Completo] Error generando PDF:', error)
    }

    // 14. Actualizar sesión
    const resumen: ResumenConciliacion = {
        sesion_id: sesionId,
        total_comprobantes: resultadosValidacion.length,
        validados: resultadosValidacion.filter(r => r.estado === 'validado').length,
        no_encontrados: resultadosValidacion.filter(r => r.estado === 'no_encontrado').length,
        sin_cliente: resultadosValidacion.filter(r => r.estado === 'sin_cliente').length,
        errores: resultadosValidacion.filter(r => r.estado === 'error').length,
        monto_total_acreditado: resultadoAcreditacion.montoTotal,
        detalles: resultadosValidacion,
        reporte_url: reporteUrl
    }

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

    revalidatePath('/tesoreria/conciliacion')

    return {
        success: true,
        sesionId,
        resumen,
        alertas: validacionMontos.alertas,
        duplicadosDetectados: duplicadosProbables
    }
}

// ===========================================
// PROCESAMIENTO EN BACKGROUND (ASYNC)
// ===========================================

async function procesarEnBackground(
    jobId: string,
    formData: FormData,
    userId: string
): Promise<void> {
    console.log(`[Background] Iniciando procesamiento del job ${jobId}`)

    const supabase = await createClient()

    try {
        await actualizarProgresoJob(jobId, { estado: 'procesando', progresoPorcentaje: 5 })

        const sabanaPdf = formData.get('sabana') as File
        const comprobantesFiles = formData.getAll('comprobantes') as File[]

        // Procesar normalmente
        const resultado = await procesarConciliacionCompleta(sabanaPdf, comprobantesFiles, userId, supabase)

        if (resultado.success) {
            await actualizarProgresoJob(jobId, {
                estado: 'completado',
                progresoPorcentaje: 100,
                sesionId: resultado.sesionId,
                resultadoResumen: resultado.resumen ? {
                    validados: resultado.resumen.validados,
                    no_encontrados: resultado.resumen.no_encontrados,
                    sin_cliente: resultado.resumen.sin_cliente,
                    monto_total_acreditado: resultado.resumen.monto_total_acreditado
                } : undefined
            })
        } else {
            await actualizarProgresoJob(jobId, {
                estado: 'error',
                errorMensaje: resultado.error || 'Error desconocido'
            })
        }
    } catch (error) {
        console.error(`[Background] Error en job ${jobId}:`, error)
        await actualizarProgresoJob(jobId, {
            estado: 'error',
            errorMensaje: error instanceof Error ? error.message : 'Error desconocido'
        })
    }
}

// ===========================================
// FUNCIONES AUXILIARES
// ===========================================

function detectarDuplicadosPorHash(
    hashes: { file: File; hash: string }[]
): Array<{ index1: number; index2: number; hash: string }> {
    const duplicados: Array<{ index1: number; index2: number; hash: string }> = []
    const vistos = new Map<string, number>()

    hashes.forEach((h, index) => {
        if (vistos.has(h.hash)) {
            duplicados.push({
                index1: vistos.get(h.hash)!,
                index2: index,
                hash: h.hash
            })
        } else {
            vistos.set(h.hash, index)
        }
    })

    return duplicados
}

async function guardarHashesComprobantes(
    hashes: { file: File; hash: string }[],
    sesionId: string,
    userId: string,
    supabase: Awaited<ReturnType<typeof createClient>>
): Promise<void> {
    const hashesParaDb = hashes.map(h => ({
        hash_sha256: h.hash,
        sesion_id: sesionId,
        nombre_archivo: h.file.name,
        usuario_id: userId
    }))

    await supabase.from('comprobantes_hashes').insert(hashesParaDb)
}

async function guardarAlertas(
    sesionId: string,
    alertas: AlertaValidacion[],
    supabase: Awaited<ReturnType<typeof createClient>>
): Promise<void> {
    if (alertas.length === 0) return

    const alertasParaDb = alertas.map(a => ({
        sesion_id: sesionId,
        tipo: a.tipo,
        codigo: a.codigo,
        mensaje: a.mensaje,
        detalles: a.detalles || {}
    }))

    await supabase.from('conciliacion_alertas').insert(alertasParaDb)
}

// ===========================================
// ACTIONS ADICIONALES
// ===========================================

export async function obtenerEstadoJobAction(jobId: string): Promise<{
    success: boolean
    job?: {
        estado: string
        progreso: number
        error?: string
        sesionId?: string
        resultado?: ResumenConciliacion
    }
    error?: string
}> {
    const resultado = await obtenerEstadoJob(jobId)
    
    if (resultado.error) {
        return { success: false, error: resultado.error }
    }

    const job = resultado.job
    if (!job) {
        return { success: false, error: 'Job no encontrado' }
    }

    return {
        success: true,
        job: {
            estado: job.estado,
            progreso: job.progreso_porcentaje,
            error: job.error_mensaje,
            sesionId: job.sesion_id,
            resultado: job.resultado_resumen as unknown as ResumenConciliacion
        }
    }
}

export async function cancelarJobAction(jobId: string): Promise<{
    success: boolean
    error?: string
}> {
    const supabase = await createClient()
    
    const { error } = await supabase
        .from('conciliacion_jobs')
        .update({ estado: 'cancelado' })
        .eq('id', jobId)
        .eq('estado', 'pendiente')

    if (error) {
        return { success: false, error: error.message }
    }

    return { success: true }
}
