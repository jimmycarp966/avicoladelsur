/**
 * Demand Predictor Service
 * Predice demanda usando Vertex AI y fallback estadistico.
 */

import { predict, isVertexAIAvailable } from '@/lib/services/google-cloud/vertex-ai'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

export interface DemandPrediction {
  productoId: string
  productoNombre: string
  cantidadPredicha: number
  confianza: number
  fechaPrediccion: string
  diasRestantes?: number
  tendencia?: 'alta' | 'media' | 'baja'
  factores?: string[]
  modeloUsado: 'vertex' | 'statistical'
  aiUsed: boolean
  aiFallbackUsed: boolean
  aiReason: string
}

export async function predecirDemandaProducto(
  supabase: SupabaseClient<Database>,
  productoId: string,
  diasFuturos: number = 7
): Promise<DemandPrediction | null> {
  try {
    const fechaInicio = new Date()
    fechaInicio.setDate(fechaInicio.getDate() - 90)

    const { data: pedidosHistoricos } = await supabase
      .from('detalles_pedido')
      .select(
        `
        cantidad,
        peso_final,
        created_at,
        pedido:pedidos(fecha_entrega, zona_id)
      `
      )
      .eq('producto_id', productoId)
      .gte('created_at', fechaInicio.toISOString())

    if (!pedidosHistoricos || pedidosHistoricos.length === 0) {
      return predecirDemandaBasica(supabase, productoId, diasFuturos, {
        aiFallbackUsed: false,
        aiReason: 'Sin historial suficiente para Vertex. Se uso modelo estadistico.',
      })
    }

    const { data: producto } = await supabase
      .from('productos')
      .select('id, nombre, categoria')
      .eq('id', productoId)
      .single()

    if (!producto) {
      return null
    }

    const datosEntrenamiento = prepararDatosParaModelo(pedidosHistoricos)

    if (isVertexAIAvailable()) {
      const predictionResult = await predict({ instances: [datosEntrenamiento] })

      if (predictionResult.success && predictionResult.predictions) {
        const prediccion = predictionResult.predictions[0]
        return {
          productoId,
          productoNombre: (producto as any).nombre,
          cantidadPredicha: prediccion.demand || 0,
          confianza: prediccion.confidence || 0.7,
          fechaPrediccion: new Date().toISOString(),
          tendencia: calcularTendencia(pedidosHistoricos),
          factores: identificarFactores(pedidosHistoricos),
          modeloUsado: 'vertex',
          aiUsed: true,
          aiFallbackUsed: false,
          aiReason: 'Prediccion generada por Vertex AI.',
        }
      }

      return predecirDemandaBasica(supabase, productoId, diasFuturos, {
        aiFallbackUsed: true,
        aiReason: predictionResult.error || 'Vertex no devolvio predicciones. Se uso fallback estadistico.',
      })
    }

    return predecirDemandaBasica(supabase, productoId, diasFuturos, {
      aiFallbackUsed: false,
      aiReason: 'Vertex AI no disponible. Se uso modelo estadistico.',
    })
  } catch (error: any) {
    console.error('Error al predecir demanda:', error)
    return null
  }
}

async function predecirDemandaBasica(
  supabase: SupabaseClient<Database>,
  productoId: string,
  diasFuturos: number,
  options: { aiFallbackUsed: boolean; aiReason: string }
): Promise<DemandPrediction | null> {
  try {
    const fechaInicio = new Date()
    fechaInicio.setDate(fechaInicio.getDate() - 28)

    const { data: pedidos } = await supabase
      .from('detalles_pedido')
      .select('cantidad, peso_final, created_at')
      .eq('producto_id', productoId)
      .gte('created_at', fechaInicio.toISOString())

    if (!pedidos || pedidos.length === 0) {
      return null
    }

    const totalCantidad = pedidos.reduce((sum, p) => {
      const cantidad = (p as any).peso_final || (p as any).cantidad || 0
      return sum + cantidad
    }, 0)

    const diasConVentas = new Set(
      pedidos.map((p) => new Date((p as any).created_at).toISOString().split('T')[0])
    ).size

    const promedioDiario = diasConVentas > 0 ? totalCantidad / diasConVentas : 0
    const cantidadPredicha = promedioDiario * diasFuturos

    const { data: producto } = await supabase.from('productos').select('nombre').eq('id', productoId).single()

    const { data: stock } = await supabase
      .from('lotes')
      .select('cantidad_disponible')
      .eq('producto_id', productoId)
      .gt('cantidad_disponible', 0)

    const stockTotal = stock?.reduce((sum, l) => sum + ((l as any).cantidad_disponible || 0), 0) || 0
    const diasRestantes = promedioDiario > 0 ? Math.floor(stockTotal / promedioDiario) : undefined

    return {
      productoId,
      productoNombre: (producto as any)?.nombre || 'Producto',
      cantidadPredicha: Math.round(cantidadPredicha),
      confianza: 0.6,
      fechaPrediccion: new Date().toISOString(),
      diasRestantes,
      tendencia: calcularTendenciaBasica(pedidos),
      factores: ['Analisis estadistico basico', 'Promedio historico'],
      modeloUsado: 'statistical',
      aiUsed: false,
      aiFallbackUsed: options.aiFallbackUsed,
      aiReason: options.aiReason,
    }
  } catch (error: any) {
    console.error('Error en prediccion basica:', error)
    return null
  }
}

