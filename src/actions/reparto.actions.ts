'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { generateRutaOptimizada } from '@/lib/services/ruta-optimizer'
import { getNowArgentina, getTodayArgentina } from '@/lib/utils'
import { optimizeRouteLocal, generateSimplePolyline, haversineDistance } from '@/lib/rutas/local-optimizer'
import { config } from '@/lib/config'
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
        tipo_vehiculo: params.tipo_vehiculo || 'Camioneta',
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
): Promise<ApiResponse<{ checklistId: string }>> {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('Usuario no autenticado')
    }

    const { data, error } = await supabase
      .from('checklists_vehiculos')
      .insert({
        ...params,
        usuario_id: user.id,
        fecha_check: getTodayArgentina(), // Fecha actual
        aprobado: true, // Por defecto aprobado, se puede cambiar según lógica
      })
      .select()
      .single()

    if (error) throw error

    revalidatePath('/(admin)/(dominios)/reparto/vehiculos')

    return {
      success: true,
      data: { checklistId: data.id },
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

    // Obtener número de ruta secuencial desde la base de datos
    const { data: numeroRutaData, error: numeroError } = await supabase
      .rpc('obtener_siguiente_numero_ruta')

    if (numeroError || !numeroRutaData) {
      throw new Error('Error al generar número de ruta: ' + (numeroError?.message || 'Desconocido'))
    }

    const numeroRuta = numeroRutaData as string

    // Obtener repartidor
    const { data: repartidor, error: repartidorError } = await supabase
      .from('usuarios')
      .select('id')
      .eq('id', params.repartidor_id)
      .eq('rol', 'repartidor')
      .single()

    if (repartidorError) throw new Error('Repartidor no encontrado o no válido')

    // Validar que se proporcionen turno y zona_id
    if (!params.turno || !params.zona_id) {
      throw new Error('Turno y zona_id son obligatorios para crear una ruta')
    }

    if (!['mañana', 'tarde'].includes(params.turno)) {
      throw new Error('Turno inválido. Debe ser "mañana" o "tarde"')
    }

    // Crear ruta
    const { data: ruta, error: rutaError } = await supabase
      .from('rutas_reparto')
      .insert({
        numero_ruta: numeroRuta,
        vehiculo_id: params.vehiculo_id,
        repartidor_id: params.repartidor_id,
        fecha_ruta: params.fecha_ruta,
        turno: params.turno,
        zona_id: params.zona_id,
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

// Actualizar ruta (solo rutas planificadas)
export async function actualizarRuta(
  rutaId: string,
  params: Partial<CrearRutaParams>
): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    // Verificar permisos
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
      return { success: false, error: 'Solo los administradores pueden editar rutas' }
    }

    // Verificar que la ruta existe y está en estado planificada
    const { data: ruta, error: rutaError } = await supabase
      .from('rutas_reparto')
      .select('estado')
      .eq('id', rutaId)
      .single()

    if (rutaError) throw rutaError
    if (!ruta) {
      return { success: false, error: 'Ruta no encontrada' }
    }

    if (ruta.estado !== 'planificada') {
      return {
        success: false,
        error: `No se puede editar una ruta en estado "${ruta.estado}". Solo se pueden editar rutas planificadas.`,
      }
    }

    // Validar turno si se proporciona
    if (params.turno && !['mañana', 'tarde'].includes(params.turno)) {
      return { success: false, error: 'Turno inválido. Debe ser "mañana" o "tarde"' }
    }

    // Validar repartidor si se proporciona
    if (params.repartidor_id) {
      const { data: repartidor, error: repartidorError } = await supabase
        .from('usuarios')
        .select('id')
        .eq('id', params.repartidor_id)
        .eq('rol', 'repartidor')
        .single()

      if (repartidorError || !repartidor) {
        return { success: false, error: 'Repartidor no encontrado o no válido' }
      }
    }

    // Preparar datos de actualización
    const updateData: any = {
      updated_at: getNowArgentina().toISOString(),
    }

    if (params.vehiculo_id) updateData.vehiculo_id = params.vehiculo_id
    if (params.repartidor_id) updateData.repartidor_id = params.repartidor_id
    if (params.fecha_ruta) updateData.fecha_ruta = params.fecha_ruta
    if (params.turno) updateData.turno = params.turno
    if (params.zona_id) updateData.zona_id = params.zona_id
    if (params.observaciones !== undefined) updateData.observaciones = params.observaciones

    // Actualizar ruta
    const { error: updateError } = await supabase
      .from('rutas_reparto')
      .update(updateData)
      .eq('id', rutaId)

    if (updateError) throw updateError

    // Si se proporcionan nuevos pedidos, reasignar
    if (params.pedidos_ids && params.pedidos_ids.length > 0) {
      // Eliminar asignaciones anteriores
      await supabase.from('detalles_ruta').delete().eq('ruta_id', rutaId)
      // Asignar nuevos pedidos
      await asignarPedidosARuta(rutaId, params.pedidos_ids)
    }

    revalidatePath('/(admin)/(dominios)/reparto/rutas')
    revalidatePath(`/(admin)/(dominios)/reparto/rutas/${rutaId}`)

    return {
      success: true,
      message: 'Ruta actualizada exitosamente',
    }
  } catch (error: any) {
    console.error('Error al actualizar ruta:', error)
    return {
      success: false,
      error: error.message || 'Error al actualizar ruta',
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

    // Obtener información de la ruta para validar
    const { data: ruta, error: rutaError } = await supabase
      .from('rutas_reparto')
      .select('fecha_ruta, turno, zona_id')
      .eq('id', rutaId)
      .single()

    if (rutaError || !ruta) {
      throw new Error('Ruta no encontrada')
    }

    // Obtener pedidos y validar que cumplan condiciones
    const { data: pedidos, error: pedidosError } = await supabase
      .from('pedidos')
      .select(`
        id,
        fecha_entrega_estimada,
        turno,
        zona_id,
        estado,
        clientes (
          zona_entrega,
          coordenadas
        )
      `)
      .in('id', pedidosIds)
      .eq('estado', 'preparando')

    if (pedidosError) throw pedidosError

    if (!pedidos || pedidos.length === 0) {
      throw new Error('No se encontraron pedidos válidos')
    }

    // Validar que todos los pedidos cumplan las condiciones
    const pedidosInvalidos = pedidos.filter(p => {
      return p.fecha_entrega_estimada !== ruta.fecha_ruta ||
             p.turno !== ruta.turno ||
             p.zona_id !== ruta.zona_id
    })

    if (pedidosInvalidos.length > 0) {
      throw new Error(`Algunos pedidos no cumplen las condiciones de la ruta (fecha, turno, zona)`)
    }

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
    revalidatePath('/(admin)/(dominios)/almacen/pedidos')

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
        updated_at: getNowArgentina().toISOString(),
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

// Finalizar ruta (con checklist fin)
export async function finalizarRuta(
  rutaId: string,
  checklistFinId?: string
): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    // Verificar que todas las entregas estén completas
    const { data: detalles, error: detallesError } = await supabase
      .from('detalles_ruta')
      .select('estado_entrega')
      .eq('ruta_id', rutaId)

    if (detallesError) throw detallesError

    const entregasPendientes = detalles?.filter(d => 
      d.estado_entrega !== 'entregado' && d.estado_entrega !== 'fallido'
    )

    if (entregasPendientes && entregasPendientes.length > 0) {
      throw new Error('No se puede finalizar la ruta. Todas las entregas deben estar completas.')
    }

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

    const updateData: any = {
      estado: 'completada',
      tiempo_real_min: tiempoRealMin,
      updated_at: getNowArgentina().toISOString(),
    }

    if (checklistFinId) {
      updateData.checklist_fin_id = checklistFinId
    }

    const { error: updateError } = await supabase
      .from('rutas_reparto')
      .update(updateData)
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

// Registrar devolución
export async function registrarDevolucionAction(formData: FormData): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Verificar que es repartidor
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || usuario.rol !== 'repartidor') {
      return { success: false, error: 'Solo repartidores pueden registrar devoluciones' }
    }

    // Parsear datos
    const pedido_id = formData.get('pedido_id') as string
    const detalle_ruta_id = formData.get('detalle_ruta_id') as string
    const producto_id = formData.get('producto_id') as string
    const cantidad = parseFloat(formData.get('cantidad') as string)
    const motivo = formData.get('motivo') as string
    const observaciones = formData.get('observaciones') as string

    if (!pedido_id || !producto_id || !cantidad || !motivo) {
      return { success: false, error: 'Faltan datos requeridos' }
    }

    // Insertar devolución
    const { error: insertError } = await supabase
      .from('devoluciones')
      .insert({
        pedido_id,
        detalle_ruta_id: detalle_ruta_id || null,
        producto_id,
        cantidad,
        motivo,
        observaciones: observaciones || null,
        usuario_id: user.id,
      })

    if (insertError) throw insertError

    revalidatePath('/(repartidor)/ruta/*')
    revalidatePath('/(admin)/(dominios)/reparto/rutas')

    return {
      success: true,
      message: 'Devolución registrada exitosamente',
    }
  } catch (error: any) {
    console.error('Error al registrar devolución:', error)
    return {
      success: false,
      error: error.message || 'Error al registrar devolución',
    }
  }
}

