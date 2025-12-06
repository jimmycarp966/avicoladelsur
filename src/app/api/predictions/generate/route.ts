/**
 * POST /api/predictions/generate
 * 
 * Endpoint para generar predicciones de demanda para todos los productos
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { predecirDemandaProducto } from '@/lib/services/predictions/demand-predictor'

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

    // Verificar permisos (solo admin)
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || usuario.rol !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'No tienes permisos para generar predicciones' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { diasFuturos = 7 } = body as { diasFuturos?: number }

    // Obtener todos los productos activos
    const { data: productos } = await supabase
      .from('productos')
      .select('id')
      .eq('activo', true)

    if (!productos || productos.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No hay productos activos' },
        { status: 404 }
      )
    }

    // Generar predicciones para cada producto
    const predicciones = []
    const errores = []

    for (const producto of productos) {
      try {
        const prediccion = await predecirDemandaProducto(supabase, producto.id, diasFuturos)
        if (prediccion) {
          // Guardar predicción en base de datos
          await supabase.rpc('fn_registrar_prediccion_demanda', {
            p_producto_id: producto.id,
            p_fecha_prediccion: new Date().toISOString().split('T')[0],
            p_fecha_predicha: new Date(Date.now() + diasFuturos * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            p_cantidad_predicha: prediccion.cantidadPredicha,
            p_confianza: prediccion.confianza,
            p_tendencia: prediccion.tendencia,
            p_factores: prediccion.factores ? JSON.stringify(prediccion.factores) : null,
            p_modelo_usado: 'basico',
            p_dias_restantes: prediccion.diasRestantes || null
          })
          predicciones.push(prediccion)
        }
      } catch (error: any) {
        errores.push({ productoId: producto.id, error: error.message })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        prediccionesGeneradas: predicciones.length,
        totalProductos: productos.length,
        predicciones,
        errores: errores.length > 0 ? errores : undefined
      }
    })
  } catch (error: any) {
    console.error('Error al generar predicciones:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al generar predicciones' },
      { status: 500 }
    )
  }
}

