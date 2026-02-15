/**
 * POST /api/ia/auditar-cobros
 * Auditoria de cobros basada en reglas (sin IA generativa).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAIMetadata } from '@/lib/ai/metadata'
import { logAIUsage } from '@/lib/ai/logger'
import type { AIMetadata } from '@/types/ai.types'

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
  ai: AIMetadata
}

export async function POST(request: NextRequest): Promise<NextResponse<AuditarCobrosResponse>> {
  const startedAt = Date.now()

  try {
    const supabase = await createClient()

    let horasAtras = 24
    try {
      const body = await request.json()
      if (body.horasAtras) horasAtras = body.horasAtras
    } catch {
      // Body vacio es valido.
    }

    const fechaDesde = new Date()
    fechaDesde.setHours(fechaDesde.getHours() - horasAtras)

    const { data: cobros, error: cobrosError } = await supabase
      .from('movimientos_caja')
      .select(
        `
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
      `
      )
      .eq('tipo', 'ingreso')
      .gte('created_at', fechaDesde.toISOString())
      .order('created_at', { ascending: false })
      .limit(500)

    if (cobrosError) throw cobrosError

    const anomalias: AnomaliaDetectada[] = []

    const { data: promediosUsuario, error: promediosError } = await supabase.rpc('fn_promedios_cobros_por_usuario')

    const promediosPorUsuario: Record<string, { promedio: number; max: number; count: number }> = {}

    if (!promediosError && promediosUsuario) {
      for (const p of promediosUsuario) {
        promediosPorUsuario[p.usuario_id] = {
          promedio: p.promedio_monto,
          max: p.max_monto,
          count: p.cantidad_cobros,
        }
      }
    }

    for (const cobro of cobros || []) {
      const usuarioNombre = `${(cobro.usuarios as any)?.nombre || ''} ${(cobro.usuarios as any)?.apellido || ''}`.trim() || 'Desconocido'
      const sucursalNombre = (cobro.cajas as any)?.sucursales?.nombre || 'Central'
      const monto = Number(cobro.monto || 0)

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

      if (monto >= 10000 && monto % 10000 === 0 && monto <= 100000) {
        const cobrosRedondosUsuario = (cobros || []).filter(
          (c: any) => c.usuario_id === cobro.usuario_id && Number(c.monto) % 10000 === 0 && Number(c.monto) >= 10000
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

    const cobrosPorUsuario: Record<string, any[]> = {}
    for (const cobro of cobros || []) {
      if (!cobrosPorUsuario[cobro.usuario_id]) {
        cobrosPorUsuario[cobro.usuario_id] = []
      }
      cobrosPorUsuario[cobro.usuario_id].push(cobro)
    }

    for (const cobrosList of Object.values(cobrosPorUsuario)) {
      const unaHoraAtras = new Date(Date.now() - 60 * 60 * 1000)
      const cobrosUltimaHora = cobrosList.filter((c: any) => new Date(c.created_at) > unaHoraAtras)

      if (cobrosUltimaHora.length > 20) {
        const usuarioNombre = `${(cobrosUltimaHora[0].usuarios as any)?.nombre || ''} ${(cobrosUltimaHora[0].usuarios as any)?.apellido || ''}`.trim()
        const sucursalNombre = (cobrosUltimaHora[0].cajas as any)?.sucursales?.nombre || 'Central'

        anomalias.push({
          cobroId: cobrosUltimaHora[0].id,
          tipo: 'frecuencia_alta',
          severidad: 'medio',
          descripcion: `${cobrosUltimaHora.length} cobros en la ultima hora (inusualmente alto)`,
          monto: cobrosUltimaHora.reduce((sum: number, c: any) => sum + Number(c.monto), 0),
          usuario: usuarioNombre,
          sucursal: sucursalNombre,
        })
      }
    }

    const anomaliasUnicas = anomalias.filter(
      (a, index, self) => index === self.findIndex((t) => t.cobroId === a.cobroId && t.tipo === a.tipo)
    )

    let notificacionesCreadas = 0

    for (const anomalia of anomaliasUnicas) {
      if (anomalia.severidad === 'bajo') continue

      const { error: notifError } = await supabase.from('notificaciones').insert({
        titulo: `Anomalia detectada: ${anomalia.tipo.replace('_', ' ')}`,
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
        usuario_id: null,
      })

      if (!notifError) notificacionesCreadas++
    }

    const ai = createAIMetadata({
      strategy: 'none',
      used: false,
      provider: 'none',
      model: null,
      fallbackUsed: false,
      reason: 'Motor de auditoria por reglas. No usa IA generativa.',
      startedAt,
      deprecated: true,
      deprecatedMessage: 'Endpoint legado bajo /api/ia. Conservado por compatibilidad.',
    })

    logAIUsage({ endpoint: '/api/ia/auditar-cobros', feature: 'auditar_cobros', success: true, ai })

    return NextResponse.json({
      success: true,
      cobrosAnalizados: (cobros || []).length,
      anomaliasDetectadas: anomaliasUnicas,
      notificacionesCreadas,
      ai,
    })
  } catch (error) {
    console.error('[IA] Error en auditar-cobros:', error)

    const ai = createAIMetadata({
      strategy: 'none',
      used: false,
      provider: 'none',
      model: null,
      fallbackUsed: false,
      reason: 'Error no controlado en auditoria de cobros.',
      startedAt,
      deprecated: true,
      deprecatedMessage: 'Endpoint legado bajo /api/ia. Conservado por compatibilidad.',
    })

    logAIUsage({
      endpoint: '/api/ia/auditar-cobros',
      feature: 'auditar_cobros',
      success: false,
      ai,
      error: error instanceof Error ? error.message : 'unknown',
    })

    return NextResponse.json({
      success: false,
      cobrosAnalizados: 0,
      anomaliasDetectadas: [],
      notificacionesCreadas: 0,
      error: 'Error al auditar cobros',
      ai,
    })
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return POST(request)
}
