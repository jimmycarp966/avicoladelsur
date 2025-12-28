/**
 * POST /api/ia/auditar-cobros
 * 
 * Endpoint que analiza cobros recientes de sucursales en busca de anomalías.
 * No muestra nada a cajeros, solo genera notificaciones para administradores.
 * 
 * Puede ser llamado por:
 * - Un cron job (Vercel Cron / GitHub Actions)
 * - Un webhook de Supabase cuando se inserta un cobro
 * - Manualmente desde el dashboard de admin
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '')

interface AnomaliaDetectada {
    cobroId: string
    tipo: 'descuento_excesivo' | 'monto_inusual' | 'frecuencia_alta' | 'patron_sospechoso' | 'horario_inusual'
    severidad: 'alto' | 'medio' | 'bajo'
    descripcion: string
    monto: number
    usuario: string
    sucursal: string
    sugerencia?: string
}

interface AuditarCobrosResponse {
    success: boolean
    cobrosAnalizados: number
    anomaliasDetectadas: AnomaliaDetectada[]
    notificacionesCreadas: number
    error?: string
}

export async function POST(request: NextRequest): Promise<NextResponse<AuditarCobrosResponse>> {
    try {
        const supabase = await createClient()

        // Obtener parámetros opcionales
        let horasAtras = 24 // Por defecto últimas 24 horas
        try {
            const body = await request.json()
            if (body.horasAtras) horasAtras = body.horasAtras
        } catch {
            // Body vacío es OK
        }

        const fechaDesde = new Date()
        fechaDesde.setHours(fechaDesde.getHours() - horasAtras)

        // Obtener cobros recientes de todas las sucursales
        const { data: cobros, error: cobrosError } = await supabase
            .from('movimientos_caja')
            .select(`
        id,
        monto,
        tipo,
        descripcion,
        created_at,
        usuario_id,
        caja_id,
        metodo_pago,
        usuarios:usuario_id (nombre, apellido),
        cajas:caja_id (
          nombre,
          sucursal_id,
          sucursales:sucursal_id (nombre)
        )
      `)
            .eq('tipo', 'ingreso')
            .gte('created_at', fechaDesde.toISOString())
            .order('created_at', { ascending: false })
            .limit(500)

        if (cobrosError) throw cobrosError

        const anomalias: AnomaliaDetectada[] = []

        // Obtener promedios históricos por usuario para comparación
        const { data: promediosUsuario, error: promediosError } = await supabase
            .rpc('fn_promedios_cobros_por_usuario')

        // Si no existe la función RPC, calcular manualmente
        const promediosPorUsuario: Record<string, { promedio: number; max: number; count: number }> = {}

        if (!promediosError && promediosUsuario) {
            for (const p of promediosUsuario) {
                promediosPorUsuario[p.usuario_id] = {
                    promedio: p.promedio_monto,
                    max: p.max_monto,
                    count: p.cantidad_cobros
                }
            }
        }

        // Analizar cada cobro
        for (const cobro of cobros || []) {
            const usuarioNombre = `${(cobro.usuarios as any)?.nombre || ''} ${(cobro.usuarios as any)?.apellido || ''}`.trim() || 'Desconocido'
            const sucursalNombre = (cobro.cajas as any)?.sucursales?.nombre || 'Central'
            const monto = Number(cobro.monto || 0)

            // Regla 1: Monto significativamente mayor al promedio del usuario
            const stats = promediosPorUsuario[cobro.usuario_id]
            if (stats && monto > stats.promedio * 3 && monto > 50000) {
                anomalias.push({
                    cobroId: cobro.id,
                    tipo: 'monto_inusual',
                    severidad: monto > stats.max * 1.5 ? 'alto' : 'medio',
                    descripcion: `Cobro de $${monto.toLocaleString()} es ${(monto / stats.promedio).toFixed(1)}x mayor al promedio del usuario ($${stats.promedio.toLocaleString()})`,
                    monto,
                    usuario: usuarioNombre,
                    sucursal: sucursalNombre,
                })
            }

            // Regla 2: Cobros en horario inusual (antes 6am o después 10pm)
            const hora = new Date(cobro.created_at).getHours()
            if (hora < 6 || hora >= 22) {
                anomalias.push({
                    cobroId: cobro.id,
                    tipo: 'horario_inusual',
                    severidad: 'medio',
                    descripcion: `Cobro realizado a las ${hora}:${new Date(cobro.created_at).getMinutes().toString().padStart(2, '0')} (fuera de horario habitual)`,
                    monto,
                    usuario: usuarioNombre,
                    sucursal: sucursalNombre,
                })
            }

            // Regla 3: Montos redondos sospechosos (múltiplos exactos de 10000)
            if (monto >= 10000 && monto % 10000 === 0 && monto <= 100000) {
                // Solo marcar si es muy frecuente (buscar patrones)
                const cobrosRedondosUsuario = (cobros || []).filter(
                    (c: any) => c.usuario_id === cobro.usuario_id &&
                        Number(c.monto) % 10000 === 0 &&
                        Number(c.monto) >= 10000
                )

                if (cobrosRedondosUsuario.length >= 3) {
                    anomalias.push({
                        cobroId: cobro.id,
                        tipo: 'patron_sospechoso',
                        severidad: 'bajo',
                        descripcion: `Usuario tiene ${cobrosRedondosUsuario.length} cobros de montos redondos ($${monto.toLocaleString()})`,
                        monto,
                        usuario: usuarioNombre,
                        sucursal: sucursalNombre,
                    })
                }
            }
        }

        // Regla 4: Frecuencia alta - muchos cobros en poco tiempo por mismo usuario
        const cobrosPorUsuario: Record<string, any[]> = {}
        for (const cobro of cobros || []) {
            if (!cobrosPorUsuario[cobro.usuario_id]) {
                cobrosPorUsuario[cobro.usuario_id] = []
            }
            cobrosPorUsuario[cobro.usuario_id].push(cobro)
        }

        for (const [usuarioId, cobrosList] of Object.entries(cobrosPorUsuario)) {
            // Más de 20 cobros en una hora
            const unaHoraAtras = new Date(Date.now() - 60 * 60 * 1000)
            const cobrosUltimaHora = cobrosList.filter(
                (c: any) => new Date(c.created_at) > unaHoraAtras
            )

            if (cobrosUltimaHora.length > 20) {
                const usuarioNombre = `${(cobrosUltimaHora[0].usuarios as any)?.nombre || ''} ${(cobrosUltimaHora[0].usuarios as any)?.apellido || ''}`.trim()
                const sucursalNombre = (cobrosUltimaHora[0].cajas as any)?.sucursales?.nombre || 'Central'

                anomalias.push({
                    cobroId: cobrosUltimaHora[0].id,
                    tipo: 'frecuencia_alta',
                    severidad: 'medio',
                    descripcion: `${cobrosUltimaHora.length} cobros en la última hora (inusualmente alto)`,
                    monto: cobrosUltimaHora.reduce((sum: number, c: any) => sum + Number(c.monto), 0),
                    usuario: usuarioNombre,
                    sucursal: sucursalNombre,
                })
            }
        }

        // Eliminar duplicados (mismo cobro puede tener múltiples anomalías)
        const anomaliasUnicas = anomalias.filter(
            (a, index, self) => index === self.findIndex((t) => t.cobroId === a.cobroId && t.tipo === a.tipo)
        )

        // Crear notificaciones para administradores
        let notificacionesCreadas = 0

        for (const anomalia of anomaliasUnicas) {
            // Solo notificar anomalías de severidad media o alta
            if (anomalia.severidad === 'bajo') continue

            const { error: notifError } = await supabase
                .from('notificaciones')
                .insert({
                    titulo: `⚠️ Anomalía detectada: ${anomalia.tipo.replace('_', ' ')}`,
                    mensaje: `${anomalia.descripcion}. Usuario: ${anomalia.usuario}. Sucursal: ${anomalia.sucursal}. Monto: $${anomalia.monto.toLocaleString()}`,
                    tipo: anomalia.severidad === 'alto' ? 'error' : 'warning',
                    categoria: 'tesoreria',
                    metadata: {
                        cobroId: anomalia.cobroId,
                        tipoAnomalia: anomalia.tipo,
                        severidad: anomalia.severidad,
                        usuario: anomalia.usuario,
                        sucursal: anomalia.sucursal,
                        monto: anomalia.monto,
                    },
                    // usuario_id null = notificación global para admins
                    usuario_id: null,
                })

            if (!notifError) notificacionesCreadas++
        }

        return NextResponse.json({
            success: true,
            cobrosAnalizados: (cobros || []).length,
            anomaliasDetectadas: anomaliasUnicas,
            notificacionesCreadas,
        })
    } catch (error) {
        console.error('[IA] Error en auditar-cobros:', error)
        return NextResponse.json({
            success: false,
            cobrosAnalizados: 0,
            anomaliasDetectadas: [],
            notificacionesCreadas: 0,
            error: 'Error al auditar cobros',
        })
    }
}

// GET para permitir llamadas desde cron jobs
export async function GET(request: NextRequest) {
    // Verificar token de cron si está configurado
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Redirigir a POST con parámetros por defecto
    return POST(request)
}