// Obtener ruta por ID
export async function obtenerRutaPorId(rutaId: string): Promise<ApiResponse<any>> {
  try {
    const supabase = await createClient()

    const { data: ruta, error } = await supabase
      .from('rutas_reparto')
      .select(`
        *,
        repartidor:usuarios!rutas_reparto_repartidor_id_fkey(id, nombre, apellido),
        vehiculo:vehiculos(id, patente, marca, modelo, capacidad_kg),
        zona:zonas(id, nombre),
        detalles_ruta (
          id,
          pedido_id,
          pedido:pedidos(id, numero_pedido, cliente:clientes(nombre))
        )
      `)
      .eq('id', rutaId)
      .single()

    if (error) throw error
    if (!ruta) {
      return {
        success: false,
        error: 'Ruta no encontrada',
      }
    }

    return {
      success: true,
      data: ruta,
    }
  } catch (error: any) {
    console.error('Error al obtener ruta:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener ruta',
    }
  }
}

// Obtener rutas por vehículo
export async function obtenerRutasPorVehiculoAction(
  vehiculoId: string,
  fecha?: string
): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    let query = supabase
      .from('rutas_reparto')
      .select(`
        *,
        repartidor:usuarios!rutas_reparto_repartidor_id_fkey(nombre, apellido),
        vehiculo:vehiculos(patente, marca, modelo),
        detalles_ruta (
          id,
          orden_entrega,
          estado_entrega,
          pedido:pedidos(
            numero_pedido,
            cliente:clientes(nombre, direccion)
          )
        )
      `)
      .eq('vehiculo_id', vehiculoId)
      .order('fecha_ruta', { ascending: false })

    if (fecha) {
      query = query.eq('fecha_ruta', fecha)
    }

    const { data, error } = await query

    if (error) throw error

    return {
      success: true,
      data,
      message: 'Rutas obtenidas exitosamente',
    }
  } catch (error: any) {
    console.error('Error al obtener rutas por vehículo:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener rutas',
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
      updated_at: getNowArgentina().toISOString(),
    }

    if (estado === 'entregado') {
      updateData.fecha_hora_entrega = getNowArgentina().toISOString()
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
    revalidatePath('/(admin)/(dominios)/almacen/pedidos')

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

// Eliminar vehículo (DELETE real)
export async function eliminarVehiculo(
  vehiculoId: string
): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    // Verificar permisos (admin)
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
      return { success: false, error: 'No tienes permisos para eliminar vehículos' }
    }

    // Verificar si el vehículo está siendo usado en rutas activas
    const { data: rutasActivas, error: rutasError } = await supabase
      .from('rutas_reparto')
      .select('id, numero_ruta')
      .eq('vehiculo_id', vehiculoId)
      .in('estado', ['planificada', 'en_curso'])
      .limit(1)

    if (rutasError) throw rutasError

    if (rutasActivas && rutasActivas.length > 0) {
      return {
        success: false,
        error: 'No se puede eliminar el vehículo porque está asignado a rutas activas',
      }
    }

    // Eliminar vehículo (DELETE real)
    const { error } = await supabase
      .from('vehiculos')
      .delete()
      .eq('id', vehiculoId)

    if (error) throw error

    revalidatePath('/(admin)/(dominios)/reparto/vehiculos')

    return {
      success: true,
      message: 'Vehículo eliminado exitosamente',
    }
  } catch (error: any) {
    console.error('Error al eliminar vehículo:', error)
    return {
      success: false,
      error: error.message || 'Error al eliminar vehículo',
    }
  }
}

// Crear mantenimiento de vehículo
export async function crearMantenimientoVehiculo(
  vehiculoId: string,
  data: {
    tipo: string
    descripcion?: string
    costo?: number
    fecha?: string
    kilometraje?: number
    observaciones?: string
  }
): Promise<ApiResponse<{ mantenimientoId: string }>> {
  try {
    const supabase = await createClient()

    // Verificar permisos (admin o repartidor)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'repartidor'].includes(usuario.rol)) {
      return { success: false, error: 'No tienes permisos para crear mantenimientos' }
    }

    // Insertar mantenimiento (usando tabla checklists_vehiculos como registro de mantenimiento)
    const { data: mantenimiento, error } = await supabase
      .from('checklists_vehiculos')
      .insert({
        vehiculo_id: vehiculoId,
        usuario_id: user.id,
        fecha_check: data.fecha || getTodayArgentina(),
        kilometraje: data.kilometraje || null,
        observaciones: data.observaciones || data.descripcion || null,
        aprobado: true,
      })
      .select()
      .single()

    if (error) throw error

    // Actualizar updated_at del vehículo
    await supabase
      .from('vehiculos')
      .update({
        updated_at: getNowArgentina().toISOString(),
      })
      .eq('id', vehiculoId)

    revalidatePath('/(admin)/(dominios)/reparto/vehiculos')

    return {
      success: true,
      data: { mantenimientoId: mantenimiento.id },
      message: 'Mantenimiento registrado exitosamente',
    }
  } catch (error: any) {
    console.error('Error al crear mantenimiento:', error)
    return {
      success: false,
      error: error.message || 'Error al crear mantenimiento',
    }
  }
}

// Obtener vehículos (solo activos)
export async function obtenerVehiculos(): Promise<ApiResponse<any[]>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('vehiculos')
      .select('*')
      .eq('activo', true)
      .order('patente', { ascending: true })

    if (error) throw error

    return {
      success: true,
      data: data || [],
    }
  } catch (error: any) {
    console.error('Error al obtener vehículos:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener vehículos',
    }
  }
}

// Cancelar ruta (solo rutas planificadas)
export async function cancelarRuta(rutaId: string): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    // Verificar permisos
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario) {
      return { success: false, error: 'Usuario no encontrado' }
    }

    // Obtener ruta para validar estado y permisos
    const { data: ruta, error: rutaError } = await supabase
      .from('rutas_reparto')
      .select('estado, repartidor_id')
      .eq('id', rutaId)
      .single()

    if (rutaError) throw rutaError
    if (!ruta) {
      return { success: false, error: 'Ruta no encontrada' }
    }

    // Validar que solo rutas planificadas pueden cancelarse
    if (ruta.estado !== 'planificada') {
      return {
        success: false,
        error: `No se puede cancelar una ruta en estado "${ruta.estado}". Solo se pueden cancelar rutas planificadas.`,
      }
    }

    // Validar permisos: admin o repartidor asignado
    if (usuario.rol !== 'admin' && ruta.repartidor_id !== user.id) {
      return {
        success: false,
        error: 'No tienes permisos para cancelar esta ruta',
      }
    }

    // Actualizar estado a cancelada
    const { error: updateError } = await supabase
      .from('rutas_reparto')
      .update({
        estado: 'cancelada',
        updated_at: getNowArgentina().toISOString(),
      })
      .eq('id', rutaId)

    if (updateError) throw updateError

    revalidatePath('/(admin)/(dominios)/reparto/rutas')
    revalidatePath('/(repartidor)/ruta/*')

    return {
      success: true,
      message: 'Ruta cancelada exitosamente',
    }
  } catch (error: any) {
    console.error('Error al cancelar ruta:', error)
    return {
      success: false,
      error: error.message || 'Error al cancelar ruta',
    }
  }
}

// Obtener vehículo por ID
export async function obtenerVehiculoPorId(
  vehiculoId: string
): Promise<ApiResponse<any>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('vehiculos')
      .select('*')
      .eq('id', vehiculoId)
      .single()

    if (error) throw error

    if (!data) {
      return {
        success: false,
        error: 'Vehículo no encontrado',
      }
    }

    return {
      success: true,
      data,
    }
  } catch (error: any) {
    console.error('Error al obtener vehículo:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener vehículo',
    }
  }
}

