'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import {
  RRHH_DISCIPLINA_BUCKET,
  generarDocumentoIncidenciaDisciplinaria,
} from '@/lib/services/documents/rrhh-incidencia-disciplinaria-service'
import {
  buildDisciplinaTitulo,
  type DisciplinaEtapa,
  type LegajoDisciplinaMetadata,
} from '@/lib/utils/rrhh-disciplinario'
import { buildEmpleadoLegajoFromDni } from '@/lib/utils/empleado-legajo'
import { devError } from '@/lib/utils/logger'
import {
  prepararLiquidacionMensualConDomingoSucursal,
  recalcularLiquidacionConDomingoSucursal,
} from '@/lib/services/rrhh-sucursal-domingos.service'
import type { ApiResponse } from '@/types/api.types'
import type { Empleado, LiquidacionReglaPeriodo, LiquidacionReglaPuesto } from '@/types/domain.types'

// ===========================================
// RRHH - ACCIONES DEL SERVIDOR
// ===========================================

type LegajoEventoInput = {
  empleadoId: string
  tipo: string
  categoria: string
  titulo: string
  descripcion?: string
  metadata?: Record<string, unknown>
  createdBy?: string | null
  fechaEvento?: string
}

const RRHH_LICENCIAS_BUCKET = 'rrhh-licencias'
const RRHH_LICENCIAS_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const RRHH_LICENCIAS_ALLOWED_INPUT_MIME_TYPES = [
  ...RRHH_LICENCIAS_ALLOWED_MIME_TYPES,
  'image/jpg',
  'image/heic',
  'image/heif',
] as const
const RRHH_LICENCIAS_FILE_SIZE_LIMIT = 10 * 1024 * 1024
const RRHH_DISCIPLINA_ALLOWED_MIME_TYPES = ['application/pdf']
const RRHH_DISCIPLINA_FILE_SIZE_LIMIT = 5 * 1024 * 1024

function resolveEmpleadoLegajo(legajo?: string, dni?: string): string | undefined {
  const normalizedLegajo = legajo?.trim()
  if (normalizedLegajo) {
    return normalizedLegajo
  }

  return buildEmpleadoLegajoFromDni(dni)
}

type CertificadoLicenciaPreparado = {
  file: File
  buffer: Buffer
  mimeType: string
  originalName: string
  storedFileName: string
  sizeBytes: number
}

async function ensureRrhhLicenciasBucket(db: any): Promise<boolean> {
  try {
    const { data: buckets, error: bucketsError } = await db.storage.listBuckets()

    if (bucketsError) {
      devError('Error obteniendo buckets RRHH:', bucketsError)
      return false
    }

    const bucketExists = (buckets || []).some(
      (bucket: { id?: string; name?: string }) =>
        bucket.id === RRHH_LICENCIAS_BUCKET || bucket.name === RRHH_LICENCIAS_BUCKET,
    )

    if (bucketExists) {
      const { error: updateBucketError } = await db.storage.updateBucket(RRHH_LICENCIAS_BUCKET, {
        public: false,
        fileSizeLimit: RRHH_LICENCIAS_FILE_SIZE_LIMIT,
        allowedMimeTypes: RRHH_LICENCIAS_ALLOWED_MIME_TYPES,
      })

      if (updateBucketError) {
        devError('Error actualizando bucket RRHH de licencias:', updateBucketError)
        return false
      }

      return true
    }

    const { error: createBucketError } = await db.storage.createBucket(RRHH_LICENCIAS_BUCKET, {
      public: false,
      fileSizeLimit: RRHH_LICENCIAS_FILE_SIZE_LIMIT,
      allowedMimeTypes: RRHH_LICENCIAS_ALLOWED_MIME_TYPES,
    })

    if (createBucketError && !String(createBucketError.message || '').toLowerCase().includes('already exists')) {
      devError('Error creando bucket RRHH de licencias:', createBucketError)
      return false
    }

    return true
  } catch (error) {
    devError('Error inesperado asegurando bucket RRHH de licencias:', error)
    return false
  }
}

async function ensureRrhhDisciplinaBucket(db: any): Promise<boolean> {
  try {
    const { data: buckets, error: bucketsError } = await db.storage.listBuckets()

    if (bucketsError) {
      devError('Error obteniendo bucket RRHH disciplinario:', bucketsError)
      return false
    }

    const bucketExists = (buckets || []).some(
      (bucket: { id?: string; name?: string }) =>
        bucket.id === RRHH_DISCIPLINA_BUCKET || bucket.name === RRHH_DISCIPLINA_BUCKET,
    )

    if (bucketExists) {
      const { error: updateBucketError } = await db.storage.updateBucket(RRHH_DISCIPLINA_BUCKET, {
        public: false,
        fileSizeLimit: RRHH_DISCIPLINA_FILE_SIZE_LIMIT,
        allowedMimeTypes: RRHH_DISCIPLINA_ALLOWED_MIME_TYPES,
      })

      if (updateBucketError) {
        devError('Error actualizando bucket RRHH disciplinario:', updateBucketError)
        return false
      }

      return true
    }

    const { error: createBucketError } = await db.storage.createBucket(RRHH_DISCIPLINA_BUCKET, {
      public: false,
      fileSizeLimit: RRHH_DISCIPLINA_FILE_SIZE_LIMIT,
      allowedMimeTypes: RRHH_DISCIPLINA_ALLOWED_MIME_TYPES,
    })

    if (createBucketError && !String(createBucketError.message || '').toLowerCase().includes('already exists')) {
      devError('Error creando bucket RRHH disciplinario:', createBucketError)
      return false
    }

    return true
  } catch (error) {
    devError('Error inesperado asegurando bucket RRHH disciplinario:', error)
    return false
  }
}

function getCertificadoMimeLabel() {
  return 'JPG, PNG, WEBP, HEIC o HEIF'
}

function buildStoredFileName(fileName: string, mimeType: string) {
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const extensionByMime: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  }

  const targetExtension = extensionByMime[mimeType] || ''
  if (!targetExtension) return sanitized

  const withoutExtension = sanitized.replace(/\.[^.]+$/, '')
  return withoutExtension.endsWith(targetExtension) ? withoutExtension : `${withoutExtension}${targetExtension}`
}

async function prepararCertificadoLicencia(
  file: File
): Promise<ApiResponse<CertificadoLicenciaPreparado>> {
  if (!file || file.size <= 0) {
    return { success: false, error: 'Debe adjuntar el certificado en imagen para validar la licencia' }
  }

  const inputMimeType = (file.type || '').toLowerCase()
  if (!RRHH_LICENCIAS_ALLOWED_INPUT_MIME_TYPES.includes(inputMimeType as (typeof RRHH_LICENCIAS_ALLOWED_INPUT_MIME_TYPES)[number])) {
    return {
      success: false,
      error: `El certificado debe estar en formato ${getCertificadoMimeLabel()}.`,
    }
  }

  let outputBuffer: Buffer = Buffer.from(await file.arrayBuffer())
  let outputMimeType = inputMimeType === 'image/jpg' ? 'image/jpeg' : inputMimeType
  let outputFileName = buildStoredFileName(file.name, outputMimeType)

  // iPhone suele subir HEIC/HEIF; lo normalizamos a JPEG antes de guardar/auditar.
  if (outputMimeType === 'image/heic' || outputMimeType === 'image/heif') {
    try {
      const sharpModule = await import('sharp')
      const sharp = sharpModule.default
      outputBuffer = await sharp(outputBuffer, { failOn: 'none' }).rotate().jpeg({ quality: 90 }).toBuffer()
      outputMimeType = 'image/jpeg'
      outputFileName = buildStoredFileName(file.name, outputMimeType)
    } catch (error) {
      devError('Error convirtiendo certificado HEIC/HEIF:', error)
      return {
        success: false,
        error: 'No se pudo procesar el certificado HEIC/HEIF. Intente con JPG, PNG o WEBP.',
      }
    }
  }

  if (!RRHH_LICENCIAS_ALLOWED_MIME_TYPES.includes(outputMimeType)) {
    return {
      success: false,
      error: `El certificado debe estar en formato ${getCertificadoMimeLabel()}.`,
    }
  }

  if (outputBuffer.length > RRHH_LICENCIAS_FILE_SIZE_LIMIT) {
    return {
      success: false,
      error: 'El certificado excede el limite de 10 MB. Reduzca el archivo e intente nuevamente.',
    }
  }

  const preparedFile =
    outputMimeType === file.type && outputFileName === file.name
      ? file
      : new File([new Uint8Array(outputBuffer)], outputFileName, { type: outputMimeType })

  return {
    success: true,
    data: {
      file: preparedFile,
      buffer: outputBuffer,
      mimeType: outputMimeType,
      originalName: file.name,
      storedFileName: outputFileName,
      sizeBytes: outputBuffer.length,
    },
  }
}

async function registrarEventoLegajo(db: any, input: LegajoEventoInput): Promise<void> {
  try {
    const { error } = await db
      .from('rrhh_legajo_eventos')
      .insert({
        empleado_id: input.empleadoId,
        tipo: input.tipo,
        categoria: input.categoria,
        titulo: input.titulo,
        descripcion: input.descripcion || null,
        metadata: input.metadata || {},
        created_by: input.createdBy || null,
        fecha_evento: input.fechaEvento || new Date().toISOString(),
      })

    // 42P01 = relation does not exist (migracion aun no aplicada)
    if (error && error.code !== '42P01') {
      devError('Error registrando evento en legajo:', error)
    }
  } catch (error) {
    devError('Error inesperado registrando evento en legajo:', error)
  }
}

