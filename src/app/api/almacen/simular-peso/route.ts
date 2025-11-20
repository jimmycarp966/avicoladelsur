import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { BalanzaAdapterFactory } from '@/lib/balanza-adapter'

const simularPesoSchema = z.object({
  presupuesto_item_id: z.string().uuid(),
  peso_simulado: z.number().positive().optional(),
})

const useBalanzaFisica = (process.env.BALANZA_MODE || '').toLowerCase() === 'live'

function generarPesoSimulado(cantidadSolicitada: number): number {
  const base = cantidadSolicitada > 0 ? cantidadSolicitada : 1
  const variacion = (Math.random() - 0.5) * 0.15 // ±7.5 %
  const peso = base * (1 + variacion)
  return Math.max(0.01, Math.round(peso * 1000) / 1000)
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { presupuesto_item_id, peso_simulado } = simularPesoSchema.parse(body)

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { success: false, message: 'Usuario no autenticado' },
        { status: 401 }
      )
    }

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'almacenista'].includes(usuario.rol)) {
      return NextResponse.json(
        { success: false, message: 'No tienes permisos para leer la balanza' },
        { status: 403 }
      )
    }

    const { data: item, error: itemError } = await supabase
      .from('presupuesto_items')
      .select(`
        cantidad_solicitada,
        pesable,
        producto:productos(nombre)
      `)
      .eq('id', presupuesto_item_id)
      .single()

    if (itemError || !item) {
      return NextResponse.json(
        { success: false, message: 'Item de presupuesto no encontrado' },
        { status: 404 }
      )
    }

    const cantidadBase = Number(item.cantidad_solicitada) || 1
    let pesoFinal = peso_simulado ? Number(peso_simulado) : undefined
    let origen: 'manual' | 'balanza' | 'simulado' = peso_simulado ? 'manual' : 'simulado'

    if (!pesoFinal && useBalanzaFisica) {
      try {
        const balanza = BalanzaAdapterFactory.crearAdapter()
        await balanza.conectar()
        const lectura = await balanza.leerPeso()
        pesoFinal = lectura.peso
        origen = 'balanza'
        await balanza.desconectar()
      } catch (adapterError) {
        console.error('Error leyendo balanza física:', adapterError)
      }
    }

    if (!pesoFinal || pesoFinal <= 0) {
      pesoFinal = generarPesoSimulado(cantidadBase)
      origen = 'simulado'
    }

    const pesoRedondeado = Number(pesoFinal.toFixed(3))
    const producto = Array.isArray(item.producto) ? item.producto[0] : item.producto

    return NextResponse.json({
      success: true,
      peso_simulado: pesoRedondeado,
      mensaje: `Peso ${origen === 'balanza' ? 'registrado' : 'simulado'}: ${pesoRedondeado} kg`,
      metadata: {
        origen,
        producto: producto?.nombre,
        pesable: item.pesable,
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error en simular-peso:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Datos inválidos',
          details: error.issues
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    mensaje: 'Endpoint de simulación de balanza - Solo para desarrollo',
    instrucciones: 'POST con { presupuesto_item_id, peso_simulado? }',
    ejemplo: {
      presupuesto_item_id: 'uuid-del-item',
      peso_simulado: 5.25 // opcional, si no se envía genera uno aleatorio
    }
  })
}
