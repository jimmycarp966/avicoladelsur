import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Obtener todos los códigos de clientes
    const { data: clientes, error } = await supabase
      .from('clientes')
      .select('codigo, nombre')
      .order('codigo', { ascending: true })
      .limit(100) // Solo los primeros 100 para debug

    if (error) throw error

    // Contar códigos que empiezan con 0
    const codigosConCero = clientes?.filter(c => c.codigo?.startsWith('0')) || []
    const codigosTotal = clientes?.length || 0

    return NextResponse.json({
      success: true,
      data: {
        totalClientes: codigosTotal,
        primerosClientes: clientes?.slice(0, 10),
        codigosConCero: codigosConCero.length,
        ejemplosCodigosConCero: codigosConCero.slice(0, 5)
      }
    })
  } catch (error: any) {
    console.error('Error testing clientes:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    })
  }
}
