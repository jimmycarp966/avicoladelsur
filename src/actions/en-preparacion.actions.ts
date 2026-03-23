'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { esVentaMayorista } from '@/lib/utils'
import { esItemPesable } from '@/lib/utils/pesaje'
import { devLog, devError } from '@/lib/utils/logger'

/**
 * Obtiene los presupuestos en estado en_almacen que están pendientes de preparación
 * (preparacion_completada = false) o ya fueron preparados (preparacion_completada = true)
 */
export async function obtenerPresupuestosEnPreparacionAction() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('presupuestos')
      .select(`
        *,
        pedido_convertido_id,
        cliente:clientes(nombre, telefono),
        zona:zonas(nombre),
        lista_precio:listas_precios(tipo),
        items:presupuesto_items(
          id,
          producto_id,
          pesable,
          peso_final,
          producto:productos(
            nombre,
            codigo,
            categoria,
            requiere_pesaje,
            venta_mayor_habilitada,
            kg_por_unidad_mayor,
            unidad_mayor_nombre,
            unidad_medida
          ),
          lista_precio:listas_precios(tipo),
          cantidad_solicitada,
          cantidad_reservada
        )
      `)
      .eq('estado', 'en_almacen')
      .order('created_at', { ascending: true })

    if (error) {
      devError('[en-preparacion] Error obteniendo presupuestos:', error)
      return {
        success: false,
        error: `Error al obtener presupuestos: ${error.message}`,
        data: []
      }
    }

    const presupuestos = (data || []).filter((presupuesto: any) => {
      if (presupuesto.pedido_convertido_id) {
        return false
      }

      const itemsPesables = (presupuesto.items || []).filter((item: any) =>
        esItemPesable(item, esVentaMayorista(presupuesto, item))
      )

      if (itemsPesables.length === 0) {
        return true
      }

      return itemsPesables.some((item: any) => !item.peso_final)
    })

    devLog('[en-preparacion] Presupuestos obtenidos:', presupuestos.length)

    return {
      success: true,
      data: presupuestos
    }
  } catch (error) {
    devError('[en-preparacion] Excepción obteniendo presupuestos:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
      data: []
    }
  }
}

/**
 * Marca un presupuesto como completado en su preparación de cámara frigorífica
 * El presupuesto sigue en estado en_almacen y aparece en "Presupuestos del Día"
 */
export async function marcarPreparacionListoAction(presupuestoId: string) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Verificar que el presupuesto existe
    const { data: presupuesto, error: presupuestoError } = await supabase
      .from('presupuestos')
      .select('id, numero_presupuesto, estado')
      .eq('id', presupuestoId)
      .single()

    if (presupuestoError || !presupuesto) {
      return { success: false, error: 'Presupuesto no encontrado' }
    }

    if (presupuesto.estado !== 'en_almacen') {
      return { success: false, error: 'Solo se pueden marcar presupuestos en almacén' }
    }

    // Actualizar preparación completada
    const { error } = await supabase
      .from('presupuestos')
      .update({
        preparacion_completada: true,
        preparacion_completada_at: new Date().toISOString(),
        preparado_por: user.id,
      })
      .eq('id', presupuestoId)

    if (error) {
      devError('[en-preparacion] Error marcando como listo:', error)
      return { success: false, error: `Error al marcar como listo: ${error.message}` }
    }

    devLog('[en-preparacion] Presupuesto marcado como listo:', presupuesto.numero_presupuesto)

    // Revalidar paths
    revalidatePath('/almacen/en-preparacion')
    revalidatePath('/almacen/presupuestos-dia')
    revalidatePath(`/almacen/presupuesto/${presupuestoId}/pesaje`)

    return {
      success: true,
      message: `Presupuesto ${presupuesto.numero_presupuesto} marcado como listo para pesaje`
    }
  } catch (error) {
    devError('[en-preparacion] Excepción marcando como listo:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

/**
 * Desmarca un presupuesto como completado, volviéndolo a poner pendiente de preparación
 */
export async function desmarcarPreparacionListoAction(presupuestoId: string) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Verificar que el presupuesto existe
    const { data: presupuesto, error: presupuestoError } = await supabase
      .from('presupuestos')
      .select('id, numero_presupuesto, estado')
      .eq('id', presupuestoId)
      .single()

    if (presupuestoError || !presupuesto) {
      return { success: false, error: 'Presupuesto no encontrado' }
    }

    // Actualizar preparación completada
    const { error } = await supabase
      .from('presupuestos')
      .update({
        preparacion_completada: false,
        preparacion_completada_at: null,
        preparado_por: null,
      })
      .eq('id', presupuestoId)

    if (error) {
      devError('[en-preparacion] Error desmarcando como listo:', error)
      return { success: false, error: `Error al desmarcar: ${error.message}` }
    }

    devLog('[en-preparacion] Presupuesto desmarcado:', presupuesto.numero_presupuesto)

    // Revalidar paths
    revalidatePath('/almacen/en-preparacion')
    revalidatePath('/almacen/presupuestos-dia')
    revalidatePath(`/almacen/presupuesto/${presupuestoId}/pesaje`)

    return {
      success: true,
      message: `Presupuesto ${presupuesto.numero_presupuesto} desmarcado`
    }
  } catch (error) {
    devError('[en-preparacion] Excepción desmarcando:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

/**
 * Obtiene el conteo de presupuestos pendientes de preparación
 * (en estado en_almacen y preparacion_completada = false)
 */
export async function obtenerConteoPendientesPreparacionAction(): Promise<{
  success: boolean
  data?: number
  error?: string
}> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('presupuestos')
      .select(`
        *,
        pedido_convertido_id,
        lista_precio:listas_precios(tipo),
        items:presupuesto_items(
          pesable,
          peso_final,
          producto:productos(
            categoria,
            requiere_pesaje,
            venta_mayor_habilitada
          ),
          lista_precio:listas_precios(tipo)
        )
      `)
      .eq('estado', 'en_almacen')

    if (error) {
      devError('[en-preparacion] Error obteniendo conteo:', error)
      return { success: false, error: error.message }
    }

    const presupuestos = (data || []).filter((presupuesto: any) => {
      if (presupuesto.pedido_convertido_id) {
        return false
      }

      const itemsPesables = (presupuesto.items || []).filter((item: any) =>
        esItemPesable(item, esVentaMayorista(presupuesto, item))
      )

      if (itemsPesables.length === 0) {
        return true
      }

      return itemsPesables.some((item: any) => !item.peso_final)
    })

    return { success: true, data: presupuestos.length }
  } catch (error) {
    devError('[en-preparacion] Excepción obteniendo conteo:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}
