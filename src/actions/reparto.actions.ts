'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type {
  CrearVehiculoParams,
  ChecklistVehiculoParams,
  CrearRutaParams,
  ValidacionEntregaParams,
  ApiResponse,
  RutaActivaResponse
} from '@/types/api.types'

// Crear vehículo
export async function crearVehiculo(
  params: CrearVehiculoParams
): Promise<ApiResponse<{ vehiculoId: string }>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('vehiculos')
      .insert({
        ...params,
        tipo_vehiculo: params.tipo_vehiculo || 'camioneta',
        seguro_vigente: true,
        activo: true,
      })
      .select()
      .single()

    if (error) throw error

    revalidatePath('/(admin)/(dominios)/reparto/vehiculos')

    return {
      success: true,
      data: { vehiculoId: data.id },
      message: 'Vehículo creado exitosamente',
    }
  } catch (error: any) {
    console.error('Error al crear vehículo:', error)
    return {
      success: false,
      error: error.message || 'Error al crear vehículo',
    }
  }
}

// Registrar checklist de vehículo
export async function registrarChecklistVehiculo(
  params: ChecklistVehiculoParams
): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('checklists_vehiculos')
      .insert({
        ...params,
        fecha_check: new Date().toISOString().split('T')[0], // Fecha actual
        aprobado: true, // Por defecto aprobado, se puede cambiar según lógica
      })
      .select()
      .single()

    if (error) throw error

    revalidatePath('/(admin)/(dominios)/reparto/vehiculos')

    return {
      success: true,
      message: 'Checklist de vehículo registrado exitosamente',
    }
  } catch (error: any) {
    console.error('Error al registrar checklist:', error)
    return {
      success: false,
      error: error.message || 'Error al registrar checklist de vehículo',
    }
  }
}

// Crear ruta
export async function crearRuta(
  params: CrearRutaParams
): Promise<ApiResponse<{ rutaId: string }>> {
  try {
    const supabase = await createClient()

    // Generar número de ruta único
    const numeroRuta = `RUT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`

    // Obtener repartidor
    const { data: repartidor, error: repartidorError } = await supabase
      .from('usuarios')
      .select('id')
      .eq('id', params.repartidor_id)
      .eq('rol', 'repartidor')
      .single()

    if (repartidorError) throw new Error('Repartidor no encontrado o no válido')

    // Crear ruta
    const { data: ruta, error: rutaError } = await supabase
      .from('rutas_reparto')
      .insert({
        numero_ruta: numeroRuta,
        vehiculo_id: params.vehiculo_id,
        repartidor_id: params.repartidor_id,
        fecha_ruta: params.fecha_ruta,
        estado: 'planificada',
        observaciones: params.observaciones,
      })
      .select()
      .single()

    if (rutaError) throw rutaError

    // Asignar pedidos a la ruta
    await asignarPedidosARuta(ruta.id, params.pedidos_ids)

    revalidatePath('/(admin)/(dominios)/reparto/rutas')

    return {
      success: true,
      data: { rutaId: ruta.id },
      message: 'Ruta creada exitosamente',
    }
  } catch (error: any) {
    console.error('Error al crear ruta:', error)
    return {
      success: false,
      error: error.message || 'Error al crear ruta',
    }
  }
}

// Asignar pedidos a ruta
export async function asignarPedidosARuta(
  rutaId: string,
  pedidosIds: string[]
): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    // Obtener pedidos y calcular orden de entrega
    const { data: pedidos, error: pedidosError } = await supabase
      .from('pedidos')
      .select(`
        id,
        clientes (
          zona_entrega,
          coordenadas
        )
      `)
      .in('id', pedidosIds)
      .eq('estado', 'preparando')

    if (pedidosError) throw pedidosError

    // Crear detalles de ruta (ordenados por zona y coordenadas)
    const detallesRuta = (pedidos as any[])
      .sort((a, b) => {
        // Lógica simple de ordenamiento por zona
        const zonaA = a.clientes?.zona_entrega || ''
        const zonaB = b.clientes?.zona_entrega || ''
        if (zonaA !== zonaB) return zonaA.localeCompare(zonaB)
        return 0
      })
      .map((pedido, index) => ({
        ruta_id: rutaId,
        pedido_id: pedido.id,
        orden_entrega: index + 1,
        coordenadas_entrega: pedido.clientes?.coordenadas,
        estado_entrega: 'pendiente',
      }))

    const { error: detallesError } = await supabase
      .from('detalles_ruta')
      .insert(detallesRuta)

    if (detallesError) throw detallesError

    // Actualizar estado de pedidos
    await supabase
      .from('pedidos')
      .update({ estado: 'enviado' })
      .in('id', pedidosIds)

    revalidatePath('/(admin)/(dominios)/reparto/rutas')
    revalidatePath('/(admin)/(dominios)/ventas/pedidos')

    return {
      success: true,
      message: 'Pedidos asignados a ruta exitosamente',
    }
  } catch (error: any) {
    console.error('Error al asignar pedidos a ruta:', error)
    return {
      success: false,
      error: error.message || 'Error al asignar pedidos a ruta',
    }
  }
}

