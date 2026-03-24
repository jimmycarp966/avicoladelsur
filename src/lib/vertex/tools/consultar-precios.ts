/**
 * Tool: Consultar Precios / Lista de Precios
 * Permite al agente mostrar precios de productos al cliente por WhatsApp.
 */

import { createAdminClient } from '@/lib/supabase/server'

export interface ConsultarPreciosParams {
  cliente_id?: string
  producto_nombre?: string
  mostrar_todos?: boolean
}

export interface ProductoPrecio {
  codigo: string
  nombre: string
  precio: number
  unidad_medida: string
}

export interface ConsultarPreciosResult {
  success: boolean
  productos?: ProductoPrecio[]
  lista_nombre?: string
  error?: string
}

const PRICE_QUERY_STOP_WORDS = new Set([
  'hola',
  'holaa',
  'buen',
  'buena',
  'buenas',
  'buenos',
  'dia',
  'dias',
  'tarde',
  'tardes',
  'noche',
  'noches',
  'che',
  'por',
  'favor',
  'precio',
  'precios',
  'cuanto',
  'cuanta',
  'cuantos',
  'cuantas',
  'cuesta',
  'sale',
  'valor',
  'esta',
  'estan',
  'el',
  'la',
  'los',
  'las',
  'de',
  'del',
  'al',
  'un',
  'una',
  'unos',
  'unas',
  'kg',
  'kilo',
  'kilos',
  'me',
  'pasas',
  'pasame',
  'necesito',
  'quiero',
])

function normalizeSearchText(value: string): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function singularizeToken(token: string): string {
  if (token.length > 4 && token.endsWith('es')) {
    return token.slice(0, -2)
  }

  if (token.length > 3 && token.endsWith('s')) {
    return token.slice(0, -1)
  }

  return token
}

function extractMeaningfulTokens(value?: string): string[] {
  const normalized = normalizeSearchText(value || '')

  if (!normalized) {
    return []
  }

  const tokens = new Set<string>()

  for (const rawToken of normalized.split(' ')) {
    if (!rawToken || PRICE_QUERY_STOP_WORDS.has(rawToken)) {
      continue
    }

    tokens.add(rawToken)
    tokens.add(singularizeToken(rawToken))
  }

  return Array.from(tokens).filter(Boolean)
}

function scoreProductMatch(productName: string, queryTokens: string[]): number {
  if (queryTokens.length === 0) {
    return 0
  }

  const normalizedProduct = normalizeSearchText(productName)
  const productTokens = new Set(
    normalizedProduct
      .split(' ')
      .flatMap((token) => [token, singularizeToken(token)])
      .filter(Boolean)
  )

  let score = 0

  for (const token of queryTokens) {
    if (productTokens.has(token)) {
      score += 5
      continue
    }

    if (normalizedProduct.includes(token)) {
      score += 3
      continue
    }

    for (const productToken of productTokens) {
      if (productToken.startsWith(token) || token.startsWith(productToken)) {
        score += 2
        break
      }
    }
  }

  return score
}

/**
 * Tool para consultar precios de productos.
 * Si el cliente tiene lista de precios asignada, usa esa lista.
 * Si no, usa la lista por defecto "MAYORISTA".
 */
export async function consultarPreciosTool(
  params: ConsultarPreciosParams
): Promise<ConsultarPreciosResult> {
  try {
    const supabase = createAdminClient()

    let listaPrecioId: string | null = null
    let listaNombre = 'Lista General'

    if (params.cliente_id) {
      const { data: clienteLista } = await supabase
        .from('clientes_listas_precios')
        .select(`
          lista_precio_id,
          listas_precios (id, nombre)
        `)
        .eq('cliente_id', params.cliente_id)
        .eq('activo', true)
        .limit(1)
        .single()

      if (clienteLista?.lista_precio_id) {
        listaPrecioId = clienteLista.lista_precio_id
        listaNombre = (clienteLista.listas_precios as any)?.nombre || 'Lista del Cliente'
      }
    }

    if (!listaPrecioId) {
      const { data: listaMayorista } = await supabase
        .from('listas_precios')
        .select('id, nombre')
        .eq('nombre', 'MAYORISTA')
        .eq('activo', true)
        .limit(1)
        .single()

      if (listaMayorista) {
        listaPrecioId = listaMayorista.id
        listaNombre = listaMayorista.nombre
      }
    }

    const { data: productosBase, error: productosError } = await supabase
      .from('productos')
      .select('id, codigo, nombre, unidad_medida, precio_venta')
      .eq('activo', true)
      .order('nombre', { ascending: true })

    if (productosError || !productosBase || productosBase.length === 0) {
      return {
        success: false,
        error: 'No se encontraron productos activos',
      }
    }

    const queryTokens = extractMeaningfulTokens(params.producto_nombre)
    let productos = productosBase

    if (queryTokens.length > 0) {
      productos = productosBase
        .map((prod: any) => ({
          product: prod,
          score: scoreProductMatch(prod.nombre, queryTokens),
        }))
        .filter((item) => item.score > 0)
        .sort((a, b) => {
          if (b.score !== a.score) {
            return b.score - a.score
          }

          return a.product.nombre.localeCompare(b.product.nombre)
        })
        .map((item) => item.product)
    }

    if (!params.mostrar_todos) {
      productos = productos.slice(0, 15)
    }

    if (!productos || productos.length === 0) {
      return {
        success: false,
        error: 'No se encontraron productos activos',
      }
    }

    let productosConPrecios: ProductoPrecio[] = []

    if (listaPrecioId) {
      const { data: preciosLista } = await supabase
        .from('precios_productos')
        .select('producto_id, precio')
        .eq('lista_precio_id', listaPrecioId)

      const preciosMap = new Map(
        (preciosLista || []).map((precio: any) => [precio.producto_id, precio.precio])
      )

      productosConPrecios = productos.map((prod: any) => ({
        codigo: prod.codigo,
        nombre: prod.nombre,
        precio: preciosMap.get(prod.id) || prod.precio_venta || 0,
        unidad_medida: prod.unidad_medida || 'kg',
      }))
    } else {
      productosConPrecios = productos.map((prod: any) => ({
        codigo: prod.codigo,
        nombre: prod.nombre,
        precio: prod.precio_venta || 0,
        unidad_medida: prod.unidad_medida || 'kg',
      }))
    }

    return {
      success: true,
      productos: productosConPrecios,
      lista_nombre: listaNombre,
    }
  } catch (error) {
    console.error('[Tool: Consultar Precios] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

export const consultarPreciosToolDefinition = {
  name: 'consultar_precios',
  description:
    'Consulta la lista de precios de productos. Usalo cuando el cliente pregunte por precios, la lista de precios, o cuanto cuesta algo.',
  parameters: {
    type: 'object',
    properties: {
      cliente_id: {
        type: 'string',
        description: 'ID del cliente para usar su lista de precios personalizada (opcional)',
      },
      producto_nombre: {
        type: 'string',
        description: 'Nombre del producto a buscar (opcional). Ej: "filet", "pechuga", "ala"',
      },
      mostrar_todos: {
        type: 'boolean',
        description: 'Si es true, muestra todos los productos. Si es false, limita a 15 productos.',
      },
    },
    required: [],
  },
}