// Actualizar vehículo
export async function actualizarVehiculo(
  vehiculoId: string,
  params: Partial<CrearVehiculoParams>
): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    // Verificar permisos (admin)
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
      return { success: false, error: 'No tienes permisos para actualizar vehículos' }
    }

    // Verificar que la patente no exista en otro vehículo
    if (params.patente) {
      const { data: vehiculoExistente } = await supabase
        .from('vehiculos')
        .select('id')
        .eq('patente', params.patente)
        .neq('id', vehiculoId)
        .single()

      if (vehiculoExistente) {
        return { success: false, error: 'Ya existe otro vehículo con esa patente' }
      }
    }

    const updateData: any = {
      updated_at: getNowArgentina().toISOString(),
    }

    if (params.patente) updateData.patente = params.patente
    if (params.marca !== undefined) updateData.marca = params.marca
    if (params.modelo !== undefined) updateData.modelo = params.modelo
    if (params.tipo_vehiculo) updateData.tipo_vehiculo = params.tipo_vehiculo
    if (params.capacidad_kg) updateData.capacidad_kg = params.capacidad_kg
    if (params.fecha_vto_seguro !== undefined) {
      updateData.fecha_vto_seguro = params.fecha_vto_seguro || null
    }
    if (params.seguro_vigente !== undefined) {
      updateData.seguro_vigente = params.seguro_vigente
    }
    if (params.activo !== undefined) {
      updateData.activo = params.activo
    }

    const { error } = await supabase
      .from('vehiculos')
      .update(updateData)
      .eq('id', vehiculoId)

    if (error) throw error

    revalidatePath('/(admin)/(dominios)/reparto/vehiculos')
    revalidatePath(`/(admin)/(dominios)/reparto/vehiculos/${vehiculoId}`)

    return {
      success: true,
      message: 'Vehículo actualizado exitosamente',
    }
  } catch (error: any) {
    console.error('Error al actualizar vehículo:', error)
    return {
      success: false,
      error: error.message || 'Error al actualizar vehículo',
    }
  }
}

// Obtener rutas
export async function obtenerRutas(): Promise<ApiResponse<any[]>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('rutas_reparto')
      .select(`
        *,
        repartidor:usuarios!rutas_reparto_repartidor_id_fkey(nombre, apellido),
        vehiculo:vehiculos(patente, marca, modelo),
        zona:zonas(nombre),
        detalles_ruta (
          id,
          orden_entrega,
          estado_entrega,
          pedido:pedidos(
            numero_pedido,
            cliente:clientes(nombre)
          )
        )
      `)
      .order('fecha_ruta', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error

    return {
      success: true,
      data: data || [],
    }
  } catch (error: any) {
    console.error('Error al obtener rutas:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener rutas',
    }
  }
}

// Generar ruta diaria automática
export async function generarRutaDiariaAutomatica(
  fecha: string,
  turno: string
): Promise<ApiResponse<{ rutasCreadas: number; rutasIds: string[] }>> {
  try {
    const supabase = await createClient()

    // Obtener pedidos del turno/fecha con estado "preparando"
    const { data: pedidos, error: pedidosError } = await supabase
      .from('pedidos')
      .select(`
        id,
        numero_pedido,
        fecha_entrega_estimada,
        turno,
        zona_id,
        estado,
        cliente:clientes(zona_entrega)
      `)
      .eq('fecha_entrega_estimada', fecha)
      .eq('turno', turno)
      .eq('estado', 'preparando')

    if (pedidosError) throw pedidosError

    if (!pedidos || pedidos.length === 0) {
      return {
        success: false,
        error: 'No hay pedidos disponibles para el turno seleccionado',
      }
    }

    // Validar que todos tengan zona
    const pedidosSinZona = pedidos.filter(
      (p) => !p.zona_id && !(p.cliente as any)?.zona_entrega
    )
    if (pedidosSinZona.length > 0) {
      return {
        success: false,
        error: `${pedidosSinZona.length} pedido(s) no tienen zona asignada`,
      }
    }

    // Agrupar pedidos por zona
    const pedidosPorZona = new Map<string, typeof pedidos>()
    for (const pedido of pedidos) {
      const zonaId = pedido.zona_id || (pedido.cliente as any)?.zona_entrega
      if (!zonaId) continue

      if (!pedidosPorZona.has(zonaId)) {
        pedidosPorZona.set(zonaId, [])
      }
      pedidosPorZona.get(zonaId)!.push(pedido)
    }

    const rutasIds: string[] = []
    let rutasCreadas = 0

    // Crear rutas por zona usando fn_asignar_pedido_a_ruta
    for (const [zonaId, pedidosZona] of pedidosPorZona.entries()) {
      try {
        // Intentar asignar cada pedido a una ruta (la función crea la ruta si no existe)
        for (const pedido of pedidosZona) {
          const { data: resultado, error: asignacionError } = await supabase.rpc(
            'fn_asignar_pedido_a_ruta',
            {
              p_pedido_id: pedido.id,
            }
          )

          if (asignacionError) {
            console.error(
              `Error asignando pedido ${pedido.numero_pedido}:`,
              asignacionError
            )
            continue
          }

          if (resultado?.success && resultado?.ruta_id) {
            const rutaId = resultado.ruta_id as string
            if (!rutasIds.includes(rutaId)) {
              rutasIds.push(rutaId)
              rutasCreadas++

              // Generar optimización de ruta
              try {
                await generateRutaOptimizada({
                  supabase,
                  rutaId,
                  usarGoogle: true,
                })
              } catch (optError) {
                console.error(
                  `Error optimizando ruta ${rutaId}:`,
                  optError
                )
              }
            }
          }
        }
      } catch (error: any) {
        console.error(`Error procesando zona ${zonaId}:`, error)
      }
    }

    if (rutasCreadas === 0) {
      return {
        success: false,
        error: 'No se pudieron crear rutas. Verifique que existan planes semanales para las zonas.',
      }
    }

    revalidatePath('/(admin)/(dominios)/reparto/rutas')
    revalidatePath('/(admin)/(dominios)/almacen/pedidos')

    return {
      success: true,
      data: { rutasCreadas, rutasIds },
      message: `Se crearon ${rutasCreadas} ruta(s) diaria(s) exitosamente`,
    }
  } catch (error: any) {
    console.error('Error generando ruta diaria automática:', error)
    return {
      success: false,
      error: error.message || 'Error al generar ruta diaria automática',
    }
  }
}

// Generar ruta diaria manual
export async function generarRutaDiariaManual(
  pedidosIds: string[],
  fecha: string,
  zonaId: string,
  turno: string
): Promise<ApiResponse<{ rutaId: string }>> {
  try {
    const supabase = await createClient()

    // Validar que todos los pedidos sean del mismo turno y tengan estado preparando
    const { data: pedidos, error: pedidosError } = await supabase
      .from('pedidos')
      .select(`
        id,
        numero_pedido,
        fecha_entrega_estimada,
        turno,
        zona_id,
        estado
      `)
      .in('id', pedidosIds)
      .eq('estado', 'preparando')

    if (pedidosError) throw pedidosError

    if (!pedidos || pedidos.length === 0) {
      return {
        success: false,
        error: 'No se encontraron pedidos válidos con estado "preparando"',
      }
    }

    // Validar que todos sean del mismo turno
    const turnosDiferentes = pedidos.filter((p) => p.turno !== turno)
    if (turnosDiferentes.length > 0) {
      return {
        success: false,
        error: 'Todos los pedidos deben ser del mismo turno',
      }
    }

    // Validar que todos tengan la misma zona
    const zonasDiferentes = pedidos.filter(
      (p) => p.zona_id !== zonaId && p.zona_id !== null
    )
    if (zonasDiferentes.length > 0) {
      return {
        success: false,
        error: 'Todos los pedidos deben ser de la misma zona',
      }
    }

    // Crear ruta usando fn_asignar_pedido_a_ruta para cada pedido
    // Esto creará la ruta automáticamente si no existe
    let rutaId: string | null = null
    const errores: string[] = []

    for (const pedido of pedidos) {
      const { data: resultado, error: asignacionError } = await supabase.rpc(
        'fn_asignar_pedido_a_ruta',
        {
          p_pedido_id: pedido.id,
        }
      )

      if (asignacionError) {
        errores.push(`${pedido.numero_pedido}: ${asignacionError.message}`)
        continue
      }

      if (resultado?.success && resultado?.ruta_id) {
        rutaId = resultado.ruta_id as string
      } else {
        errores.push(
          `${pedido.numero_pedido}: ${resultado?.error || 'Error desconocido'}`
        )
      }
    }

    if (!rutaId) {
      return {
        success: false,
        error: `No se pudo crear la ruta. Errores: ${errores.join(', ')}`,
      }
    }

    // Generar optimización de ruta
    try {
      await generateRutaOptimizada({
        supabase,
        rutaId,
        usarGoogle: true,
      })
    } catch (optError) {
      console.error('Error optimizando ruta:', optError)
      // No fallar si la optimización falla
    }

    revalidatePath('/(admin)/(dominios)/reparto/rutas')
    revalidatePath('/(admin)/(dominios)/almacen/pedidos')

    return {
      success: true,
      data: { rutaId },
      message: `Ruta creada exitosamente con ${pedidos.length} pedido(s)`,
    }
  } catch (error: any) {
    console.error('Error generando ruta diaria manual:', error)
    return {
      success: false,
      error: error.message || 'Error al generar ruta diaria manual',
    }
  }
}

