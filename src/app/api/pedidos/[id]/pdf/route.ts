import { NextRequest, NextResponse } from 'next/server'
import { generarPDFPedidoAgrupado } from '@/actions/pedidos-pdf.actions'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const result = await generarPDFPedidoAgrupado(id)

    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.error || 'Error al generar PDF' },
        { status: 400 }
      )
    }

    return new NextResponse(result.data as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="pedido-${id}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error('Error en endpoint PDF pedido:', error)
    return NextResponse.json(
      { error: error.message || 'Error al generar PDF' },
      { status: 500 }
    )
  }
}

