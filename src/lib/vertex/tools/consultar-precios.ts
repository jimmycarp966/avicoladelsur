/**
 * Tool: Consultar Precios / Lista de Precios
 * Permite al agente mostrar precios de productos al cliente por WhatsApp
 */

import { createAdminClient } from '@/lib/supabase/server'

export interface ConsultarPreciosParams {
    cliente_id?: string // Si tiene cliente, usa su lista de precios
    producto_nombre?: string // Filtro opcional por nombre de producto
    mostrar_todos?: boolean // Si true, muestra todos los productos activos
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

/**
 * Tool para consultar precios de productos
 * Si el cliente tiene lista de precios asignada, usa esa lista
 * Si no, usa la lista por defecto "MAYORISTA"
 */
export async function consultarPreciosTool(
    params: ConsultarPreciosParams
): Promise<ConsultarPreciosResult> {
    try {
        const supabase = createAdminClient()

        let listaPrecioId: string | null = null
        let listaNombre = 'Lista General'

        // 1. Si hay cliente_id, buscar su lista de precios asignada
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

        // 2. Si no tiene lista asignada, buscar lista "MAYORISTA" por defecto
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

        // 3. Obtener productos activos
        let productosQuery = supabase
            .from('productos')
            .select('id, codigo, nombre, unidad_medida, precio_venta')
            .eq('activo', true)
            .order('nombre', { ascending: true })

        // Filtrar por nombre si se especificó
        if (params.producto_nombre) {
            productosQuery = productosQuery.ilike('nombre', `%${params.producto_nombre}%`)
        }

        // Limitar cantidad si no pide todos
        if (!params.mostrar_todos) {
            productosQuery = productosQuery.limit(15)
        }

        const { data: productos, error: prodError } = await productosQuery

        if (prodError || !productos || productos.length === 0) {
            return {
                success: false,
                error: 'No se encontraron productos activos'
            }
        }

        // 4. Si hay lista de precios, obtener precios de esa lista
        let productosConPrecios: ProductoPrecio[] = []

        if (listaPrecioId) {
            // Obtener precios de la lista específica
            const { data: preciosLista } = await supabase
                .from('precios_productos')
                .select('producto_id, precio')
                .eq('lista_precio_id', listaPrecioId)

            const preciosMap = new Map(
                (preciosLista || []).map((p: any) => [p.producto_id, p.precio])
            )

            productosConPrecios = productos.map((prod: any) => ({
                codigo: prod.codigo,
                nombre: prod.nombre,
                precio: preciosMap.get(prod.id) || prod.precio_venta || 0,
                unidad_medida: prod.unidad_medida || 'kg'
            }))
        } else {
            // Usar precio_venta por defecto
            productosConPrecios = productos.map((prod: any) => ({
                codigo: prod.codigo,
                nombre: prod.nombre,
                precio: prod.precio_venta || 0,
                unidad_medida: prod.unidad_medida || 'kg'
            }))
        }

        return {
            success: true,
            productos: productosConPrecios,
            lista_nombre: listaNombre
        }
    } catch (error) {
        console.error('[Tool: Consultar Precios] Error:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido'
        }
    }
}

/**
 * Descripción de la tool para Vertex AI
 */
export const consultarPreciosToolDefinition = {
    name: 'consultar_precios',
    description:
        'Consulta la lista de precios de productos. Úsalo cuando el cliente pregunte por precios, la lista de precios, o cuánto cuesta algo.',
    parameters: {
        type: 'object',
        properties: {
            cliente_id: {
                type: 'string',
                description: 'ID del cliente para usar su lista de precios personalizada (opcional)'
            },
            producto_nombre: {
                type: 'string',
                description: 'Nombre del producto a buscar (opcional). Ej: "filet", "pechuga", "ala"'
            },
            mostrar_todos: {
                type: 'boolean',
                description: 'Si es true, muestra todos los productos. Si es false, limita a 15 productos.'
            }
        },
        required: []
    }
}
