/**
 * Tool para recuperar carritos del catálogo web
 * Permite al bot acceder a carritos guardados por código
 */

import { createAdminClient } from '@/lib/supabase/server'

interface RecuperarCarritoParams {
  codigo: string
  telefono?: string
}

interface RecuperarCarritoResult {
  success: boolean
  carrito?: {
    codigo: string
    items: Array<{
      producto_id: string
      producto_nombre: string
      cantidad: number
      peso_aprox?: number
      precio_unitario: number
    }>
    total_estimado: number
    estado: string
  }
  error?: string
}

/**
 * Recupera un carrito por su código
 */
export async function recuperarCarritoTool({
  codigo,
  telefono
}: RecuperarCarritoParams): Promise<RecuperarCarritoResult> {
  try {
    const supabase = createAdminClient()

    // Buscar carrito por código
    const { data: carrito, error } = await supabase
      .from('carritos_pendientes')
      .select('*')
      .eq('codigo', codigo.toUpperCase())
      .single()

    if (error || !carrito) {
      return {
        success: false,
        error: 'No encontré un carrito con ese código. Verificá que esté bien escrito.'
      }
    }

    // Verificar que el teléfono coincida (si se proporcionó)
    if (telefono && carrito.telefono_cliente) {
      const telefonoNormalizado = telefono.replace(/[\s\-\(\)]/g, '').slice(-10)
      const telefonoCarrito = carrito.telefono_cliente.replace(/[\s\-\(\)]/g, '').slice(-10)

      if (telefonoCarrito && telefonoNormalizado !== telefonoCarrito) {
        return {
          success: false,
          error: 'El carrito no corresponde a este número de teléfono.'
        }
      }
    }

    // Verificar que no esté expirado
    if (carrito.fecha_expiracion && new Date(carrito.fecha_expiracion) < new Date()) {
      return {
        success: false,
        error: 'El carrito expiró. Por favor, armá uno nuevo desde el catálogo.'
      }
    }

    // Verificar estado
    if (carrito.estado === 'convertido') {
      return {
        success: false,
        error: 'Este carrito ya fue procesado.'
      }
    }

    if (carrito.estado === 'cancelado') {
      return {
        success: false,
        error: 'Este carrito fue cancelado.'
      }
    }

    // Parsear items
    let items: any[] = []
    try {
      if (typeof carrito.items === 'string') {
        items = JSON.parse(carrito.items)
      } else {
        items = carrito.items
      }
    } catch (e) {
      items = []
    }

    // Marcar como confirmado
    await supabase
      .from('carritos_pendientes')
      .update({
        estado: 'confirmado',
        confirmado_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('codigo', codigo.toUpperCase())

    return {
      success: true,
      carrito: {
        codigo: carrito.codigo,
        items,
        total_estimado: carrito.total_estimado,
        estado: carrito.estado
      }
    }

  } catch (error) {
    console.error('[Recuperar Carrito] Error:', error)
    return {
      success: false,
      error: 'Ocurrió un error al recuperar el carrito.'
    }
  }
}

/**
 * Convierte un carrito recuperado en formato para crear presupuesto
 */
export function carritoAPresupuesto(carrito: RecuperarCarritoResult['carrito']) {
  if (!carrito) return []

  return carrito.items.map(item => ({
    producto_id: item.producto_id,
    cantidad: item.cantidad,
    peso_final: item.peso_aprox,
  }))
}
