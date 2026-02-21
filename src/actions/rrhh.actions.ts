'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { getGeminiModel } from '@/lib/ai/runtime'
import { GEMINI_MODEL_FLASH } from '@/lib/constants/gemini-models'
import { devError } from '@/lib/utils/logger'
import type { ApiResponse } from '@/types/api.types'
import type { Empleado, LiquidacionReglaPeriodo, LiquidacionReglaPuesto } from '@/types/domain.types'

// ===========================================
// RRHH - ACCIONES DEL SERVIDOR
// ===========================================

// ========== EMPLEADOS ==========

export async function crearEmpleadoAction(
  empleadoData: {
    usuario_id?: string
    sucursal_id?: string
    categoria_id?: string
    legajo?: string
    fecha_ingreso: string
    fecha_nacimiento?: string
    dni?: string
    cuil?: string
    domicilio?: string
    telefono_personal?: string
    contacto_emergencia?: string
    telefono_emergencia?: string
    obra_social?: string
    numero_afiliado?: string
    banco?: string
    cbu?: string
    numero_cuenta?: string
    sueldo_actual?: number
    activo?: boolean
  }
): Promise<ApiResponse<{ empleadoId: string }>> {
  try {
    const supabase = await createClient()

    // Validar unicidad del legajo si se proporciona
    if (empleadoData.legajo) {
      const { data: existingEmpleado, error: checkError } = await supabase
        .from('rrhh_empleados')
        .select('id')
        .eq('legajo', empleadoData.legajo)
        .single()

      if (existingEmpleado) {
        return {
          success: false,
          error: 'El legajo ya está en uso por otro empleado',
        }
      }
    }

    // Validar unicidad del DNI si se proporciona
    if (empleadoData.dni) {
      const { data: existingEmpleado, error: checkError } = await supabase
        .from('rrhh_empleados')
        .select('id')
        .eq('dni', empleadoData.dni)
        .single()

      if (existingEmpleado) {
        return {
          success: false,
          error: 'El DNI ya está en uso por otro empleado',
        }
      }
    }

    // Validar unicidad del CUIL si se proporciona
    if (empleadoData.cuil) {
      const { data: existingEmpleado, error: checkError } = await supabase
        .from('rrhh_empleados')
        .select('id')
        .eq('cuil', empleadoData.cuil)
        .single()

      if (existingEmpleado) {
        return {
          success: false,
          error: 'El CUIL ya está en uso por otro empleado',
        }
      }
    }

    // Validar que el usuario_id tenga cuenta de autenticación si se proporciona
    if (empleadoData.usuario_id) {
      // Verificar que el usuario existe en la tabla usuarios
      const { data: usuarioData, error: usuarioError } = await supabase
        .from('usuarios')
        .select('id, email, activo')
        .eq('id', empleadoData.usuario_id)
        .single()

      if (usuarioError || !usuarioData) {
        return {
          success: false,
          error: 'El usuario seleccionado no existe en el sistema',
        }
      }

      if (!usuarioData.activo) {
        return {
          success: false,
          error: 'El usuario seleccionado está inactivo',
        }
      }

      // Verificar que el usuario no esté ya asignado a otro empleado
      const { data: empleadoExistente, error: empleadoError } = await supabase
        .from('rrhh_empleados')
        .select('id')
        .eq('usuario_id', empleadoData.usuario_id)
        .eq('activo', true)
        .single()

      if (empleadoExistente) {
        return {
          success: false,
          error: 'Este usuario ya está asignado a otro empleado activo',
        }
      }

      // Nota: La verificación de que existe en auth.users se hace automáticamente
      // mediante el trigger sync_user_from_auth() o se puede verificar con una función RPC
      // Por ahora, asumimos que si está en la tabla usuarios y está activo, tiene cuenta de auth
    }

    // Limpiar campos de fecha vacíos (convertir "" a null/undefined)
    const cleanedData: any = {
      ...empleadoData,
      activo: empleadoData.activo ?? true,
    }
    
    // IMPORTANTE: Eliminar nombre y apellido - estos campos NO deben enviarse al crear
    // El nombre y apellido del empleado vienen del usuario vinculado (usuario_id)
    // Solo se usan si el empleado NO tiene usuario_id asignado
    delete cleanedData.nombre
    delete cleanedData.apellido
    
    // Validar que fecha_ingreso no esté vacío (es requerido)
    if (!cleanedData.fecha_ingreso || cleanedData.fecha_ingreso === '' || cleanedData.fecha_ingreso === null) {
      return {
        success: false,
        error: 'La fecha de ingreso es requerida',
      }
    }
    
    // Convertir fecha_nacimiento vacía a undefined
    if (cleanedData.fecha_nacimiento === '' || cleanedData.fecha_nacimiento === null || cleanedData.fecha_nacimiento === undefined) {
      delete cleanedData.fecha_nacimiento
    }
    
    // Limpiar otros campos opcionales vacíos
    const optionalFields = ['legajo', 'dni', 'cuil', 'domicilio', 'telefono_personal', 
                            'contacto_emergencia', 'telefono_emergencia', 'obra_social', 
                            'numero_afiliado', 'banco', 'cbu', 'numero_cuenta', 'usuario_id',
                            'sucursal_id', 'categoria_id']
    
    optionalFields.forEach(field => {
      if (cleanedData[field] === '' || cleanedData[field] === null || cleanedData[field] === undefined) {
        delete cleanedData[field]
      }
    })
    
    // Limpiar sueldo_actual si es 0 o null (opcional)
    if (cleanedData.sueldo_actual === 0 || cleanedData.sueldo_actual === null || cleanedData.sueldo_actual === undefined) {
      delete cleanedData.sueldo_actual
    }

    const { data, error } = await supabase
      .from('rrhh_empleados')
      .insert(cleanedData)
      .select('id')
      .single()

    if (error) {
      devError('Error al crear empleado:', error)
      return {
        success: false,
        error: 'Error al crear empleado: ' + error.message,
      }
    }

    revalidatePath('/rrhh/empleados')
    revalidatePath('/admin/dashboard')

    return {
      success: true,
      data: { empleadoId: data.id },
      message: 'Empleado creado exitosamente',
    }
  } catch (error) {
    devError('Error en crearEmpleado:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function actualizarEmpleadoAction(
  empleadoId: string,
  empleadoData: {
    usuario_id?: string
    sucursal_id?: string
    categoria_id?: string
    legajo?: string
    fecha_ingreso?: string
    fecha_nacimiento?: string
    dni?: string
    cuil?: string
    domicilio?: string
    telefono_personal?: string
    contacto_emergencia?: string
    telefono_emergencia?: string
    obra_social?: string
    numero_afiliado?: string
    banco?: string
    cbu?: string
    numero_cuenta?: string
    sueldo_actual?: number
    activo?: boolean
  }
): Promise<ApiResponse<{ empleadoId: string }>> {
  try {
    const supabase = await createClient()

    // Validar unicidad del legajo si se proporciona
    if (empleadoData.legajo) {
      const { data: existingEmpleado, error: checkError } = await supabase
        .from('rrhh_empleados')
        .select('id')
        .eq('legajo', empleadoData.legajo)
        .neq('id', empleadoId)
        .single()

      if (existingEmpleado) {
        return {
          success: false,
          error: 'El legajo ya está en uso por otro empleado',
        }
      }
    }

    // Validar unicidad del DNI si se proporciona
    if (empleadoData.dni) {
      const { data: existingEmpleado, error: checkError } = await supabase
        .from('rrhh_empleados')
        .select('id')
        .eq('dni', empleadoData.dni)
        .neq('id', empleadoId)
        .single()

      if (existingEmpleado) {
        return {
          success: false,
          error: 'El DNI ya está en uso por otro empleado',
        }
      }
    }

    // Validar unicidad del CUIL si se proporciona
    if (empleadoData.cuil) {
      const { data: existingEmpleado, error: checkError } = await supabase
        .from('rrhh_empleados')
        .select('id')
        .eq('cuil', empleadoData.cuil)
        .neq('id', empleadoId)
        .single()

      if (existingEmpleado) {
        return {
          success: false,
          error: 'El CUIL ya está en uso por otro empleado',
        }
      }
    }

    // Limpiar campos de fecha vacíos (convertir "" a null/undefined)
    const cleanedData: any = { ...empleadoData }
    
    // IMPORTANTE: Manejar nombre y apellido correctamente
    // El nombre y apellido del empleado vienen del usuario vinculado (usuario_id)
    // Solo se usan si el empleado NO tiene usuario_id asignado
    
    // Si se está asignando un usuario_id, limpiar nombre y apellido del empleado
    // porque el nombre debe venir del usuario vinculado, no de campos directos
    if (cleanedData.usuario_id) {
      cleanedData.nombre = null
      cleanedData.apellido = null
    } else {
      // Si no se está asignando usuario_id, eliminar estos campos para que no se actualicen
      delete cleanedData.nombre
      delete cleanedData.apellido
    }
    
    // Convertir fechas vacías a undefined (no se actualizan si están vacías)
    // fecha_ingreso puede ser opcional en actualización, pero si viene vacío no se actualiza
    if (cleanedData.fecha_ingreso === '' || cleanedData.fecha_ingreso === null || cleanedData.fecha_ingreso === undefined) {
      delete cleanedData.fecha_ingreso
    }
    
    if (cleanedData.fecha_nacimiento === '' || cleanedData.fecha_nacimiento === null || cleanedData.fecha_nacimiento === undefined) {
      delete cleanedData.fecha_nacimiento
    }
    
    // Limpiar otros campos opcionales vacíos
    const optionalFields = ['legajo', 'dni', 'cuil', 'domicilio', 'telefono_personal', 
                            'contacto_emergencia', 'telefono_emergencia', 'obra_social', 
                            'numero_afiliado', 'banco', 'cbu', 'numero_cuenta', 'usuario_id',
                            'sucursal_id', 'categoria_id']
    
    optionalFields.forEach(field => {
      if (cleanedData[field] === '' || cleanedData[field] === null || cleanedData[field] === undefined) {
        delete cleanedData[field]
      }
    })
    
    // Limpiar sueldo_actual si es 0 o null (opcional)
    if (cleanedData.sueldo_actual === 0 || cleanedData.sueldo_actual === null || cleanedData.sueldo_actual === undefined) {
      delete cleanedData.sueldo_actual
    }

    const { data, error } = await supabase
      .from('rrhh_empleados')
      .update(cleanedData)
      .eq('id', empleadoId)
      .select('id')
      .single()

    if (error) {
      devError('Error al actualizar empleado:', error)
      return {
        success: false,
        error: 'Error al actualizar empleado: ' + error.message,
      }
    }

    revalidatePath('/rrhh/empleados')
    revalidatePath(`/rrhh/empleados/${empleadoId}`)

    return {
      success: true,
      data: { empleadoId: data.id },
      message: 'Empleado actualizado exitosamente',
    }
  } catch (error) {
    devError('Error en actualizarEmpleado:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function eliminarEmpleadoAction(empleadoId: string): Promise<ApiResponse<void>> {
  try {
    const supabase = await createClient()

    // Verificar si el empleado tiene dependencias
    const { data: asistencias, error: checkAsistencias } = await supabase
      .from('rrhh_asistencia')
      .select('id')
      .eq('empleado_id', empleadoId)
      .limit(1)

    if (asistencias && asistencias.length > 0) {
      return {
        success: false,
        error: 'No se puede eliminar el empleado porque tiene registros de asistencia',
      }
    }

    const { data: adelantos, error: checkAdelantos } = await supabase
      .from('rrhh_adelantos')
      .select('id')
      .eq('empleado_id', empleadoId)
      .limit(1)

    if (adelantos && adelantos.length > 0) {
      return {
        success: false,
        error: 'No se puede eliminar el empleado porque tiene adelantos registrados',
      }
    }

    const { error } = await supabase
      .from('rrhh_empleados')
      .delete()
      .eq('id', empleadoId)

    if (error) {
      devError('Error al eliminar empleado:', error)
      return {
        success: false,
        error: 'Error al eliminar empleado: ' + error.message,
      }
    }

    revalidatePath('/rrhh/empleados')

    return {
      success: true,
      message: 'Empleado eliminado exitosamente',
    }
  } catch (error) {
    devError('Error en eliminarEmpleado:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function obtenerEmpleadosActivosAction(): Promise<ApiResponse<Empleado[]>> {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    const { data: authResult, error: authError } = await supabase.auth.getUser()
    if (authError || !authResult.user) {
      return {
        success: false,
        error: 'Usuario no autenticado',
      }
    }

    const { data: userData } = await supabase
      .from('usuarios')
      .select('rol, activo')
      .eq('id', authResult.user.id)
      .maybeSingle()

    const isAdmin = !!userData?.activo && userData.rol === 'admin'
    const db = isAdmin ? adminSupabase : supabase

    const { data, error } = await db
      .from('rrhh_empleados')
      .select(`
        *,
        usuario:usuarios(id, nombre, apellido, email),
        sucursal:sucursales(id, nombre),
        categoria:rrhh_categorias(id, nombre, sueldo_basico)
      `)
      .eq('activo', true)
      .order('created_at', { ascending: false })

    if (error) {
      devError('Error al obtener empleados activos:', error)
      return {
        success: false,
        error: 'Error al obtener empleados: ' + error.message,
      }
    }

    return {
      success: true,
      data: (data || []) as Empleado[],
    }
  } catch (error) {
    devError('Error en obtenerEmpleadosActivosAction:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function obtenerEmpleadoPorIdAction(empleadoId: string): Promise<ApiResponse<Empleado>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('rrhh_empleados')
      .select(`
        *,
        usuario:usuarios(id, nombre, apellido, email),
        sucursal:sucursales(id, nombre),
        categoria:rrhh_categorias(id, nombre, sueldo_basico)
      `)
      .eq('id', empleadoId)
      .single()

    if (error) {
      devError('Error al obtener empleado:', error)
      return {
        success: false,
        error: 'Error al obtener empleado: ' + error.message,
      }
    }

    if (!data) {
      return {
        success: false,
        error: 'Empleado no encontrado',
      }
    }

    return {
      success: true,
      data: data as Empleado,
    }
  } catch (error) {
    devError('Error en obtenerEmpleadoPorId:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

// ========== NOVEDADES ==========

export async function crearNovedadAction(
  novedadData: {
    titulo: string
    descripcion?: string
    tipo: 'general' | 'sucursal' | 'categoria'
    sucursal_id?: string
    categoria_id?: string
    fecha_publicacion?: string
    fecha_expiracion?: string
    prioridad?: 'baja' | 'normal' | 'alta' | 'urgente'
    activo?: boolean
  }
): Promise<ApiResponse<{ novedadId: string }>> {
  try {
    const supabase = await createClient()

    // Obtener el usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return {
        success: false,
        error: 'Usuario no autenticado',
      }
    }

    const { data, error } = await supabase
      .from('rrhh_novedades')
      .insert({
        ...novedadData,
        created_by: user.id,
        fecha_publicacion: novedadData.fecha_publicacion || new Date().toISOString().split('T')[0],
        prioridad: novedadData.prioridad || 'normal',
        activo: novedadData.activo ?? true,
      })
      .select('id')
      .single()

    if (error) {
      devError('Error al crear novedad:', error)
      return {
        success: false,
        error: 'Error al crear novedad: ' + error.message,
      }
    }

    revalidatePath('/rrhh/novedades')

    return {
      success: true,
      data: { novedadId: data.id },
      message: 'Novedad creada exitosamente',
    }
  } catch (error) {
    devError('Error en crearNovedad:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function actualizarNovedadAction(
  novedadId: string,
  novedadData: {
    titulo?: string
    descripcion?: string
    tipo?: 'general' | 'sucursal' | 'categoria'
    sucursal_id?: string
    categoria_id?: string
    fecha_publicacion?: string
    fecha_expiracion?: string
    prioridad?: 'baja' | 'normal' | 'alta' | 'urgente'
    activo?: boolean
  }
): Promise<ApiResponse<{ novedadId: string }>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('rrhh_novedades')
      .update(novedadData)
      .eq('id', novedadId)
      .select('id')
      .single()

    if (error) {
      devError('Error al actualizar novedad:', error)
      return {
        success: false,
        error: 'Error al actualizar novedad: ' + error.message,
      }
    }

    revalidatePath('/rrhh/novedades')
    revalidatePath(`/rrhh/novedades/${novedadId}`)

    return {
      success: true,
      data: { novedadId: data.id },
      message: 'Novedad actualizada exitosamente',
    }
  } catch (error) {
    devError('Error en actualizarNovedad:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function eliminarNovedadAction(novedadId: string): Promise<ApiResponse<void>> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('rrhh_novedades')
      .delete()
      .eq('id', novedadId)

    if (error) {
      devError('Error al eliminar novedad:', error)
      return {
        success: false,
        error: 'Error al eliminar novedad: ' + error.message,
      }
    }

    revalidatePath('/rrhh/novedades')

    return {
      success: true,
      message: 'Novedad eliminada exitosamente',
    }
  } catch (error) {
    devError('Error en eliminarNovedad:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

// ========== ASISTENCIA ==========

export async function marcarAsistenciaAction(
  asistenciaData: {
    empleado_id: string
    fecha: string
    hora_entrada?: string
    hora_salida?: string
    turno?: 'mañana' | 'tarde' | 'noche'
    estado?: 'presente' | 'ausente' | 'tarde' | 'licencia'
    observaciones?: string
  }
): Promise<ApiResponse<{ asistenciaId: string }>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .rpc('fn_marcar_asistencia', {
        p_empleado_id: asistenciaData.empleado_id,
        p_fecha: asistenciaData.fecha,
        p_hora_entrada: asistenciaData.hora_entrada,
        p_turno: asistenciaData.turno,
      })

    if (error) {
      devError('Error al marcar asistencia:', error)
      return {
        success: false,
        error: 'Error al marcar asistencia: ' + error.message,
      }
    }

    revalidatePath('/rrhh/horarios')

    return {
      success: true,
      data: { asistenciaId: data },
      message: 'Asistencia registrada exitosamente',
    }
  } catch (error) {
    devError('Error en marcarAsistencia:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function actualizarAsistenciaAction(
  asistenciaId: string,
  asistenciaData: {
    hora_entrada?: string
    hora_salida?: string
    horas_trabajadas?: number
    turno?: 'mañana' | 'tarde' | 'noche'
    estado?: 'presente' | 'ausente' | 'tarde' | 'licencia'
    observaciones?: string
  }
): Promise<ApiResponse<{ asistenciaId: string }>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('rrhh_asistencia')
      .update(asistenciaData)
      .eq('id', asistenciaId)
      .select('id')
      .single()

    if (error) {
      devError('Error al actualizar asistencia:', error)
      return {
        success: false,
        error: 'Error al actualizar asistencia: ' + error.message,
      }
    }

    revalidatePath('/rrhh/horarios')

    return {
      success: true,
      data: { asistenciaId: data.id },
      message: 'Asistencia actualizada exitosamente',
    }
  } catch (error) {
    devError('Error en actualizarAsistencia:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

// ========== ADELANTOS ==========

export async function crearAdelantoAction(
  adelantoData: {
    empleado_id: string
    tipo: 'dinero' | 'producto'
    monto?: number
    producto_id?: string
    cantidad?: number
    precio_unitario?: number
    fecha_solicitud?: string
    observaciones?: string
  }
): Promise<ApiResponse<{ adelantoId: string }>> {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    // Obtener el usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return {
        success: false,
        error: 'Usuario no autenticado',
      }
    }

    // Validar límite de adelantos (30% del sueldo básico)
    if (adelantoData.tipo === 'dinero' && adelantoData.monto) {
      const { data: isValid, error: validationError } = await adminSupabase
        .rpc('fn_validar_limite_adelanto', {
          p_empleado_id: adelantoData.empleado_id,
          p_monto: adelantoData.monto,
        })

      if (validationError) {
        devError('Error al validar límite de adelanto:', validationError)
        return {
          success: false,
          error: 'Error al validar límite de adelanto',
        }
      }

      if (!isValid) {
        return {
          success: false,
          error: 'El adelanto supera el límite del 30% del sueldo básico',
        }
      }
    }

    const { data, error } = await adminSupabase
      .from('rrhh_adelantos')
      .insert({
        ...adelantoData,
        fecha_solicitud: adelantoData.fecha_solicitud || new Date().toISOString().split('T')[0],
        aprobado: false,
      })
      .select('id')
      .single()

    if (error) {
      devError('Error al crear adelanto:', error)
      return {
        success: false,
        error: 'Error al crear adelanto: ' + error.message,
      }
    }

    revalidatePath('/rrhh/adelantos')

    return {
      success: true,
      data: { adelantoId: data.id },
      message: 'Adelanto creado exitosamente, pendiente de aprobación',
    }
  } catch (error) {
    devError('Error en crearAdelanto:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function aprobarAdelantoAction(
  adelantoId: string,
  aprobadoPor: string
): Promise<ApiResponse<void>> {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('rrhh_adelantos')
      .update({
        aprobado: true,
        aprobado_por: aprobadoPor,
        fecha_aprobacion: new Date().toISOString(),
      })
      .eq('id', adelantoId)
      .select('id')
      .maybeSingle()

    if (error || !data?.id) {
      devError('Error al aprobar adelanto:', error)
      return {
        success: false,
        error: 'Error al aprobar adelanto: ' + (error?.message || 'Adelanto no encontrado'),
      }
    }

    revalidatePath('/rrhh/adelantos')

    return {
      success: true,
      message: 'Adelanto aprobado exitosamente',
    }
  } catch (error) {
    devError('Error en aprobarAdelanto:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function rechazarAdelantoAction(adelantoId: string): Promise<ApiResponse<void>> {
  try {
    const supabase = createAdminClient()

    const { error } = await supabase
      .from('rrhh_adelantos')
      .delete()
      .eq('id', adelantoId)

    if (error) {
      devError('Error al rechazar adelanto:', error)
      return {
        success: false,
        error: 'Error al rechazar adelanto: ' + error.message,
      }
    }

    revalidatePath('/rrhh/adelantos')

    return {
      success: true,
      message: 'Adelanto rechazado exitosamente',
    }
  } catch (error) {
    devError('Error en rechazarAdelanto:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

// ========== LIQUIDACIONES ==========

async function getAuthenticatedAdminUserId(): Promise<string | null> {
  const supabase = await createClient()
  const adminSupabase = createAdminClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return null

  const { data: userRow, error: roleError } = await adminSupabase
    .from('usuarios')
    .select('rol, activo')
    .eq('id', user.id)
    .maybeSingle()

  if (roleError || !userRow?.activo || userRow.rol !== 'admin') return null
  return user.id
}

type UpsertLiquidacionJornadaInput = {
  id?: string
  fecha: string
  turno?: string
  tarea?: string
  horas_mensuales?: number
  horas_adicionales?: number
  turno_especial_unidades?: number
  tarifa_hora_base?: number
  tarifa_hora_extra?: number
  tarifa_turno_especial?: number
  origen?: 'auto_hik' | 'auto_asistencia' | 'manual'
  observaciones?: string
}

type CalculoLiquidacionAjusteManualInput = {
  horas_adicionales?: number
  turno_especial_unidades?: number
  observaciones?: string
}

type GuardarReglaPeriodoInput = {
  periodo_mes: number
  periodo_anio: number
  dias_base_galpon: number
  dias_base_sucursales: number
  dias_base_rrhh: number
  activo?: boolean
}

function getDaysInMonth(periodoMes: number, periodoAnio: number): number {
  return new Date(periodoAnio, periodoMes, 0).getDate()
}

type GuardarReglaPuestoInput = {
  id?: string
  puesto_codigo: string
  categoria_id?: string | null
  grupo_base_dias: 'galpon' | 'sucursales' | 'rrhh'
  horas_jornada: number
  tarifa_turno_especial: number
  habilita_cajero: boolean
  tarifa_diferencia_cajero: number
  tipo_calculo?: 'hora' | 'turno'
  activo?: boolean
}

export async function prepararLiquidacionMensualAction(
  empleadoId: string,
  mes: number,
  anio: number
): Promise<ApiResponse<{ liquidacionId: string }>> {
  try {
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return {
        success: false,
        error: 'Usuario no autenticado',
      }
    }

    let data: string | null = null
    let error: any = null

    const v2Result = await supabase.rpc('fn_rrhh_preparar_liquidacion_mensual', {
      p_empleado_id: empleadoId,
      p_mes: mes,
      p_anio: anio,
      p_created_by: user.id,
    })

    data = v2Result.data as string | null
    error = v2Result.error

    if (error && String(error.message || '').toLowerCase().includes('fn_rrhh_preparar_liquidacion_mensual')) {
      const legacyResult = await supabase.rpc('fn_calcular_liquidacion_mensual', {
        p_empleado_id: empleadoId,
        p_mes: mes,
        p_anio: anio,
        p_created_by: user.id,
      })
      data = legacyResult.data as string | null
      error = legacyResult.error
    }

    if (error) {
      devError('Error al calcular liquidacion:', error)
      return {
        success: false,
        error: 'Error al calcular liquidacion: ' + error.message,
      }
    }

    revalidatePath('/rrhh/liquidaciones')

    return {
      success: true,
      data: { liquidacionId: data as string },
      message: 'Liquidacion calculada exitosamente',
    }
  } catch (error) {
    devError('Error en prepararLiquidacionMensualAction:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function calcularLiquidacionMensualAction(
  empleadoId: string,
  mes: number,
  anio: number
): Promise<ApiResponse<{ liquidacionId: string }>> {
  return prepararLiquidacionMensualAction(empleadoId, mes, anio)
}

export async function calcularLiquidacionConAjustesAction(
  empleadoId: string,
  mes: number,
  anio: number,
  ajustesManual?: CalculoLiquidacionAjusteManualInput
): Promise<ApiResponse<{ liquidacionId: string }>> {
  try {
    const horasAdicionales = Number(ajustesManual?.horas_adicionales ?? 0)
    const turnoEspecialUnidades = Number(ajustesManual?.turno_especial_unidades ?? 0)
    const observaciones = ajustesManual?.observaciones?.trim() || ''

    if (horasAdicionales < 0 || turnoEspecialUnidades < 0) {
      return {
        success: false,
        error: 'Las horas adicionales y turnos especiales no pueden ser negativos',
      }
    }

    const calculoResult = await prepararLiquidacionMensualAction(empleadoId, mes, anio)
    if (!calculoResult.success || !calculoResult.data?.liquidacionId) {
      return calculoResult
    }

    const liquidacionId = calculoResult.data.liquidacionId
    const requiereAjusteManual =
      horasAdicionales > 0 || turnoEspecialUnidades > 0 || observaciones.length > 0

    if (!requiereAjusteManual) {
      return calculoResult
    }

    const adminUserId = await getAuthenticatedAdminUserId()
    if (!adminUserId) {
      return {
        success: false,
        error: 'Solo administradores pueden aplicar ajustes manuales de liquidacion',
      }
    }

    const adminSupabase = createAdminClient()

    const { data: liquidacion, error: liquidacionError } = await adminSupabase
      .from('rrhh_liquidaciones')
      .select('id, valor_hora, valor_hora_extra')
      .eq('id', liquidacionId)
      .maybeSingle()

    if (liquidacionError || !liquidacion?.id) {
      devError('Error obteniendo liquidacion para ajustes manuales:', liquidacionError)
      return {
        success: false,
        error: 'No se pudo obtener la liquidacion para aplicar ajustes',
      }
    }

    const { data: ajusteExistente } = await adminSupabase
      .from('rrhh_liquidacion_jornadas')
      .select('id')
      .eq('liquidacion_id', liquidacionId)
      .eq('origen', 'manual')
      .eq('turno', 'ajuste_rrhh')
      .limit(1)
      .maybeSingle()

    const { data: jornadasReferencia } = await adminSupabase
      .from('rrhh_liquidacion_jornadas')
      .select('tarifa_hora_extra, tarifa_turno_especial')
      .eq('liquidacion_id', liquidacionId)
      .order('created_at', { ascending: false })
      .limit(30)

    const tarifaHoraExtra =
      (jornadasReferencia || []).find((row) => Number(row.tarifa_hora_extra || 0) > 0)?.tarifa_hora_extra ||
      liquidacion.valor_hora_extra ||
      liquidacion.valor_hora ||
      0

    const tarifaTurnoEspecial =
      (jornadasReferencia || []).find((row) => Number(row.tarifa_turno_especial || 0) > 0)?.tarifa_turno_especial ||
      0

    const fechaAjuste = `${anio}-${String(mes).padStart(2, '0')}-01`
    const ajusteResult = await upsertLiquidacionJornadaAction(liquidacionId, {
      id: ajusteExistente?.id,
      fecha: fechaAjuste,
      turno: 'ajuste_rrhh',
      tarea: 'ajuste_manual_rrhh',
      horas_mensuales: 0,
      horas_adicionales: horasAdicionales,
      turno_especial_unidades: turnoEspecialUnidades,
      tarifa_hora_base: liquidacion.valor_hora || 0,
      tarifa_hora_extra: Number(tarifaHoraExtra || 0),
      tarifa_turno_especial: Number(tarifaTurnoEspecial || 0),
      origen: 'manual',
      observaciones: observaciones || 'Ajuste manual desde calcular liquidaciones',
    })

    if (!ajusteResult.success) {
      return {
        success: false,
        error: ajusteResult.error || 'No se pudo guardar el ajuste manual',
      }
    }

    revalidatePath(`/rrhh/liquidaciones/${liquidacionId}`)

    return {
      success: true,
      data: { liquidacionId },
      message: 'Liquidacion calculada con ajuste manual aplicado',
    }
  } catch (error) {
    devError('Error en calcularLiquidacionConAjustesAction:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function recalcularLiquidacionAction(
  liquidacionId: string
): Promise<ApiResponse<{ liquidacionId: string }>> {
  try {
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return {
        success: false,
        error: 'Usuario no autenticado',
      }
    }

    const { data, error } = await supabase.rpc('fn_rrhh_recalcular_liquidacion', {
      p_liquidacion_id: liquidacionId,
      p_actor: user.id,
    })

    if (error) {
      devError('Error al recalcular liquidacion:', error)
      return {
        success: false,
        error: 'Error al recalcular liquidacion: ' + error.message,
      }
    }

    revalidatePath('/rrhh/liquidaciones')
    revalidatePath(`/rrhh/liquidaciones/${liquidacionId}`)

    return {
      success: true,
      data: { liquidacionId: data as string },
      message: 'Liquidacion recalculada exitosamente',
    }
  } catch (error) {
    devError('Error en recalcularLiquidacionAction:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function upsertLiquidacionJornadaAction(
  liquidacionId: string,
  jornadaData: UpsertLiquidacionJornadaInput
): Promise<ApiResponse<{ jornadaId: string; liquidacionId: string }>> {
  try {
    const adminUserId = await getAuthenticatedAdminUserId()
    if (!adminUserId) {
      return {
        success: false,
        error: 'No autorizado',
      }
    }

    const supabase = createAdminClient()

    const { data: liquidacion, error: liqError } = await supabase
      .from('rrhh_liquidaciones')
      .select('id, empleado_id')
      .eq('id', liquidacionId)
      .maybeSingle()

    if (liqError || !liquidacion?.id) {
      return {
        success: false,
        error: 'Liquidacion no encontrada',
      }
    }

    const payload = {
      liquidacion_id: liquidacion.id,
      empleado_id: liquidacion.empleado_id,
      fecha: jornadaData.fecha,
      turno: jornadaData.turno || 'general',
      tarea: jornadaData.tarea || null,
      horas_mensuales: jornadaData.horas_mensuales ?? 0,
      horas_adicionales: jornadaData.horas_adicionales ?? 0,
      turno_especial_unidades: jornadaData.turno_especial_unidades ?? 0,
      tarifa_hora_base: jornadaData.tarifa_hora_base ?? 0,
      tarifa_hora_extra: jornadaData.tarifa_hora_extra ?? 0,
      tarifa_turno_especial: jornadaData.tarifa_turno_especial ?? 0,
      origen: jornadaData.origen || 'manual',
      observaciones: jornadaData.observaciones || null,
    }

    let jornadaId = jornadaData.id

    if (jornadaData.id) {
      const { data, error } = await supabase
        .from('rrhh_liquidacion_jornadas')
        .update(payload)
        .eq('id', jornadaData.id)
        .eq('liquidacion_id', liquidacionId)
        .select('id')
        .maybeSingle()

      if (error || !data?.id) {
        devError('Error al actualizar jornada de liquidacion:', error)
        return {
          success: false,
          error: 'No se pudo actualizar la jornada',
        }
      }

      jornadaId = data.id
    } else {
      const { data, error } = await supabase
        .from('rrhh_liquidacion_jornadas')
        .insert(payload)
        .select('id')
        .single()

      if (error || !data?.id) {
        devError('Error al crear jornada de liquidacion:', error)
        return {
          success: false,
          error: 'No se pudo crear la jornada',
        }
      }

      jornadaId = data.id
    }

    const recalcResult = await recalcularLiquidacionAction(liquidacionId)
    if (!recalcResult.success) {
      return {
        success: false,
        error: recalcResult.error || 'No se pudo recalcular la liquidacion luego de guardar la jornada',
      }
    }

    revalidatePath(`/rrhh/liquidaciones/${liquidacionId}`)

    return {
      success: true,
      data: { jornadaId: jornadaId as string, liquidacionId },
      message: 'Jornada guardada y liquidacion recalculada',
    }
  } catch (error) {
    devError('Error en upsertLiquidacionJornadaAction:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function obtenerConfiguracionLiquidacionAction(
  periodoMes: number,
  periodoAnio: number
): Promise<ApiResponse<{ reglaPeriodo: LiquidacionReglaPeriodo | null; reglasPuesto: LiquidacionReglaPuesto[]; categorias: { id: string; nombre: string }[] }>> {
  try {
    const adminUserId = await getAuthenticatedAdminUserId()
    if (!adminUserId) {
      return {
        success: false,
        error: 'No autorizado',
      }
    }

    const supabase = createAdminClient()

    const { data: reglaPeriodo, error: periodoError } = await supabase
      .from('rrhh_liquidacion_reglas_periodo')
      .select('*')
      .eq('periodo_mes', periodoMes)
      .eq('periodo_anio', periodoAnio)
      .maybeSingle()

    if (periodoError) {
      devError('Error obteniendo regla de periodo de liquidacion:', periodoError)
      return {
        success: false,
        error: 'No se pudo obtener la regla de periodo',
      }
    }

    const { data: reglasPuesto, error: puestosError } = await supabase
      .from('rrhh_liquidacion_reglas_puesto')
      .select('*')
      .order('puesto_codigo', { ascending: true })

    if (puestosError) {
      devError('Error obteniendo reglas por puesto de liquidacion:', puestosError)
      return {
        success: false,
        error: 'No se pudieron obtener las reglas por puesto',
      }
    }

    const { data: categorias } = await supabase
      .from('rrhh_categorias')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre')

    return {
      success: true,
      data: {
        reglaPeriodo: (reglaPeriodo || null) as LiquidacionReglaPeriodo | null,
        reglasPuesto: (reglasPuesto || []) as LiquidacionReglaPuesto[],
        categorias: (categorias ?? []) as { id: string; nombre: string }[],
      },
    }
  } catch (error) {
    devError('Error en obtenerConfiguracionLiquidacionAction:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function guardarReglaPeriodoAction(
  payload: GuardarReglaPeriodoInput
): Promise<ApiResponse<{ reglaPeriodoId: string }>> {
  try {
    const adminUserId = await getAuthenticatedAdminUserId()
    if (!adminUserId) {
      return {
        success: false,
        error: 'No autorizado',
      }
    }

    if (payload.periodo_mes < 1 || payload.periodo_mes > 12 || payload.periodo_anio < 2000) {
      return {
        success: false,
        error: 'Periodo inválido',
      }
    }

    if (payload.dias_base_galpon <= 0 || payload.dias_base_rrhh <= 0) {
      return {
        success: false,
        error: 'Los días base deben ser mayores a cero',
      }
    }

    const diasBaseSucursales = getDaysInMonth(payload.periodo_mes, payload.periodo_anio)

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('rrhh_liquidacion_reglas_periodo')
      .upsert(
        {
          periodo_mes: payload.periodo_mes,
          periodo_anio: payload.periodo_anio,
          dias_base_galpon: payload.dias_base_galpon,
          dias_base_sucursales: diasBaseSucursales,
          dias_base_rrhh: payload.dias_base_rrhh,
          activo: payload.activo ?? true,
        },
        { onConflict: 'periodo_mes,periodo_anio' }
      )
      .select('id')
      .single()

    if (error || !data?.id) {
      devError('Error guardando regla de periodo:', error)
      return {
        success: false,
        error: 'No se pudo guardar la regla de periodo',
      }
    }

    revalidatePath('/rrhh/liquidaciones')
    revalidatePath('/rrhh/liquidaciones/configuracion')

    return {
      success: true,
      data: { reglaPeriodoId: data.id },
      message: 'Regla de periodo guardada',
    }
  } catch (error) {
    devError('Error en guardarReglaPeriodoAction:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function guardarReglaPuestoAction(
  payload: GuardarReglaPuestoInput
): Promise<ApiResponse<{ reglaPuestoId: string }>> {
  try {
    const adminUserId = await getAuthenticatedAdminUserId()
    if (!adminUserId) {
      return {
        success: false,
        error: 'No autorizado',
      }
    }

    const puestoCodigo = payload.puesto_codigo.trim()
    if (!puestoCodigo) {
      return {
        success: false,
        error: 'El código de puesto es obligatorio',
      }
    }

    if (payload.horas_jornada <= 0) {
      return {
        success: false,
        error: 'Las horas de jornada deben ser mayores a cero',
      }
    }

    if (payload.tarifa_turno_especial < 0 || payload.tarifa_diferencia_cajero < 0) {
      return {
        success: false,
        error: 'Las tarifas no pueden ser negativas',
      }
    }

    const supabase = createAdminClient()
    const insertPayload = {
      puesto_codigo: puestoCodigo,
      categoria_id: payload.categoria_id || null,
      grupo_base_dias: payload.grupo_base_dias,
      horas_jornada: payload.horas_jornada,
      tarifa_turno_especial: payload.tarifa_turno_especial,
      habilita_cajero: payload.habilita_cajero,
      tarifa_diferencia_cajero: payload.tarifa_diferencia_cajero,
      tipo_calculo: payload.tipo_calculo ?? 'hora',
      activo: payload.activo ?? true,
    }

    let data: { id: string } | null = null
    let error: { message?: string } | null = null

    if (payload.id) {
      const updateResult = await supabase
        .from('rrhh_liquidacion_reglas_puesto')
        .update(insertPayload)
        .eq('id', payload.id)
        .select('id')
        .single()

      data = updateResult.data
      error = updateResult.error
    } else {
      const upsertResult = await supabase
        .from('rrhh_liquidacion_reglas_puesto')
        .upsert(insertPayload, { onConflict: 'puesto_codigo' })
        .select('id')
        .single()

      data = upsertResult.data
      error = upsertResult.error
    }

    if (error || !data?.id) {
      devError('Error guardando regla de puesto:', error)
      return {
        success: false,
        error: 'No se pudo guardar la regla de puesto',
      }
    }

    revalidatePath('/rrhh/liquidaciones')
    revalidatePath('/rrhh/liquidaciones/configuracion')

    return {
      success: true,
      data: { reglaPuestoId: data.id },
      message: 'Regla de puesto guardada',
    }
  } catch (error) {
    devError('Error en guardarReglaPuestoAction:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function autorizarPagoLiquidacionAction(
  liquidacionId: string,
  autorizado: boolean,
  motivo?: string
): Promise<ApiResponse<void>> {
  try {
    const adminUserId = await getAuthenticatedAdminUserId()
    if (!adminUserId) {
      return {
        success: false,
        error: 'No autorizado',
      }
    }

    const supabase = createAdminClient()

    const updatePayload: Record<string, unknown> = {
      pago_autorizado: autorizado,
      motivo_no_autorizado: autorizado ? null : (motivo?.trim() || 'No autorizado por RRHH'),
    }

    const { data, error } = await supabase
      .from('rrhh_liquidaciones')
      .update(updatePayload)
      .eq('id', liquidacionId)
      .select('id')
      .maybeSingle()

    if (error || !data?.id) {
      devError('Error al autorizar pago de liquidacion:', error)
      return {
        success: false,
        error: 'Error al guardar autorizacion: ' + (error?.message || 'Liquidacion no encontrada'),
      }
    }

    revalidatePath('/rrhh/liquidaciones')
    revalidatePath(`/rrhh/liquidaciones/${liquidacionId}`)

    return {
      success: true,
      message: autorizado ? 'Pago autorizado' : 'Pago marcado como no autorizado',
    }
  } catch (error) {
    devError('Error en autorizarPagoLiquidacionAction:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function actualizarLiquidacionControlAction(
  liquidacionId: string,
  payload: {
    puesto_override?: string | null
    puesto_hs_extra?: string | null
    dias_cajero?: number
    diferencia_turno_cajero?: number
    orden_pago?: number | null
    observaciones?: string | null
  }
): Promise<ApiResponse<{ liquidacionId: string }>> {
  try {
    const adminUserId = await getAuthenticatedAdminUserId()
    if (!adminUserId) {
      return {
        success: false,
        error: 'No autorizado',
      }
    }

    const supabase = createAdminClient()

    const updatePayload: Record<string, unknown> = {
      puesto_override: payload.puesto_override ?? null,
      puesto_hs_extra: payload.puesto_hs_extra ?? null,
      dias_cajero: payload.dias_cajero ?? 0,
      diferencia_turno_cajero: payload.diferencia_turno_cajero ?? 0,
      orden_pago: payload.orden_pago ?? null,
      observaciones: payload.observaciones ?? null,
    }

    const { data, error } = await supabase
      .from('rrhh_liquidaciones')
      .update(updatePayload)
      .eq('id', liquidacionId)
      .select('id')
      .maybeSingle()

    if (error || !data?.id) {
      devError('Error actualizando control de liquidacion:', error)
      return {
        success: false,
        error: 'No se pudo actualizar los datos de control de liquidacion',
      }
    }

    const recalcResult = await recalcularLiquidacionAction(liquidacionId)
    if (!recalcResult.success) {
      return {
        success: false,
        error: recalcResult.error || 'No se pudo recalcular la liquidacion',
      }
    }

    revalidatePath('/rrhh/liquidaciones')
    revalidatePath(`/rrhh/liquidaciones/${liquidacionId}`)

    return {
      success: true,
      data: { liquidacionId },
      message: 'Datos de control actualizados',
    }
  } catch (error) {
    devError('Error en actualizarLiquidacionControlAction:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function aprobarLiquidacionAction(liquidacionId: string): Promise<ApiResponse<void>> {
  try {
    const adminUserId = await getAuthenticatedAdminUserId()
    if (!adminUserId) {
      return {
        success: false,
        error: 'No autorizado',
      }
    }

    const adminSupabase = createAdminClient()

    const { data, error } = await adminSupabase
      .from('rrhh_liquidaciones')
      .update({
        estado: 'aprobada',
        aprobado_por: adminUserId,
        fecha_aprobacion: new Date().toISOString(),
      })
      .eq('id', liquidacionId)
      .select('id')
      .maybeSingle()

    if (error || !data?.id) {
      devError('Error al aprobar liquidación:', error)
      return {
        success: false,
        error: 'Error al aprobar liquidación: ' + (error?.message || 'Liquidación no encontrada'),
      }
    }

    revalidatePath('/rrhh/liquidaciones')

    return {
      success: true,
      message: 'Liquidación aprobada exitosamente',
    }
  } catch (error) {
    devError('Error en aprobarLiquidacion:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function marcarLiquidacionPagadaAction(liquidacionId: string): Promise<ApiResponse<void>> {
  try {
    const adminUserId = await getAuthenticatedAdminUserId()
    if (!adminUserId) {
      return {
        success: false,
        error: 'No autorizado',
      }
    }

    const supabase = createAdminClient()

    const { data: liquidacionActual, error: fetchError } = await supabase
      .from('rrhh_liquidaciones')
      .select('id, control_30_superado, pago_autorizado')
      .eq('id', liquidacionId)
      .maybeSingle()

    if (fetchError || !liquidacionActual?.id) {
      return {
        success: false,
        error: 'Liquidacion no encontrada',
      }
    }

    if (liquidacionActual.control_30_superado && !liquidacionActual.pago_autorizado) {
      return {
        success: false,
        error: 'La liquidacion supera el control del 30% y requiere autorizacion manual de pago',
      }
    }

    const { data, error } = await supabase
      .from('rrhh_liquidaciones')
      .update({
        estado: 'pagada',
        pagado: true,
        fecha_pago: new Date().toISOString(),
        pago_autorizado: liquidacionActual.pago_autorizado || !liquidacionActual.control_30_superado,
      })
      .eq('id', liquidacionId)
      .select('id')
      .maybeSingle()

    if (error || !data?.id) {
      devError('Error al marcar liquidación como pagada:', error)
      return {
        success: false,
        error: 'Error al marcar liquidación como pagada: ' + (error?.message || 'Liquidación no encontrada'),
      }
    }

    revalidatePath('/rrhh/liquidaciones')
    revalidatePath(`/rrhh/liquidaciones/${liquidacionId}`)

    return {
      success: true,
      message: 'Liquidación marcada como pagada exitosamente',
    }
  } catch (error) {
    devError('Error en marcarLiquidacionPagada:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

// ========== LICENCIAS ==========

type AuditoriaCertificadoIA = {
  valido: boolean
  confianza: number
  observaciones: string
  nombreDetectado?: string
  diagnosticoDetectado?: string
}

function normalizarTexto(value?: string | null) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function coincideNombre(esperado: string, detectado: string) {
  const esperadoNorm = normalizarTexto(esperado)
  const detectadoNorm = normalizarTexto(detectado)

  if (!esperadoNorm || !detectadoNorm) return false
  if (esperadoNorm.includes(detectadoNorm) || detectadoNorm.includes(esperadoNorm)) return true

  const tokens = esperadoNorm.split(' ').filter((token) => token.length > 2)
  return tokens.length > 0 && tokens.every((token) => detectadoNorm.includes(token))
}

function coincideDiagnostico(reportado?: string, detectado?: string) {
  const reportadoNorm = normalizarTexto(reportado)
  const detectadoNorm = normalizarTexto(detectado)

  if (!reportadoNorm) return true
  if (!detectadoNorm) return false
  return reportadoNorm.includes(detectadoNorm) || detectadoNorm.includes(reportadoNorm)
}

async function auditarCertificadoConIA(
  file: File,
  contexto: { nombreEmpleado: string; diagnosticoReportado?: string }
): Promise<AuditoriaCertificadoIA> {
  const fallback: AuditoriaCertificadoIA = {
    valido: false,
    confianza: 0,
    observaciones: 'No se pudo validar automaticamente. Requiere revision manual.',
  }

  if (!file.type.startsWith('image/')) {
    return {
      ...fallback,
      observaciones: 'Solo se admiten imagenes para auditoria IA del certificado.',
    }
  }

  const model = getGeminiModel(GEMINI_MODEL_FLASH, {
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  })

  if (!model) {
    return {
      ...fallback,
      observaciones: 'IA no configurada. Queda pendiente de revision manual RRHH.',
    }
  }

  try {
    const buffer = await file.arrayBuffer()
    const base64Data = Buffer.from(buffer).toString('base64')

    const prompt = `
Analiza esta imagen de certificado medico laboral y responde SOLO JSON valido:
{
  "es_certificado_medico": true/false,
  "nombre_paciente": "texto o null",
  "diagnostico": "texto o null",
  "fecha_emision": "YYYY-MM-DD o null",
  "confianza": 0-100,
  "observaciones": "hallazgos cortos"
}
`

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType: file.type } },
    ])

    const response = await result.response
    const text = response.text()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return fallback

    const parsed = JSON.parse(jsonMatch[0]) as {
      es_certificado_medico?: boolean
      nombre_paciente?: string | null
      diagnostico?: string | null
      confianza?: number
      observaciones?: string
    }

    const nombreDetectado = parsed.nombre_paciente || ''
    const diagnosticoDetectado = parsed.diagnostico || ''
    const nombreOk = coincideNombre(contexto.nombreEmpleado, nombreDetectado)
    const diagnosticoOk = coincideDiagnostico(contexto.diagnosticoReportado, diagnosticoDetectado)
    const esCertificado = !!parsed.es_certificado_medico

    return {
      valido: esCertificado && nombreOk && diagnosticoOk,
      confianza: Number(parsed.confianza || 0),
      observaciones: parsed.observaciones || 'Analisis IA completado.',
      nombreDetectado,
      diagnosticoDetectado,
    }
  } catch (error) {
    devError('Error en auditarCertificadoConIA:', error)
    return fallback
  }
}

export async function crearLicenciaAction(formData: FormData): Promise<ApiResponse<{ licenciaId: string }>> {
  try {
    const supabase = await createClient()

    const empleado_id = String(formData.get('empleado_id') || '')
    const tipo = String(formData.get('tipo') || '') as
      | 'vacaciones'
      | 'enfermedad'
      | 'maternidad'
      | 'estudio'
      | 'otro'
    const fecha_inicio = String(formData.get('fecha_inicio') || '')
    const fecha_fin = String(formData.get('fecha_fin') || '')
    const fecha_sintomas = String(formData.get('fecha_sintomas') || '')
    const diagnostico_reportado = String(formData.get('diagnostico_reportado') || '').trim() || undefined
    const excepcion_plazo = String(formData.get('excepcion_plazo') || 'false') === 'true'
    const motivo_excepcion = String(formData.get('motivo_excepcion') || '').trim() || undefined
    const observaciones = String(formData.get('observaciones') || '').trim() || undefined
    const certificado = formData.get('certificado') as File | null

    if (!empleado_id || !tipo || !fecha_inicio || !fecha_fin || !fecha_sintomas) {
      return { success: false, error: 'Faltan campos obligatorios de la licencia' }
    }

    if (!certificado || certificado.size <= 0) {
      return { success: false, error: 'Debe adjuntar el certificado en imagen para validar la licencia' }
    }

    if (!certificado.type.startsWith('image/')) {
      return { success: false, error: 'El certificado debe ser una imagen valida (JPG, PNG o WEBP)' }
    }

    const fechaInicio = new Date(fecha_inicio)
    const fechaFin = new Date(fecha_fin)
    const fechaSintomas = new Date(fecha_sintomas)
    const ahora = new Date()

    if (Number.isNaN(fechaInicio.getTime()) || Number.isNaN(fechaFin.getTime()) || Number.isNaN(fechaSintomas.getTime())) {
      return { success: false, error: 'Las fechas informadas no son validas' }
    }

    if (fechaFin < fechaInicio) {
      return { success: false, error: 'La fecha de fin no puede ser anterior a la fecha de inicio' }
    }

    const fechaLimitePresentacion = new Date(fechaSintomas.getTime() + 24 * 60 * 60 * 1000)
    const presentadoEnTermino = ahora <= fechaLimitePresentacion

    if (!presentadoEnTermino && !excepcion_plazo) {
      return {
        success: false,
        error: 'El certificado debe presentarse dentro de las 24 horas desde el inicio. Marque excepcion si corresponde.',
      }
    }

    if (excepcion_plazo && !motivo_excepcion) {
      return { success: false, error: 'Debe informar el motivo de excepcion de plazo' }
    }

    const { data: empleado, error: empleadoError } = await supabase
      .from('rrhh_empleados')
      .select('id, nombre, apellido, usuario:usuarios(nombre, apellido)')
      .eq('id', empleado_id)
      .single()

    if (empleadoError || !empleado) {
      return { success: false, error: 'Empleado no encontrado' }
    }

    const nombreEmpleado =
      `${(empleado as any).usuario?.nombre || (empleado as any).nombre || ''} ${(empleado as any).usuario?.apellido || (empleado as any).apellido || ''}`.trim() ||
      'Empleado'

    const safeFileName = certificado.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `rrhh/licencias/${empleado_id}/${Date.now()}-${safeFileName}`
    const certBuffer = Buffer.from(await certificado.arrayBuffer())

    const { error: uploadError } = await supabase.storage.from('documentos').upload(storagePath, certBuffer, {
      contentType: certificado.type || 'image/jpeg',
      upsert: false,
    })

    if (uploadError) {
      devError('Error subiendo certificado de licencia:', uploadError)
      return { success: false, error: 'No se pudo subir el certificado. Intenta nuevamente.' }
    }

    const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(storagePath)

    const auditoriaIA = await auditarCertificadoConIA(certificado, {
      nombreEmpleado,
      diagnosticoReportado: diagnostico_reportado,
    })

    const diasTotal = Math.ceil((fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24)) + 1

    const { data, error } = await supabase
      .from('rrhh_licencias')
      .insert({
        empleado_id,
        tipo,
        fecha_inicio,
        fecha_fin,
        fecha_sintomas: fechaSintomas.toISOString(),
        diagnostico_reportado,
        excepcion_plazo,
        motivo_excepcion,
        fecha_presentacion_certificado: ahora.toISOString(),
        fecha_limite_presentacion: fechaLimitePresentacion.toISOString(),
        presentado_en_termino: presentadoEnTermino,
        certificado_url: urlData.publicUrl,
        certificado_storage_path: storagePath,
        certificado_nombre_archivo: certificado.name,
        certificado_mime_type: certificado.type || 'image/jpeg',
        certificado_tamano_bytes: certificado.size,
        estado_revision: 'pendiente',
        revision_manual_required: true,
        ia_certificado_valido: auditoriaIA.valido,
        ia_confianza: auditoriaIA.confianza,
        ia_observaciones: auditoriaIA.observaciones,
        ia_nombre_detectado: auditoriaIA.nombreDetectado || null,
        ia_diagnostico_detectado: auditoriaIA.diagnosticoDetectado || null,
        observaciones,
        dias_total: diasTotal,
        aprobado: false,
      })
      .select('id')
      .single()

    if (error) {
      devError('Error al crear licencia:', error)
      return {
        success: false,
        error: 'Error al crear licencia: ' + error.message,
      }
    }

    revalidatePath('/rrhh/licencias')

    return {
      success: true,
      data: { licenciaId: data.id },
      message: 'Licencia creada con certificado. Queda pendiente de revision manual por RRHH.',
    }
  } catch (error) {
    devError('Error en crearLicencia:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function aprobarLicenciaAction(licenciaId: string): Promise<ApiResponse<void>> {
  try {
    const supabase = await createClient()

    // Obtener el usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return {
        success: false,
        error: 'Usuario no autenticado',
      }
    }

    const { data, error } = await supabase
      .from('rrhh_licencias')
      .update({
        aprobado: true,
        aprobado_por: user.id,
        fecha_aprobacion: new Date().toISOString(),
        estado_revision: 'aprobado',
        revision_manual_required: false,
        revisado_por: user.id,
        fecha_revision: new Date().toISOString(),
      })
      .eq('id', licenciaId)
      .select('id')
      .single()

    if (error) {
      devError('Error al aprobar licencia:', error)
      return {
        success: false,
        error: 'Error al aprobar licencia: ' + error.message,
      }
    }

    revalidatePath('/rrhh/licencias')

    return {
      success: true,
      message: 'Licencia aprobada exitosamente',
    }
  } catch (error) {
    devError('Error en aprobarLicencia:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

// ========== DESCUENTOS ==========

export async function crearDescuentoAction(
  descuentoData: {
    empleado_id: string
    tipo: 'multa' | 'daño_equipo' | 'otro'
    monto: number
    fecha?: string
    motivo: string
    observaciones?: string
  }
): Promise<ApiResponse<{ descuentoId: string }>> {
  try {
    const supabase = await createClient()

    // Obtener el usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return {
        success: false,
        error: 'Usuario no autenticado',
      }
    }

    const { data, error } = await supabase
      .from('rrhh_descuentos')
      .insert({
        ...descuentoData,
        fecha: descuentoData.fecha || new Date().toISOString().split('T')[0],
        aprobado: false,
      })
      .select('id')
      .single()

    if (error) {
      devError('Error al crear descuento:', error)
      return {
        success: false,
        error: 'Error al crear descuento: ' + error.message,
      }
    }

    revalidatePath('/rrhh/descuentos')

    return {
      success: true,
      data: { descuentoId: data.id },
      message: 'Descuento creado exitosamente, pendiente de aprobación',
    }
  } catch (error) {
    devError('Error en crearDescuento:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function aprobarDescuentoAction(descuentoId: string): Promise<ApiResponse<void>> {
  try {
    const supabase = await createClient()

    // Obtener el usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return {
        success: false,
        error: 'Usuario no autenticado',
      }
    }

    const { data, error } = await supabase
      .from('rrhh_descuentos')
      .update({
        aprobado: true,
        aprobado_por: user.id,
        fecha_aprobacion: new Date().toISOString(),
      })
      .eq('id', descuentoId)
      .select('id')
      .single()

    if (error) {
      devError('Error al aprobar descuento:', error)
      return {
        success: false,
        error: 'Error al aprobar descuento: ' + error.message,
      }
    }

    revalidatePath('/rrhh/descuentos')

    return {
      success: true,
      message: 'Descuento aprobado exitosamente',
    }
  } catch (error) {
    devError('Error en aprobarDescuento:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

// ========== EVALUACIONES ==========

export async function crearEvaluacionAction(
  evaluacionData: {
    empleado_id: string
    sucursal_id: string
    periodo_mes: number
    periodo_anio: number
    puntualidad?: number
    rendimiento?: number
    actitud?: number
    responsabilidad?: number
    trabajo_equipo?: number
    fortalezas?: string
    areas_mejora?: string
    objetivos?: string
    comentarios?: string
    fecha_evaluacion?: string
    estado?: 'borrador' | 'enviada' | 'completada'
  }
): Promise<ApiResponse<{ evaluacionId: string }>> {
  try {
    const supabase = await createClient()

    // Obtener el usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return {
        success: false,
        error: 'Usuario no autenticado',
      }
    }

    // Verificar si ya existe una evaluación para el mismo período
    const { data: existingEvaluacion, error: checkError } = await supabase
      .from('rrhh_evaluaciones')
      .select('id')
      .eq('empleado_id', evaluacionData.empleado_id)
      .eq('periodo_mes', evaluacionData.periodo_mes)
      .eq('periodo_anio', evaluacionData.periodo_anio)
      .single()

    if (existingEvaluacion) {
      return {
        success: false,
        error: 'Ya existe una evaluación para este empleado en el período seleccionado',
      }
    }

    const { data, error } = await supabase
      .from('rrhh_evaluaciones')
      .insert({
        ...evaluacionData,
        evaluador_id: user.id,
        fecha_evaluacion: evaluacionData.fecha_evaluacion || new Date().toISOString().split('T')[0],
        estado: evaluacionData.estado || 'borrador',
      })
      .select('id')
      .single()

    if (error) {
      devError('Error al crear evaluación:', error)
      return {
        success: false,
        error: 'Error al crear evaluación: ' + error.message,
      }
    }

    revalidatePath('/rrhh/evaluaciones')

    return {
      success: true,
      data: { evaluacionId: data.id },
      message: 'Evaluación creada exitosamente',
    }
  } catch (error) {
    devError('Error en crearEvaluacion:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function actualizarEvaluacionAction(
  evaluacionId: string,
  evaluacionData: {
    puntualidad?: number
    rendimiento?: number
    actitud?: number
    responsabilidad?: number
    trabajo_equipo?: number
    fortalezas?: string
    areas_mejora?: string
    objetivos?: string
    comentarios?: string
    estado?: 'borrador' | 'enviada' | 'completada'
  }
): Promise<ApiResponse<{ evaluacionId: string }>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('rrhh_evaluaciones')
      .update(evaluacionData)
      .eq('id', evaluacionId)
      .select('id')
      .single()

    if (error) {
      devError('Error al actualizar evaluación:', error)
      return {
        success: false,
        error: 'Error al actualizar evaluación: ' + error.message,
      }
    }

    revalidatePath('/rrhh/evaluaciones')
    revalidatePath(`/rrhh/evaluaciones/${evaluacionId}`)

    return {
      success: true,
      data: { evaluacionId: data.id },
      message: 'Evaluación actualizada exitosamente',
    }
  } catch (error) {
    devError('Error en actualizarEvaluacion:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function enviarEvaluacionAction(evaluacionId: string): Promise<ApiResponse<void>> {
  try {
    const supabase = await createClient()

    // Actualizar estado a 'enviada' y marcar como notificada
    const { data, error } = await supabase
      .from('rrhh_evaluaciones')
      .update({
        estado: 'enviada',
        notificado: true,
        fecha_notificacion: new Date().toISOString(),
      })
      .eq('id', evaluacionId)
      .select('id')
      .single()

    if (error) {
      devError('Error al enviar evaluación:', error)
      return {
        success: false,
        error: 'Error al enviar evaluación: ' + error.message,
      }
    }

    revalidatePath('/rrhh/evaluaciones')

    return {
      success: true,
      message: 'Evaluación enviada exitosamente',
    }
  } catch (error) {
    devError('Error en enviarEvaluacion:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

// ========== SUCURSALES ==========

export async function crearSucursalAction(
  sucursalData: {
    nombre: string
    direccion?: string
    telefono?: string
    encargado_id?: string
    activo?: boolean
  }
): Promise<ApiResponse<{ sucursalId: string }>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('sucursales')
      .insert({
        ...sucursalData,
        activo: sucursalData.activo ?? true,
      })
      .select('id')
      .single()

    if (error) {
      devError('Error al crear sucursal:', error)
      return {
        success: false,
        error: 'Error al crear sucursal: ' + error.message,
      }
    }

    revalidatePath('/rrhh/sucursales')

    return {
      success: true,
      data: { sucursalId: data.id },
      message: 'Sucursal creada exitosamente',
    }
  } catch (error) {
    devError('Error en crearSucursal:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function actualizarSucursalAction(
  sucursalId: string,
  sucursalData: {
    nombre?: string
    direccion?: string
    telefono?: string
    encargado_id?: string
    activo?: boolean
  }
): Promise<ApiResponse<{ sucursalId: string }>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('sucursales')
      .update(sucursalData)
      .eq('id', sucursalId)
      .select('id')
      .single()

    if (error) {
      devError('Error al actualizar sucursal:', error)
      return {
        success: false,
        error: 'Error al actualizar sucursal: ' + error.message,
      }
    }

    revalidatePath('/rrhh/sucursales')
    revalidatePath(`/rrhh/sucursales/${sucursalId}`)

    return {
      success: true,
      data: { sucursalId: data.id },
      message: 'Sucursal actualizada exitosamente',
    }
  } catch (error) {
    devError('Error en actualizarSucursal:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

// ========== CATEGORÍAS ==========

export async function crearCategoriaEmpleadoAction(
  categoriaData: {
    nombre: string
    descripcion?: string
    sueldo_basico: number
    adicional_cajero?: number
    adicional_produccion?: number
    activo?: boolean
  }
): Promise<ApiResponse<{ categoriaId: string }>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('rrhh_categorias')
      .insert({
        ...categoriaData,
        adicional_cajero: categoriaData.adicional_cajero ?? 0,
        adicional_produccion: categoriaData.adicional_produccion ?? 0,
        activo: categoriaData.activo ?? true,
      })
      .select('id')
      .single()

    if (error) {
      devError('Error al crear categoría:', error)
      return {
        success: false,
        error: 'Error al crear categoría: ' + error.message,
      }
    }

    revalidatePath('/rrhh/categorias')

    return {
      success: true,
      data: { categoriaId: data.id },
      message: 'Categoría creada exitosamente',
    }
  } catch (error) {
    devError('Error en crearCategoriaEmpleado:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function actualizarCategoriaEmpleadoAction(
  categoriaId: string,
  categoriaData: {
    nombre?: string
    descripcion?: string
    sueldo_basico?: number
    adicional_cajero?: number
    adicional_produccion?: number
    activo?: boolean
  }
): Promise<ApiResponse<{ categoriaId: string }>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('rrhh_categorias')
      .update(categoriaData)
      .eq('id', categoriaId)
      .select('id')
      .single()

    if (error) {
      devError('Error al actualizar categoría:', error)
      return {
        success: false,
        error: 'Error al actualizar categoría: ' + error.message,
      }
    }

    revalidatePath('/rrhh/categorias')
    revalidatePath(`/rrhh/categorias/${categoriaId}`)

    return {
      success: true,
      data: { categoriaId: data.id },
      message: 'Categoría actualizada exitosamente',
    }
  } catch (error) {
    devError('Error en actualizarCategoriaEmpleado:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

// Obtener usuarios activos con cuenta de autenticación (para formularios)
export async function obtenerUsuariosConAuthAction(): Promise<ApiResponse<Array<{
  id: string
  email: string
  nombre: string
  apellido?: string
  rol: string
  activo: boolean
}>>> {
  try {
    const supabase = await createClient()

    // Obtener usuarios activos
    const { data: usuarios, error } = await supabase
      .from('usuarios')
      .select('id, email, nombre, apellido, rol, activo')
      .eq('activo', true)
      .order('nombre')

    if (error) {
      devError('Error al obtener usuarios:', error)
      return {
        success: false,
        error: 'Error al obtener usuarios: ' + error.message,
      }
    }

    // Verificar cuáles tienen cuenta de autenticación usando función RPC
    // Nota: No podemos consultar auth.users directamente, pero podemos usar
    // la función usuario_tiene_auth() si está disponible, o asumir que todos
    // los usuarios activos en la tabla usuarios tienen cuenta de auth
    // (ya que el trigger sync_user_from_auth() los sincroniza automáticamente)

    return {
      success: true,
      data: usuarios || [],
    }
  } catch (error) {
    devError('Error en obtenerUsuariosConAuthAction:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

// Obtener sucursales activas para formularios
export async function obtenerSucursalesActivasAction(): Promise<ApiResponse<Array<{
  id: string
  nombre: string
  direccion?: string
  telefono?: string
  activo: boolean
}>>> {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    const { data: authResult, error: authError } = await supabase.auth.getUser()
    if (authError || !authResult.user) {
      return {
        success: false,
        error: 'Usuario no autenticado',
      }
    }

    const { data: userData } = await supabase
      .from('usuarios')
      .select('rol, activo')
      .eq('id', authResult.user.id)
      .maybeSingle()

    const isAdmin = !!userData?.activo && userData.rol === 'admin'
    const db = isAdmin ? adminSupabase : supabase

    // Intentar con 'activo' primero (esquema RRHH)
    let { data: sucursales, error } = await db
      .from('sucursales')
      .select('id, nombre, direccion, telefono, activo')
      .eq('activo', true)
      .order('nombre')

    // Si falla con 'activo', intentar con 'active' (esquema sucursales)
    if (error) {
      const { data: sucursalesAlt, error: errorAlt } = await db
        .from('sucursales')
        .select('id, nombre, direccion, telefono, active')
        .eq('active', true)
        .order('nombre')
      
      if (!errorAlt && sucursalesAlt) {
        // Mapear 'active' a 'activo' para consistencia
        sucursales = sucursalesAlt.map(s => ({
          ...s,
          activo: (s as any).active
        }))
        error = null
      }
    }

    if (error) {
      devError('Error al obtener sucursales activas:', error)
      return {
        success: false,
        error: 'Error al obtener sucursales: ' + error.message,
      }
    }

    return {
      success: true,
      data: sucursales || [],
    }
  } catch (error) {
    devError('Error en obtenerSucursalesActivasAction:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}
