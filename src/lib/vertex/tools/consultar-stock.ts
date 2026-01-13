/**
 * Tool: Consultar Stock
 * Permite al agente consultar stock de productos
 */

import { createAdminClient } from '@/lib/supabase/server'

export interface ConsultarStockParams {
  producto_nombre?: string
  producto_id?: string
}

export interface ProductoStock {
  id: string
  nombre: string
  stock_disponible: number
  unidad_medida: string
  categoria?: string
}

export interface ConsultarStockResult {
  success: boolean
  productos?: ProductoStock[]
  message?: string
  error?: string
}

/**
 * Tool para consultar stock de productos
 */
export async function consultarStockTool(
  params: ConsultarStockParams
): Promise<ConsultarStockResult> {
  try {
    const supabase = createAdminClient()

    let query = supabase
      .from('productos')
      .select(
        `
        id,
        nombre,
        categoria,
        unidad_medida,
        lotes!inner(
          cantidad_disponible,
          estado
        )
      `
      )
      .eq('activo', true)
      .eq('lotes.estado', 'disponible')
      .order('nombre')

    // Filtrar por nombre si se proporciona
    if (params.producto_nombre) {
      query = query.ilike('nombre', `%${params.producto_nombre}%`)
    }

    // Filtrar por ID si se proporciona
    if (params.producto_id) {
      query = query.eq('id', params.producto_id)
    }

    const { data: productos, error } = await query.limit(10)

    if (error) {
      return {
        success: false,
        error: error.message
      }
    }

    if (!productos || productos.length === 0) {
      return {
        success: true,
        productos: [],
        message: 'No hay productos disponibles con esos criterios'
      }
    }

    const productosConStock: ProductoStock[] = (productos as any[]).map((p) => {
      const stockDisponible = (p.lotes || []).reduce(
        (acc: number, l: any) => acc + Number(l?.cantidad_disponible || 0),
        0
      )

      return {
        id: p.id,
        nombre: p.nombre,
        categoria: p.categoria || undefined,
        unidad_medida: p.unidad_medida,
        stock_disponible: stockDisponible,
      }
    })

    return {
      success: true,
      productos: productosConStock.filter((p) => p.stock_disponible > 0),
      message: `Encontré ${productosConStock.filter((p) => p.stock_disponible > 0).length} productos disponibles`
    }
  } catch (error) {
    console.error('[Tool: Consultar Stock] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

/**
 * Descripción de la tool para Vertex AI
 */
export const consultarStockToolDefinition = {
  name: 'consultar_stock',
  description:
    'Consulta el stock disponible de productos. Úsalo cuando el cliente pregunte por disponibilidad o quiera saber qué productos hay.',
  parameters: {
    type: 'object',
    properties: {
      producto_nombre: {
        type: 'string',
        description: 'Nombre del producto a buscar (parcial)'
      },
      producto_id: {
        type: 'string',
        description: 'ID exacto del producto'
      }
    }
  }
}
