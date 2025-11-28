import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/sucursales/low-stock-run
// Ejecuta evaluación de stock bajo para todas las sucursales
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Obtener todas las sucursales activas
    const { data: sucursales, error: sucursalesError } = await supabase
      .from('sucursales')
      .select('id, nombre')
      .eq('active', true)

    if (sucursalesError) {
      return NextResponse.json(
        { success: false, error: `Error al obtener sucursales: ${sucursalesError.message}` },
        { status: 500 }
      )
    }

    let totalAlertas = 0
    const resultados = []

    // Ejecutar evaluación para cada sucursal
    for (const sucursal of sucursales) {
      try {
        const { data: alertasCreadas, error: evalError } = await supabase
          .rpc('fn_evaluar_stock_bajo_sucursal', {
            p_sucursal_id: sucursal.id
          })

        if (evalError) {
          console.error(`Error en sucursal ${sucursal.nombre}:`, evalError)
          resultados.push({
            sucursal: sucursal.nombre,
            exito: false,
            error: evalError.message,
            alertas: 0
          })
        } else {
          totalAlertas += alertasCreadas || 0
          resultados.push({
            sucursal: sucursal.nombre,
            exito: true,
            alertas: alertasCreadas || 0
          })
        }
      } catch (error) {
        console.error(`Error procesando sucursal ${sucursal.nombre}:`, error)
        resultados.push({
          sucursal: sucursal.nombre,
          exito: false,
          error: error instanceof Error ? error.message : 'Error desconocido',
          alertas: 0
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        totalAlertas,
        resultados,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Error en low-stock-run:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}
