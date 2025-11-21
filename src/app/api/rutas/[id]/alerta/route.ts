/**
 * POST /api/rutas/:id/alerta
 * 
 * Inserta alerta manual o automática
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { crearAlertaSchema } from '@/lib/schemas/reparto'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    
    // Validar body
    const body = await request.json()
    const validated = crearAlertaSchema.parse({
      ...body,
      rutaId: params.id
    })
    
    // Insertar alerta
    const { data: alerta, error: insertError } = await supabase
      .from('alertas_reparto')
      .insert({
        ruta_id: validated.rutaId,
        ruta_reparto_id: validated.rutaRepartoId,
        vehiculo_id: validated.vehiculoId,
        repartidor_id: validated.repartidorId,
        tipo: validated.tipo,
        descripcion: validated.descripcion,
        lat: validated.lat,
        lng: validated.lng,
        distancia_desvio_m: validated.distanciaDesvioM,
        cliente_id: validated.clienteId,
        pedido_id: validated.pedidoId
      })
      .select()
      .single()
    
    if (insertError) throw insertError
    
    return NextResponse.json({
      success: true,
      data: { alertaId: alerta.id }
    })
  } catch (error: any) {
    console.error('Error al crear alerta:', error)
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { success: false, error: error.message || 'Error al crear alerta' },
      { status: 500 }
    )
  }
}