// Asignar un solo pedido a una ruta (desde Almacén) usando el plan semanal
export async function asignarPedidoARutaDesdeAlmacen(
  pedidoId: string
): Promise<ApiResponse<{ rutaId: string }>> {
  try {
    const supabase = await createClient()

    // Obtener pedido y validar estado
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .select('id, numero_pedido, estado')
      .eq('id', pedidoId)
      .single()

    if (pedidoError || !pedido) {
      return {
        success: false,
        error: 'Pedido no encontrado',
      }
    }

    if (pedido.estado !== 'preparando') {
      return {
        success: false,
        error: `Solo se pueden asignar a ruta pedidos en estado \"preparando\" (actual: ${pedido.estado})`,
      }
    }

    // Asignar pedido a una ruta usando la función RPC
    const { data: resultado, error: asignacionError } = await supabase.rpc(
      'fn_asignar_pedido_a_ruta',
      {
        p_pedido_id: pedidoId,
      }
    )

    if (asignacionError) {
      console.error(
        `Error asignando pedido ${pedido.numero_pedido} a ruta:`,
        asignacionError
      )
      return {
        success: false,
        error: asignacionError.message || 'Error al asignar pedido a ruta',
      }
    }

    if (!resultado?.success || !resultado?.ruta_id) {
      return {
        success: false,
        error:
          (resultado && (resultado as any).error) ||
          'No se pudo asignar el pedido a una ruta planificada',
      }
    }

    const rutaId = resultado.ruta_id as string

    // Optimizar la ruta generada/actualizada
    try {
      await generateRutaOptimizada({
        supabase,
        rutaId,
        usarGoogle: true,
      })
    } catch (optError) {
      console.error(
        `Error optimizando ruta ${rutaId} para pedido ${pedido.numero_pedido}:`,
        optError
      )
    }

    revalidatePath('/(admin)/(dominios)/reparto/rutas')
    revalidatePath('/(admin)/(dominios)/almacen/pedidos')

    return {
      success: true,
      data: { rutaId },
      message: `Pedido ${pedido.numero_pedido} asignado a ruta exitosamente`,
    }
  } catch (error: any) {
    console.error('Error en asignarPedidoARutaDesdeAlmacen:', error)
    return {
      success: false,
      error: error.message || 'Error al asignar pedido a ruta',
    }
  }
}

// Asignar pedido a ruta con vehículo específico (sin validar capacidad)
export async function asignarPedidoARutaConVehiculo(
  pedidoId: string,
  vehiculoId: string
): Promise<ApiResponse<{ rutaId: string }>> {
  try {
    const supabase = await createClient()

    // Obtener pedido y validar estado
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .select('id, numero_pedido, estado, fecha_entrega_estimada, turno, zona_id')
      .eq('id', pedidoId)
      .single()

    if (pedidoError || !pedido) {
      return { success: false, error: 'Pedido no encontrado' }
    }

    if (pedido.estado !== 'preparando') {
      return {
        success: false,
        error: `Solo se pueden asignar a ruta pedidos en estado "preparando" (actual: ${pedido.estado})`,
      }
    }

    // Obtener vehículo
    const { data: vehiculo, error: vehiculoError } = await supabase
      .from('vehiculos')
      .select('id, patente')
      .eq('id', vehiculoId)
      .eq('activo', true)
      .single()

    if (vehiculoError || !vehiculo) {
      return { success: false, error: 'Vehículo no encontrado o inactivo' }
    }

    // Obtener un repartidor (el asignado al vehículo o cualquier activo)
    let repartidorId: string | null = null
    
    const { data: repartidorVehiculo } = await supabase
      .from('usuarios')
      .select('id')
      .eq('vehiculo_asignado', vehiculoId)
      .eq('rol', 'repartidor')
      .eq('activo', true)
      .single()
    
    if (repartidorVehiculo) {
      repartidorId = repartidorVehiculo.id
    } else {
      const { data: repartidorAny } = await supabase
        .from('usuarios')
        .select('id')
        .eq('rol', 'repartidor')
        .eq('activo', true)
        .limit(1)
        .single()
      
      if (repartidorAny) {
        repartidorId = repartidorAny.id
      }
    }

    if (!repartidorId) {
      return { success: false, error: 'No hay repartidores activos disponibles' }
    }

    const fechaRuta = pedido.fecha_entrega_estimada || new Date().toISOString().split('T')[0]
    const turno = pedido.turno || 'mañana'

    // Buscar ruta existente para el mismo vehículo, fecha, turno y zona
    let rutaId: string | null = null

    const { data: rutaExistente } = await supabase
      .from('rutas_reparto')
      .select('id')
      .eq('vehiculo_id', vehiculoId)
      .eq('fecha_ruta', fechaRuta)
      .eq('turno', turno)
      .eq('zona_id', pedido.zona_id)
      .in('estado', ['planificada', 'en_curso'])
      .limit(1)
      .single()

    if (rutaExistente) {
      rutaId = rutaExistente.id
    } else {
      // Crear nueva ruta
      const { data: numeroRuta } = await supabase.rpc('obtener_siguiente_numero_ruta')
      
      const { data: nuevaRuta, error: rutaError } = await supabase
        .from('rutas_reparto')
        .insert({
          numero_ruta: numeroRuta || `R-${Date.now()}`,
          vehiculo_id: vehiculoId,
          repartidor_id: repartidorId,
          fecha_ruta: fechaRuta,
          turno: turno,
          zona_id: pedido.zona_id,
          estado: 'planificada',
        })
        .select('id')
        .single()

      if (rutaError || !nuevaRuta) {
        return { success: false, error: 'Error al crear la ruta: ' + (rutaError?.message || '') }
      }

      rutaId = nuevaRuta.id
    }

    // Verificar si el pedido ya está en una ruta
    const { data: detalleExistente } = await supabase
      .from('detalles_ruta')
      .select('id')
      .eq('pedido_id', pedidoId)
      .single()

    if (!detalleExistente) {
      // Agregar pedido a la ruta
      const { data: maxOrden } = await supabase
        .from('detalles_ruta')
        .select('orden_entrega')
        .eq('ruta_id', rutaId)
        .order('orden_entrega', { ascending: false })
        .limit(1)
        .single()

      const orden = (maxOrden?.orden_entrega || 0) + 1

      const { error: detalleError } = await supabase
        .from('detalles_ruta')
        .insert({
          ruta_id: rutaId,
          pedido_id: pedidoId,
          orden_entrega: orden,
        })

      if (detalleError) {
        return { success: false, error: 'Error al agregar pedido a la ruta: ' + detalleError.message }
      }
    }

    // Actualizar estado del pedido a 'enviado'
    await supabase
      .from('pedidos')
      .update({ estado: 'enviado', updated_at: new Date().toISOString() })
      .eq('id', pedidoId)

    revalidatePath('/(admin)/(dominios)/reparto/rutas')
    revalidatePath('/(admin)/(dominios)/almacen/pedidos')
    revalidatePath(`/(admin)/(dominios)/almacen/pedidos/${pedidoId}`)

    return {
      success: true,
      data: { rutaId },
      message: `Pedido ${pedido.numero_pedido} asignado a ruta con vehículo ${vehiculo.patente}`,
    }
  } catch (error: any) {
    console.error('Error en asignarPedidoARutaConVehiculo:', error)
    return {
      success: false,
      error: error.message || 'Error al asignar pedido a ruta',
    }
  }
}

