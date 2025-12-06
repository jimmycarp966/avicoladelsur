/**
 * POST /api/reportes/ia/generate
 * 
 * Endpoint para generar reportes usando Gemini
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generarReporteSemanal } from '@/lib/services/google-cloud/gemini'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { tipo = 'semanal', fechaInicio, fechaFin } = body as {
      tipo?: string
      fechaInicio?: string
      fechaFin?: string
    }

    // Obtener datos de la semana
    const inicio = fechaInicio || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const fin = fechaFin || new Date().toISOString().split('T')[0]

    // Obtener ventas del período
    const { data: pedidos } = await supabase
      .from('pedidos')
      .select('id, total, estado, created_at')
      .eq('estado', 'completado')
      .gte('created_at', `${inicio}T00:00:00.000Z`)
      .lte('created_at', `${fin}T23:59:59.999Z`)

    const ventas = pedidos?.reduce((sum, p) => sum + (Number(p.total) || 0), 0) || 0
    const totalPedidos = pedidos?.length || 0

    // Obtener productos más vendidos
    const { data: detallesPedido } = await supabase
      .from('detalles_pedido')
      .select(`
        cantidad,
        peso_final,
        productos(nombre)
      `)
      .in('pedido_id', pedidos?.map(p => p.id) || [])

    const productosMap = new Map<string, number>()
    detallesPedido?.forEach(detalle => {
      const producto = Array.isArray(detalle.productos) ? detalle.productos[0] : detalle.productos
      const nombre = producto?.nombre || 'Desconocido'
      const cantidad = detalle.peso_final || detalle.cantidad || 0
      productosMap.set(nombre, (productosMap.get(nombre) || 0) + cantidad)
    })

    const productos = Array.from(productosMap.entries())
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10)

    // Generar reporte con Gemini
    const reporteResult = await generarReporteSemanal({
      ventas,
      pedidos: totalPedidos,
      productos
    })

    if (!reporteResult.success || !reporteResult.text) {
      return NextResponse.json(
        { success: false, error: reporteResult.error || 'Error al generar reporte' },
        { status: 500 }
      )
    }

    // Guardar reporte en base de datos
    const { data: reporte } = await supabase
      .from('reportes_ia')
      .insert({
        tipo,
        titulo: `Reporte ${tipo} - ${inicio} a ${fin}`,
        contenido: reporteResult.text,
        datos_usados: {
          ventas,
          pedidos: totalPedidos,
          productos
        },
        fecha_periodo_inicio: inicio,
        fecha_periodo_fin: fin,
        generado_por: user.id
      })
      .select()
      .single()

    return NextResponse.json({
      success: true,
      data: {
        id: reporte?.id,
        titulo: reporte?.titulo,
        contenido: reporte?.contenido,
        fechaGeneracion: reporte?.created_at
      }
    })
  } catch (error: any) {
    console.error('Error al generar reporte IA:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al generar reporte' },
      { status: 500 }
    )
  }
}

