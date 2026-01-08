'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { devError } from '@/lib/utils/logger'
import { MovimientoBancarioInput, MovimientoBancarioSchema, ConciliacionManualSchema, MovimientoBancario, PagoEsperado } from '@/types/conciliacion'
import { encontrarMejorMatch, UMBRAL_AUTOCONCILIACION } from '@/lib/conciliacion/motor-conciliacion'
import { analizarMatchConGemini } from '@/lib/conciliacion/gemini-matcher'

// ===========================================
// SCHEMAS
// ===========================================

const ImportarMovimientosSchema = z.array(MovimientoBancarioSchema.extend({
    cuenta_bancaria_id: z.string().uuid(),
    archivo_origen: z.string().optional()
}))

// ===========================================
// ACTIONS
// ===========================================

import { parsearArchivo } from '@/lib/conciliacion/parsers'

export async function procesarArchivoAction(formData: FormData) {
    try {
        const file = formData.get('archivo') as File
        const tipo = formData.get('tipo') as 'csv' | 'excel' | 'pdf' | 'imagen'

        if (!file) throw new Error('No se subió ningún archivo')

        // Parsear en servidor (en memoria)
        const movimientos = await parsearArchivo(file, tipo)

        return { success: true, movimientos }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

/**
 * Sincroniza los pedidos pendientes de pago con la tabla pagos_esperados.
 * Se debería llamar periódicamente o antes de conciliar.
 */
export async function sincronizarPagosEsperadosAction() {
    try {
        const supabase = await createClient()

        // 1. Obtener pedidos no pagados
        // Se asume que 'pago_estado' existe en pedidos basado en tesoreria.actions.ts
        // Y que estado no es cancelado
        const { data: pedidos, error } = await supabase
            .from('pedidos')
            .select('id, cliente_id, total, numero_pedido, fecha_pedido, clientes(cuit)')
            .neq('estado', 'cancelado')
            .neq('pago_estado', 'pagado')

        if (error) throw error
        if (!pedidos) return { success: true, count: 0 }

        let count = 0

        // 2. Insertar o actualizar en pagos_esperados
        // Usamos upsert basado en pedido_id
        for (const pedido of pedidos) {
            // Verificar si ya existe y está conciliado
            const { data: existente } = await supabase
                .from('pagos_esperados')
                .select('id, estado')
                .eq('pedido_id', pedido.id)
                .single()

            if (existente && existente.estado === 'conciliado') continue

            const pagoEsperado = {
                pedido_id: pedido.id,
                cliente_id: pedido.cliente_id,
                monto_esperado: pedido.total,
                fecha_esperada: pedido.fecha_pedido, // Asumimos fecha pedido como esperada o +X dias
                referencia: `Pedido #${pedido.numero_pedido}`,
                dni_cuit: pedido.clientes?.cuit, // Join con clientes
                estado: 'pendiente',
                origen: 'pedido'
            }

            const { error: upsertError } = await supabase
                .from('pagos_esperados')
                .upsert(pagoEsperado, { onConflict: 'pedido_id' })

            if (!upsertError) count++
        }

        return { success: true, count }

    } catch (error: any) {
        devError('Error en sincronizarPagosEsperados:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Importa movimientos bancarios y ejecuta la conciliación automática.
 */
export async function importarMovimientosAction(data: z.infer<typeof ImportarMovimientosSchema>) {
    try {
        const supabase = await createClient()
        const { data: user } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'No autenticado' }

        // Validar input
        const movimientos = ImportarMovimientosSchema.parse(data)

        // Insertar movimientos
        const { data: inserted, error } = await supabase
            .from('movimientos_bancarios')
            .insert(movimientos)
            .select()

        if (error) throw error

        // Ejecutar sincronización de pagos antes de conciliar
        await sincronizarPagosEsperadosAction()

        // Ejecutar motor de conciliación para los nuevos
        const resultados = await procesarConciliacionAutomatica(inserted as MovimientoBancario[])

        revalidatePath('/tesoreria/conciliacion')

        return {
            success: true,
            count: inserted.length,
            conciliados: resultados.filter(r => r.auto).length
        }

    } catch (error: any) {
        devError('Error en importarMovimientos:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Ejecuta el motor de conciliación para una lista de movimientos.
 */
async function procesarConciliacionAutomatica(movimientos: MovimientoBancario[]) {
    const supabase = await createClient()
    const resultados = []

    // Obtener todos los pagos esperados pendientes
    // Idealmente filtrar por fecha cercana si son muchos
    const { data: pagosCandidatos } = await supabase
        .from('pagos_esperados')
        .select('*, cliente:clientes(nombre, cuit)')
        .eq('estado', 'pendiente')

    if (!pagosCandidatos) return []

    for (const mov of movimientos) {
        const match = encontrarMejorMatch(mov, pagosCandidatos as any)

        if (match && match.score >= UMBRAL_AUTOCONCILIACION) {
            // Crear conciliación
            await supabase.from('conciliaciones').insert({
                movimiento_bancario_id: mov.id,
                pago_esperado_id: match.pagoId,
                monto_conciliado: mov.monto,
                diferencia: mov.monto - (pagosCandidatos.find(p => p.id === match.pagoId)?.monto_esperado || 0),
                tipo_match: 'automatico',
                confianza_score: match.score,
                notas: `Auto-conciliado por reglas: ${match.etiquetas.join(', ')}`
            })

            // Actualizar estados
            await supabase.from('movimientos_bancarios').update({ estado_conciliacion: 'conciliado' }).eq('id', mov.id)
            await supabase.from('pagos_esperados').update({ estado: 'conciliado' }).eq('id', match.pagoId)

            resultados.push({ id: mov.id, auto: true })
        } else {
            resultados.push({ id: mov.id, auto: false })
        }
    }

    return resultados
}

/**
 * Obtener sugerencias (Reglas + IA opcional) para un movimiento específico.
 */
export async function obtenerSugerenciasAction(movimientoId: string, usarIA: boolean = false) {
    try {
        const supabase = await createClient()

        // Obtener movimiento
        const { data: mov } = await supabase
            .from('movimientos_bancarios')
            .select('*')
            .eq('id', movimientoId)
            .single()

        if (!mov) throw new Error('Movimiento no encontrado')

        // Obtener candidatos
        const { data: pagos } = await supabase
            .from('pagos_esperados')
            .select('*, cliente:clientes(nombre, cuit), pedido:pedidos(numero_pedido, total)')
            .eq('estado', 'pendiente')
        // Filtrar +- 15 si es necesario, por ahora traemos todo lo pendiente

        if (!pagos) return { success: true, sugerencias: [] }

        // 1. Probar motor reglas
        const matchReglas = encontrarMejorMatch(mov as any, pagos as any)

        // Si el match de reglas es bajo y se pide IA
        let sugerenciaIA = null
        if (usarIA && (!matchReglas || matchReglas.score < 50)) {
            const resultadoGemini = await analizarMatchConGemini(mov as any, pagos as any)
            if (resultadoGemini.match_id) {
                const pagoIA = pagos.find(p => p.id === resultadoGemini.match_id)
                if (pagoIA) {
                    sugerenciaIA = {
                        pago: pagoIA,
                        score: resultadoGemini.confianza * 100,
                        razon: resultadoGemini.razon,
                        tipo: 'ia'
                    }
                }
            }
        }

        return {
            success: true,
            movimiento: mov,
            matchReglas: matchReglas ? {
                ...matchReglas,
                pago: pagos.find(p => p.id === matchReglas.pagoId)
            } : null,
            matchIA: sugerenciaIA
        }

    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

/**
 * Conciliación Manual
 */
export async function crearConciliacionManualAction(data: z.infer<typeof ConciliacionManualSchema>) {
    try {
        const supabase = await createClient()
        const { data: user } = await supabase.auth.getUser()

        // Validar
        const { movimientoBancarioId, pagoEsperadoId, notas } = ConciliacionManualSchema.parse(data)

        // Verificar montos para calcular diferencia
        const { data: mov } = await supabase.from('movimientos_bancarios').select('monto').eq('id', movimientoBancarioId).single()
        const { data: pago } = await supabase.from('pagos_esperados').select('monto_esperado').eq('id', pagoEsperadoId).single()

        if (!mov || !pago) throw new Error('Datos no encontrados')

        const diferencia = mov.monto - pago.monto_esperado

        // Transacción (simulada con llamadas secuenciales)
        const { error } = await supabase.from('conciliaciones').insert({
            movimiento_bancario_id: movimientoBancarioId,
            pago_esperado_id: pagoEsperadoId,
            monto_conciliado: mov.monto,
            diferencia,
            tipo_match: 'manual',
            confianza_score: 100,
            conciliado_por: user.user?.id,
            notas
        })

        if (error) throw error

        await supabase.from('movimientos_bancarios').update({ estado_conciliacion: 'conciliado' }).eq('id', movimientoBancarioId)
        await supabase.from('pagos_esperados').update({ estado: 'conciliado' }).eq('id', pagoEsperadoId)

        revalidatePath('/tesoreria/conciliacion')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function descartarMovimientoAction(movimientoId: string) {
    try {
        const supabase = await createClient()
        await supabase.from('movimientos_bancarios')
            .update({ estado_conciliacion: 'descartado' })
            .eq('id', movimientoId)

        revalidatePath('/tesoreria/conciliacion')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
