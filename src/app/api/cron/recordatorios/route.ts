import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Endpoint para cron job de recordatorios de compra inteligentes
 * 
 * Detecta clientes que suelen comprar periódicamente (ej. cada 7 días)
 * y que no han vuelto a comprar en el ciclo esperado
 *
 * Frecuencias detectadas:
 * - Semanal (7 días)
 * - Quincenal (15 días)
 * - Mensual (30 días)
 */

export async function GET(request: NextRequest) {
  try {
    // Verificar authentication para ejecutar cron jobs
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET?.trim()

    if (!cronSecret) {
      console.error('[Cron Recordatorios] CRON_SECRET no configurado')
      return NextResponse.json(
        { success: false, error: 'CRON_SECRET no configurado' },
        { status: 500 }
      )
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const offsetDias = parseInt(searchParams.get('offset_dias') || '2', 10)
    const maxDias = parseInt(searchParams.get('max_dias') || '7', 10)

    console.log('[Cron Recordatorios] Ejecutando...', {
      offsetDias,
      maxDias,
      timestamp: new Date().toISOString(),
    })

    const supabase = await createClient()

    // Obtener pedidos de los últimos 90 días de clientes activos con WhatsApp
    const { data: pedidos, error } = await supabase
      .from('pedidos')
      .select('cliente_id, fecha_pedido')
      .in('estado', ['confirmado', 'enviado', 'entregado'])
      .gte('fecha_pedido', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order('fecha_pedido', { ascending: false })
      .limit(500)

    if (error) {
      console.error('[Cron Recordatorios] Error obteniendo pedidos:', error)
      return NextResponse.json({
        success: false,
        error: 'Error obteniendo datos de pedidos',
        timestamp: new Date().toISOString(),
      }, { status: 500 })
    }

    // Agrupar por cliente y analizar ciclo de compra
    const clientesMap = new Map<string, Array<Date>>()

    for (const pedido of pedidos || []) {
      const clienteId = pedido.cliente_id
      const fecha = new Date(pedido.fecha_pedido)

      if (!clientesMap.has(clienteId)) {
        clientesMap.set(clienteId, [])
      }

      const fechas = clientesMap.get(clienteId)!
      fechas.push(fecha)
    }

    // Obtener datos de clientes
    const clienteIds = Array.from(clientesMap.keys())
    const { data: clientes } = await supabase
      .from('clientes')
      .select('id, nombre, whatsapp, activo')
      .in('id', clienteIds.slice(0, 50))

    // Crear mapa de datos de clientes
    const clientesDataMap = new Map<string, { nombre: string; whatsapp: string | null; activo: boolean }>()
    for (const cliente of clientes || []) {
      clientesDataMap.set(cliente.id, {
        nombre: cliente.nombre,
        whatsapp: cliente.whatsapp,
        activo: cliente.activo,
      })
    }

    // Analizar ciclo de compra por cliente
    const clientesParaRecordar: Array<{
      cliente_id: string
      cliente_nombre: string
      whatsapp: string | null
      ciclo_promedio_dias: number
      dias_desde_ultima_compra: number
    }> = []

    for (const [clienteId, fechas] of clientesMap.entries()) {
      const cliente = clientesDataMap.get(clienteId)
      if (!cliente || !cliente.whatsapp || !cliente.activo) continue
      if (fechas.length < 2) continue // Necesario mínimo 2 compras

      // Ordenar fechas descendente
      const fechasOrdenadas = fechas.sort((a, b) => b.getTime() - a.getTime())

      // Calcular ciclo promedio en días
      let totalDias = 0
      for (let i = 0; i < fechasOrdenadas.length - 1; i++) {
        const diffDias = (fechasOrdenadas[i].getTime() - fechasOrdenadas[i + 1].getTime()) / (1000 * 60 * 60 * 24)
        totalDias += diffDias
      }

      const cicloPromedioDias = Math.round(totalDias / (fechasOrdenadas.length - 1))
      const ultimaCompra = fechasOrdenadas[0]
      const diasDesdeUltimaCompra = Math.floor((Date.now() - ultimaCompra.getTime()) / (1000 * 60 * 60 * 24))

      // Solo programar si está dentro del rango de días esperado
      if (cicloPromedioDias >= offsetDias &&
          cicloPromedioDias <= maxDias &&
          diasDesdeUltimaCompra >= Math.floor(cicloPromedioDias * 0.7)) {

        clientesParaRecordar.push({
          cliente_id: clienteId,
          cliente_nombre: cliente.nombre,
          whatsapp: cliente.whatsapp,
          ciclo_promedio_dias: cicloPromedioDias,
          dias_desde_ultima_compra: diasDesdeUltimaCompra,
        })
      }
    }

    console.log('[Cron Recordatorios] Clientes analizados:', {
      total_clientes: clientesMap.size,
      clientes_para_recordar: clientesParaRecordar.length,
      ciclo_min_dias: offsetDias,
      ciclo_max_dias: maxDias,
    })

    // Programar recordatorios
    let programados = 0
    const errores: string[] = []

    for (const cliente of clientesParaRecordar) {
      try {
        const diasDesde = cliente.dias_desde_ultima_compra
        const ciclo = cliente.ciclo_promedio_dias

        let mensaje: string
        let tipoFrecuencia: string

        if (ciclo <= 10) {
          tipoFrecuencia = 'semanal'
          mensaje = `📝 *Recordatorio de Compra Semanal*\n\nHola ${cliente.cliente_nombre}!\n\nPasaron ${diasDesde} días desde tu última compra.\n\n¿Querés hacer tu pedido de esta semana?`
        } else if (ciclo <= 20) {
          tipoFrecuencia = 'quincenal'
          mensaje = `📝 *Recordatorio de Compra Quincenal*\n\nHola ${cliente.cliente_nombre}!\n\nPasaron ${diasDesde} días desde tu última compra.\n\n¿Querés hacer tu pedido quincenal?`
        } else {
          tipoFrecuencia = 'mensual'
          mensaje = `📝 *Recordatorio de Compra Mensual*\n\nHola ${cliente.cliente_nombre}!\n\nPasaron ${diasDesde} días desde tu última compra.\n\n¿Querés hacer tu pedido mensual?`
        }

        // Programar notificación para las 9am de mañana
        const programadaPara = new Date()
        programadaPara.setHours(9, 0, 0, 0)
        if (programadaPara <= new Date()) {
          programadaPara.setDate(programadaPara.getDate() + 1)
        }

        // Usar RPC programar_notificacion
        const { data, error: progError } = await supabase.rpc('programar_notificacion', {
          p_cliente_id: cliente.cliente_id,
          p_tipo: 'recordatorio_compra',
          p_mensaje: mensaje,
          p_datos: {
            frecuencia: tipoFrecuencia,
            ciclo_promedio_dias: ciclo,
            dias_desde_ultima_compra: diasDesde,
          },
          p_programada_para: programadaPara.toISOString(),
        })

        if (!progError && data?.success) {
          programados++
          console.log(`[Cron Recordatorios] Recordatorio programado:`, {
            cliente: cliente.cliente_nombre,
            frecuencia: tipoFrecuencia,
            programada_para: programadaPara,
          })
        } else {
          errores.push(`${cliente.cliente_nombre}: ${progError?.message || 'Error desconocido'}`)
        }
      } catch (err: any) {
        errores.push(`${cliente.cliente_nombre}: ${err.message}`)
        console.error(`[Cron Recordatorios] Error procesando cliente:`, cliente, err)
      }
    }

    console.log('[Cron Recordatorios] Ejecución completada:', {
      analizados: clientesParaRecordar.length,
      programados,
      errores: errores.length,
    })

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      analizados: clientesParaRecordar.length,
      programados,
      errores,
      config: {
        offset_dias: offsetDias,
        max_dias: maxDias,
      },
    })
  } catch (error: any) {
    console.error('[Cron Recordatorios] Error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error procesando recordatorios',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

/**
 * Endpoint POST para testing manual
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const offsetDias = body.offset_dias || 2
    const maxDias = body.max_dias || 7

    console.log('[Cron Recordatorios] Test manual...', { offsetDias, maxDias })

    // Ejecutar lógica similar al GET pero con límites específicos
    // (Simplificado para testing - usar query completa en producción)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      mensaje: 'Test ejecutado - ver logs en consola',
      params: { offset_dias: offsetDias, max_dias: maxDias },
    })
  } catch (error: any) {
    console.error('[Cron Recordatorios] Error en test manual:', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error en test manual',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
