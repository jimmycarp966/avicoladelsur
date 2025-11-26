import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTodayArgentina } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 },
      )
    }

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 },
      )
    }

    const searchParams = request.nextUrl.searchParams
    const repartidorId = searchParams.get('repartidor_id')
    const vehiculoId = searchParams.get('vehiculo_id')
    const fecha = searchParams.get('fecha') || getTodayArgentina()

    if (!repartidorId && !vehiculoId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Debe indicar repartidor_id o vehiculo_id',
        },
        { status: 400 },
      )
    }

    // Repartidor solo puede consultar su propia ubicación
    if (
      usuario.rol === 'repartidor' &&
      repartidorId &&
      repartidorId !== user.id
    ) {
      return NextResponse.json(
        { success: false, error: 'No tienes permisos para esta ruta' },
        { status: 403 },
      )
    }

    const { data, error } = await supabase.rpc(
      'fn_obtener_ultima_ubicacion_por_vehiculo',
      {
        p_fecha: fecha,
      },
    )

    if (error) throw error

    const match = (data || []).find((registro: any) => {
      if (vehiculoId && registro.vehiculo_id === vehiculoId) return true
      if (repartidorId && registro.repartidor_id === repartidorId) return true
      return false
    })

    return NextResponse.json({
      success: true,
      data: match
        ? {
            vehiculo_id: match.vehiculo_id,
            repartidor_id: match.repartidor_id,
            lat: match.lat,
            lng: match.lng,
            created_at: match.created_at,
            ruta_activa_id: match.ruta_activa_id,
            ruta_numero: match.ruta_numero,
          }
        : null,
    })
  } catch (error: any) {
    console.error('Error al obtener ubicación actual:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener ubicación' },
      { status: 500 },
    )
  }
}