// Iniciar ruta
export async function iniciarRuta(
  rutaId: string
): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('rutas_reparto')
      .update({
        estado: 'en_curso',
        updated_at: new Date().toISOString(),
      })
      .eq('id', rutaId)

    if (error) throw error

    revalidatePath('/(admin)/(dominios)/reparto/rutas')

    return {
      success: true,
      message: 'Ruta iniciada exitosamente',
    }
  } catch (error: any) {
    console.error('Error al iniciar ruta:', error)
    return {
      success: false,
      error: error.message || 'Error al iniciar ruta',
    }
  }
}

// Finalizar ruta
export async function finalizarRuta(
  rutaId: string
): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    // Calcular tiempo real y distancia
    const { data: ruta, error: rutaError } = await supabase
      .from('rutas_reparto')
      .select('*')
      .eq('id', rutaId)
      .single()

    if (rutaError) throw rutaError

    const tiempoInicio = new Date(ruta.created_at)
    const tiempoFin = new Date()
    const tiempoRealMin = Math.round((tiempoFin.getTime() - tiempoInicio.getTime()) / (1000 * 60))

    const { error: updateError } = await supabase
      .from('rutas_reparto')
      .update({
        estado: 'completada',
        tiempo_real_min: tiempoRealMin,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rutaId)

    if (updateError) throw updateError

    revalidatePath('/(admin)/(dominios)/reparto/rutas')

    return {
      success: true,
      message: 'Ruta finalizada exitosamente',
    }
  } catch (error: any) {
    console.error('Error al finalizar ruta:', error)
    return {
      success: false,
      error: error.message || 'Error al finalizar ruta',
    }
  }
}

// Actualizar estado de entrega
export async function actualizarEstadoEntrega(
  detalleRutaId: string,
  estado: string
): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    const updateData: any = {
      estado_entrega: estado,
      updated_at: new Date().toISOString(),
    }

    if (estado === 'entregado') {
      updateData.fecha_hora_entrega = new Date().toISOString()
    }

    const { error } = await supabase
      .from('detalles_ruta')
      .update(updateData)
      .eq('id', detalleRutaId)

    if (error) throw error

    revalidatePath('/(admin)/(dominios)/reparto/rutas')

    return {
      success: true,
      message: 'Estado de entrega actualizado exitosamente',
    }
  } catch (error: any) {
    console.error('Error al actualizar estado de entrega:', error)
    return {
      success: false,
      error: error.message || 'Error al actualizar estado de entrega',
    }
  }
}

// Validar entrega (usa función RPC)
export async function validarEntrega(
  params: ValidacionEntregaParams
): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.rpc('fn_validar_entrega', {
      p_pedido_id: params.pedido_id,
      p_firma_url: params.firma_url,
      p_qr_verificacion: params.qr_verificacion,
    })

    if (error) throw error

    if (!data.success) {
      throw new Error(data.error || 'Error al validar entrega')
    }

    revalidatePath('/(admin)/(dominios)/reparto/rutas')
    revalidatePath('/(admin)/(dominios)/ventas/pedidos')

    return {
      success: true,
      message: 'Entrega validada exitosamente',
    }
  } catch (error: any) {
    console.error('Error al validar entrega:', error)
    return {
      success: false,
      error: error.message || 'Error al validar entrega',
    }
  }
}

// Obtener ruta activa del repartidor
export async function obtenerRutaActiva(
  repartidorId: string
): Promise<ApiResponse<RutaActivaResponse | null>> {
  try {
    const supabase = await createClient()

    // Buscar ruta activa del repartidor
    const { data: ruta, error: rutaError } = await supabase
      .from('rutas_reparto')
      .select(`
        id,
        numero_ruta,
        fecha_ruta,
        estado,
        vehiculos (
          patente,
          marca,
          modelo
        ),
        detalles_ruta (
          estado_entrega
        )
      `)
      .eq('repartidor_id', repartidorId)
      .in('estado', ['planificada', 'en_curso'])
      .order('fecha_ruta', { ascending: false })
      .limit(1)
      .single()

    if (rutaError && rutaError.code !== 'PGRST116') throw rutaError

    if (!ruta) {
      return {
        success: true,
        data: null,
        message: 'No hay ruta activa',
      }
    }

    const entregasPendientes = ruta.detalles_ruta.filter((d: any) => d.estado_entrega === 'pendiente').length
    const entregasCompletadas = ruta.detalles_ruta.filter((d: any) => d.estado_entrega === 'entregado').length

    return {
      success: true,
      data: {
        ruta_id: ruta.id,
        numero_ruta: ruta.numero_ruta,
        fecha_ruta: ruta.fecha_ruta,
        estado: ruta.estado,
        vehiculo: {
          patente: (ruta as any).vehiculos.patente,
          marca: (ruta as any).vehiculos.marca,
          modelo: (ruta as any).vehiculos.modelo,
        },
        entregas_pendientes: entregasPendientes,
        entregas_completadas: entregasCompletadas,
      },
    }
  } catch (error: any) {
    console.error('Error al obtener ruta activa:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener ruta activa',
    }
  }
}
