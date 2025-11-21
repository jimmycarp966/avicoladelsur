/**
 * GET /api/reparto/alertas
 * 
 * Devuelve alertas de reparto (desvíos, cliente saltado, etc.)
 * Query params: zona_id?, fecha?, resuelta?
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
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
    
    // Obtener query params
    const searchParams = request.nextUrl.searchParams
    const fecha = searchParams.get('fecha') || new Date().toISOString().split('T')[0]
    const zonaId = searchParams.get('zona_id') || null
    const resuelta = searchParams.get('resuelta')
    
    // Construir query
    let query = supabase
      .from('alertas_reparto')
      .select(`
        *,
        vehiculo:vehiculos(patente),
        repartidor:usuarios(nombre, apellido),
        cliente:clientes(nombre),
        pedido:pedidos(numero_pedido)
      `)
      .gte('created_at', `${fecha}T00:00:00`)
      .lt('created_at', `${fecha}T23:59:59`)
      .order('created_at', { ascending: false })
      .limit(50)
    
    if (resuelta !== null) {
      query = query.eq('resuelta', resuelta === 'true')
    }
    
    // Si hay zona_id, filtrar por rutas de esa zona
    if (zonaId) {
      query = query.in('ruta_reparto_id', 
        supabase
          .from('rutas_reparto')
          .select('id')
          .eq('zona_id', zonaId)
      )
    }
    
    const { data, error } = await query
    
    if (error) throw error
    
    return NextResponse.json({
      success: true,
      data: data || []
    })
  } catch (error: any) {
    console.error('Error al obtener alertas:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener alertas' },
      { status: 500 }
    )
  }
}

