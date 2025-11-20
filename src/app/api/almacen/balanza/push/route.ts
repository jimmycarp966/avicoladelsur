import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { actualizarPesoItemAction } from '@/actions/presupuestos.actions'

/**
 * Endpoint para recibir datos de balanza física
 * 
 * Este endpoint puede ser llamado por:
 * - Servicios bridge (Raspberry Pi, Node.js, Python) que leen balanzas serial
 * - Balanzas HTTP-enabled directamente
 * - Dispositivos IoT que envían datos de peso
 * 
 * Ejemplo de uso con Raspberry Pi + balanza serial:
 * ```python
 * import serial
 * import requests
 * 
 * ser = serial.Serial('/dev/ttyUSB0', 9600)
 * while True:
 *     peso = ser.readline().decode().strip()
 *     requests.post('http://tu-servidor/api/almacen/balanza/push', json={
 *         'presupuesto_item_id': 'uuid-del-item',
 *         'peso': float(peso),
 *         'unidad': 'kg'
 *     })
 * ```
 */

const balanzaPushSchema = z.object({
  presupuesto_item_id: z.string().uuid(),
  peso: z.number().positive(),
  unidad: z.enum(['kg', 'g', 'lb']).default('kg'),
  timestamp: z.string().datetime().optional(),
  estable: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = balanzaPushSchema.parse(body)

    // Convertir peso a kg si es necesario
    let pesoEnKg = data.peso
    if (data.unidad === 'g') {
      pesoEnKg = data.peso / 1000
    } else if (data.unidad === 'lb') {
      pesoEnKg = data.peso * 0.453592
    }

    // Actualizar el peso del item usando la Server Action
    const formData = new FormData()
    formData.append('presupuesto_item_id', data.presupuesto_item_id)
    formData.append('peso_final', pesoEnKg.toString())

    const result = await actualizarPesoItemAction(formData)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Peso actualizado exitosamente',
        data: {
          peso_kg: pesoEnKg,
          peso_original: data.peso,
          unidad_original: data.unidad,
          timestamp: data.timestamp || new Date().toISOString(),
        }
      })
    } else {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Error en balanza/push:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Datos inválidos',
          details: error.issues
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    mensaje: 'Endpoint para recibir datos de balanza física',
    instrucciones: 'POST con { presupuesto_item_id, peso, unidad?, timestamp?, estable? }',
    ejemplo: {
      presupuesto_item_id: 'uuid-del-item',
      peso: 5.25,
      unidad: 'kg', // 'kg', 'g', o 'lb'
      timestamp: new Date().toISOString(), // opcional
      estable: true // opcional, indica si el peso está estable
    },
    integracion: {
      serial: 'Usar servicio bridge (Node.js/Python) que lea puerto serial y POST a este endpoint',
      http: 'Balanza HTTP-enabled puede POST directamente',
      bluetooth: 'Usar servicio bridge que lea Bluetooth y POST a este endpoint'
    }
  })
}
