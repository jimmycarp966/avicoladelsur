import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { registrarRecepcionIngresoAction, registrarRecepcionEgresoAction } from '@/actions/almacen.actions'

// Schema para recepción
const recepcionSchema = z.object({
  tipo: z.enum(['ingreso', 'egreso']),
  producto_id: z.string().uuid(),
  lote_id: z.string().uuid().optional(),
  cantidad: z.number().positive(),
  unidad_medida: z.string().default('kg'),
  motivo: z.string().min(1),
  destino_produccion: z.boolean().optional().default(false),
  proveedor_id: z.string().uuid().optional(),
  factura_proveedor_id: z.string().uuid().optional(),
  numero_comprobante_ref: z.string().trim().max(100).optional(),
  tipo_comprobante_ref: z.string().trim().max(50).optional(),
  fecha_comprobante: z.string().trim().optional(),
  monto_compra: z.number().nonnegative().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const data = recepcionSchema.parse(body)

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { success: false, message: 'Usuario no autenticado' },
        { status: 401 }
      )
    }

    // Verificar permisos (almacenista o admin)
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'almacenista'].includes(usuario.rol)) {
      return NextResponse.json(
        { success: false, message: 'No tienes permisos para registrar recepciones' },
        { status: 403 }
      )
    }

    // Crear FormData para la acción
    const formData = new FormData()
    formData.append('producto_id', data.producto_id)
    if (data.lote_id) {
      formData.append('lote_id', data.lote_id)
    }
    formData.append('cantidad', data.cantidad.toString())
    formData.append('unidad_medida', data.unidad_medida)
    formData.append('motivo', data.motivo)
    if (data.destino_produccion) {
      formData.append('destino_produccion', 'true')
    }
    if (data.proveedor_id) {
      formData.append('proveedor_id', data.proveedor_id)
    }
    if (data.factura_proveedor_id) {
      formData.append('factura_proveedor_id', data.factura_proveedor_id)
    }
    if (data.numero_comprobante_ref) {
      formData.append('numero_comprobante_ref', data.numero_comprobante_ref)
    }
    if (data.tipo_comprobante_ref) {
      formData.append('tipo_comprobante_ref', data.tipo_comprobante_ref)
    }
    if (data.fecha_comprobante) {
      formData.append('fecha_comprobante', data.fecha_comprobante)
    }
    if (typeof data.monto_compra === 'number') {
      formData.append('monto_compra', data.monto_compra.toString())
    }

    // Llamar Server Action según tipo
    const result = data.tipo === 'ingreso'
      ? await registrarRecepcionIngresoAction(formData)
      : await registrarRecepcionEgresoAction(formData)

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.error || 'Error al registrar recepción',
          error: result.error || 'Error al registrar recepción',
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Recepción de ${data.tipo} registrada exitosamente`,
    })

  } catch (error) {
    console.error('Error en /api/almacen/recepcion:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Datos inválidos',
          details: error.issues,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}

