/**
 * Demand Predictor Service
 * 
 * Servicio para predecir demanda de productos usando Vertex AI
 * y análisis de datos históricos.
 */

import { predict, isVertexAIAvailable } from '@/lib/services/google-cloud/vertex-ai'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

export interface DemandPrediction {
  productoId: string
  productoNombre: string
  cantidadPredicha: number // en kg o unidades
  confianza: number // 0-1
  fechaPrediccion: string // ISO date
  diasRestantes?: number // Días hasta rotura de stock
  tendencia?: 'alta' | 'media' | 'baja'
  factores?: string[] // Factores que influyen en la predicción
}

/**
 * Predice demanda para un producto específico
 */
export async function predecirDemandaProducto(
  supabase: SupabaseClient<Database>,
  productoId: string,
  diasFuturos: number = 7
): Promise<DemandPrediction | null> {
  try {
    // Obtener datos históricos del producto
    const fechaInicio = new Date()
    fechaInicio.setDate(fechaInicio.getDate() - 90) // Últimos 90 días

    const { data: pedidosHistoricos } = await supabase
      .from('detalles_pedido')
      .select(`
        cantidad,
        peso_final,
        created_at,
        pedido:pedidos(fecha_entrega, zona_id)
      `)
      .eq('producto_id', productoId)
      .gte('created_at', fechaInicio.toISOString())

    if (!pedidosHistoricos || pedidosHistoricos.length === 0) {
      // Sin datos históricos, usar predicción básica
      return predecirDemandaBasica(supabase, productoId, diasFuturos)
    }

    // Obtener información del producto
    const { data: producto } = await supabase
      .from('productos')
      .select('id, nombre, categoria')
      .eq('id', productoId)
      .single()

    if (!producto) {
      return null
    }

    // Preparar datos para el modelo
    const datosEntrenamiento = prepararDatosParaModelo(pedidosHistoricos)

    // Si Vertex AI está disponible, usar modelo avanzado
    if (isVertexAIAvailable()) {
      const predictionResult = await predict({
        instances: [datosEntrenamiento]
      })

      if (predictionResult.success && predictionResult.predictions) {
        const prediccion = predictionResult.predictions[0]
        return {
          productoId,
          productoNombre: (producto as any).nombre,
          cantidadPredicha: prediccion.demand || 0,
          confianza: prediccion.confidence || 0.7,
          fechaPrediccion: new Date().toISOString(),
          tendencia: calcularTendencia(pedidosHistoricos),
          factores: identificarFactores(pedidosHistoricos)
        }
      }
    }

    // Fallback a predicción básica
    return predecirDemandaBasica(supabase, productoId, diasFuturos)
  } catch (error: any) {
    console.error('Error al predecir demanda:', error)
    return null
  }
}

/**
 * Predicción básica usando análisis estadístico simple
 */
async function predecirDemandaBasica(
  supabase: SupabaseClient<Database>,
  productoId: string,
  diasFuturos: number
): Promise<DemandPrediction | null> {
  try {
    // Obtener promedio de ventas de las últimas 4 semanas
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

    // Calcular promedio diario
    const totalCantidad = pedidos.reduce((sum, p) => {
      const cantidad = (p as any).peso_final || (p as any).cantidad || 0
      return sum + cantidad
    }, 0)

    const diasConVentas = new Set(
      pedidos.map(p => new Date((p as any).created_at).toISOString().split('T')[0])
    ).size

    const promedioDiario = diasConVentas > 0 ? totalCantidad / diasConVentas : 0
    const cantidadPredicha = promedioDiario * diasFuturos

    // Obtener nombre del producto
    const { data: producto } = await supabase
      .from('productos')
      .select('nombre')
      .eq('id', productoId)
      .single()

    // Calcular días restantes si hay stock
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
      confianza: 0.6, // Confianza baja para predicción básica
      fechaPrediccion: new Date().toISOString(),
      diasRestantes,
      tendencia: calcularTendenciaBasica(pedidos),
      factores: ['Análisis estadístico básico', 'Promedio histórico']
    }
  } catch (error: any) {
    console.error('Error en predicción básica:', error)
    return null
  }
}

/**
 * Prepara datos históricos para el modelo de ML
 */
