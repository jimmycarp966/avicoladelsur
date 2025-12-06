/**
 * Stock Alert Service
 * 
 * Servicio para generar alertas de stock basadas en predicciones de demanda
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { predecirDemandaProducto, type DemandPrediction } from './demand-predictor'

export interface StockAlert {
  id: string
  productoId: string
  productoNombre: string
  tipo: 'rotura_inminente' | 'stock_bajo' | 'demanda_alta'
  mensaje: string
  diasRestantes: number
  stockActual: number
  demandaPrevista: number // kg/día
  accionSugerida: string
  resuelta: boolean
  created_at: string
}

/**
 * Genera alertas de stock para todos los productos
 */
export async function generarAlertasStock(
  supabase: SupabaseClient<Database>
): Promise<StockAlert[]> {
  try {
    // Obtener todos los productos activos con stock
    const { data: productos } = await supabase
      .from('productos')
      .select('id, nombre, categoria')
      .eq('activo', true)

    if (!productos || productos.length === 0) {
      return []
    }

    const alertas: StockAlert[] = []

    // Para cada producto, predecir demanda y generar alertas si es necesario
    for (const producto of productos) {
      // Obtener stock actual
      const { data: lotes } = await supabase
        .from('lotes')
        .select('cantidad_disponible')
        .eq('producto_id', (producto as any).id)
        .gt('cantidad_disponible', 0)

      const stockActual = lotes?.reduce((sum, l) => sum + ((l as any).cantidad_disponible || 0), 0) || 0

      // Predecir demanda
      const prediccion = await predecirDemandaProducto(supabase, (producto as any).id, 7)

      if (!prediccion) {
        continue
      }

      const demandaDiaria = prediccion.cantidadPredicha / 7 // Promedio diario
      const diasRestantes = demandaDiaria > 0 ? Math.floor(stockActual / demandaDiaria) : undefined

      // Generar alerta si es necesario
      if (diasRestantes !== undefined && diasRestantes < 3) {
        const tipo = diasRestantes < 1 ? 'rotura_inminente' : 'stock_bajo'
        const mensaje = diasRestantes < 1
          ? `⚠️ ALERTA CRÍTICA: ${(producto as any).nombre} se acabará hoy según predicción de IA`
          : `⚠️ ALERTA: ${(producto as any).nombre} se acabará en ${diasRestantes.toFixed(1)} días`

        const accionSugerida = `Comprar ${Math.ceil(demandaDiaria * 7)}kg para cubrir demanda de la próxima semana`

        // Guardar alerta en base de datos
        const { data: alerta } = await supabase
          .from('alertas_stock_ia')
          .insert({
            producto_id: (producto as any).id,
            tipo,
            mensaje,
            dias_restantes: diasRestantes,
            accion_sugerida: accionSugerida,
            resuelta: false
          })
          .select()
          .single()

        if (alerta) {
          const alertaData = alerta as any
          alertas.push({
            id: alertaData.id,
            productoId: (producto as any).id,
            productoNombre: (producto as any).nombre,
            tipo: alertaData.tipo as any,
            mensaje: alertaData.mensaje,
            diasRestantes: alertaData.dias_restantes,
            stockActual,
            demandaPrevista: demandaDiaria,
            accionSugerida: alertaData.accion_sugerida || '',
            resuelta: alertaData.resuelta || false,
            created_at: alertaData.created_at
          })
        }
      }

      // Alerta de demanda alta (sin riesgo de rotura pero demanda creciente)
      if (prediccion.tendencia === 'alta' && diasRestantes && diasRestantes > 3 && diasRestantes < 7) {
        const mensaje = `📈 Demanda alta detectada: ${(producto as any).nombre} tiene tendencia creciente`
        const accionSugerida = `Considerar aumentar stock preventivo`

        const { data: alerta } = await supabase
          .from('alertas_stock_ia')
          .insert({
            producto_id: (producto as any).id,
            tipo: 'demanda_alta',
            mensaje,
            dias_restantes: diasRestantes,
            accion_sugerida: accionSugerida,
            resuelta: false
          })
          .select()
          .single()

        if (alerta) {
          const alertaData = alerta as any
          alertas.push({
            id: alertaData.id,
            productoId: (producto as any).id,
            productoNombre: (producto as any).nombre,
            tipo: 'demanda_alta',
            mensaje: alertaData.mensaje,
            diasRestantes: alertaData.dias_restantes,
            stockActual,
            demandaPrevista: demandaDiaria,
            accionSugerida: alertaData.accion_sugerida || '',
            resuelta: alertaData.resuelta || false,
            created_at: alertaData.created_at
          })
        }
      }
    }

    return alertas
  } catch (error: any) {
    console.error('Error al generar alertas de stock:', error)
    return []
  }
}

/**
 * Obtiene alertas activas de stock
 */
export async function obtenerAlertasStockActivas(
  supabase: SupabaseClient<Database>
): Promise<StockAlert[]> {
  try {
    const { data: alertas } = await supabase
      .from('alertas_stock_ia')
      .select(`
        id,
        producto_id,
        tipo,
        mensaje,
        dias_restantes,
        accion_sugerida,
        resuelta,
        created_at,
        productos(nombre)
      `)
      .eq('resuelta', false)
      .order('dias_restantes', { ascending: true })
      .order('created_at', { ascending: false })

    if (!alertas) {
      return []
    }

    // Obtener stock actual para cada producto
    const alertasConStock = await Promise.all(
      alertas.map(async (alerta: any) => {
        const { data: lotes } = await supabase
          .from('lotes')
          .select('cantidad_disponible')
          .eq('producto_id', alerta.producto_id)
          .gt('cantidad_disponible', 0)

        const stockActual = lotes?.reduce((sum, l) => sum + ((l as any).cantidad_disponible || 0), 0) || 0

        return {
          id: alerta.id,
          productoId: alerta.producto_id,
          productoNombre: alerta.productos?.nombre || 'Producto',
          tipo: alerta.tipo,
          mensaje: alerta.mensaje,
          diasRestantes: alerta.dias_restantes,
          stockActual,
          demandaPrevista: 0, // Se calcularía si es necesario
          accionSugerida: alerta.accion_sugerida || '',
          resuelta: alerta.resuelta || false,
          created_at: alerta.created_at
        }
      })
    )

    return alertasConStock
  } catch (error: any) {
    console.error('Error al obtener alertas de stock:', error)
    return []
  }
}

