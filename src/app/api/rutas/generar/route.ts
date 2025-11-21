/**
 * POST /api/rutas/generar
 * 
 * Genera ruta optimizada (Google Directions o fallback local)
 * Body: { rutaId, usarGoogle: boolean }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generarRutaSchema } from '@/lib/schemas/reparto'
import { generateRutaOptimizada } from '@/lib/services/ruta-optimizer'

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
    
    // Validar body
    const body = await request.json()
    const validated = generarRutaSchema.parse(body)
    
    try {
      const data = await generateRutaOptimizada({
        supabase,
        rutaId: validated.rutaId,
        usarGoogle: validated.usarGoogle,
      })

      return NextResponse.json({
        success: true,
        data,
      })
    } catch (err: any) {
      console.error('Error generando ruta optimizada:', err)
      return NextResponse.json(
        { success: false, error: err.message || 'Error al generar ruta' },
        { status: 400 },
      )
    }
  } catch (error: any) {
    console.error('Error al generar ruta:', error)
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { success: false, error: error.message || 'Error al generar ruta' },
      { status: 500 }
    )
  }
}