function prepararDatosParaModelo(pedidosHistoricos: any[]): Record<string, any> {
  // Agrupar por día de semana
  const porDiaSemana: Record<number, number[]> = {}
  
  pedidosHistoricos.forEach(pedido => {
    const fecha = new Date(pedido.created_at || pedido.pedido?.fecha_entrega)
    const diaSemana = fecha.getDay()
    const cantidad = pedido.peso_final || pedido.cantidad || 0
    
    if (!porDiaSemana[diaSemana]) {
      porDiaSemana[diaSemana] = []
    }
    porDiaSemana[diaSemana].push(cantidad)
  })

  // Calcular promedios por día de semana
  const promediosPorDia: Record<string, number> = {}
  Object.entries(porDiaSemana).forEach(([dia, cantidades]) => {
    const promedio = cantidades.reduce((sum, c) => sum + c, 0) / cantidades.length
    promediosPorDia[`dia_${dia}`] = promedio
  })

  return {
    ...promediosPorDia,
    total_pedidos: pedidosHistoricos.length,
    promedio_general: pedidosHistoricos.reduce((sum, p) => 
      sum + (p.peso_final || p.cantidad || 0), 0
    ) / pedidosHistoricos.length
  }
}

/**
 * Calcula la tendencia de demanda
 */
function calcularTendencia(pedidosHistoricos: any[]): 'alta' | 'media' | 'baja' {
  if (pedidosHistoricos.length < 7) {
    return 'media'
  }

  // Comparar últimas 2 semanas vs anteriores 2 semanas
  const ahora = new Date()
  const dosSemanasAtras = new Date(ahora.getTime() - 14 * 24 * 60 * 60 * 1000)
  const cuatroSemanasAtras = new Date(ahora.getTime() - 28 * 24 * 60 * 60 * 1000)

  const recientes = pedidosHistoricos.filter(p => 
    new Date(p.created_at) >= dosSemanasAtras
  )
  const anteriores = pedidosHistoricos.filter(p => 
    new Date(p.created_at) >= cuatroSemanasAtras && 
    new Date(p.created_at) < dosSemanasAtras
  )

  const promedioReciente = recientes.reduce((sum, p) => 
    sum + (p.peso_final || p.cantidad || 0), 0
  ) / Math.max(recientes.length, 1)

  const promedioAnterior = anteriores.reduce((sum, p) => 
    sum + (p.peso_final || p.cantidad || 0), 0
  ) / Math.max(anteriores.length, 1)

  const cambio = promedioAnterior > 0 
    ? ((promedioReciente - promedioAnterior) / promedioAnterior) * 100
    : 0

  if (cambio > 10) return 'alta'
  if (cambio < -10) return 'baja'
  return 'media'
}

/**
 * Calcula tendencia básica
 */
function calcularTendenciaBasica(pedidos: any[]): 'alta' | 'media' | 'baja' {
  // Análisis simple: si hay muchos pedidos recientes, tendencia alta
  const ahora = new Date()
  const ultimaSemana = pedidos.filter(p => {
    const fecha = new Date(p.created_at)
    return (ahora.getTime() - fecha.getTime()) < 7 * 24 * 60 * 60 * 1000
  })

  const ratio = ultimaSemana.length / Math.max(pedidos.length, 1)
  
  if (ratio > 0.4) return 'alta'
  if (ratio < 0.2) return 'baja'
  return 'media'
}

/**
 * Identifica factores que influyen en la demanda
 */
function identificarFactores(pedidosHistoricos: any[]): string[] {
  const factores: string[] = []

  // Analizar día de semana más común
  const porDiaSemana: Record<number, number> = {}
  pedidosHistoricos.forEach(p => {
    const fecha = new Date(p.created_at)
    const dia = fecha.getDay()
    porDiaSemana[dia] = (porDiaSemana[dia] || 0) + 1
  })

  const diaMasComun = Object.entries(porDiaSemana)
    .sort(([, a], [, b]) => b - a)[0]?.[0]

  if (diaMasComun) {
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
    factores.push(`Mayor demanda los ${diasSemana[Number(diaMasComun)]}`)
  }

  // Analizar zonas más comunes
  const zonas = new Set(pedidosHistoricos.map(p => p.pedido?.zona_id).filter(Boolean))
  if (zonas.size > 0) {
    factores.push(`${zonas.size} zona(s) de alta demanda`)
  }

  return factores
}