async function getDbForCurrentUser() {
  const supabase = await createClient()
  const adminSupabase = createAdminClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { supabase, db: supabase, user: null, isAdmin: false }
  }

  const { data: userRow } = await adminSupabase
    .from('usuarios')
    .select('rol, activo')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = !!userRow?.activo && userRow.rol === 'admin'

  return {
    supabase,
    db: isAdmin ? adminSupabase : supabase,
    user,
    isAdmin,
  }
}

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
    if (!(await getAuthenticatedAdminUserId())) {
      return {
        success: false,
        error: 'No autorizado',
      }
    }

    const supabase = createAdminClient()
    const resolvedLegajo = resolveEmpleadoLegajo(empleadoData.legajo, empleadoData.dni)
    const empleadoPayload = {
      ...empleadoData,
      legajo: resolvedLegajo,
    }

    // Validar unicidad del legajo si se proporciona
    if (resolvedLegajo) {
      const { data: existingEmpleado, error: checkError } = await supabase
        .from('rrhh_empleados')
        .select('id')
        .eq('legajo', resolvedLegajo)
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

      // Verificar que el usuario no está ya asignado a otro empleado
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

      // Nota: La verificacion de que existe en auth.users se hace automaticamente
      // mediante el trigger sync_user_from_auth() o se puede verificar con una función RPC
      // Por ahora, asumimos que si está en la tabla usuarios y está activo, tiene cuenta de auth
    }

    // Limpiar campos de fecha vacíos (convertir "" a null/undefined)
    const cleanedData: any = {
      ...empleadoPayload,
      activo: empleadoData.activo ?? true,
    }
    
    // IMPORTANTE: Eliminar nombre y apellido - estos campos NO deben enviarse al crear
    // El nombre y apellido del empleado vienen del usuario vinculado (usuario_id)
    // Solo se usan si el empleado NO tiene usuario_id asignado
    delete cleanedData.nombre
    delete cleanedData.apellido
    
    // Validar que fecha_ingreso no está vacío (es requerido)
    if (!cleanedData.fecha_ingreso || cleanedData.fecha_ingreso === '' || cleanedData.fecha_ingreso === null) {
      return {
        success: false,
        error: 'La fecha de ingreso es requerida',
      }
    }
    
    // Convertir fecha_nacimiento vacia a undefined
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
    if (!(await getAuthenticatedAdminUserId())) {
      return {
        success: false,
        error: 'No autorizado',
      }
    }

    const supabase = createAdminClient()
    const resolvedLegajo = resolveEmpleadoLegajo(empleadoData.legajo, empleadoData.dni)
    const empleadoPayload = {
      ...empleadoData,
      legajo: resolvedLegajo,
    }

    // Validar unicidad del legajo si se proporciona
    if (resolvedLegajo) {
      const { data: existingEmpleado, error: checkError } = await supabase
        .from('rrhh_empleados')
        .select('id')
        .eq('legajo', resolvedLegajo)
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
    const cleanedData: any = { ...empleadoPayload }
    
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
    
    // Convertir fechas vacias a undefined (no se actualizan si estan vacias)
    // fecha_ingreso puede ser opcional en actualizacion, pero si viene vacio no se actualiza
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
    if (!(await getAuthenticatedAdminUserId())) {
      return {
        success: false,
        error: 'No autorizado',
      }
    }

    const supabase = createAdminClient()

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
      .order('legajo', { ascending: true, nullsFirst: false })
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

export async function crearIncidenciaLegajoAction(payload: {
  empleado_id: string
  etapa: DisciplinaEtapa
  motivo: string
  titulo: string
  descripcion?: string
  fecha_evento: string
  fecha_inicio_suspension?: string
  turno_inicio?: 'manana' | 'tarde' | 'turno_completo'
  fecha_reintegro?: string
  turno_reintegro?: 'manana' | 'tarde' | 'turno_completo'
}): Promise<ApiResponse<{ eventoId: string }>> {
  let eventoIdCreado: string | null = null

  try {
    const adminUserId = await getAuthenticatedAdminUserId()
    if (!adminUserId) {
      return {
        success: false,
        error: 'No autorizado',
      }
    }

    const etapa = payload.etapa
    const motivo = payload.motivo.trim()
    const titulo = payload.titulo.trim() || buildDisciplinaTitulo(etapa, motivo)
    const descripcion = payload.descripcion?.trim()
    const fechaEvento = new Date(payload.fecha_evento)
    const fechaInicioSuspension =
      etapa === 'suspension' ? toIsoDateOnly(payload.fecha_inicio_suspension || payload.fecha_evento) : null
    const fechaReintegro = etapa === 'suspension' ? toIsoDateOnly(payload.fecha_reintegro) : null
    const suspensionDias =
      etapa === 'suspension'
        ? resolveSuspensionDays(fechaInicioSuspension, fechaReintegro)
        : undefined

    if (!titulo) {
      return {
        success: false,
        error: 'El titulo de la incidencia es obligatorio',
      }
    }

    if (!motivo) {
      return {
        success: false,
        error: 'El motivo de la incidencia es obligatorio',
      }
    }

    if (Number.isNaN(fechaEvento.getTime())) {
      return {
        success: false,
        error: 'La fecha de la incidencia no es valida',
      }
    }

    if (etapa === 'suspension' && !fechaInicioSuspension) {
      return {
        success: false,
        error: 'Debe indicar la fecha de inicio de la suspension',
      }
    }

    if (etapa === 'suspension' && !payload.turno_inicio) {
      return {
        success: false,
        error: 'Debe indicar el turno en que inicia la suspension',
      }
    }

    if (etapa === 'suspension' && !fechaReintegro) {
      return {
        success: false,
        error: 'Debe indicar la fecha de reintegro de la suspension',
      }
    }

    if (
      etapa === 'suspension' &&
      fechaInicioSuspension &&
      fechaReintegro &&
      new Date(`${fechaReintegro}T00:00:00`).getTime() < new Date(`${fechaInicioSuspension}T00:00:00`).getTime()
    ) {
      return {
        success: false,
        error: 'La fecha de reintegro no puede ser anterior al inicio de la suspension',
      }
    }

    if (etapa === 'suspension' && (!suspensionDias || Number.isNaN(suspensionDias) || suspensionDias < 1)) {
      return {
        success: false,
        error: 'No se pudo calcular la duracion de la suspension',
      }
    }

    const supabase = createAdminClient()

    const { data: empleado, error: empleadoError } = await supabase
      .from('rrhh_empleados')
      .select(`
        id,
        legajo,
        dni,
        cuil,
        nombre,
        apellido,
        usuario:usuarios(nombre, apellido)
      `)
      .eq('id', payload.empleado_id)
      .maybeSingle()

    if (empleadoError || !empleado) {
      return {
        success: false,
        error: 'Empleado no encontrado',
      }
    }

    const usuarioEmpleado = Array.isArray(empleado.usuario) ? empleado.usuario[0] : empleado.usuario
    const empleadoNombre =
      `${usuarioEmpleado?.nombre || empleado.nombre || ''} ${usuarioEmpleado?.apellido || empleado.apellido || ''}`.trim() ||
      'Empleado sin nombre'

    const metadataBase: LegajoDisciplinaMetadata = {
      flujo: 'disciplinario',
      origen: 'manual',
      etapa,
      motivo,
      documento: {
        estado: 'pendiente_firma',
      },
      suspension:
        etapa === 'suspension'
          ? {
              dias: suspensionDias || null,
              fecha_inicio: fechaInicioSuspension,
              turno_inicio: payload.turno_inicio || 'turno_completo',
              fecha_reintegro: fechaReintegro,
              turno_reintegro: payload.turno_reintegro || null,
            }
          : undefined,
    }

    const { data, error } = await supabase
      .from('rrhh_legajo_eventos')
      .insert({
        empleado_id: payload.empleado_id,
        tipo: 'incidencia_manual',
        categoria: 'incidencias',
        titulo,
        descripcion: descripcion || null,
        metadata: metadataBase,
        created_by: adminUserId,
        fecha_evento: fechaEvento.toISOString(),
      })
      .select('id')
      .single()

    if (error || !data?.id) {
      devError('Error creando incidencia de legajo:', error)
      return {
        success: false,
        error: 'No se pudo registrar la incidencia en el legajo',
      }
    }

    eventoIdCreado = data.id

    const bucketReady = await ensureRrhhDisciplinaBucket(supabase)
    if (!bucketReady) {
      await supabase.from('rrhh_legajo_eventos').delete().eq('id', data.id)

      return {
        success: false,
        error: 'No se pudo preparar el almacenamiento del documento disciplinario',
      }
    }

    const documento = await generarDocumentoIncidenciaDisciplinaria({
      eventoId: data.id,
      empleado: {
        id: empleado.id,
        legajo: empleado.legajo,
        dni: empleado.dni,
        cuil: empleado.cuil,
        nombreCompleto: empleadoNombre,
      },
      fechaEventoIso: fechaEvento.toISOString(),
      etapa,
      motivo,
      descripcion,
      suspensionDias,
      fechaInicioSuspension,
      turnoInicio: payload.turno_inicio,
      fechaReintegro,
      turnoReintegro: payload.turno_reintegro,
    })

    const metadataActualizada: LegajoDisciplinaMetadata = {
      ...metadataBase,
      documento: {
        bucket: documento.bucket,
        path: documento.path,
        estado: 'pendiente_firma',
        generado_at: new Date().toISOString(),
      },
    }

    const { error: updateError } = await supabase
      .from('rrhh_legajo_eventos')
      .update({
        metadata: metadataActualizada,
      })
      .eq('id', data.id)

    if (updateError) {
      devError('Error actualizando documento de incidencia de legajo:', updateError)
      await supabase.from('rrhh_legajo_eventos').delete().eq('id', data.id)

      return {
        success: false,
        error: 'No se pudo guardar el documento de la medida disciplinaria',
      }
    }

    revalidatePath(`/rrhh/empleados/${payload.empleado_id}`)
    revalidatePath('/rrhh/empleados')
    revalidatePath(`/rrhh/empleados/${payload.empleado_id}/incidencias/${data.id}/documento`)

    if (etapa === 'suspension' && fechaInicioSuspension) {
      const periodos = buildMonthRange(fechaInicioSuspension, fechaReintegro || fechaInicioSuspension)
      await recalcularLiquidacionesEmpleadoPorPeriodos(supabase, {
        empleadoId: payload.empleado_id,
        actorId: adminUserId,
        periodos,
      })
    }

    return {
      success: true,
      data: { eventoId: data.id },
      message: 'Medida disciplinaria registrada en el legajo con su documento',
    }
  } catch (error) {
    devError('Error en crearIncidenciaLegajoAction:', error)

    if (eventoIdCreado) {
      try {
        const supabase = createAdminClient()
        await supabase.from('rrhh_legajo_eventos').delete().eq('id', eventoIdCreado)
      } catch (cleanupError) {
        devError('Error limpiando incidencia disciplinaria incompleta:', cleanupError)
      }
    }

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

export async function obtenerProductosActivosParaAdelantosAction(): Promise<ApiResponse<Array<{
  id: string
  nombre: string
  codigo: string | null
  precio_venta: number | null
}>>> {
  try {
    const adminUserId = await getAuthenticatedAdminUserId()
    if (!adminUserId) {
      return {
        success: false,
        error: 'No autorizado',
      }
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('productos')
      .select('id, nombre, codigo, precio_venta')
      .eq('activo', true)
      .order('nombre')

    if (error) {
      devError('Error al obtener productos activos para adelantos:', error)
      return {
        success: false,
        error: 'Error al obtener productos: ' + error.message,
      }
    }

    return {
      success: true,
      data: (data || []) as Array<{
        id: string
        nombre: string
        codigo: string | null
        precio_venta: number | null
      }>,
    }
  } catch (error) {
    devError('Error en obtenerProductosActivosParaAdelantosAction:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function crearAdelantoAction(
  adelantoData: {
    empleado_id: string
    tipo: 'dinero' | 'producto'
    monto?: number
    producto_id?: string
    cantidad?: number
    precio_unitario?: number
    cantidad_cuotas?: number
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

    const cantidadCuotas = Math.max(1, Math.min(24, Math.trunc(Number(adelantoData.cantidad_cuotas || 1)) || 1))
    const { cantidad_cuotas: _cantidadCuotasIgnorada, ...adelantoPayload } = adelantoData
    const observacionesLimpias = (adelantoData.observaciones || '').trim()
    const observacionesConCuotas = cantidadCuotas > 1
      ? [observacionesLimpias, `Cuotas solicitadas: ${cantidadCuotas}`].filter(Boolean).join(' | ')
      : observacionesLimpias

    const { data, error } = await adminSupabase
      .from('rrhh_adelantos')
      .insert({
        ...adelantoPayload,
        observaciones: observacionesConCuotas || null,
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

    await registrarEventoLegajo(adminSupabase, {
      empleadoId: adelantoData.empleado_id,
      tipo: 'adelanto_solicitado',
      categoria: 'adelantos',
      titulo: 'Solicitud de adelanto',
      descripcion:
        adelantoData.tipo === 'dinero'
          ? `Adelanto en dinero solicitado por ${Number(adelantoData.monto || 0).toLocaleString('es-AR')}`
          : `Adelanto en producto solicitado (${Number(adelantoData.cantidad || 0)} unidad/es)`,
      metadata: {
        adelanto_id: data.id,
        tipo: adelantoData.tipo,
        monto: adelantoData.monto || null,
        producto_id: adelantoData.producto_id || null,
        cantidad: adelantoData.cantidad || null,
        precio_unitario: adelantoData.precio_unitario || null,
        cantidad_cuotas_solicitadas: cantidadCuotas,
      },
      createdBy: user.id,
    })

    revalidatePath('/rrhh/adelantos')
    revalidatePath(`/rrhh/empleados/${adelantoData.empleado_id}`)

    return {
      success: true,
      data: { adelantoId: data.id },
      message:
        cantidadCuotas > 1
          ? `Adelanto creado exitosamente, pendiente de aprobación (${cantidadCuotas} cuotas solicitadas).`
          : 'Adelanto creado exitosamente, pendiente de aprobación',
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
  aprobadoPor: string,
  cantidadCuotas = 1,
): Promise<ApiResponse<void>> {
  try {
    const supabase = createAdminClient()
    const cuotasNormalizadas = Math.max(1, Math.min(24, Math.trunc(Number(cantidadCuotas)) || 1))

    const { data: adelantoSnapshot } = await supabase
      .from('rrhh_adelantos')
      .select('id, empleado_id, tipo, monto, cantidad, precio_unitario, observaciones')
      .eq('id', adelantoId)
      .maybeSingle()

    const { data, error } = await supabase.rpc('fn_rrhh_aprobar_adelanto_atomico', {
      p_adelanto_id: adelantoId,
      p_aprobado_por: aprobadoPor,
      p_cantidad_cuotas: cuotasNormalizadas,
      p_fecha_inicio: null,
      p_recalcular: true,
    })

    const resultRow = Array.isArray(data) ? data[0] : data

    if (error || !resultRow?.adelanto_id) {
      devError('Error al aprobar adelanto:', error)
      return {
        success: false,
        error: 'Error al aprobar adelanto: ' + (error?.message || 'No se pudo mapear el adelanto en planes/cuotas'),
      }
    }

    if (adelantoSnapshot?.empleado_id) {
      await registrarEventoLegajo(supabase, {
        empleadoId: adelantoSnapshot.empleado_id,
        tipo: 'adelanto_aprobado',
        categoria: 'adelantos',
        titulo: 'Adelanto aprobado',
        descripcion:
          adelantoSnapshot.tipo === 'dinero'
            ? `Adelanto en dinero aprobado por ${Number(adelantoSnapshot.monto || 0).toLocaleString('es-AR')}`
            : 'Adelanto en producto aprobado',
        metadata: {
          adelanto_id: adelantoId,
          plan_id: resultRow.plan_id || null,
          cantidad_cuotas: cuotasNormalizadas,
          liquidacion_recalculada_id: resultRow.liquidacion_recalculada_id || null,
        },
        createdBy: aprobadoPor,
      })
    }

    revalidatePath('/rrhh/adelantos')
    if (adelantoSnapshot?.empleado_id) {
      revalidatePath(`/rrhh/empleados/${adelantoSnapshot.empleado_id}`)
    }
    revalidatePath('/rrhh/liquidaciones')
    if (resultRow.liquidacion_recalculada_id) {
      revalidatePath(`/rrhh/liquidaciones/${resultRow.liquidacion_recalculada_id}`)
    }

    return {
      success: true,
      message:
        cuotasNormalizadas > 1
          ? `Adelanto aprobado exitosamente en ${cuotasNormalizadas} cuotas.`
          : 'Adelanto aprobado exitosamente',
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
    const { data: snapshot } = await supabase
      .from('rrhh_adelantos')
      .select('id, empleado_id, tipo, monto, cantidad, precio_unitario')
      .eq('id', adelantoId)
      .maybeSingle()

    const { data, error } = await supabase
      .from('rrhh_adelantos')
      .delete()
      .eq('aprobado', false)
      .is('plan_id', null)
      .eq('id', adelantoId)
      .select('id')
      .maybeSingle()

    if (error) {
      devError('Error al rechazar adelanto:', error)
      return {
        success: false,
        error: 'Error al rechazar adelanto: ' + error.message,
      }
    }
    if (!data?.id) {
      return {
        success: false,
        error: 'Solo se pueden rechazar adelantos pendientes y aun no mapeados en liquidaciones',
      }
    }

    if (snapshot?.empleado_id) {
      await registrarEventoLegajo(supabase, {
        empleadoId: snapshot.empleado_id,
        tipo: 'adelanto_rechazado',
        categoria: 'adelantos',
        titulo: 'Adelanto rechazado',
        descripcion:
          snapshot.tipo === 'dinero'
            ? `Se rechazó un adelanto en dinero de ${Number(snapshot.monto || 0).toLocaleString('es-AR')}`
            : 'Se rechazó un adelanto en producto',
        metadata: {
          adelanto_id: adelantoId,
          tipo: snapshot.tipo,
          monto: snapshot.monto || null,
          cantidad: snapshot.cantidad || null,
          precio_unitario: snapshot.precio_unitario || null,
        },
      })
    }

    revalidatePath('/rrhh/adelantos')
    if (snapshot?.empleado_id) {
      revalidatePath(`/rrhh/empleados/${snapshot.empleado_id}`)
    }

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
  horas_extra_aprobadas?: boolean
  origen?: 'auto_hik' | 'auto_asistencia' | 'auto_licencia_descanso' | 'auto_suspension' | 'manual'
  observaciones?: string
}

const RRHH_LIQUIDACION_AUTO_ORIGINS = new Set([
  'auto_hik',
  'auto_asistencia',
  'auto_licencia_descanso',
  'auto_suspension',
])

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
  dias_base_lun_sab: number
  activo?: boolean
}

function getDaysInMonth(periodoMes: number, periodoAnio: number): number {
  return new Date(periodoAnio, periodoMes, 0).getDate()
}

function toIsoDateOnly(value?: string | null): string | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

function resolveSuspensionDays(
  fechaInicio?: string | null,
  fechaReintegro?: string | null,
): number | undefined {
  if (fechaInicio && fechaReintegro) {
    const inicio = new Date(`${fechaInicio}T00:00:00`)
    const reintegro = new Date(`${fechaReintegro}T00:00:00`)

    if (!Number.isNaN(inicio.getTime()) && !Number.isNaN(reintegro.getTime())) {
      const diff = Math.round((reintegro.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24))
      return Math.max(diff, 1)
    }
  }

  return undefined
}

function buildMonthRange(fromIso?: string | null, toIso?: string | null): Array<{ mes: number; anio: number }> {
  const fromDate = fromIso ? new Date(fromIso) : null
  const toDate = toIso ? new Date(toIso) : null
  if (!fromDate || !toDate || Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return []
  }

  const start = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), 1))
  const end = new Date(Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), 1))
  const result: Array<{ mes: number; anio: number }> = []

  for (const cursor = new Date(start); cursor <= end; cursor.setUTCMonth(cursor.getUTCMonth() + 1)) {
    result.push({
      mes: cursor.getUTCMonth() + 1,
      anio: cursor.getUTCFullYear(),
    })
  }

  return result
}

function normalizeText(value?: string | null): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function normalizePuestoCode(value?: string | null): string {
  return normalizeText(value)
    .replace(/\bsucursales?\b/g, 'suc')
    .replace(/\basistente\b/g, 'asist')
    .replace(/\badministracion\b/g, 'admin')
    .replace(/[^a-z0-9]+/g, '')
}

function puestoMatchesCategoria(puestoCodigo?: string | null, categoriaNombre?: string | null): boolean {
  const puestoNorm = normalizePuestoCode(puestoCodigo)
  const categoriaNorm = normalizePuestoCode(categoriaNombre)

  if (!puestoNorm || !categoriaNorm) {
    return false
  }

  return (
    puestoNorm === categoriaNorm ||
    puestoNorm.startsWith(categoriaNorm) ||
    categoriaNorm.startsWith(puestoNorm)
  )
}

function priorizarSucursalesHorqueta<T extends { nombre?: string }>(sucursales: T[]): T[] {
  const list = Array.isArray(sucursales) ? [...sucursales] : []
  const hasHorqueta = list.some((s) => normalizeText(s.nombre).includes('horqueta'))
  const withoutColon = hasHorqueta
    ? list.filter((s) => !normalizeText(s.nombre).includes('colon'))
    : list

  return withoutColon.sort((a, b) => {
    const aNorm = normalizeText(a.nombre)
    const bNorm = normalizeText(b.nombre)
    const aHorqueta = aNorm.includes('horqueta')
    const bHorqueta = bNorm.includes('horqueta')
    if (aHorqueta && !bHorqueta) return -1
    if (!aHorqueta && bHorqueta) return 1
    return aNorm.localeCompare(bNorm, 'es')
  })
}

type DescansosMensualesSyncResult = {
  generados: number
  sincronizados: number
  soportado: boolean
}

async function sincronizarDescansosMensualesSucursal(
  db: any,
  input: {
    anio: number
    mes: number
    empleadoId?: string
    seed?: string
  }
): Promise<DescansosMensualesSyncResult> {
  try {
    let generados = 0
    let sincronizados = 0

    const { data: generadosData, error: generadosError } = await db.rpc('fn_rrhh_generar_descansos_mensuales', {
      p_anio: input.anio,
      p_mes: input.mes,
      p_empleado_id: input.empleadoId || null,
      p_seed: input.seed || null,
    })

    if (generadosError) {
      const message = String(generadosError.message || '').toLowerCase()
      if (message.includes('fn_rrhh_generar_descansos_mensuales')) {
        return { generados: 0, sincronizados: 0, soportado: false }
      }
      throw generadosError
    }

    if (Array.isArray(generadosData)) {
      generados = generadosData.reduce(
        (acc: number, row: any) => acc + Number(row?.generados || 0),
        0
      )
    }

    const { data: sincronizadosData, error: syncError } = await db.rpc('fn_rrhh_sync_descansos_mensuales_asistencia', {
      p_anio: input.anio,
      p_mes: input.mes,
      p_empleado_id: input.empleadoId || null,
    })

    if (syncError) {
      const message = String(syncError.message || '').toLowerCase()
      if (message.includes('fn_rrhh_sync_descansos_mensuales_asistencia')) {
        return { generados, sincronizados: 0, soportado: false }
      }
      throw syncError
    }

    sincronizados = Number(sincronizadosData || 0)
    return { generados, sincronizados, soportado: true }
  } catch (error) {
    devError('Error sincronizando descansos mensuales de RRHH:', error)
    return { generados: 0, sincronizados: 0, soportado: false }
  }
}

type GuardarReglaPuestoInput = {
  id?: string
  puesto_codigo: string
  categoria_id?: string | null
  periodo_mes?: number
  periodo_anio?: number
  grupo_base_dias: 'galpon' | 'sucursales' | 'rrhh' | 'lun_sab'
  horas_jornada: number
  valor_hora_override?: number | null
  tarifa_turno_trabajado: number
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
    const adminUserId = await getAuthenticatedAdminUserId()
    if (!adminUserId) {
      return {
        success: false,
        error: 'No autorizado',
      }
    }

    const supabase = createAdminClient()
    await sincronizarDescansosMensualesSucursal(supabase, {
      anio,
      mes,
      empleadoId,
      seed: `${empleadoId}-${anio}-${mes}`,
    })

    const { data, error } = await prepararLiquidacionMensualConDomingoSucursal(supabase, {
      empleadoId,
      mes,
      anio,
      createdBy: adminUserId,
    })

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

async function recalcularLiquidacionesEmpleadoPorPeriodos(
  db: any,
  input: {
    empleadoId: string
    actorId: string
    periodos: Array<{ mes: number; anio: number }>
  }
) {
  for (const periodo of input.periodos) {
    const { error } = await prepararLiquidacionMensualConDomingoSucursal(db, {
      empleadoId: input.empleadoId,
      mes: periodo.mes,
      anio: periodo.anio,
      createdBy: input.actorId,
    })

    if (error) {
      devError(
        `Error recalculando liquidacion de ${input.empleadoId} para ${periodo.mes}/${periodo.anio}:`,
        error,
      )
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
    const adminUserId = await getAuthenticatedAdminUserId()
    if (!adminUserId) {
      return {
        success: false,
        error: 'No autorizado',
      }
    }

    const supabase = createAdminClient()
    const { data, error } = await recalcularLiquidacionConDomingoSucursal(supabase, {
      liquidacionId,
      actorId: adminUserId,
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

export async function recalcularLiquidacionesPeriodoAction(input: {
  mes: number
  anio: number
  alcance: 'todos' | 'empleado'
  empleadoId?: string
}): Promise<
  ApiResponse<{
    procesados: number
    actualizados: number
    omitidos_sin_horas: number
    errores: number
  }>
> {
  try {
    const adminUserId = await getAuthenticatedAdminUserId()
    if (!adminUserId) {
      return {
        success: false,
        error: 'No autorizado',
      }
    }

    const mes = Number(input.mes)
    const anio = Number(input.anio)
    if (!Number.isInteger(mes) || mes < 1 || mes > 12 || !Number.isInteger(anio) || anio < 2000) {
      return {
        success: false,
        error: 'Periodo invalido',
      }
    }

    if (input.alcance === 'empleado' && !input.empleadoId) {
      return {
        success: false,
        error: 'Debe seleccionar un empleado',
      }
    }

    const supabase = createAdminClient()

    let targetIds: string[] = []
    if (input.alcance === 'empleado' && input.empleadoId) {
      targetIds = [input.empleadoId]
    } else {
      const { data: activos, error: activosError } = await supabase
        .from('rrhh_empleados')
        .select('id')
        .eq('activo', true)

      if (activosError) {
        devError('Error obteniendo empleados activos para recalculo:', activosError)
        return {
          success: false,
          error: 'No se pudo obtener la lista de empleados activos',
        }
      }

      targetIds = (activos || []).map((row) => String(row.id)).filter(Boolean)
    }

    if (targetIds.length === 0) {
      return {
        success: true,
        data: {
          procesados: 0,
          actualizados: 0,
          omitidos_sin_horas: 0,
          errores: 0,
        },
        message: 'No hay empleados para recalcular',
      }
    }

    const fromDate = `${anio}-${String(mes).padStart(2, '0')}-01`
    const toDate = `${anio}-${String(mes).padStart(2, '0')}-${String(getDaysInMonth(mes, anio)).padStart(2, '0')}`

    const { data: asistenciaConHoras, error: asistenciaError } = await supabase
      .from('rrhh_asistencia')
      .select('empleado_id')
      .in('empleado_id', targetIds)
      .gte('fecha', fromDate)
      .lte('fecha', toDate)
      .in('estado', ['presente', 'tarde'])
      .gt('horas_trabajadas', 0)

    if (asistenciaError) {
      devError('Error obteniendo asistencia para recalculo:', asistenciaError)
      return {
        success: false,
        error: 'No se pudo verificar la asistencia del periodo',
      }
    }

    const idsConHoras = new Set(
      (asistenciaConHoras || []).map((row) => String(row.empleado_id || '')).filter(Boolean),
    )

    let actualizados = 0
    let omitidosSinHoras = 0
    let errores = 0

    for (const empleadoId of targetIds) {
      if (!idsConHoras.has(empleadoId)) {
        omitidosSinHoras++
        continue
      }

      const { error } = await prepararLiquidacionMensualConDomingoSucursal(supabase, {
        empleadoId,
        mes,
        anio,
        createdBy: adminUserId,
      })

      if (error) {
        errores++
        devError(`Error recalculando liquidacion para empleado ${empleadoId}:`, error)
      } else {
        actualizados++
      }
    }

    revalidatePath('/rrhh/liquidaciones')

    return {
      success: true,
      data: {
        procesados: targetIds.length,
        actualizados,
        omitidos_sin_horas: omitidosSinHoras,
        errores,
      },
      message: 'Recalculo ejecutado',
    }
  } catch (error) {
    devError('Error en recalcularLiquidacionesPeriodoAction:', error)
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
      .select('id, empleado_id, periodo_mes, periodo_anio, grupo_base_snapshot')
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
      horas_extra_aprobadas: true,
      origen: jornadaData.origen || 'manual',
      observaciones: jornadaData.observaciones || null,
    }

    let jornadaId = jornadaData.id
    let jornadaOriginal: {
      fecha?: string | null
      origen?: string | null
      empleado_id?: string | null
      horas_extra_aprobadas?: boolean | null
    } | null = null

    if (jornadaData.id) {
      const { data: currentRow } = await supabase
        .from('rrhh_liquidacion_jornadas')
        .select('fecha, origen, empleado_id, horas_extra_aprobadas')
        .eq('id', jornadaData.id)
        .eq('liquidacion_id', liquidacionId)
        .maybeSingle()

      jornadaOriginal = (currentRow as any) || null
    }

    const horasAdicionales = Number(jornadaData.horas_adicionales ?? 0)
    const esSucursal =
      liquidacion.grupo_base_snapshot === 'sucursales' || liquidacion.grupo_base_snapshot === 'lun_sab'
    payload.horas_extra_aprobadas =
      horasAdicionales <= 0
        ? true
        : typeof jornadaData.horas_extra_aprobadas === 'boolean'
          ? jornadaData.horas_extra_aprobadas
          : esSucursal
            ? true
            : Boolean(jornadaOriginal?.horas_extra_aprobadas ?? false)

    if (jornadaData.id && jornadaOriginal?.origen && RRHH_LIQUIDACION_AUTO_ORIGINS.has(jornadaOriginal.origen)) {
      payload.origen = 'manual'
    }

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

    const fechaAnterior = jornadaOriginal?.fecha?.slice(0, 10)
    const fechaNueva = payload.fecha?.slice(0, 10)
    const esDescansoAutoOriginal = jornadaOriginal?.origen === 'auto_licencia_descanso'
    if (esDescansoAutoOriginal && fechaAnterior && fechaNueva && fechaAnterior !== fechaNueva) {
      const { error: descansoError } = await supabase
        .from('rrhh_descansos_mensuales')
        .update({
          fecha: fechaNueva,
          estado: 'editado',
          origen: 'manual',
          observaciones: `Descanso movido manualmente de ${fechaAnterior} a ${fechaNueva}`,
          updated_at: new Date().toISOString(),
        })
        .eq('empleado_id', liquidacion.empleado_id)
        .eq('periodo_mes', Number(liquidacion.periodo_mes))
        .eq('periodo_anio', Number(liquidacion.periodo_anio))
        .eq('fecha', fechaAnterior)
        .neq('estado', 'cancelado')

      if (descansoError && descansoError.code !== '42P01') {
        devError('No se pudo actualizar rrhh_descansos_mensuales al mover descanso:', descansoError)
      }
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

export async function actualizarAprobacionHorasExtraJornadaAction(
  liquidacionId: string,
  jornadaId: string,
  aprobadas: boolean,
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

    const { data: liquidacion } = await supabase
      .from('rrhh_liquidaciones')
      .select('id, grupo_base_snapshot')
      .eq('id', liquidacionId)
      .maybeSingle()

    if (!liquidacion?.id) {
      return {
        success: false,
        error: 'Liquidacion no encontrada',
      }
    }

    if (liquidacion.grupo_base_snapshot === 'sucursales' || liquidacion.grupo_base_snapshot === 'lun_sab') {
      return {
        success: false,
        error: 'Este ambito no requiere aprobacion de horas extra',
      }
    }

    const { error } = await supabase
      .from('rrhh_liquidacion_jornadas')
      .update({
        horas_extra_aprobadas: aprobadas,
        horas_extra_aprobadas_por: aprobadas ? adminUserId : null,
        horas_extra_aprobadas_at: aprobadas ? new Date().toISOString() : null,
      })
      .eq('id', jornadaId)
      .eq('liquidacion_id', liquidacionId)

    if (error) {
      devError('Error actualizando aprobacion de horas extra:', error)
      return {
        success: false,
        error: 'No se pudo actualizar la aprobacion de horas extra',
      }
    }

    const recalcResult = await recalcularLiquidacionAction(liquidacionId)
    if (!recalcResult.success) {
      return {
        success: false,
        error: recalcResult.error || 'No se pudo recalcular la liquidacion luego de aprobar las horas extra',
      }
    }

    revalidatePath(`/rrhh/liquidaciones/${liquidacionId}`)

    return {
      success: true,
      data: { jornadaId, liquidacionId },
      message: aprobadas ? 'Horas extra aprobadas' : 'Aprobacion de horas extra revocada',
    }
  } catch (error) {
    devError('Error en actualizarAprobacionHorasExtraJornadaAction:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function guardarLiquidacionTramosPuestoAction(
  liquidacionId: string,
  tramos: Array<{
    id?: string
    fecha_desde: string
    fecha_hasta: string
    puesto_codigo: string
    orden: number
  }>,
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
    const { data: liquidacion } = await supabase
      .from('rrhh_liquidaciones')
      .select('id, periodo_mes, periodo_anio')
      .eq('id', liquidacionId)
      .maybeSingle()

    if (!liquidacion?.id) {
      return {
        success: false,
        error: 'Liquidacion no encontrada',
      }
    }

    const desdePeriodo = `${liquidacion.periodo_anio}-${String(liquidacion.periodo_mes).padStart(2, '0')}-01`
    const hastaPeriodo = `${liquidacion.periodo_anio}-${String(liquidacion.periodo_mes).padStart(2, '0')}-${String(getDaysInMonth(liquidacion.periodo_mes, liquidacion.periodo_anio)).padStart(2, '0')}`

    const normalizados = tramos
      .map((tramo, index) => ({
        id: tramo.id,
        fecha_desde: tramo.fecha_desde,
        fecha_hasta: tramo.fecha_hasta,
        puesto_codigo: tramo.puesto_codigo.trim(),
        orden: Number.isFinite(Number(tramo.orden)) ? Number(tramo.orden) : index + 1,
      }))
      .filter((tramo) => tramo.fecha_desde && tramo.fecha_hasta && tramo.puesto_codigo)
      .sort((a, b) => a.fecha_desde.localeCompare(b.fecha_desde, 'es'))

    for (let index = 0; index < normalizados.length; index++) {
      const actual = normalizados[index]
      if (actual.fecha_desde < desdePeriodo || actual.fecha_hasta > hastaPeriodo) {
        return {
          success: false,
          error: 'Los tramos deben quedar dentro del periodo de la liquidacion',
        }
      }
      if (actual.fecha_hasta < actual.fecha_desde) {
        return {
          success: false,
          error: 'Cada tramo debe tener una fecha hasta posterior o igual a la fecha desde',
        }
      }

      const siguiente = normalizados[index + 1]
      if (siguiente && actual.fecha_hasta >= siguiente.fecha_desde) {
        return {
          success: false,
          error: 'Los tramos no pueden superponerse',
        }
      }

      if (siguiente) {
        const siguienteEsperado = new Date(new Date(`${actual.fecha_hasta}T12:00:00`).getTime() + 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10)
        if (siguiente.fecha_desde !== siguienteEsperado) {
          return {
            success: false,
            error: 'Los tramos deben cubrir todo el periodo sin huecos entre fechas',
          }
        }
      }
    }

    if (normalizados.length > 0) {
      if (normalizados[0].fecha_desde !== desdePeriodo || normalizados[normalizados.length - 1].fecha_hasta !== hastaPeriodo) {
        return {
          success: false,
          error: 'Los tramos deben cubrir el periodo completo de la liquidacion',
        }
      }
    }

    const { error: replaceError } = await supabase.rpc('fn_rrhh_reemplazar_tramos_puesto', {
      p_liquidacion_id: liquidacionId,
      p_actor: adminUserId,
      p_tramos: normalizados.map((tramo, index) => ({
        fecha_desde: tramo.fecha_desde,
        fecha_hasta: tramo.fecha_hasta,
        puesto_codigo: tramo.puesto_codigo,
        orden: index + 1,
      })),
    })
    if (replaceError) {
      devError('Error reemplazando tramos de liquidacion:', replaceError)
      return {
        success: false,
        error: 'No se pudieron actualizar los tramos de puesto',
      }
    }

    const recalcResult = await recalcularLiquidacionAction(liquidacionId)
    if (!recalcResult.success) {
      return {
        success: false,
        error: recalcResult.error || 'No se pudo recalcular la liquidacion luego de guardar los tramos',
      }
    }

    revalidatePath(`/rrhh/liquidaciones/${liquidacionId}`)

    return {
      success: true,
      data: { liquidacionId },
      message: 'Tramos de puesto actualizados',
    }
  } catch (error) {
    devError('Error en guardarLiquidacionTramosPuestoAction:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function eliminarLiquidacionJornadaAction(
  liquidacionId: string,
  jornadaId: string,
): Promise<
  ApiResponse<{
    liquidacionId: string
    jornadaId: string
    descansoCancelado: boolean
    asistenciaEliminada: boolean
  }>
> {
  try {
    const adminUserId = await getAuthenticatedAdminUserId()
    if (!adminUserId) {
      return {
        success: false,
        error: 'No autorizado',
      }
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase.rpc('fn_rrhh_eliminar_liquidacion_jornada', {
      p_liquidacion_id: liquidacionId,
      p_jornada_id: jornadaId,
      p_actor: adminUserId,
    })

    if (error) {
      devError('Error eliminando jornada de liquidacion:', error)
      return {
        success: false,
        error: error.message || 'No se pudo eliminar la jornada',
      }
    }

    const resultRow = Array.isArray(data) ? data[0] : data
    if (!resultRow?.jornada_id) {
      return {
        success: false,
        error: 'No se pudo eliminar la jornada',
      }
    }

    revalidatePath('/rrhh/liquidaciones')
    revalidatePath(`/rrhh/liquidaciones/${liquidacionId}`)

    return {
      success: true,
      data: {
        liquidacionId,
        jornadaId,
        descansoCancelado: Boolean(resultRow.descanso_cancelado),
        asistenciaEliminada: Boolean(resultRow.asistencia_eliminada),
      },
      message: resultRow.descanso_cancelado
        ? 'Descanso eliminado completamente y liquidacion recalculada'
        : 'Jornada eliminada y liquidacion recalculada',
    }
  } catch (error) {
    devError('Error en eliminarLiquidacionJornadaAction:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function obtenerConfiguracionLiquidacionAction(
  periodoMes: number,
  periodoAnio: number
): Promise<ApiResponse<{ reglaPeriodo: LiquidacionReglaPeriodo | null; reglasPuesto: LiquidacionReglaPuesto[]; categorias: { id: string; nombre: string; sueldo_basico: number }[] }>> {
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
      .select('id, nombre, sueldo_basico')
      .eq('activo', true)
      .order('nombre')

    return {
      success: true,
      data: {
        reglaPeriodo: (reglaPeriodo || null) as LiquidacionReglaPeriodo | null,
        reglasPuesto: (reglasPuesto || []) as LiquidacionReglaPuesto[],
        categorias: (categorias ?? []) as { id: string; nombre: string; sueldo_basico: number }[],
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
        error: 'Periodo invalido',
      }
    }

    if (payload.dias_base_galpon <= 0 || payload.dias_base_rrhh <= 0 || payload.dias_base_lun_sab <= 0) {
      return {
        success: false,
        error: 'Los dias base deben ser mayores a cero',
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
          dias_base_lun_sab: payload.dias_base_lun_sab,
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
        error: 'El codigo de puesto es obligatorio',
      }
    }

    if (payload.horas_jornada <= 0) {
      return {
        success: false,
        error: 'Las horas de jornada deben ser mayores a cero',
      }
    }

    if (
      (payload.valor_hora_override != null && payload.valor_hora_override < 0) ||
      payload.tarifa_turno_trabajado < 0 ||
      payload.tarifa_turno_especial < 0 ||
      payload.tarifa_diferencia_cajero < 0
    ) {
      return {
        success: false,
        error: 'Las tarifas no pueden ser negativas',
      }
    }

    if ((payload.tipo_calculo ?? 'hora') === 'turno' && payload.tarifa_turno_trabajado <= 0) {
      return {
        success: false,
        error: 'Para calculo por turno, la tarifa de turno trabajado debe ser mayor a cero',
      }
    }

    if (
      (payload.tipo_calculo ?? 'hora') === 'hora' &&
      payload.valor_hora_override != null &&
      payload.valor_hora_override <= 0
    ) {
      return {
        success: false,
        error: 'El valor hora editable debe ser mayor a cero o quedar vacio para usar el automatico',
      }
    }

    const supabase = createAdminClient()
    let categoriaId = payload.categoria_id || null

    if (!categoriaId) {
      const { data: categorias, error: categoriasError } = await supabase
        .from('rrhh_categorias')
        .select('id, nombre')
        .eq('activo', true)
        .order('nombre')

      if (categoriasError) {
        devError('Error buscando categoria para regla de puesto:', categoriasError)
      } else {
        const matches = (categorias || []).filter((categoria) =>
          puestoMatchesCategoria(puestoCodigo, categoria.nombre),
        )

        if (matches.length === 1) {
          categoriaId = matches[0].id
        }
      }
    }

    const insertPayload = {
      puesto_codigo: puestoCodigo,
      categoria_id: categoriaId,
      grupo_base_dias: payload.grupo_base_dias,
      horas_jornada: payload.horas_jornada,
      valor_hora_override: (payload.tipo_calculo ?? 'hora') === 'hora' ? payload.valor_hora_override ?? null : null,
      tarifa_turno_trabajado: payload.tarifa_turno_trabajado,
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

    if (
      Number.isInteger(payload.periodo_mes) &&
      Number.isInteger(payload.periodo_anio) &&
      (payload.periodo_mes as number) >= 1 &&
      (payload.periodo_mes as number) <= 12 &&
      (payload.periodo_anio as number) >= 2000
    ) {
      const periodoMes = Number(payload.periodo_mes)
      const periodoAnio = Number(payload.periodo_anio)
      const fromDate = `${periodoAnio}-${String(periodoMes).padStart(2, '0')}-01`
      const toDate = `${periodoAnio}-${String(periodoMes).padStart(2, '0')}-${String(getDaysInMonth(periodoMes, periodoAnio)).padStart(2, '0')}`

      const { data: empleadosActivos, error: empleadosError } = await supabase
        .from('rrhh_empleados')
        .select('id, categoria_id, rrhh_categorias(nombre)')
        .eq('activo', true)

      if (empleadosError) {
        devError('Error obteniendo empleados para recalcular regla de puesto:', empleadosError)
      } else {
        const empleadosImpactados = (empleadosActivos || [])
          .filter((empleado) => {
            if (categoriaId && empleado.categoria_id === categoriaId) {
              return true
            }

            const categoriaNombre =
              empleado.rrhh_categorias && typeof empleado.rrhh_categorias === 'object' && 'nombre' in empleado.rrhh_categorias
                ? String(empleado.rrhh_categorias.nombre || '')
                : ''

            return puestoMatchesCategoria(puestoCodigo, categoriaNombre)
          })
          .map((empleado) => String(empleado.id))
          .filter(Boolean)

        if (empleadosImpactados.length > 0) {
          const [liqRows, asistenciaRows] = await Promise.all([
            supabase
              .from('rrhh_liquidaciones')
              .select('empleado_id')
              .in('empleado_id', empleadosImpactados)
              .eq('periodo_mes', periodoMes)
              .eq('periodo_anio', periodoAnio),
            supabase
              .from('rrhh_asistencia')
              .select('empleado_id')
              .in('empleado_id', empleadosImpactados)
              .gte('fecha', fromDate)
              .lte('fecha', toDate)
              .gt('horas_trabajadas', 0),
          ])

          const empleadosParaRecalculo = new Set<string>()
          for (const row of liqRows.data || []) {
            if (row.empleado_id) empleadosParaRecalculo.add(String(row.empleado_id))
          }
          for (const row of asistenciaRows.data || []) {
            if (row.empleado_id) empleadosParaRecalculo.add(String(row.empleado_id))
          }

          for (const empleadoId of empleadosParaRecalculo) {
            const { error: recalcError } = await prepararLiquidacionMensualConDomingoSucursal(supabase, {
              empleadoId,
              mes: periodoMes,
              anio: periodoAnio,
              createdBy: adminUserId,
            })

            if (recalcError) {
              devError(`Error recalculando liquidacion de ${empleadoId} tras guardar regla de puesto:`, recalcError)
            }
          }
        }
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
      motivo_no_autorizado: autorizado ? null : (motivo?.trim() || 'No autorizado por Administrador'),
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
      devError('Error al aprobar liquidacion:', error)
      return {
        success: false,
        error: 'Error al aprobar liquidacion: ' + (error?.message || 'Liquidacion no encontrada'),
      }
    }

    revalidatePath('/rrhh/liquidaciones')

    return {
      success: true,
      message: 'Liquidacion aprobada exitosamente',
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
      devError('Error al marcar liquidacion como pagada:', error)
      return {
        success: false,
        error: 'Error al marcar liquidacion como pagada: ' + (error?.message || 'Liquidacion no encontrada'),
      }
    }

    revalidatePath('/rrhh/liquidaciones')
    revalidatePath(`/rrhh/liquidaciones/${liquidacionId}`)

    return {
      success: true,
      message: 'Liquidacion marcada como pagada exitosamente',
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

export async function crearLicenciaAction(formData: FormData): Promise<ApiResponse<{ licenciaId: string }>> {
  try {
    const { db, user, isAdmin } = await getDbForCurrentUser()
    const actorId = user?.id || null

    const empleado_id = String(formData.get('empleado_id') || '')
    const tipo = String(formData.get('tipo') || '') as
      | 'vacaciones'
      | 'enfermedad'
      | 'maternidad'
      | 'estudio'
      | 'otro'
      | 'descanso_programado'
    const fecha_inicio = String(formData.get('fecha_inicio') || '')
    const fecha_fin = String(formData.get('fecha_fin') || '')
    const fecha_presentacion_raw = String(
      formData.get('fecha_presentacion') || formData.get('fecha_sintomas') || ''
    )
    const diagnostico_reportado = String(formData.get('diagnostico_reportado') || '').trim() || undefined
    const excepcion_plazo = String(formData.get('excepcion_plazo') || 'false') === 'true'
    const motivo_excepcion = String(formData.get('motivo_excepcion') || '').trim() || undefined
    const observaciones = String(formData.get('observaciones') || '').trim() || undefined
    const certificado = formData.get('certificado') as File | null
    const esVacaciones = tipo === 'vacaciones'

    if (!empleado_id || !tipo || !fecha_inicio || !fecha_fin) {
      return { success: false, error: 'Faltan campos obligatorios de la licencia' }
    }

    if (!user || !isAdmin) {
      return { success: false, error: 'Solo un administrador puede registrar licencias.' }
    }

    let certificadoPreparado: CertificadoLicenciaPreparado | null = null
    if (!esVacaciones) {
      const certificadoResult = await prepararCertificadoLicencia(certificado as File)
      if (!certificadoResult.success || !certificadoResult.data) {
        return { success: false, error: certificadoResult.error || 'No se pudo procesar el certificado.' }
      }
      certificadoPreparado = certificadoResult.data
    }

    const fechaInicio = new Date(fecha_inicio)
    const fechaFin = new Date(fecha_fin)
    const fechaControlPresentacion = esVacaciones
      ? null
      : (fecha_presentacion_raw
          ? new Date(fecha_presentacion_raw)
          : new Date(`${fecha_inicio}T00:00:00`))
    const ahora = new Date()

    if (
      Number.isNaN(fechaInicio.getTime()) ||
      Number.isNaN(fechaFin.getTime()) ||
      (!esVacaciones && (!fechaControlPresentacion || Number.isNaN(fechaControlPresentacion.getTime())))
    ) {
      return { success: false, error: 'Las fechas informadas no son validas' }
    }

    if (fechaFin < fechaInicio) {
      return { success: false, error: 'La fecha de fin no puede ser anterior a la fecha de inicio' }
    }

    const fechaLimitePresentacion = !esVacaciones && fechaControlPresentacion
      ? new Date(fechaControlPresentacion.getTime() + 24 * 60 * 60 * 1000)
      : null
    const presentadoEnTermino = !esVacaciones && fechaLimitePresentacion ? ahora <= fechaLimitePresentacion : null
    const fechaPresentacionIso = !esVacaciones && fechaControlPresentacion ? fechaControlPresentacion.toISOString() : null
    const fechaCargaIso = ahora.toISOString()

    if (!esVacaciones && !presentadoEnTermino && !excepcion_plazo && fechaLimitePresentacion) {
      await registrarEventoLegajo(db, {
        empleadoId: empleado_id,
        tipo: 'certificado_fuera_termino',
        categoria: 'licencias',
        titulo: 'Intento de certificado fuera de término',
        descripcion: 'Se intentó cargar un certificado después de las 24 horas permitidas.',
        metadata: {
          tipo_licencia: tipo,
          fecha_inicio,
          fecha_fin,
          fecha_presentacion: fechaPresentacionIso,
          fecha_registro_sistema: fechaCargaIso,
          fecha_limite_presentacion: fechaLimitePresentacion.toISOString(),
          excepcion_plazo: false,
        },
        createdBy: actorId,
      })

      return {
        success: false,
        error: 'El certificado debe presentarse dentro de las 24 horas. Marque excepcion si corresponde.',
      }
    }

    if (!esVacaciones && excepcion_plazo && !motivo_excepcion) {
      return { success: false, error: 'Debe informar el motivo de excepcion de plazo' }
    }

    const { data: empleado, error: empleadoError } = await db
      .from('rrhh_empleados')
      .select('id, nombre, apellido, usuario:usuarios(nombre, apellido)')
      .eq('id', empleado_id)
      .single()

    if (empleadoError || !empleado) {
      return { success: false, error: 'Empleado no encontrado' }
    }

    const certificadoUrl: string | null = null
    let storagePath: string | null = null
    let certificadoNombreArchivo: string | null = null
    let certificadoMimeType: string | null = null
    let certificadoTamanoBytes: number | null = null

    if (!esVacaciones && certificadoPreparado) {
      const bucketReady = await ensureRrhhLicenciasBucket(db)
      if (!bucketReady) {
        return {
          success: false,
          error: 'No se pudo preparar el almacenamiento del certificado. Intenta nuevamente.',
        }
      }

      storagePath = `rrhh/licencias/${empleado_id}/${Date.now()}-${certificadoPreparado.storedFileName}`

      const { error: uploadError } = await db.storage.from(RRHH_LICENCIAS_BUCKET).upload(storagePath, certificadoPreparado.buffer, {
        contentType: certificadoPreparado.mimeType,
        upsert: false,
      })

      if (uploadError) {
        devError('Error subiendo certificado de licencia:', uploadError)
        const uploadMessage = String(uploadError.message || '').toLowerCase()
        if (uploadMessage.includes('mime type')) {
          return {
            success: false,
            error: `El certificado debe estar en formato ${getCertificadoMimeLabel()}.`,
          }
        }
        if (uploadMessage.includes('row-level security')) {
          return {
            success: false,
            error: 'No se pudo guardar el certificado por permisos de almacenamiento. Intente nuevamente.',
          }
        }
        if (uploadMessage.includes('maximum allowed size')) {
          return {
            success: false,
            error: 'El certificado excede el limite de 10 MB. Reduzca el archivo e intente nuevamente.',
          }
        }
        return { success: false, error: 'No se pudo subir el certificado. Intenta nuevamente.' }
      }

      certificadoNombreArchivo = certificadoPreparado.originalName
      certificadoMimeType = certificadoPreparado.mimeType
      certificadoTamanoBytes = certificadoPreparado.sizeBytes
    }

    const diasTotal = Math.ceil((fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24)) + 1

    const { data, error } = await db
      .from('rrhh_licencias')
      .insert({
        empleado_id,
        tipo,
        fecha_inicio,
        fecha_fin,
        fecha_sintomas: esVacaciones || !fechaControlPresentacion ? null : fechaControlPresentacion.toISOString(),
        diagnostico_reportado: esVacaciones ? null : diagnostico_reportado,
        excepcion_plazo: esVacaciones ? false : excepcion_plazo,
        motivo_excepcion: esVacaciones ? null : motivo_excepcion,
        fecha_presentacion_certificado: fechaPresentacionIso,
        fecha_limite_presentacion: fechaLimitePresentacion ? fechaLimitePresentacion.toISOString() : null,
        presentado_en_termino: presentadoEnTermino,
        certificado_url: certificadoUrl,
        certificado_storage_path: storagePath,
        certificado_nombre_archivo: certificadoNombreArchivo,
        certificado_mime_type: certificadoMimeType,
        certificado_tamano_bytes: certificadoTamanoBytes,
        estado_revision: 'pendiente',
        revision_manual_required: true,
        ia_certificado_valido: null,
        ia_confianza: null,
        ia_observaciones: null,
        ia_nombre_detectado: null,
        ia_diagnostico_detectado: null,
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

    await registrarEventoLegajo(db, {
      empleadoId: empleado_id,
      tipo: 'licencia_solicitada',
      categoria: 'licencias',
      titulo: 'Nueva licencia solicitada',
      descripcion: `${tipo} del ${fecha_inicio} al ${fecha_fin}`,
      metadata: {
        licencia_id: data.id,
        tipo,
        fecha_inicio,
        fecha_fin,
        dias_total: diasTotal,
        ...(fechaPresentacionIso ? { fecha_presentacion_certificado: fechaPresentacionIso } : {}),
        fecha_registro_sistema: fechaCargaIso,
        ...(presentadoEnTermino !== null ? { presentado_en_termino: presentadoEnTermino } : {}),
        excepcion_plazo: esVacaciones ? false : excepcion_plazo,
      },
      createdBy: actorId,
    })

    revalidatePath('/rrhh/licencias')
    revalidatePath(`/rrhh/empleados/${empleado_id}`)

    return {
      success: true,
      data: { licenciaId: data.id },
      message: esVacaciones
        ? 'Vacaciones programadas correctamente. Quedan pendientes de revision manual por administrador.'
        : 'Licencia creada con certificado. Queda pendiente de revision manual por administrador.',
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
    const { db, user, isAdmin } = await getDbForCurrentUser()
    if (!isAdmin || !user) {
      return {
        success: false,
        error: 'No autorizado',
      }
    }

    // Obtener el usuario actual
    const { data: licenciaSnapshot } = await db
      .from('rrhh_licencias')
      .select('id, empleado_id, tipo, fecha_inicio, fecha_fin, dias_total')
      .eq('id', licenciaId)
      .maybeSingle()

    const { data, error } = await db
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

    if (licenciaSnapshot?.empleado_id) {
      await registrarEventoLegajo(db, {
        empleadoId: licenciaSnapshot.empleado_id,
        tipo: 'licencia_aprobada',
        categoria: 'licencias',
        titulo: 'Licencia aprobada',
        descripcion: `${licenciaSnapshot.tipo} del ${licenciaSnapshot.fecha_inicio} al ${licenciaSnapshot.fecha_fin}`,
        metadata: {
          licencia_id: licenciaId,
          tipo: licenciaSnapshot.tipo,
          fecha_inicio: licenciaSnapshot.fecha_inicio,
          fecha_fin: licenciaSnapshot.fecha_fin,
          dias_total: licenciaSnapshot.dias_total,
        },
        createdBy: user.id,
      })

      const periodos = buildMonthRange(licenciaSnapshot.fecha_inicio, licenciaSnapshot.fecha_fin)
      await recalcularLiquidacionesEmpleadoPorPeriodos(db, {
        empleadoId: licenciaSnapshot.empleado_id,
        actorId: user.id,
        periodos,
      })
    }

    revalidatePath('/rrhh/licencias')
    if (licenciaSnapshot?.empleado_id) {
      revalidatePath(`/rrhh/empleados/${licenciaSnapshot.empleado_id}`)
    }

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

export async function rechazarLicenciaAction(licenciaId: string): Promise<ApiResponse<void>> {
  try {
    const { db, user, isAdmin } = await getDbForCurrentUser()
    if (!isAdmin || !user) {
      return {
        success: false,
        error: 'No autorizado',
      }
    }

    const { data: licenciaSnapshot } = await db
      .from('rrhh_licencias')
      .select('id, empleado_id, tipo, fecha_inicio, fecha_fin, dias_total')
      .eq('id', licenciaId)
      .maybeSingle()

    const { error } = await db
      .from('rrhh_licencias')
      .update({
        aprobado: false,
        aprobado_por: null,
        fecha_aprobacion: null,
        estado_revision: 'rechazado',
        revision_manual_required: false,
        revisado_por: user.id,
        fecha_revision: new Date().toISOString(),
      })
      .eq('id', licenciaId)

    if (error) {
      devError('Error al rechazar licencia:', error)
      return {
        success: false,
        error: 'Error al rechazar licencia: ' + error.message,
      }
    }

    if (licenciaSnapshot?.empleado_id) {
      await registrarEventoLegajo(db, {
        empleadoId: licenciaSnapshot.empleado_id,
        tipo: 'licencia_rechazada',
        categoria: 'licencias',
        titulo: 'Licencia rechazada',
        descripcion: `${licenciaSnapshot.tipo} del ${licenciaSnapshot.fecha_inicio} al ${licenciaSnapshot.fecha_fin}`,
        metadata: {
          licencia_id: licenciaId,
          tipo: licenciaSnapshot.tipo,
          fecha_inicio: licenciaSnapshot.fecha_inicio,
          fecha_fin: licenciaSnapshot.fecha_fin,
          dias_total: licenciaSnapshot.dias_total,
        },
        createdBy: user.id,
      })
    }

    revalidatePath('/rrhh/licencias')
    if (licenciaSnapshot?.empleado_id) {
      revalidatePath(`/rrhh/empleados/${licenciaSnapshot.empleado_id}`)
    }

    return {
      success: true,
      message: 'Licencia rechazada exitosamente',
    }
  } catch (error) {
    devError('Error en rechazarLicenciaAction:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function obtenerDescansosProgramadosAction(
  empleadoId: string,
): Promise<
  ApiResponse<
    Array<{
      id: string
      dia_semana: number
      vigente_desde: string
      vigente_hasta?: string | null
      observaciones?: string | null
      activo: boolean
    }>
  >
> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('rrhh_descansos_programados')
      .select('id, dia_semana, vigente_desde, vigente_hasta, observaciones, activo')
      .eq('empleado_id', empleadoId)
      .eq('activo', true)
      .order('dia_semana', { ascending: true })
      .order('vigente_desde', { ascending: false })

    if (error) {
      devError('Error al obtener descansos programados:', error)
      return {
        success: false,
        error: 'No se pudieron obtener los descansos programados',
      }
    }

    return {
      success: true,
      data: (data || []) as Array<{
        id: string
        dia_semana: number
        vigente_desde: string
        vigente_hasta?: string | null
        observaciones?: string | null
        activo: boolean
      }>,
    }
  } catch (error) {
    devError('Error en obtenerDescansosProgramadosAction:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

export async function guardarDescansosProgramadosAction(input: {
  empleado_id: string
  dias_semana: number[]
  vigente_desde: string
  vigente_hasta?: string
  observaciones?: string
}): Promise<ApiResponse<{ registros: number }>> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return {
        success: false,
        error: 'Usuario no autenticado',
      }
    }

    const diasSemana = Array.from(new Set(input.dias_semana.map((d) => Number(d))))
      .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
      .sort((a, b) => a - b)

    if (!input.empleado_id || !input.vigente_desde || diasSemana.length === 0) {
      return {
        success: false,
        error: 'Debe indicar empleado, fecha de vigencia y al menos un dia de descanso',
      }
    }

    const { error: deactivateError } = await supabase
      .from('rrhh_descansos_programados')
      .update({
        activo: false,
        updated_at: new Date().toISOString(),
      })
      .eq('empleado_id', input.empleado_id)
      .eq('activo', true)

    if (deactivateError) {
      devError('Error desactivando descansos anteriores:', deactivateError)
      return {
        success: false,
        error: 'No se pudieron reemplazar los descansos previos',
      }
    }

    const payload = diasSemana.map((diaSemana) => ({
      empleado_id: input.empleado_id,
      dia_semana: diaSemana,
      vigente_desde: input.vigente_desde,
      vigente_hasta: input.vigente_hasta || null,
      observaciones: input.observaciones || null,
      activo: true,
      created_by: user.id,
    }))

    const { data, error } = await supabase
      .from('rrhh_descansos_programados')
      .insert(payload)
      .select('id')

    if (error) {
      devError('Error guardando descansos programados:', error)
      return {
        success: false,
        error: 'No se pudieron guardar los descansos programados',
      }
    }

    revalidatePath('/rrhh/licencias')
    revalidatePath(`/rrhh/empleados/${input.empleado_id}`)
    revalidatePath('/rrhh/liquidaciones')
    revalidatePath('/rrhh/liquidaciones/calcular')

    return {
      success: true,
      data: { registros: (data || []).length },
      message: 'Descansos programados guardados y notificados',
    }
  } catch (error) {
    devError('Error en guardarDescansosProgramadosAction:', error)
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
      message: 'Descuento creado exitosamente, pendiente de aprobacion',
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

    // Verificar si ya existe una evaluacion para el mismo periodo
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
        error: 'Ya existe una evaluacion para este empleado en el periodo seleccionado',
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
      devError('Error al crear evaluacion:', error)
      return {
        success: false,
        error: 'Error al crear evaluacion: ' + error.message,
      }
    }

    await registrarEventoLegajo(supabase, {
      empleadoId: evaluacionData.empleado_id,
      tipo: 'evaluacion_creada',
      categoria: 'evaluaciones',
      titulo: 'Nueva evaluacion de desempeno',
      descripcion: `Periodo ${evaluacionData.periodo_mes}/${evaluacionData.periodo_anio}`,
      metadata: {
        evaluacion_id: data.id,
        periodo_mes: evaluacionData.periodo_mes,
        periodo_anio: evaluacionData.periodo_anio,
        sucursal_id: evaluacionData.sucursal_id,
      },
      createdBy: user.id,
    })

    revalidatePath('/rrhh/evaluaciones')

    return {
      success: true,
      data: { evaluacionId: data.id },
      message: 'Evaluacion creada exitosamente',
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
      devError('Error al actualizar evaluacion:', error)
      return {
        success: false,
        error: 'Error al actualizar evaluacion: ' + error.message,
      }
    }

    revalidatePath('/rrhh/evaluaciones')
    revalidatePath(`/rrhh/evaluaciones/${evaluacionId}`)

    return {
      success: true,
      data: { evaluacionId: data.id },
      message: 'Evaluacion actualizada exitosamente',
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
      devError('Error al enviar evaluacion:', error)
      return {
        success: false,
        error: 'Error al enviar evaluacion: ' + error.message,
      }
    }

    revalidatePath('/rrhh/evaluaciones')

    return {
      success: true,
      message: 'Evaluacion enviada exitosamente',
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

// ========== CATEGORIAS ==========

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
      devError('Error al crear categoria:', error)
      return {
        success: false,
        error: 'Error al crear categoria: ' + error.message,
      }
    }

    revalidatePath('/rrhh/categorias')

    return {
      success: true,
      data: { categoriaId: data.id },
      message: 'Categoria creada exitosamente',
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
      devError('Error al actualizar categoria:', error)
      return {
        success: false,
        error: 'Error al actualizar categoria: ' + error.message,
      }
    }

    revalidatePath('/rrhh/categorias')
    revalidatePath(`/rrhh/categorias/${categoriaId}`)

    return {
      success: true,
      data: { categoriaId: data.id },
      message: 'Categoria actualizada exitosamente',
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
    // (ya que el trigger sync_user_from_auth() los sincroniza automaticamente)

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

    const sucursalesPriorizadas = priorizarSucursalesHorqueta((sucursales || []) as any[])

    return {
      success: true,
      data: sucursalesPriorizadas as Array<{
        id: string
        nombre: string
        direccion?: string
        telefono?: string
        activo: boolean
      }>,
    }
  } catch (error) {
    devError('Error en obtenerSucursalesActivasAction:', error)
    return {
      success: false,
      error: 'Error interno del servidor',
    }
  }
}

// ========== AUTO-DESCANSOS ==========

/**
 * Regla vigente RRHH descansos mensuales:
 * - Solo sucursales y tesoreria tienen 2 descansos mensuales de medio turno tarde.
 * - Se generan de forma aleatoria al inicio de mes y pueden re-sincronizarse bajo demanda.
 * - Esos descansos impactan en liquidacion como jornada paga completa (segun regla vigente).
 */
export async function autoAsignarDescansosAction(
  liquidacionId: string,
): Promise<ApiResponse<{ insertados: number; mensaje: string }>> {
  try {
    const adminUserId = await getAuthenticatedAdminUserId()
    if (!adminUserId) {
      return { success: false, error: 'No autorizado' }
    }

    const supabase = createAdminClient()

    // Obtener datos de la liquidacion objetivo
    const { data: liquidacion, error: liqError } = await supabase
      .from('rrhh_liquidaciones')
      .select('id, empleado_id, periodo_mes, periodo_anio')
      .eq('id', liquidacionId)
      .maybeSingle()

    if (liqError || !liquidacion) {
      return { success: false, error: 'Liquidacion no encontrada' }
    }

    const syncResult = await sincronizarDescansosMensualesSucursal(supabase, {
      anio: Number(liquidacion.periodo_anio),
      mes: Number(liquidacion.periodo_mes),
      empleadoId: liquidacion.empleado_id,
      seed: `liq-${liquidacionId}`,
    })

    if (syncResult.soportado) {
      const { error: prepararError } = await prepararLiquidacionMensualConDomingoSucursal(supabase, {
        empleadoId: liquidacion.empleado_id,
        mes: Number(liquidacion.periodo_mes),
        anio: Number(liquidacion.periodo_anio),
        createdBy: adminUserId,
      })

      if (prepararError) {
        devError('Error refrescando liquidacion luego de sincronizar descansos:', prepararError)
      }
    } else {
      const { error: recalcError } = await recalcularLiquidacionConDomingoSucursal(supabase, {
        liquidacionId,
        actorId: adminUserId,
      })
      if (recalcError) {
        devError('Error recalculando liquidacion (fallback descansos):', recalcError)
      }
    }

    revalidatePath(`/rrhh/liquidaciones/${liquidacionId}`)

    return {
      success: true,
      data: {
        insertados: syncResult.generados,
        mensaje: syncResult.soportado
          ? `Descansos mensuales sincronizados (generados: ${syncResult.generados}, asistencias actualizadas: ${syncResult.sincronizados}).`
          : 'Se recalculo la liquidacion. La sincronizacion de descansos requiere migracion actualizada.',
      },
    }
  } catch (error) {
    devError('Error en autoAsignarDescansosAction:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}


function getPeriodoActualArgentina(): { mes: number; anio: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
  })

  const parts = formatter.formatToParts(new Date())
  const anio = Number(parts.find((part) => part.type === 'year')?.value || new Date().getFullYear())
  const mes = Number(parts.find((part) => part.type === 'month')?.value || new Date().getMonth() + 1)

  return { mes, anio }
}

export async function asignarDescansosAleatoriosMesActualAction(): Promise<ApiResponse<{
  mes: number
  anio: number
  generados: number
  sincronizados: number
  mensaje: string
}>> {
  try {
    const adminUserId = await getAuthenticatedAdminUserId()
    if (!adminUserId) {
      return { success: false, error: 'No autorizado' }
    }

    const { mes, anio } = getPeriodoActualArgentina()
    const supabase = createAdminClient()

    const syncResult = await sincronizarDescansosMensualesSucursal(supabase, {
      anio,
      mes,
      seed: `manual-${anio}-${mes}`,
    })

    if (!syncResult.soportado) {
      return {
        success: false,
        error: 'La sincronizacion de descansos no esta disponible en esta base. Revisa migraciones RRHH.',
      }
    }

    revalidatePath('/rrhh/empleados')
    revalidatePath('/rrhh/horarios')
    revalidatePath('/rrhh/liquidaciones')

    const mensaje = `Descansos mensuales sincronizados para ${mes}/${anio} (generados: ${syncResult.generados}, asistencias actualizadas: ${syncResult.sincronizados}).`

    return {
      success: true,
      data: {
        mes,
        anio,
        generados: syncResult.generados,
        sincronizados: syncResult.sincronizados,
        mensaje,
      },
      message: mensaje,
    }
  } catch (error) {
    devError('Error en asignarDescansosAleatoriosMesActualAction:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