// Asignar transferencia a una ruta desde almacén
export async function asignarTransferenciaARutaDesdeAlmacen(
  transferenciaId: string
): Promise<ApiResponse<{ rutaId: string }>> {
  try {
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Obtener transferencia y validar estado
    const { data: transferencia, error: transferenciaError } = await supabase
      .from('transferencias_stock')
      .select(`
        id, 
        numero_transferencia, 
        estado, 
        turno, 
        fecha_entrega, 
        zona_id,
        sucursal_destino:sucursales!sucursal_destino_id(id, nombre, direccion)
      `)
      .eq('id', transferenciaId)
      .single()

    if (transferenciaError || !transferencia) {
      return {
        success: false,
        error: 'Transferencia no encontrada',
      }
    }

    if (transferencia.estado !== 'preparado') {
      return {
        success: false,
        error: `Solo se pueden asignar a ruta transferencias preparadas (actual: ${transferencia.estado})`,
      }
    }

    // Buscar ruta existente que coincida con fecha, turno y zona
    const { data: rutaExistente, error: rutaError } = await supabase
      .from('rutas_reparto')
      .select('id')
      .eq('fecha_ruta', transferencia.fecha_entrega)
      .eq('turno', transferencia.turno)
      .eq('zona_id', transferencia.zona_id)
      .in('estado', ['planificada', 'en_curso'])
      .limit(1)
      .single()

    let rutaId: string

    if (rutaExistente) {
      rutaId = rutaExistente.id
    } else {
      // Buscar plan semanal para obtener vehículo y repartidor
      const { data: planSemanal, error: planError } = await supabase
        .from('plan_rutas_semanal')
        .select('vehiculo_id, repartidor_id')
        .eq('zona_id', transferencia.zona_id)
        .eq('turno', transferencia.turno)
        .eq('activo', true)
        .limit(1)
        .single()

      if (planError || !planSemanal) {
        return {
          success: false,
          error: 'No hay plan de ruta disponible para esta zona y turno. Configure un plan semanal primero.',
        }
      }

      // Crear nueva ruta
      const { data: numeroRutaData, error: numeroError } = await supabase
        .rpc('obtener_siguiente_numero_ruta')

      if (numeroError) {
        throw new Error('Error al generar número de ruta')
      }

      const { data: nuevaRuta, error: crearRutaError } = await supabase
        .from('rutas_reparto')
        .insert({
          numero_ruta: numeroRutaData as string,
          vehiculo_id: planSemanal.vehiculo_id,
          repartidor_id: planSemanal.repartidor_id,
          fecha_ruta: transferencia.fecha_entrega,
          turno: transferencia.turno,
          zona_id: transferencia.zona_id,
          estado: 'planificada',
          observaciones: 'Ruta creada automáticamente para transferencia',
        })
        .select()
        .single()

      if (crearRutaError || !nuevaRuta) {
        throw new Error('Error al crear la ruta: ' + crearRutaError?.message)
      }

      rutaId = nuevaRuta.id
    }

    // Asignar transferencia a la ruta usando la función RPC
    const { data: resultado, error: asignacionError } = await supabase.rpc(
      'fn_asignar_transferencia_a_ruta',
      {
        p_transferencia_id: transferenciaId,
        p_ruta_id: rutaId,
        p_user_id: user.id,
      }
    )

    if (asignacionError) {
      console.error(
        `Error asignando transferencia ${transferencia.numero_transferencia} a ruta:`,
        asignacionError
      )
      return {
        success: false,
        error: asignacionError.message || 'Error al asignar transferencia a ruta',
      }
    }

    if (!resultado?.success) {
      return {
        success: false,
        error: resultado?.error || 'No se pudo asignar la transferencia a la ruta',
      }
    }

    // Agregar como destino en detalles_ruta (como cliente interno)
    const { data: sucursalDestino } = transferencia as any

    // Obtener el orden de entrega siguiente
    const { data: ultimoDetalle } = await supabase
      .from('detalles_ruta')
      .select('orden_entrega')
      .eq('ruta_id', rutaId)
      .order('orden_entrega', { ascending: false })
      .limit(1)
      .single()

    const siguienteOrden = (ultimoDetalle?.orden_entrega || 0) + 1

    // Insertar en detalles_ruta con transferencia_id
    const { error: detalleError } = await supabase
      .from('detalles_ruta')
      .insert({
        ruta_id: rutaId,
        transferencia_id: transferenciaId,
        orden_entrega: siguienteOrden,
        estado_entrega: 'pendiente',
        notas: `Transferencia a ${(transferencia.sucursal_destino as any)?.nombre || 'sucursal'}`,
      })

    if (detalleError) {
      console.warn('No se pudo agregar detalle de ruta para transferencia:', detalleError)
      // No fallamos, la transferencia ya fue asignada
    }

    revalidatePath('/(admin)/(dominios)/reparto/rutas')
    revalidatePath('/(admin)/(dominios)/sucursales/transferencias')
    revalidatePath('/(admin)/(dominios)/almacen/presupuestos-dia')

    return {
      success: true,
      data: { rutaId },
      message: `Transferencia ${transferencia.numero_transferencia} asignada a ruta exitosamente`,
    }
  } catch (error: any) {
    console.error('Error en asignarTransferenciaARutaDesdeAlmacen:', error)
    return {
      success: false,
      error: error.message || 'Error al asignar transferencia a ruta',
    }
  }
}

