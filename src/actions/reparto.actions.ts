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
        fecha_check: new Date().toISOString().split('T')[0], // Fecha actual
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
      updated_at: new Date().toISOString(),
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
        fecha_check: data.fecha || new Date().toISOString().split('T')[0],
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
        updated_at: new Date().toISOString(),
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
      updated_at: new Date().toISOString(),
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