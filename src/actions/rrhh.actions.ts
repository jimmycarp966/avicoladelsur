'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@/types/api.types'

// ===========================================
// RRHH - ACCIONES DEL SERVIDOR
// ===========================================

// ========== EMPLEADOS ==========

export async function crearEmpleado(
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

    const { data, error } = await supabase
      .from('rrhh_empleados')
      .insert({
        ...empleadoData,
        activo: empleadoData.activo ?? true,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error al crear empleado:', error)
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
    console.error('Error en crearEmpleado:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function actualizarEmpleado(
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

    const { data, error } = await supabase
      .from('rrhh_empleados')
      .update(empleadoData)
      .eq('id', empleadoId)
      .select('id')
      .single()

    if (error) {
      console.error('Error al actualizar empleado:', error)
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
    console.error('Error en actualizarEmpleado:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function eliminarEmpleado(empleadoId: string): Promise<ApiResponse<void>> {
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
      console.error('Error al eliminar empleado:', error)
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
    console.error('Error en eliminarEmpleado:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

// ========== NOVEDADES ==========

export async function crearNovedad(
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
      console.error('Error al crear novedad:', error)
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
    console.error('Error en crearNovedad:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function actualizarNovedad(
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
      console.error('Error al actualizar novedad:', error)
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
    console.error('Error en actualizarNovedad:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function eliminarNovedad(novedadId: string): Promise<ApiResponse<void>> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('rrhh_novedades')
      .delete()
      .eq('id', novedadId)

    if (error) {
      console.error('Error al eliminar novedad:', error)
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
    console.error('Error en eliminarNovedad:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

// ========== ASISTENCIA ==========

export async function marcarAsistencia(
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
      console.error('Error al marcar asistencia:', error)
      return {
        success: false,
        error: 'Error al marcar asistencia: ' + error.message,
      }
    }

    revalidatePath('/rrhh/asistencia')

    return {
      success: true,
      data: { asistenciaId: data },
      message: 'Asistencia registrada exitosamente',
    }
  } catch (error) {
    console.error('Error en marcarAsistencia:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function actualizarAsistencia(
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
      console.error('Error al actualizar asistencia:', error)
      return {
        success: false,
        error: 'Error al actualizar asistencia: ' + error.message,
      }
    }

    revalidatePath('/rrhh/asistencia')

    return {
      success: true,
      data: { asistenciaId: data.id },
      message: 'Asistencia actualizada exitosamente',
    }
  } catch (error) {
    console.error('Error en actualizarAsistencia:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

// ========== ADELANTOS ==========

export async function crearAdelanto(
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
      const { data: isValid, error: validationError } = await supabase
        .rpc('fn_validar_limite_adelanto', {
          p_empleado_id: adelantoData.empleado_id,
          p_monto: adelantoData.monto,
        })

      if (validationError) {
        console.error('Error al validar límite de adelanto:', validationError)
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

    const { data, error } = await supabase
      .from('rrhh_adelantos')
      .insert({
        ...adelantoData,
        fecha_solicitud: adelantoData.fecha_solicitud || new Date().toISOString().split('T')[0],
        aprobado: false,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error al crear adelanto:', error)
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
    console.error('Error en crearAdelanto:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function aprobarAdelanto(
  adelantoId: string,
  aprobadoPor: string
): Promise<ApiResponse<void>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('rrhh_adelantos')
      .update({
        aprobado: true,
        aprobado_por: aprobadoPor,
        fecha_aprobacion: new Date().toISOString(),
      })
      .eq('id', adelantoId)
      .select('id')
      .single()

    if (error) {
      console.error('Error al aprobar adelanto:', error)
      return {
        success: false,
        error: 'Error al aprobar adelanto: ' + error.message,
      }
    }

    revalidatePath('/rrhh/adelantos')

    return {
      success: true,
      message: 'Adelanto aprobado exitosamente',
    }
  } catch (error) {
    console.error('Error en aprobarAdelanto:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function rechazarAdelanto(adelantoId: string): Promise<ApiResponse<void>> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('rrhh_adelantos')
      .delete()
      .eq('id', adelantoId)

    if (error) {
      console.error('Error al rechazar adelanto:', error)
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
    console.error('Error en rechazarAdelanto:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

// ========== LIQUIDACIONES ==========

export async function calcularLiquidacionMensual(
  empleadoId: string,
  mes: number,
  anio: number
): Promise<ApiResponse<{ liquidacionId: string }>> {
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
      .rpc('fn_calcular_liquidacion_mensual', {
        p_empleado_id: empleadoId,
        p_mes: mes,
        p_anio: anio,
        p_created_by: user.id,
      })

    if (error) {
      console.error('Error al calcular liquidación:', error)
      return {
        success: false,
        error: 'Error al calcular liquidación: ' + error.message,
      }
    }

    revalidatePath('/rrhh/liquidaciones')

    return {
      success: true,
      data: { liquidacionId: data },
      message: 'Liquidación calculada exitosamente',
    }
  } catch (error) {
    console.error('Error en calcularLiquidacionMensual:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function aprobarLiquidacion(liquidacionId: string): Promise<ApiResponse<void>> {
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
      .from('rrhh_liquidaciones')
      .update({
        estado: 'aprobada',
        aprobado_por: user.id,
        fecha_aprobacion: new Date().toISOString(),
      })
      .eq('id', liquidacionId)
      .select('id')
      .single()

    if (error) {
      console.error('Error al aprobar liquidación:', error)
      return {
        success: false,
        error: 'Error al aprobar liquidación: ' + error.message,
      }
    }

    revalidatePath('/rrhh/liquidaciones')

    return {
      success: true,
      message: 'Liquidación aprobada exitosamente',
    }
  } catch (error) {
    console.error('Error en aprobarLiquidacion:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function marcarLiquidacionPagada(liquidacionId: string): Promise<ApiResponse<void>> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('rrhh_liquidaciones')
      .update({
        estado: 'pagada',
        pagado: true,
        fecha_pago: new Date().toISOString(),
      })
      .eq('id', liquidacionId)
      .select('id')
      .single()

    if (error) {
      console.error('Error al marcar liquidación como pagada:', error)
      return {
        success: false,
        error: 'Error al marcar liquidación como pagada: ' + error.message,
      }
    }

    revalidatePath('/rrhh/liquidaciones')

    return {
      success: true,
      message: 'Liquidación marcada como pagada exitosamente',
    }
  } catch (error) {
    console.error('Error en marcarLiquidacionPagada:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

// ========== LICENCIAS ==========

export async function crearLicencia(
  licenciaData: {
    empleado_id: string
    tipo: 'vacaciones' | 'enfermedad' | 'maternidad' | 'estudio' | 'otro'
    fecha_inicio: string
    fecha_fin: string
    observaciones?: string
  }
): Promise<ApiResponse<{ licenciaId: string }>> {
  try {
    const supabase = await createClient()

    // Calcular días totales
    const fechaInicio = new Date(licenciaData.fecha_inicio)
    const fechaFin = new Date(licenciaData.fecha_fin)
    const diasTotal = Math.ceil((fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24)) + 1

    const { data, error } = await supabase
      .from('rrhh_licencias')
      .insert({
        ...licenciaData,
        dias_total: diasTotal,
        aprobado: false,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error al crear licencia:', error)
      return {
        success: false,
        error: 'Error al crear licencia: ' + error.message,
      }
    }

    revalidatePath('/rrhh/licencias')

    return {
      success: true,
      data: { licenciaId: data.id },
      message: 'Licencia creada exitosamente, pendiente de aprobación',
    }
  } catch (error) {
    console.error('Error en crearLicencia:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function aprobarLicencia(licenciaId: string): Promise<ApiResponse<void>> {
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
      })
      .eq('id', licenciaId)
      .select('id')
      .single()

    if (error) {
      console.error('Error al aprobar licencia:', error)
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
    console.error('Error en aprobarLicencia:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

// ========== DESCUENTOS ==========

export async function crearDescuento(
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
      console.error('Error al crear descuento:', error)
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
    console.error('Error en crearDescuento:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function aprobarDescuento(descuentoId: string): Promise<ApiResponse<void>> {
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
      console.error('Error al aprobar descuento:', error)
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
    console.error('Error en aprobarDescuento:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

// ========== EVALUACIONES ==========

export async function crearEvaluacion(
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
      console.error('Error al crear evaluación:', error)
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
    console.error('Error en crearEvaluacion:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function actualizarEvaluacion(
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
      console.error('Error al actualizar evaluación:', error)
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
    console.error('Error en actualizarEvaluacion:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function enviarEvaluacion(evaluacionId: string): Promise<ApiResponse<void>> {
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
      console.error('Error al enviar evaluación:', error)
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
    console.error('Error en enviarEvaluacion:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

// ========== SUCURSALES ==========

export async function crearSucursal(
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
      console.error('Error al crear sucursal:', error)
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
    console.error('Error en crearSucursal:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function actualizarSucursal(
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
      console.error('Error al actualizar sucursal:', error)
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
    console.error('Error en actualizarSucursal:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

// ========== CATEGORÍAS ==========

export async function crearCategoriaEmpleado(
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
      console.error('Error al crear categoría:', error)
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
    console.error('Error en crearCategoriaEmpleado:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function actualizarCategoriaEmpleado(
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
      console.error('Error al actualizar categoría:', error)
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
    console.error('Error en actualizarCategoriaEmpleado:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}
