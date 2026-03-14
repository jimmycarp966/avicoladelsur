import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { uploadFileToPrivateStorageServer } from '@/lib/supabase/storage-server'

const COMPROBANTES_BUCKET = 'reparto-comprobantes'

const registrarEntregaSchema = z.object({
  pedido_id: z.string().uuid(),
  entrega_id: z.string().uuid().optional(),
  firma_url: z.string().optional(),
  qr_verificacion: z.string().optional(),
  comprobante_url: z.string().optional(),
  metodo_pago: z.enum(['efectivo', 'transferencia', 'qr', 'tarjeta', 'cuenta_corriente']).optional(),
  numero_transaccion: z.string().optional(),
  monto_cobrado: z.number().min(0).optional(),
  monto_cuenta_corriente: z.number().min(0).optional(),
  es_cuenta_corriente: z.boolean().optional(),
  notas_entrega: z.string().optional(),
  es_pago_parcial: z.boolean().optional(),
  motivo_rechazo: z.string().optional(),
  estado_entrega: z.enum(['pendiente', 'en_camino', 'entregado', 'rechazado']).optional(),
  facturas_pagadas: z.array(z.string().uuid()).optional(),
})

function parseBoolean(value: unknown) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    return value === 'true' || value === '1' || value === 'on'
  }
  return false
}

function parseNumber(value: unknown) {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function parseStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
  }

  if (typeof value === 'string' && value.trim() !== '') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0)
      }
    } catch {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    }
  }

  return []
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
}

