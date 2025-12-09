'use server'

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { devError, devLog } from '@/lib/utils/logger'
import {
  listaPrecioSchema,
  precioProductoSchema,
  asignarListaClienteSchema,
  actualizarPrioridadListaSchema,
} from '@/lib/schemas/listas-precios.schema'
import type { ApiResponse } from '@/types/api.types'

// Obtener todas las listas de precios
export async function obtenerListasPreciosAction(filtros?: {
  activa?: boolean
  tipo?: string
}): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    let query = supabase
      .from('listas_precios')
      .select('*')
      .order('tipo', { ascending: true })
      .order('nombre', { ascending: true })

    if (filtros?.activa !== undefined) {
      query = query.eq('activa', filtros.activa)
    }

    if (filtros?.tipo) {
      query = query.eq('tipo', filtros.tipo)
    }

    const { data, error } = await query

    if (error) {
      devError('Error obteniendo listas de precios:', error)
      return { success: false, error: 'Error al obtener listas de precios' }
    }

    // Filtrar por vigencia si está activada
    const hoy = new Date().toISOString().split('T')[0]
    const listasValidas = data?.filter((lista) => {
      // Si la lista no está activa, no incluirlo si se filtró por activa=true
      if (filtros?.activa === true && !lista.activa) {
        return false
      }
      
      // Si vigencia_activa está desactivada o es false, la lista está siempre vigente
      if (!lista.vigencia_activa) {
        return true
      }

      // Si vigencia_activa está activada, validar fechas
      const desdeValida = !lista.fecha_vigencia_desde || lista.fecha_vigencia_desde <= hoy
      const hastaValida = !lista.fecha_vigencia_hasta || lista.fecha_vigencia_hasta >= hoy
      
      return desdeValida && hastaValida
    }) || []

    return { success: true, data: listasValidas }
  } catch (error) {
    devError('Error en obtenerListasPreciosAction:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Obtener una lista de precios por ID
export async function obtenerListaPrecioAction(listaPrecioId: string): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    // Verificar permisos del usuario primero
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      devError('Error de autenticación:', userError)
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Verificar rol del usuario
    const { data: usuario, error: rolError } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (rolError || !usuario) {
      devError('Error obteniendo rol del usuario:', rolError)
      return { success: false, error: 'Error obteniendo información del usuario' }
    }

    devLog('Usuario actual:', { id: user.id, rol: usuario.rol })

    const { data, error } = await supabase
      .from('listas_precios')
      .select('*')
      .eq('id', listaPrecioId)
      .single()

    if (error) {
      devError('Error obteniendo lista de precios:', error)
      devError('Código de error:', error.code)
      devError('Mensaje de error:', error.message)
      devError('Detalles del error:', error.details)
      return { success: false, error: `Error al obtener lista de precios: ${error.message || 'Error desconocido'}` }
    }

    return { success: true, data }
  } catch (error) {
    devError('Error en obtenerListaPrecioAction:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Crear lista de precios
export async function crearListaPrecioAction(formData: FormData): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    // Verificar permisos (solo admin)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || usuario.rol !== 'admin') {
      return { success: false, error: 'No tienes permisos para crear listas de precios' }
    }

    // Validar datos
    const rawData = Object.fromEntries(formData)
    const data = listaPrecioSchema.parse({
      codigo: rawData.codigo,
      nombre: rawData.nombre,
      tipo: rawData.tipo,
      activa: rawData.activa === 'true',
      vigencia_activa: rawData.vigencia_activa === 'true',
      fecha_vigencia_desde: rawData.fecha_vigencia_desde || undefined,
      fecha_vigencia_hasta: rawData.fecha_vigencia_hasta || undefined,
    })

    const { data: lista, error } = await supabase
      .from('listas_precios')
      .insert(data)
      .select()
      .single()

    if (error) {
      devError('Error creando lista de precios:', error)
      return { success: false, error: 'Error al crear lista de precios' }
    }

    revalidatePath('/ventas/listas-precios')
    return { success: true, data: lista, message: 'Lista de precios creada exitosamente' }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    devError('Error en crearListaPrecioAction:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Actualizar lista de precios
export async function actualizarListaPrecioAction(
  listaPrecioId: string,
  formData: FormData
): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    // Verificar permisos (solo admin)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || usuario.rol !== 'admin') {
      return { success: false, error: 'No tienes permisos para actualizar listas de precios' }
    }

    // Validar datos
    const rawData = Object.fromEntries(formData)
    const data = listaPrecioSchema.parse({
      codigo: rawData.codigo,
      nombre: rawData.nombre,
      tipo: rawData.tipo,
      activa: rawData.activa === 'true',
      vigencia_activa: rawData.vigencia_activa === 'true',
      margen_ganancia: rawData.margen_ganancia ? parseFloat(rawData.margen_ganancia as string) : undefined,
      fecha_vigencia_desde: rawData.fecha_vigencia_desde || undefined,
      fecha_vigencia_hasta: rawData.fecha_vigencia_hasta || undefined,
    })

    const { error } = await supabase
      .from('listas_precios')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', listaPrecioId)

    if (error) {
      devError('Error actualizando lista de precios:', error)
      return { success: false, error: 'Error al actualizar lista de precios' }
    }

    revalidatePath('/ventas/listas-precios')
    revalidatePath(`/ventas/listas-precios/${listaPrecioId}`)
    return { success: true, message: 'Lista de precios actualizada exitosamente' }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    devError('Error en actualizarListaPrecioAction:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Obtener listas asignadas a un cliente
export async function obtenerListasClienteAction(clienteId: string): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('clientes_listas_precios')
      .select(`
        *,
        lista_precio:listas_precios(*)
      `)
      .eq('cliente_id', clienteId)
      .eq('activa', true)
      .order('prioridad', { ascending: true })

    if (error) {
      devError('Error obteniendo listas del cliente:', error)
      return { success: false, error: 'Error al obtener listas del cliente' }
    }

    // Filtrar listas que no están vigentes (si tienen vigencia activada)
    const hoy = new Date().toISOString().split('T')[0]
    const listasValidas = data?.filter((asignacion) => {
      const lista = asignacion.lista_precio
      
      // Si la lista no está activa, no incluirla
      if (!lista?.activa) {
        return false
      }
      
      // Si vigencia_activa está desactivada o es false, la lista está siempre vigente
      if (!lista.vigencia_activa) {
        return true
      }

      // Si vigencia_activa está activada, validar fechas
      const desdeValida = !lista.fecha_vigencia_desde || lista.fecha_vigencia_desde <= hoy
      const hastaValida = !lista.fecha_vigencia_hasta || lista.fecha_vigencia_hasta >= hoy
      
      return desdeValida && hastaValida
    }) || []

    return { success: true, data: listasValidas }
  } catch (error) {
    devError('Error en obtenerListasClienteAction:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Asignar lista a cliente
export async function asignarListaClienteAction(
  clienteId: string,
  listaPrecioId: string
): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    // Verificar permisos (solo admin)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || usuario.rol !== 'admin') {
      return { success: false, error: 'No tienes permisos para asignar listas' }
    }

    // Validar que no exceda el límite de 2 listas
    const { data: listasExistentes } = await supabase
      .from('clientes_listas_precios')
      .select('id')
      .eq('cliente_id', clienteId)
      .eq('activa', true)

    if (listasExistentes && listasExistentes.length >= 2) {
      return { success: false, error: 'El cliente ya tiene 2 listas activas' }
    }

    // Verificar si ya existe la asignación
    const { data: existe } = await supabase
      .from('clientes_listas_precios')
      .select('id')
      .eq('cliente_id', clienteId)
      .eq('lista_precio_id', listaPrecioId)
      .single()

    if (existe) {
      // Si existe pero está inactiva, activarla
      const { error } = await supabase
        .from('clientes_listas_precios')
        .update({ activa: true, updated_at: new Date().toISOString() })
        .eq('id', existe.id)

      if (error) {
        return { success: false, error: 'Error al activar lista' }
      }
    } else {
      // Crear nueva asignación
      const prioridad = listasExistentes ? listasExistentes.length + 1 : 1

      const { error } = await supabase
        .from('clientes_listas_precios')
        .insert({
          cliente_id: clienteId,
          lista_precio_id: listaPrecioId,
          es_automatica: false,
          prioridad,
          activa: true,
        })

      if (error) {
        devError('Error asignando lista:', error)
        return { success: false, error: 'Error al asignar lista' }
      }
    }

    revalidatePath(`/ventas/clientes/${clienteId}`)
    return { success: true, message: 'Lista asignada exitosamente' }
  } catch (error) {
    devError('Error en asignarListaClienteAction:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Desasignar lista de cliente
export async function desasignarListaClienteAction(
  clienteId: string,
  listaPrecioId: string
): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    // Verificar permisos (solo admin)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || usuario.rol !== 'admin') {
      return { success: false, error: 'No tienes permisos para desasignar listas' }
    }

    // No permitir desasignar listas automáticas
    const { data: asignacion } = await supabase
      .from('clientes_listas_precios')
      .select('es_automatica')
      .eq('cliente_id', clienteId)
      .eq('lista_precio_id', listaPrecioId)
      .single()

    if (asignacion?.es_automatica) {
      return { success: false, error: 'No se puede desasignar una lista automática' }
    }

    const { error } = await supabase
      .from('clientes_listas_precios')
      .update({ activa: false, updated_at: new Date().toISOString() })
      .eq('cliente_id', clienteId)
      .eq('lista_precio_id', listaPrecioId)

    if (error) {
      devError('Error desasignando lista:', error)
      return { success: false, error: 'Error al desasignar lista' }
    }

    revalidatePath(`/ventas/clientes/${clienteId}`)
    return { success: true, message: 'Lista desasignada exitosamente' }
  } catch (error) {
    devError('Error en desasignarListaClienteAction:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Obtener precio de un producto en una lista específica
export async function obtenerPrecioProductoAction(
  listaPrecioId: string,
  productoId: string
): Promise<ApiResponse<{ precio: number }>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.rpc('fn_obtener_precio_producto', {
      p_lista_precio_id: listaPrecioId,
      p_producto_id: productoId,
    })

    if (error) {
      devError('Error obteniendo precio:', error)
      // Fallback a precio_venta del producto
      const { data: producto } = await supabase
        .from('productos')
        .select('precio_venta')
        .eq('id', productoId)
        .single()

      return {
        success: true,
        data: { precio: producto?.precio_venta || 0 },
      }
    }

    return { success: true, data: { precio: data || 0 } }
  } catch (error) {
    devError('Error en obtenerPrecioProductoAction:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Obtener precios de todos los productos en una lista
export async function obtenerPreciosListaAction(listaPrecioId: string): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    // Verificar permisos del usuario primero
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      devError('Error de autenticación:', userError)
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Verificar rol del usuario
    const { data: usuario, error: rolError } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (rolError || !usuario) {
      devError('Error obteniendo rol del usuario:', rolError)
      return { success: false, error: 'Error obteniendo información del usuario' }
    }

    devLog('Usuario actual para precios:', { id: user.id, rol: usuario.rol })

    const { data, error } = await supabase
      .from('precios_productos')
      .select(`
        *,
        producto:productos(id, codigo, nombre, precio_venta, unidad_medida)
      `)
      .eq('lista_precio_id', listaPrecioId)
      .eq('activo', true)

    if (error) {
      devError('Error obteniendo precios de lista:', error)
      devError('Código de error:', error.code)
      devError('Mensaje de error:', error.message)
      devError('Detalles del error:', error.details)
      return { success: false, error: `Error al obtener precios: ${error.message || 'Error desconocido'}` }
    }

    // Ordenar por nombre del producto en JavaScript
    const dataOrdenada = (data || []).sort((a: any, b: any) => {
      const nombreA = a.producto?.nombre || ''
      const nombreB = b.producto?.nombre || ''
      return nombreA.localeCompare(nombreB)
    })

    return { success: true, data: dataOrdenada }
  } catch (error) {
    devError('Error en obtenerPreciosListaAction:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Función de diagnóstico para verificar estado de las tablas
// Función de diagnóstico para verificar estado de las tablas
export async function diagnosticarListasPreciosAction(): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    // Verificar autenticación
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado', data: { userError } }
    }

    // Verificar rol
    const { data: usuario, error: rolError } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (rolError || !usuario) {
      return { success: false, error: 'Error obteniendo rol', data: { rolError } }
    }

    const diagnostico = {
      usuario: { id: user.id, rol: usuario.rol },
      tablas: {} as any,
      politicas: {} as any
    }

    // Verificar tablas existen
    try {
      const { data: listas, error: listasError } = await supabase
        .from('listas_precios')
        .select('count', { count: 'exact', head: true })

      diagnostico.tablas.listas_precios = {
        existe: !listasError,
        error: listasError,
        count: listas?.length || 0
      }
    } catch (error) {
      diagnostico.tablas.listas_precios = { existe: false, error }
    }

    try {
      const { data: precios, error: preciosError } = await supabase
        .from('precios_productos')
        .select('count', { count: 'exact', head: true })

      diagnostico.tablas.precios_productos = {
        existe: !preciosError,
        error: preciosError,
        count: precios?.length || 0
      }
    } catch (error) {
      diagnostico.tablas.precios_productos = { existe: false, error }
    }

    return { success: true, data: diagnostico }
  } catch (error) {
    devError('Error en diagnóstico:', error)
    return { success: false, error: 'Error en diagnóstico', data: { error } }
  }
}

// Crear o actualizar precio de producto en lista
export async function guardarPrecioProductoAction(formData: FormData): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    // Verificar permisos (solo admin)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || usuario.rol !== 'admin') {
      return { success: false, error: 'No tienes permisos para modificar precios' }
    }

    // Validar datos
    const rawData = Object.fromEntries(formData)
    const data = precioProductoSchema.parse({
      lista_precio_id: rawData.lista_precio_id,
      producto_id: rawData.producto_id,
      precio: parseFloat(rawData.precio as string),
      fecha_desde: rawData.fecha_desde || undefined,
      fecha_hasta: rawData.fecha_hasta || undefined,
      activo: rawData.activo === 'true',
    })

    // Verificar si ya existe un precio activo para esta combinación
    const { data: precioExistente } = await supabase
      .from('precios_productos')
      .select('id')
      .eq('lista_precio_id', data.lista_precio_id)
      .eq('producto_id', data.producto_id)
      .eq('activo', true)
      .single()

    if (precioExistente) {
      // Actualizar precio existente
      const { error } = await supabase
        .from('precios_productos')
        .update({
          precio: data.precio,
          fecha_desde: data.fecha_desde || null,
          fecha_hasta: data.fecha_hasta || null,
          activo: data.activo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', precioExistente.id)

      if (error) {
        devError('Error actualizando precio:', error)
        return { success: false, error: 'Error al actualizar precio' }
      }
    } else {
      // Crear nuevo precio
      const { error } = await supabase.from('precios_productos').insert(data)

      if (error) {
        devError('Error creando precio:', error)
        return { success: false, error: 'Error al crear precio' }
      }
    }

    revalidatePath(`/ventas/listas-precios/${data.lista_precio_id}`)
    return { success: true, message: 'Precio guardado exitosamente' }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message }
    }
    devError('Error en guardarPrecioProductoAction:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Obtener todos los precios de un producto en todas las listas
export async function obtenerPreciosProductoEnTodasListasAction(
  productoId: string
): Promise<ApiResponse<Array<{
  lista_precio_id: string
  lista_precio: {
    id: string
    codigo: string
    nombre: string
    tipo: string
    margen_ganancia: number | null
  }
  precio: number | null
  activo: boolean
  fecha_desde: string | null
  fecha_hasta: string | null
}>>> {
  try {
    const supabase = await createClient()

    // Obtener todos los precios del producto en todas las listas
    const { data: precios, error: preciosError } = await supabase
      .from('precios_productos')
      .select(`
        lista_precio_id,
        precio,
        activo,
        fecha_desde,
        fecha_hasta,
        lista_precio:listas_precios(
          id,
          codigo,
          nombre,
          tipo,
          margen_ganancia
        )
      `)
      .eq('producto_id', productoId)

    if (preciosError) {
      devError('Error obteniendo precios del producto:', preciosError)
      return { success: false, error: 'Error al obtener precios del producto' }
    }

    // Ordenar por nombre de la lista de precios en JavaScript
    const preciosOrdenados = (precios || []).sort((a: any, b: any) => {
      const nombreA = a.lista_precio?.nombre || ''
      const nombreB = b.lista_precio?.nombre || ''
      return nombreA.localeCompare(nombreB)
    })

    // Obtener todas las listas activas para mostrar también las que no tienen precio configurado
    const { data: todasLasListas, error: listasError } = await supabase
      .from('listas_precios')
      .select('id, codigo, nombre, tipo, margen_ganancia')
      .eq('activa', true)
      .order('nombre', { ascending: true })

    if (listasError) {
      devError('Error obteniendo listas:', listasError)
      return { success: false, error: 'Error al obtener listas de precios' }
    }

    // Combinar: precios existentes + listas sin precio
    const preciosMap = new Map(
      preciosOrdenados.map((p: any) => [
        p.lista_precio_id,
        {
          lista_precio_id: p.lista_precio_id,
          lista_precio: p.lista_precio,
          precio: p.precio,
          activo: p.activo,
          fecha_desde: p.fecha_desde,
          fecha_hasta: p.fecha_hasta,
        },
      ])
    )

    // Agregar listas que no tienen precio configurado
    const resultado = todasLasListas.map((lista) => {
      const precioExistente = preciosMap.get(lista.id)
      if (precioExistente) {
        return precioExistente
      }
      // Si no hay precio configurado, retornar null para precio (se calculará con margen o precio_venta)
      return {
        lista_precio_id: lista.id,
        lista_precio: lista,
        precio: null as number | null,
        activo: false,
        fecha_desde: null,
        fecha_hasta: null,
      }
    })

    return { success: true, data: resultado }
  } catch (error) {
    devError('Error en obtenerPreciosProductoEnTodasListasAction:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

