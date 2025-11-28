import { NextRequest, NextResponse } from 'next/server'
import { diagnosticarListasPreciosAction } from '@/actions/listas-precios.actions'

export async function GET(request: NextRequest) {
  try {
    const result = await diagnosticarListasPreciosAction()

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: result.data
      })
    } else {
      return NextResponse.json({
        success: false,
        message: result.message,
        data: result.data
      }, { status: 400 })
    }
  } catch (error) {
    console.error('Error en diagnóstico API:', error)
    return NextResponse.json({
      success: false,
      message: 'Error interno del servidor',
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}
