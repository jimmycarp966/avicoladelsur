import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Generar token temporal para acceso al catálogo
// Formato: BASE64(telefono_timestamp) - válido por 24hs
function generarToken(telefono: string): string {
  const timestamp = Date.now()
  const combined = `${telefono}_${timestamp}`
  return Buffer.from(combined).toString('base64').substring(0, 24)
}

// Generar link del catálogo con token
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { telefono } = body

    if (!telefono || telefono.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Teléfono inválido' },
        { status: 400 }
      )
    }

    const token = generarToken(telefono)
    const urlCatalogo = `https://avicoladelsur.vercel.app/catalogo?telefono=${telefono}&auth=${token}`

    return NextResponse.json({
      success: true,
      token,
      url: urlCatalogo
    })
  } catch (error) {
    console.error('[API/Catalogo/GenerarToken] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al generar link' },
      { status: 500 }
    )
  }
}
