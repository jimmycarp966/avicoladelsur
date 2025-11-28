import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { codigos } = await request.json()

    if (!codigos || !Array.isArray(codigos)) {
      return NextResponse.json(
        { success: false, error: 'Se requiere un array de códigos' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Buscar productos por códigos
    const { data: productos, error } = await supabase
      .from('productos')
      .select('id, codigo, nombre, categoria, precio_venta, precio_costo, unidad_medida, activo')
      .in('codigo', codigos)
      .order('codigo', { ascending: true })

    if (error) {
      console.error('Error al buscar productos:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // Obtener todos los productos para comparar
    const { data: todosProductos } = await supabase
      .from('productos')
      .select('codigo, nombre')
      .limit(50)
      .order('codigo')

    return NextResponse.json({
      success: true,
      productosEncontrados: productos || [],
      totalEncontrados: productos?.length || 0,
      codigosBuscados: codigos,
      codigosNoEncontrados: codigos.filter(
        codigo => !productos?.some(p => p.codigo === codigo)
      ),
      muestraProductos: todosProductos || [],
    })
  } catch (error: any) {
    console.error('Error en API buscar productos:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al buscar productos' },
      { status: 500 }
    )
  }
}