function prepararDatosParaModelo(pedidosHistoricos: any[]): Record<string, any> {
  const porDiaSemana: Record<number, number[]> = {}

  pedidosHistoricos.forEach((pedido) => {
    const fecha = new Date(pedido.created_at || pedido.pedido?.fecha_entrega)
    const diaSemana = fecha.getDay()
    const cantidad = pedido.peso_final || pedido.cantidad || 0

    if (!porDiaSemana[diaSemana]) {
      porDiaSemana[diaSemana] = []
    }
    porDiaSemana[diaSemana].push(cantidad)
  })

  const promediosPorDia: Record<string, number> = {}
  Object.entries(porDiaSemana).forEach(([dia, cantidades]) => {
    const promedio = cantidades.reduce((sum, c) => sum + c, 0) / cantidades.length
    promediosPorDia[`dia_${dia}`] = promedio
  })

  return {
    ...promediosPorDia,
    total_pedidos: pedidosHistoricos.length,
    promedio_general:
      pedidosHistoricos.reduce((sum, p) => sum + (p.peso_final || p.cantidad || 0), 0) / pedidosHistoricos.length,
  }
}

function calcularTendencia(pedidosHistoricos: any[]): 'alta' | 'media' | 'baja' {
  if (pedidosHistoricos.length < 7) {
    return 'media'
  }

  const ahora = new Date()
  const dosSemanasAtras = new Date(ahora.getTime() - 14 * 24 * 60 * 60 * 1000)
  const cuatroSemanasAtras = new Date(ahora.getTime() - 28 * 24 * 60 * 60 * 1000)

  const recientes = pedidosHistoricos.filter((p) => new Date(p.created_at) >= dosSemanasAtras)
  const anteriores = pedidosHistoricos.filter(
    (p) => new Date(p.created_at) >= cuatroSemanasAtras && new Date(p.created_at) < dosSemanasAtras
  )

  const promedioReciente =
    recientes.reduce((sum, p) => sum + (p.peso_final || p.cantidad || 0), 0) / Math.max(recientes.length, 1)

  const promedioAnterior =
    anteriores.reduce((sum, p) => sum + (p.peso_final || p.cantidad || 0), 0) / Math.max(anteriores.length, 1)

  const cambio = promedioAnterior > 0 ? ((promedioReciente - promedioAnterior) / promedioAnterior) * 100 : 0

  if (cambio > 10) return 'alta'
  if (cambio < -10) return 'baja'
  return 'media'
}

function calcularTendenciaBasica(pedidos: any[]): 'alta' | 'media' | 'baja' {
  const ahora = new Date()
  const ultimaSemana = pedidos.filter((p) => {
    const fecha = new Date(p.created_at)
    return ahora.getTime() - fecha.getTime() < 7 * 24 * 60 * 60 * 1000
  })

  const ratio = ultimaSemana.length / Math.max(pedidos.length, 1)

  if (ratio > 0.4) return 'alta'
  if (ratio < 0.2) return 'baja'
  return 'media'
}

function identificarFactores(pedidosHistoricos: any[]): string[] {
  const factores: string[] = []

  const porDiaSemana: Record<number, number> = {}
  pedidosHistoricos.forEach((p) => {
    const fecha = new Date(p.created_at)
    const dia = fecha.getDay()
    porDiaSemana[dia] = (porDiaSemana[dia] || 0) + 1
  })

  const diaMasComun = Object.entries(porDiaSemana).sort(([, a], [, b]) => b - a)[0]?.[0]

  if (diaMasComun) {
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']
    factores.push(`Mayor demanda los ${diasSemana[Number(diaMasComun)]}`)
  }

  const zonas = new Set(pedidosHistoricos.map((p) => p.pedido?.zona_id).filter(Boolean))
  if (zonas.size > 0) {
    factores.push(`${zonas.size} zona(s) de alta demanda`)
  }

  return factores
}