async function parseRequestPayload(request: NextRequest) {
  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    const comprobanteFileValue = formData.get('comprobante_file')
    const comprobanteFile =
      comprobanteFileValue instanceof File && comprobanteFileValue.size > 0
        ? comprobanteFileValue
        : null

    const facturas = formData.getAll('facturas_pagadas')

    return {
      data: {
        pedido_id: formData.get('pedido_id'),
        entrega_id: formData.get('entrega_id') || undefined,
        firma_url: formData.get('firma_url') || undefined,
        qr_verificacion: formData.get('qr_verificacion') || undefined,
        comprobante_url: formData.get('comprobante_url') || undefined,
        metodo_pago: formData.get('metodo_pago') || undefined,
        numero_transaccion: formData.get('numero_transaccion') || undefined,
        monto_cobrado: parseNumber(formData.get('monto_cobrado')),
        monto_cuenta_corriente: parseNumber(formData.get('monto_cuenta_corriente')),
        es_cuenta_corriente: parseBoolean(formData.get('es_cuenta_corriente')),
        notas_entrega: formData.get('notas_entrega') || undefined,
        es_pago_parcial: parseBoolean(formData.get('es_pago_parcial')),
        motivo_rechazo: formData.get('motivo_rechazo') || undefined,
        estado_entrega: formData.get('estado_entrega') || undefined,
        facturas_pagadas: facturas.length > 0
          ? facturas.filter((item): item is string => typeof item === 'string' && item.length > 0)
          : parseStringArray(formData.get('facturas_pagadas')),
      },
      comprobanteFile,
    }
  }

  const body = await request.json()

  return {
    data: {
      ...body,
      monto_cobrado: parseNumber(body.monto_cobrado),
      monto_cuenta_corriente: parseNumber(body.monto_cuenta_corriente),
      facturas_pagadas: parseStringArray(body.facturas_pagadas),
    },
    comprobanteFile: null as File | null,
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: rawData, comprobanteFile } = await parseRequestPayload(request)
    const data = registrarEntregaSchema.parse(rawData)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { success: false, message: 'Usuario no autenticado' },
        { status: 401 },
      )
    }

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || usuario.rol !== 'repartidor') {
      return NextResponse.json(
        { success: false, message: 'Solo repartidores pueden registrar entregas' },
        { status: 403 },
      )
    }

    const { data: detalleRuta, error: rutaError } = await supabase
      .from('detalles_ruta')
      .select('id, ruta_id, estado_entrega')
      .eq('pedido_id', data.pedido_id)
      .limit(1)
      .maybeSingle()

    if (rutaError || !detalleRuta) {
      return NextResponse.json(
        { success: false, message: 'Pedido no encontrado en la ruta' },
        { status: 404 },
      )
    }

    if (data.metodo_pago === 'transferencia' && data.numero_transaccion) {
      if (data.numero_transaccion.startsWith('0')) {
        return NextResponse.json(
          { success: false, message: 'El numero de transaccion BNA no debe empezar con 0' },
          { status: 400 },
        )
      }

      if (!/^\d+$/.test(data.numero_transaccion)) {
        return NextResponse.json(
          { success: false, message: 'El numero de transaccion debe contener solo digitos' },
          { status: 400 },
        )
      }
    }

    let comprobanteStoragePath: string | null = null
    if (comprobanteFile) {
      const safeName = sanitizeFileName(comprobanteFile.name || 'comprobante')
      const storagePath = [
        user.id,
        new Date().toISOString().slice(0, 10),
        data.pedido_id,
        data.entrega_id || detalleRuta.id,
        `${crypto.randomUUID()}-${safeName}`,
      ].join('/')

      const uploadResult = await uploadFileToPrivateStorageServer(
        COMPROBANTES_BUCKET,
        comprobanteFile,
        storagePath,
        comprobanteFile.type,
      )

      comprobanteStoragePath = uploadResult.path
    }

    try {
      const { data: result, error: entregaError } = await supabase.rpc('fn_validar_entrega', {
        p_pedido_id: data.pedido_id,
        p_firma_url: data.firma_url,
        p_qr_verificacion: data.qr_verificacion,
      })

      if (entregaError) {
        console.log('[API/entrega] fn_validar_entrega no aplicada:', entregaError.message)
      } else if (result && !result.success) {
        console.log('[API/entrega] fn_validar_entrega devolvio error:', result.error)
      }
    } catch (rpcError) {
      console.log('[API/entrega] fn_validar_entrega no disponible:', rpcError)
    }

    const { data: resultadoEntrega, error: errorEntrega } = await supabase.rpc(
      'fn_registrar_entrega_completa',
      {
        p_pedido_id: data.pedido_id,
        p_repartidor_id: user.id,
        p_entrega_id: data.entrega_id,
        p_facturas_pagadas: data.facturas_pagadas || [],
        p_estado_entrega: data.estado_entrega || detalleRuta.estado_entrega || 'pendiente',
        p_metodo_pago: data.metodo_pago,
        p_monto_cobrado: data.monto_cobrado || 0,
        p_monto_cuenta_corriente: data.monto_cuenta_corriente || 0,
        p_es_cuenta_corriente: data.es_cuenta_corriente || false,
        p_es_pago_parcial: data.es_pago_parcial || false,
        p_motivo_rechazo: data.motivo_rechazo,
        p_notas_entrega: data.notas_entrega,
        p_comprobante_url: data.comprobante_url,
        p_numero_transaccion: data.numero_transaccion,
        p_firma_url: data.firma_url,
        p_qr_verificacion: data.qr_verificacion,
        p_comprobante_storage_path: comprobanteStoragePath,
      },
    )

    if (errorEntrega || !resultadoEntrega?.success) {
      console.error('[API/entrega] Error en fn_registrar_entrega_completa:', errorEntrega || resultadoEntrega?.error)
      return NextResponse.json(
        {
          success: false,
          message: 'Error al registrar entrega',
          error: errorEntrega?.message || resultadoEntrega?.error || 'Error desconocido',
        },
        { status: 500 },
      )
    }

    revalidatePath('/(repartidor)/ruta')
    revalidatePath(`/(repartidor)/ruta/${detalleRuta.ruta_id}`)
    revalidatePath('/(repartidor)/entregas')
    revalidatePath('/(repartidor)/home')
    revalidatePath('/(admin)/(dominios)/reparto/rutas')

    return NextResponse.json({
      success: true,
      message: 'Entrega registrada exitosamente',
      data: {
        pedido_id: data.pedido_id,
        entrega_registrada: true,
        cobro_registrado: (data.monto_cobrado || 0) > 0,
        comprobante_storage_path: comprobanteStoragePath,
        nota: (data.monto_cobrado || 0) > 0
          ? 'El cobro quedara pendiente de validacion por tesoreria'
          : null,
      },
    })
  } catch (error) {
    console.error('Error en registrar entrega:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Datos invalidos',
          details: error.issues,
        },
        { status: 400 },
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    mensaje: 'Endpoint para registro de entregas - PWA Repartidor',
    instrucciones: 'POST con datos de entrega',
    campos_requeridos: ['pedido_id'],
    campos_opcionales: [
      'firma_url',
      'qr_verificacion',
      'comprobante_url',
      'comprobante_file',
      'metodo_pago',
      'numero_transaccion',
      'monto_cobrado',
      'notas_entrega',
    ],
  })
}