// Crear rutas mock para Monteros, Tucumán
export async function crearRutasMockMonteros(
  cantidadRutas: number = 2,
  clientesPorRuta: number = 7
): Promise<ApiResponse<{ rutasCreadas: string[] }>> {
  const inicioTotal = Date.now()
  try {
    console.log('🚀 [INICIO] ===== INICIANDO crearRutasMockMonteros =====')
    console.log('🔍 [DEBUG] Parámetros:', { cantidadRutas, clientesPorRuta })
    console.log('⏱️ [TIME] Tiempo inicio:', new Date().toISOString())
    const supabase = await createClient()

    // Verificar que el usuario sea admin
    const tiempoAuth = Date.now()
    console.log('⏱️ [TIME] Iniciando verificación de autenticación...')
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    console.log('⏱️ [TIME] Auth completado en:', Date.now() - tiempoAuth, 'ms')
    if (userError || !user) {
      console.error('❌ [ERROR] Usuario no autenticado:', userError)
      return { success: false, error: 'Usuario no autenticado' }
    }

    const tiempoUsuario = Date.now()
    console.log('⏱️ [TIME] Consultando rol de usuario...')
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()
    console.log('⏱️ [TIME] Consulta usuario completada en:', Date.now() - tiempoUsuario, 'ms')

    if (!usuario || usuario.rol !== 'admin') {
      console.error('❌ [ERROR] Usuario no es admin:', usuario?.rol)
      return { success: false, error: 'Solo los administradores pueden crear rutas mock' }
    }
    console.log('✅ [AUTH] Usuario autenticado como admin')

    // Crear o obtener vehículos mock
    const tiempoVehiculos = Date.now()
    console.log('⏱️ [TIME] Consultando vehículos...')
    let { data: vehiculos } = await supabase
      .from('vehiculos')
      .select('id, patente')
      .eq('activo', true)
      .limit(cantidadRutas)
    console.log('⏱️ [TIME] Vehículos consultados en:', Date.now() - tiempoVehiculos, 'ms, encontrados:', vehiculos?.length || 0)

    if (!vehiculos || vehiculos.length === 0) {
      // Crear vehículo mock
      const { data: vehiculoMock, error: vehiculoError } = await supabase
        .from('vehiculos')
        .insert({
          patente: `MOCK-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          marca: 'Toyota',
          modelo: 'Hilux',
          capacidad_kg: 1500,
          tipo_vehiculo: 'camioneta',
          seguro_vigente: true,
          activo: true,
        })
        .select('id, patente')
        .single()

      if (vehiculoError || !vehiculoMock) {
        return { success: false, error: 'Error al crear vehículo mock: ' + (vehiculoError?.message || 'Desconocido') }
      }

      vehiculos = [vehiculoMock]
    }

    // Crear o obtener repartidores mock
    const tiempoRepartidores = Date.now()
    console.log('⏱️ [TIME] Consultando repartidores...')
    let { data: repartidores } = await supabase
      .from('usuarios')
      .select('id, nombre, apellido')
      .eq('rol', 'repartidor')
      .eq('activo', true)
      .limit(cantidadRutas)
    console.log('⏱️ [TIME] Repartidores consultados en:', Date.now() - tiempoRepartidores, 'ms, encontrados:', repartidores?.length || 0)

    if (!repartidores || repartidores.length === 0) {
      // Crear repartidor mock directamente en la tabla usuarios
      // Nota: Este usuario no tendrá autenticación, solo se usa para datos mock
      const nombresRepartidores = ['Carlos', 'Juan', 'Pedro', 'Luis', 'Miguel']
      const apellidosRepartidores = ['García', 'Rodríguez', 'Martínez', 'López', 'González']
      
      const nombre = nombresRepartidores[Math.floor(Math.random() * nombresRepartidores.length)]
      const apellido = apellidosRepartidores[Math.floor(Math.random() * apellidosRepartidores.length)]
      const emailMock = `repartidor.mock.${Date.now()}@avicoladelsur.com`

      const { data: repartidorMock, error: repartidorError } = await supabase
        .from('usuarios')
        .insert({
          email: emailMock,
          nombre,
          apellido,
          rol: 'repartidor',
          vehiculo_asignado: vehiculos[0].id,
          activo: true,
        })
        .select('id, nombre, apellido')
        .single()

      if (repartidorError || !repartidorMock) {
        return { success: false, error: 'Error al crear repartidor mock: ' + (repartidorError?.message || 'Desconocido') }
      }

      repartidores = [repartidorMock]
    }

    // Crear o obtener zona de Monteros
    const tiempoZona = Date.now()
    console.log('⏱️ [TIME] Consultando zona Monteros...')
    let { data: zonas } = await supabase
      .from('zonas')
      .select('id, nombre')
      .ilike('nombre', '%monteros%')
      .eq('activo', true)
      .limit(1)
    console.log('⏱️ [TIME] Zona consultada en:', Date.now() - tiempoZona, 'ms')

    let zonaId: string | null = null

    if (zonas && zonas.length > 0) {
      zonaId = zonas[0].id
    } else {
      // Crear zona mock de Monteros
      const { data: zonaMock, error: zonaError } = await supabase
        .from('zonas')
        .insert({
          nombre: 'Monteros Centro',
          descripcion: 'Zona céntrica de Monteros, Tucumán (Mock)',
          activo: true,
        })
        .select('id')
        .single()

      if (zonaError || !zonaMock) {
        return { success: false, error: 'Error al crear zona mock: ' + (zonaError?.message || 'Desconocido') }
      }

      zonaId = zonaMock.id
    }

    const homeBase = config.rutas.homeBase
    const fechaRuta = getTodayArgentina()
    const rutasCreadas: string[] = []

    // Generar coordenadas aleatorias en zona Monteros
    // Rango: lat: -27.15 a -27.20, lng: -65.48 a -65.52
    const generarCoordenadaAleatoria = () => {
      const lat = -27.15 + Math.random() * 0.05 // -27.15 a -27.20
      const lng = -65.48 + Math.random() * 0.04 // -65.48 a -65.52
      return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) }
    }

    // Crear clientes mock si no existen suficientes
    const nombresClientes = [
      'Carnicería El Buen Sabor', 'Pollos Don Juan', 'Aves Frescas SRL', 'Distribuidora San Miguel',
      'Supermercado Central', 'Carnicería La Esquina', 'Pollos y Más', 'Distribuidora El Progreso',
      'Carnicería Los Amigos', 'Aves Premium', 'Supermercado Norte', 'Distribuidora Sur',
      'Carnicería El Rincón', 'Pollos Express', 'Aves del Valle', 'Distribuidora La Esperanza',
      'Carnicería San Martín', 'Pollos Selectos', 'Aves Frescas Norte', 'Distribuidora Centro',
      'Carnicería La Familia', 'Pollos Premium', 'Aves del Sur', 'Distribuidora El Sol',
      'Carnicería Los Pinos', 'Pollos y Aves', 'Aves Selectas', 'Distribuidora La Paz'
    ]

    const totalClientesNecesarios = cantidadRutas * clientesPorRuta
    const tiempoClientes = Date.now()
    console.log('⏱️ [TIME] Consultando clientes existentes, necesarios:', totalClientesNecesarios)
    const { data: clientesExistentes } = await supabase
      .from('clientes')
      .select('id, nombre')
      .ilike('nombre', '%mock%')
      .limit(totalClientesNecesarios)
    console.log('⏱️ [TIME] Clientes consultados en:', Date.now() - tiempoClientes, 'ms, encontrados:', clientesExistentes?.length || 0)

    const clientesIds: string[] = []

    // Crear clientes mock faltantes
    if (!clientesExistentes || clientesExistentes.length < totalClientesNecesarios) {
      const clientesACrear = totalClientesNecesarios - (clientesExistentes?.length || 0)
      const tiempoCrearClientes = Date.now()
      console.log('⏱️ [TIME] Creando', clientesACrear, 'clientes mock...')
      
      for (let i = 0; i < clientesACrear; i++) {
        const nombre = nombresClientes[i % nombresClientes.length] + ` (Mock ${i + 1})`
        const coords = generarCoordenadaAleatoria()
        
        const { data: cliente, error: clienteError } = await supabase
          .from('clientes')
          .insert({
            codigo: `MOCK${String(i + 1).padStart(4, '0')}`,
            nombre,
            telefono: `3815${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`,
            direccion: `Calle ${Math.floor(Math.random() * 1000)} #${Math.floor(Math.random() * 1000)}`,
            zona_entrega: 'Monteros',
            coordenadas: `SRID=4326;POINT(${coords.lng} ${coords.lat})`,
            tipo_cliente: 'minorista',
            activo: true,
          })
          .select('id')
          .single()

        if (!clienteError && cliente) {
          clientesIds.push(cliente.id)
        }
      }
      console.log('⏱️ [TIME] Clientes creados en:', Date.now() - tiempoCrearClientes, 'ms')
    }

    // Agregar IDs de clientes existentes
    if (clientesExistentes) {
      clientesExistentes.forEach(c => clientesIds.push(c.id))
    }
    console.log('✅ [CLIENTES] Total clientes disponibles:', clientesIds.length)

    // Crear rutas mock
    console.log('🏗️ [RUTAS] Iniciando creación de', cantidadRutas, 'rutas...')
    for (let rutaIndex = 0; rutaIndex < cantidadRutas; rutaIndex++) {
      const tiempoRuta = Date.now()
      console.log(`⏱️ [TIME] Iniciando ruta ${rutaIndex + 1}/${cantidadRutas}...`)
      const vehiculo = vehiculos[rutaIndex % vehiculos.length]
      const repartidor = repartidores[rutaIndex % repartidores.length]
      
      // Seleccionar clientes para esta ruta
      const clientesRuta = clientesIds.slice(
        rutaIndex * clientesPorRuta,
        (rutaIndex + 1) * clientesPorRuta
      )

      if (clientesRuta.length === 0) {
        continue
      }

      // Obtener coordenadas de los clientes
      const tiempoCoords = Date.now()
      console.log('🔍 [DEBUG] Consultando clientes para ruta:', { clientesRuta, clientesRutaLength: clientesRuta.length })
      const { data: clientesData } = await supabase
        .from('clientes')
        .select('id, nombre, coordenadas')
        .in('id', clientesRuta)
      console.log('⏱️ [TIME] Coordenadas consultadas en:', Date.now() - tiempoCoords, 'ms')

      console.log('🔍 [DEBUG] Clientes obtenidos:', { clientesDataLength: clientesData?.length, clientesData })

      if (!clientesData || clientesData.length === 0) {
        console.warn('⚠️ [WARNING] No se encontraron datos de clientes para la ruta')
        continue
      }

      // Convertir coordenadas PostGIS a {lat, lng}
      console.log('🔍 [DEBUG] Procesando coordenadas de clientes')
      const puntos: Array<{ lat: number; lng: number; id: string; nombre: string }> = []

      try {
        for (const cliente of clientesData) {
          console.log('🔍 [DEBUG] Procesando cliente:', { clienteId: cliente.id, coordenadas: cliente.coordenadas })
          if (cliente.coordenadas) {
            let coords: { lat: number; lng: number } | null = null

            try {
              // Supabase puede devolver geometrías PostGIS de diferentes formas
              if (typeof cliente.coordenadas === 'string') {
                // Si viene como WKT: "POINT(lng lat)" o "SRID=4326;POINT(lng lat)"
                const match = cliente.coordenadas.match(/POINT\(([\d.-]+)\s+([\d.-]+)\)/)
                if (match) {
                  coords = {
                    lng: parseFloat(match[1]),
                    lat: parseFloat(match[2])
                  }
                } else {
                  // Intentar parsear como JSON
                  try {
                    const parsed = JSON.parse(cliente.coordenadas)
                    if (parsed && typeof parsed === 'object') {
                      if ('lat' in parsed && 'lng' in parsed) {
                        coords = { lat: parsed.lat, lng: parsed.lng }
                      } else if ('coordinates' in parsed && Array.isArray(parsed.coordinates)) {
                        // Formato GeoJSON: [lng, lat]
                        coords = {
                          lng: parsed.coordinates[0],
                          lat: parsed.coordinates[1]
                        }
                      }
                    }
                  } catch (e) {
                    // Ignorar
                  }
                }
              } else if (cliente.coordenadas && typeof cliente.coordenadas === 'object') {
                // Si viene como objeto con propiedades lat/lng
                if ('lat' in cliente.coordenadas && 'lng' in cliente.coordenadas) {
                  coords = {
                    lat: typeof cliente.coordenadas.lat === 'string' ? parseFloat(cliente.coordenadas.lat) : cliente.coordenadas.lat,
                    lng: typeof cliente.coordenadas.lng === 'string' ? parseFloat(cliente.coordenadas.lng) : cliente.coordenadas.lng
                  }
                } else if ('coordinates' in cliente.coordenadas && Array.isArray(cliente.coordenadas.coordinates)) {
                  // Formato GeoJSON: [lng, lat]
                  coords = {
                    lng: cliente.coordenadas.coordinates[0],
                    lat: cliente.coordenadas.coordinates[1]
                  }
                }
              }

              console.log('🔍 [DEBUG] Coordenadas procesadas:', { clienteId: cliente.id, coords })

              if (coords && !isNaN(coords.lat) && !isNaN(coords.lng) && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
                puntos.push({ lat: coords.lat, lng: coords.lng, id: cliente.id, nombre: cliente.nombre })
                console.log('🔍 [DEBUG] Punto agregado:', { punto: { lat: coords.lat, lng: coords.lng, id: cliente.id, nombre: cliente.nombre } })
              } else {
                console.warn('⚠️ [WARNING] Coordenadas inválidas para cliente:', cliente.id, coords)
              }
            } catch (e) {
              console.warn('Error parseando coordenadas del cliente:', cliente.id, e)
            }
          } else {
            console.warn('⚠️ [WARNING] Cliente sin coordenadas:', cliente.id)
          }
        }
      } catch (e) {
        console.error('❌ [ERROR] Error en el loop de procesamiento de coordenadas:', e)
        continue
      }

      console.log('🔍 [DEBUG] Puntos finales:', { puntosLength: puntos.length, puntos })

      if (puntos.length === 0) {
        continue
      }

      // Optimizar ruta usando algoritmo local
      const origin = { lat: homeBase.lat, lng: homeBase.lng, id: 'origin', nombre: homeBase.nombre }
      const destination = config.rutas.returnToBase
        ? { lat: homeBase.lat, lng: homeBase.lng, id: 'destination', nombre: homeBase.nombre }
        : undefined

      // Validar que puntos sea un array válido
      console.log('🔍 [DEBUG] Puntos obtenidos:', { puntos, length: puntos?.length })
      if (!Array.isArray(puntos)) {
        console.error('Error: puntos no es un array válido', { puntos })
        continue
      }

      const waypoints = puntos.map(p => ({
        lat: p.lat,
        lng: p.lng,
        id: p.id,
        nombreCliente: p.nombre,
        clienteId: p.id,
      }))
      console.log('🔍 [DEBUG] Waypoints creados:', { waypointsLength: waypoints.length, waypoints })

      const tiempoOptimizacion = Date.now()
      console.log('🔍 [DEBUG] Llamando optimizeRouteLocal con:', { origin, waypointsLength: waypoints.length, destination })
      const rutaOptimizada = optimizeRouteLocal(origin, waypoints, destination)
      console.log('⏱️ [TIME] Optimización completada en:', Date.now() - tiempoOptimizacion, 'ms')
      console.log('🔍 [DEBUG] optimizeRouteLocal retornó:', rutaOptimizada)

      // Validar que la optimización retornó datos válidos
      if (!rutaOptimizada || !rutaOptimizada.orderedPoints || !Array.isArray(rutaOptimizada.orderedPoints)) {
        console.error('Error: optimizeRouteLocal retornó datos inválidos', { rutaOptimizada })
        continue
      }

      // Generar número de ruta
      const { data: numeroRutaData } = await supabase.rpc('obtener_siguiente_numero_ruta')
      const numeroRuta = numeroRutaData as string || `MOCK-${Date.now()}-${rutaIndex}`

      // Crear ruta_reparto
      const { data: ruta, error: rutaError } = await supabase
        .from('rutas_reparto')
        .insert({
          numero_ruta: numeroRuta,
          vehiculo_id: vehiculo.id,
          repartidor_id: repartidor.id,
          fecha_ruta: fechaRuta,
          turno: rutaIndex % 2 === 0 ? 'mañana' : 'tarde',
          zona_id: zonaId,
          estado: 'en_curso',
          distancia_estimada_km: rutaOptimizada.totalDistance,
          tiempo_estimado_min: rutaOptimizada.estimatedDuration,
        })
        .select('id')
        .single()

      if (rutaError || !ruta) {
        console.error('Error al crear ruta:', rutaError)
        continue
      }

      // Crear pedidos mock para cada cliente
      const tiempoPedidos = Date.now()
      console.log('⏱️ [TIME] Creando pedidos mock...')
      const pedidosIds: string[] = []
      for (const cliente of clientesData) {
        // Generar número de pedido
        const numeroPedido = `PED-MOCK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const total = Math.floor(Math.random() * 50000) + 10000 // Entre $10,000 y $60,000
        const subtotal = total
        
        // Crear pedido mock
        const { data: pedido, error: pedidoError } = await supabase
          .from('pedidos')
          .insert({
            numero_pedido: numeroPedido,
            cliente_id: cliente.id,
            fecha_pedido: fechaRuta,
            estado: 'enviado',
            turno: rutaIndex % 2 === 0 ? 'mañana' : 'tarde',
            zona_id: zonaId,
            subtotal,
            total,
            pago_estado: 'pendiente',
          })
          .select('id')
          .single()

        if (!pedidoError && pedido) {
          pedidosIds.push(pedido.id)
        } else {
          console.error('Error al crear pedido mock:', pedidoError)
        }
      }
      console.log('⏱️ [TIME] Pedidos creados en:', Date.now() - tiempoPedidos, 'ms, total:', pedidosIds.length)

      // Verificar que se crearon pedidos
      if (pedidosIds.length === 0) {
        console.error('No se pudieron crear pedidos mock para la ruta')
        continue
      }

      // Crear detalles_ruta con orden optimizado
      console.log('🔍 [DEBUG] Creando detalles_ruta, orderedPoints:', { length: rutaOptimizada.orderedPoints.length, orderedPoints: rutaOptimizada.orderedPoints })
      const ordenVisita: any[] = []
      const puntosOrdenados = rutaOptimizada.orderedPoints.filter(p => p && p.clienteId)
      console.log('🔍 [DEBUG] Puntos ordenados filtrados:', { puntosOrdenadosLength: puntosOrdenados.length, puntosOrdenados })

      for (let i = 0; i < puntosOrdenados.length && i < pedidosIds.length; i++) {
        const punto = puntosOrdenados[i]
        const clienteId = punto.clienteId || punto.id

        // Buscar cliente y pedido correspondiente
        const clienteIndex = clientesData.findIndex(c => c.id === clienteId)
        if (clienteIndex === -1 || clienteIndex >= pedidosIds.length) continue

        const cliente = clientesData[clienteIndex]
        const pedidoId = pedidosIds[clienteIndex]

        // Crear detalle_ruta
        const { data: detalle, error: detalleError } = await supabase
          .from('detalles_ruta')
          .insert({
            ruta_id: ruta.id,
            pedido_id: pedidoId,
            orden_entrega: i + 1,
            coordenadas_entrega: cliente.coordenadas,
            estado_entrega: 'pendiente',
          })
          .select('id')
          .single()

        if (!detalleError && detalle) {
          // Extraer coordenadas para orden_visita usando la misma lógica de parseo
          let coords: { lat: number; lng: number } | null = null
          
          if (cliente.coordenadas) {
            try {
              if (typeof cliente.coordenadas === 'string') {
                const match = cliente.coordenadas.match(/POINT\(([\d.-]+)\s+([\d.-]+)\)/)
                if (match) {
                  coords = {
                    lng: parseFloat(match[1]),
                    lat: parseFloat(match[2])
                  }
                }
              } else if (cliente.coordenadas && typeof cliente.coordenadas === 'object') {
                if ('lat' in cliente.coordenadas && 'lng' in cliente.coordenadas) {
                  coords = {
                    lat: typeof cliente.coordenadas.lat === 'string' ? parseFloat(cliente.coordenadas.lat) : cliente.coordenadas.lat,
                    lng: typeof cliente.coordenadas.lng === 'string' ? parseFloat(cliente.coordenadas.lng) : cliente.coordenadas.lng
                  }
                } else if ('coordinates' in cliente.coordenadas && Array.isArray(cliente.coordenadas.coordinates)) {
                  coords = {
                    lng: cliente.coordenadas.coordinates[0],
                    lat: cliente.coordenadas.coordinates[1]
                  }
                }
              }
            } catch (e) {
              console.warn('Error parseando coordenadas para orden_visita:', e)
            }
          }
          
          if (coords && !isNaN(coords.lat) && !isNaN(coords.lng)) {
            ordenVisita.push({
              detalle_ruta_id: detalle.id,
              pedido_id: pedidoId,
              cliente_id: clienteId,
              cliente_nombre: cliente.nombre,
              lat: coords.lat,
              lng: coords.lng,
              orden: i + 1,
            })
          }
        }
      }

      // Generar polilínea simple
      console.log('🔍 [DEBUG] Generando polilínea con orderedPoints:', { orderedPoints: rutaOptimizada.orderedPoints })
      const polyline = generateSimplePolyline(rutaOptimizada.orderedPoints || [])
      console.log('🔍 [DEBUG] Polilínea generada:', polyline)

      // Crear ruta_planificada
      const { error: rutaPlanificadaError } = await supabase
        .from('rutas_planificadas')
        .insert({
          ruta_reparto_id: ruta.id,
          fecha: fechaRuta,
          zona_id: zonaId,
          vehiculo_id: vehiculo.id,
          estado: 'en_curso',
          orden_visita: ordenVisita,
          polyline,
          distancia_total_km: rutaOptimizada.totalDistance,
          duracion_total_min: rutaOptimizada.estimatedDuration,
          optimizada_por: 'local',
        })

      if (rutaPlanificadaError) {
        console.error('Error al crear ruta planificada:', rutaPlanificadaError)
      }

      // Generar ubicaciones GPS simuladas
      // IMPORTANTE: Usar fecha/hora actual para que aparezcan en el monitor
      const tiempoGPS = Date.now()
      console.log('⏱️ [TIME] Generando ubicaciones GPS...')
      console.log('🔍 [DEBUG] Generando ubicaciones GPS, orderedPoints:', { orderedPoints: rutaOptimizada.orderedPoints })
      const ubicacionesGPS: Array<{ lat: number; lng: number; timestamp: Date }> = []
      const puntosRuta = rutaOptimizada.orderedPoints || []
      console.log('🔍 [DEBUG] Puntos ruta para GPS:', { puntosRutaLength: puntosRuta.length, puntosRuta })

      if (!Array.isArray(puntosRuta) || puntosRuta.length === 0) {
        console.warn(`No hay puntos de ruta válidos para generar GPS en ruta ${ruta.id}`)
      }
      
      // Usar hora actual como base, pero ajustar para que parezca que la ruta está en curso
      const ahora = new Date()
      const inicioTimestamp = new Date(ahora)
      // Establecer hora de inicio hace 30 minutos para que parezca que la ruta ya está en curso
      inicioTimestamp.setMinutes(ahora.getMinutes() - 30 - (rutaIndex * 10))
      
      // Generar puntos intermedios entre cada par de puntos de la ruta
      let tiempoAcumulado = 0
      for (let i = 0; i < Math.max(0, puntosRuta.length - 1); i++) {
        const puntoActual = puntosRuta[i]
        const puntoSiguiente = puntosRuta[i + 1]

        // Calcular distancia entre puntos
        const distancia = haversineDistance(puntoActual, puntoSiguiente)
        // Reducir puntos intermedios para optimizar tiempo en Vercel Free: ~1 punto cada 500m
        const numPuntosIntermedios = Math.max(1, Math.floor(distancia * 2)) // ~1 punto cada 500m

        // Calcular tiempo del segmento (asumiendo velocidad promedio de 30 km/h)
        const tiempoSegmento = (distancia / 30) * 3600 // segundos

        // Generar puntos intermedios
        for (let j = 0; j <= numPuntosIntermedios; j++) {
          const factor = j / numPuntosIntermedios
          const lat = puntoActual.lat + (puntoSiguiente.lat - puntoActual.lat) * factor
          const lng = puntoActual.lng + (puntoSiguiente.lng - puntoActual.lng) * factor

          // Calcular timestamp para este punto
          const tiempoPunto = (tiempoSegmento / numPuntosIntermedios) * j
          const timestamp = new Date(inicioTimestamp.getTime() + (tiempoAcumulado + tiempoPunto) * 1000)
          
          // Asegurar que el timestamp no sea futuro (máximo 5 minutos en el futuro)
          const maxTimestamp = new Date(ahora.getTime() + 5 * 60 * 1000)
          const timestampFinal = timestamp > maxTimestamp ? maxTimestamp : timestamp

          ubicacionesGPS.push({
            lat: Number(lat.toFixed(6)),
            lng: Number(lng.toFixed(6)),
            timestamp: timestampFinal,
          })
        }
        
        tiempoAcumulado += tiempoSegmento
      }

      // Insertar ubicaciones GPS (limitado a 20 por ruta para optimizar tiempo en Vercel Free)
      // Reducido a 20 para evitar timeouts en Vercel Free (10s límite)
      console.log('⏱️ [TIME] Generación GPS completada en:', Date.now() - tiempoGPS, 'ms')
      console.log('🔍 [DEBUG] Ubicaciones GPS generadas:', { ubicacionesGPSLength: ubicacionesGPS.length, ubicacionesGPS })
      const ubicacionesLimitadas = Array.isArray(ubicacionesGPS) ? ubicacionesGPS.slice(0, 20) : []
      console.log('🔍 [DEBUG] Ubicaciones limitadas:', { ubicacionesLimitadasLength: ubicacionesLimitadas.length })
      
      // Asegurar que todas las ubicaciones sean de hoy
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      const ubicacionesInsert = ubicacionesLimitadas.map(ubic => {
        // Asegurar que el timestamp sea de hoy (mismo día)
        const timestamp = new Date(ubic.timestamp)
        timestamp.setFullYear(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
        
        return {
          repartidor_id: repartidor.id,
          vehiculo_id: vehiculo.id,
          lat: ubic.lat,
          lng: ubic.lng,
          created_at: timestamp.toISOString(),
        }
      })

      if (ubicacionesInsert.length > 0) {
        const tiempoInsertGPS = Date.now()
        console.log('⏱️ [TIME] Insertando ubicaciones GPS en BD...')
        const { error: ubicacionesError } = await supabase
          .from('ubicaciones_repartidores')
          .insert(ubicacionesInsert)
        console.log('⏱️ [TIME] Inserción GPS completada en:', Date.now() - tiempoInsertGPS, 'ms')

        if (ubicacionesError) {
          console.error('Error al insertar ubicaciones GPS:', ubicacionesError)
        } else {
          console.log(`✅ Insertadas ${ubicacionesInsert.length} ubicaciones GPS para ruta ${ruta.id}`)
        }

        // Actualizar vehiculos_estado con última ubicación
        const ultimaUbicacion = ubicacionesLimitadas[ubicacionesLimitadas.length - 1]
        const ultimoTimestamp = new Date(ultimaUbicacion.timestamp)
        ultimoTimestamp.setFullYear(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
        
        const { error: estadoError } = await supabase
          .from('vehiculos_estado')
          .upsert({
            vehiculo_id: vehiculo.id,
            ultima_lat: ultimaUbicacion.lat,
            ultima_lng: ultimaUbicacion.lng,
            ultima_actualizacion: ultimoTimestamp.toISOString(),
            ruta_activa_id: ruta.id,
            updated_at: new Date().toISOString(),
          })

        if (estadoError) {
          console.error('Error al actualizar vehiculos_estado:', estadoError)
        } else {
          console.log(`✅ Actualizado vehiculos_estado para vehículo ${vehiculo.id} con ruta_activa_id ${ruta.id}`)
        }
      } else {
        console.warn(`⚠️ No se generaron ubicaciones GPS para la ruta ${ruta.id}`)
      }

      rutasCreadas.push(ruta.id)
      const tiempoTotalRuta = Date.now() - tiempoRuta
      console.log(`⏱️ [TIME] Ruta ${rutaIndex + 1} completada en:`, tiempoTotalRuta, 'ms')
      console.log(`✅ [RUTA] Ruta ${rutaIndex + 1}/${cantidadRutas} creada exitosamente`)
    }

    const tiempoTotal = Date.now() - inicioTotal
    console.log('✅ [SUCCESS] Función completada exitosamente en:', tiempoTotal, 'ms')
    console.log('✅ [SUCCESS] Rutas creadas:', { rutasCreadasLength: rutasCreadas.length, rutasCreadas })
    revalidatePath('/(admin)/(dominios)/reparto/monitor')
    revalidatePath('/(admin)/(dominios)/reparto/rutas')

    return {
      success: true,
      data: { rutasCreadas },
      message: `Se crearon ${rutasCreadas.length} rutas mock exitosamente`,
    }
  } catch (error: any) {
    const tiempoTotal = Date.now() - inicioTotal
    console.error('❌ [ERROR] Error al crear rutas mock después de:', tiempoTotal, 'ms')
    console.error('❌ [ERROR] Error al crear rutas mock:', error)
    console.error('❌ [ERROR] Stack trace:', error.stack)
    console.error('❌ [ERROR] Error details:', {
      message: error.message,
      name: error.name,
      cause: error.cause
    })
    return {
      success: false,
      error: error.message || 'Error al crear rutas mock',
    }
  }
}