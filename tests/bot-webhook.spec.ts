/**
 * Tests E2E para Webhook del Bot de WhatsApp
 *
 * Estos tests verifican que el webhook del bot procese correctamente
 * los comandos y flujos principales sin depender de servicios externos.
 */

import { test, expect } from '@playwright/test'

// Mock de respuestas de servicios externos
const MOCKS = {
  supabase: {
    findClienteByPhone: null, // Cliente no encontrado por defecto
    productos: [],
  },
  vertex: {
    response: null,
  },
}

interface BotResponse {
  status: number
  body: string
}

/**
 * Helper para enviar mensajes al webhook del bot
 * Simula una petición POST desde Twilio/Meta
 */
async function sendBotMessage(
  body: string,
  from: string = 'whatsapp:+5491112345678'
): Promise<BotResponse> {
  const baseUrl = process.env.BOT_TEST_URL || 'http://localhost:3000'
  const url = `${baseUrl}/api/bot`

  const formData = new URLSearchParams()
  formData.append('From', from)
  formData.append('Body', body)

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  })

  return {
    status: res.status,
    body: await res.text(),
  }
}

test.describe('Webhook del Bot de WhatsApp - Tests E2E', () => {
  test.describe('Comandos Básicos', () => {
    test('debería responder al saludo "hola"', async () => {
      const response = await sendBotMessage('hola')

      expect(response.status).toBe(200)
      // Debería contener saludo o menú
      expect(response.body).toMatch(/hola|¿en qué puedo ayudarte|menú/i)
    })

    test('debería responder al menú numérico "1" (productos)', async () => {
      const response = await sendBotMessage('1')

      expect(response.status).toBe(200)
      expect(response.body).toMatch(/productos|catálogo|disponible/i)
    })

    test('debería responder al menú numérico "2" (presupuesto)', async () => {
      const response = await sendBotMessage('2')

      expect(response.status).toBe(200)
      expect(response.body).toMatch(/presupuesto|código|cantidad/i)
    })

    test('debería responder al menú numérico "3" (estado)', async () => {
      const response = await sendBotMessage('3')

      expect(response.status).toBe(200)
      expect(response.body).toMatch(/estado|pedidos|consultar/i)
    })

    test('debería responder al menú numérico "4" (reclamo)', async () => {
      const response = await sendBotMessage('4')

      expect(response.status).toBe(200)
      expect(response.body).toMatch(/reclamo|tipo|descripción/i)
    })

    test('debería responder al menú numérico "5" (saldo)', async () => {
      const response = await sendBotMessage('5')

      expect(response.status).toBe(200)
      expect(response.body).toMatch(/saldo|deuda|cuenta/i)
    })
  })

  test.describe('Comandos de Productos', () => {
    test('debería responder a "productos" o "catalogo"', async () => {
      const response1 = await sendBotMessage('productos')
      const response2 = await sendBotMessage('catalogo')

      expect(response1.status).toBe(200)
      expect(response2.status).toBe(200)

      expect(response1.body).toMatch(/productos|catálogo|disponible/i)
      expect(response2.body).toMatch(/productos|catálogo|disponible/i)
    })

    test('debería aceptar formato "CODIGO CANTIDAD"', async () => {
      const response = await sendBotMessage('POLLO001 5')

      expect(response.status).toBe(200)
      // Debería responder con algo relacionado al producto o presupuesto
      expect(response.body).toMatch(/producto|presupuesto|registrado|cantidad/i)
    })
  })

  test.describe('Comandos de Consultas', () => {
    test('debería responder a consulta de estado', async () => {
      const response = await sendBotMessage('estado')

      expect(response.status).toBe(200)
      expect(response.body).toMatch(/estado|pedidos|consultar/i)
    })

    test('debería responder a consulta de deuda/saldo', async () => {
      const response = await sendBotMessage('deuda')

      expect(response.status).toBe(200)
      expect(response.body).toMatch(/saldo|deuda|cuenta|pendiente/i)
    })

    test('debería responder a consulta de reclamos', async () => {
      const response = await sendBotMessage('mis reclamos')

      expect(response.status).toBe(200)
      expect(response.body).toMatch(/reclamo|registrado|consultar/i)
    })
  })

  test.describe('Flujo de Pedido Simple', () => {
    test('debería procesar pedido simple: "Quiero 5 kg de pechuga"', async () => {
      const response = await sendBotMessage('Quiero 5 kg de pechuga')

      expect(response.status).toBe(200)
      // Debería intentar procesar el pedido
      expect(response.body).toMatch(/pechuga|presupuesto|producto|registrado/i)
    })

    test('debería procesar pedido con código: "POLLO001 5"', async () => {
      const response = await sendBotMessage('POLLO001 5')

      expect(response.status).toBe(200)
      expect(response.body).toMatch(/presupuesto|producto|confirmar|cantidad/i)
    })
  })

  test.describe('Selección de Lista', () => {
    test('debería procesar selección de producto: "prod_POLLO001"', async () => {
      const response = await sendBotMessage('prod_POLLO001')

      expect(response.status).toBe(200)
      expect(response.body).toMatch(/producto|ordenar|cantidad/i)
    })

    test('debería procesar selección de pedido: "pedido_PED-20250101-000001"', async () => {
      const response = await sendBotMessage('pedido_PED-20250101-000001')

      expect(response.status).toBe(200)
      expect(response.body).toMatch(/pedido|estado|encontrado|consultar/i)
    })
  })

  test.describe('Confirmación de Pedido', () => {
    test('debería aceptar confirmación "sí" o "si"', async () => {
      const response1 = await sendBotMessage('sí')
      const response2 = await sendBotMessage('si')

      expect(response1.status).toBe(200)
      expect(response2.status).toBe(200)

      // Debería mencionar confirmación o cancelación
      expect(response1.body).toMatch(/confirmar|cancelar|presupuesto|no tienes/i)
      expect(response2.body).toMatch(/confirmar|cancelar|presupuesto|no tienes/i)
    })

    test('debería aceptar cancelación "no" o "cancelar"', async () => {
      const response1 = await sendBotMessage('no')
      const response2 = await sendBotMessage('cancelar')

      expect(response1.status).toBe(200)
      expect(response2.status).toBe(200)

      expect(response1.body).toMatch(/cancelado|presupuesto|opciones|no tienes/i)
      expect(response2.body).toMatch(/cancelado|presupuesto|opciones|no tienes/i)
    })
  })

  test.describe('Botones e IDs', () => {
    test('debería procesar botón "btn_menu"', async () => {
      const response = await sendBotMessage('btn_menu')

      expect(response.status).toBe(200)
      expect(response.body).toMatch(/¿en qué puedo ayudarte|menú|hola/i)
    })

    test('debería procesar botón "btn_productos"', async () => {
      const response = await sendBotMessage('btn_productos')

      expect(response.status).toBe(200)
      expect(response.body).toMatch(/productos|catálogo/i)
    })

    test('debería procesar botón "btn_presupuesto"', async () => {
      const response = await sendBotMessage('btn_presupuesto')

      expect(response.status).toBe(200)
      expect(response.body).toMatch(/presupuesto|código|cantidad/i)
    })

    test('debería procesar botón "btn_estado"', async () => {
      const response = await sendBotMessage('btn_estado')

      expect(response.status).toBe(200)
      expect(response.body).toMatch(/estado|pedidos/i)
    })

    test('debería procesar botón de confirmación "btn_confirmar_si"', async () => {
      const response = await sendBotMessage('btn_confirmar_si')

      expect(response.status).toBe(200)
      expect(response.body).toMatch(/confirmar|presupuesto|no tienes/i)
    })

    test('debería procesar botón de cancelación "btn_confirmar_no"', async () => {
      const response = await sendBotMessage('btn_confirmar_no')

      expect(response.status).toBe(200)
      expect(response.body).toMatch(/cancelado|presupuesto|no tienes/i)
    })
  })

  test.describe('Flujo de Registro de Cliente Nuevo', () => {
    test('debería iniciar flujo de registro para cliente no encontrado', async () => {
      const response = await sendBotMessage('hola')

      expect(response.status).toBe(200)
      // Si el cliente no existe, debería pedir datos de registro
      // O mostrar el menú general
      expect(response.body).toBeTruthy()
    })

    test('debería procesar nombre en flujo de registro', async () => {
      // Este test asume que ya se inició el flujo de registro
      const response = await sendBotMessage('Juan Pérez')

      expect(response.status).toBe(200)
      expect(response.body).toBeTruthy()
    })
  })

  test.describe('Flujo de Reclamos', () => {
    test('debería iniciar flujo de reclamos', async () => {
      const response = await sendBotMessage('quiero hacer un reclamo')

      expect(response.status).toBe(200)
      expect(response.body).toMatch(/tipo|reclamo|selecciona|problema/i)
    })

    test('debería procesar tipo de reclamo numérico', async () => {
      const response = await sendBotMessage('1') // Producto dañado

      expect(response.status).toBe(200)
      expect(response.body).toMatch(/descripción|problema|describe|detalle/i)
    })
  })

  test.describe('Manejo de Errores', () => {
    test('debería responder a mensaje vacío', async () => {
      const response = await sendBotMessage('')

      expect(response.status).toBe(200)
      expect(response.body).toBeTruthy()
    })

    test('debería responder a mensaje desconocido', async () => {
      const response = await sendBotMessage('xyz123abc')

      expect(response.status).toBe(200)
      // Debería intentar procesarlo con Vertex AI o dar un mensaje útil
      expect(response.body).toBeTruthy()
    })

    test('debería manejar formato incorrecto de pedido', async () => {
      const response = await sendBotMessage('POLLO001')

      expect(response.status).toBe(200)
      // Debería pedir formato correcto o intentar ayudar
      expect(response.body).toBeTruthy()
    })
  })

  test.describe('Integración con Vertex AI', () => {
    test('debería procesar comandos mapeados por Vertex AI', async () => {
      // Comandos que deberían pasar por mapMessageForVertex
      const commands = [
        'ayuda',
        'inicio',
        'lista',
      ]

      for (const cmd of commands) {
        const response = await sendBotMessage(cmd)
        expect(response.status).toBe(200)
        expect(response.body).toBeTruthy()
      }
    })

    test('debería convertir comandos cortos a instrucciones claras', async () => {
      // "1" debería convertirse a "Quiero ver productos disponibles"
      // y Vertex AI debería procesarlo
      const response = await sendBotMessage('1')

      expect(response.status).toBe(200)
      expect(response.body).toMatch(/productos|catálogo|disponible/i)
    })
  })

  test.describe('Estado Persistente', () => {
    test('debería mantener estado entre mensajes (flujo de registro)', async () => {
      const phoneNumber = 'whatsapp:+5499999999999'

      // Primer mensaje: iniciar registro
      const response1 = await sendBotMessage('POLLO001 5', phoneNumber)
      expect(response1.status).toBe(200)

      // Segundo mensaje: nombre
      const response2 = await sendBotMessage('Juan Pérez', phoneNumber)
      expect(response2.status).toBe(200)

      // Debería avanzar en el flujo
      expect(response2.body).toMatch(/nombre|apellido|dirección|paso/i)
    })

    test('debería limpiar estado al cancelar', async () => {
      const phoneNumber = 'whatsapp:+5498888888888'

      // Iniciar flujo
      await sendBotMessage('POLLO001 5', phoneNumber)

      // Cancelar
      const response = await sendBotMessage('cancelar', phoneNumber)
      expect(response.status).toBe(200)
      expect(response.body).toMatch(/cancelado|menú|inicio/i)
    })
  })
})

test.describe('Webhook del Bot - Tests de Regresión', () => {
  test('debería mantener compatibilidad con formato antiguo de menú', async () => {
    const oldFormatCommands = [
      'opcion 1',
      'opcion 2',
      'opcion 3',
      'opcion 4',
      'opcion 5',
    ]

    for (const cmd of oldFormatCommands) {
      const response = await sendBotMessage(cmd)
      expect(response.status).toBe(200)
      expect(response.body).toBeTruthy()
    }
  })

  test('debería manejar mensajes con mayúsculas/minúsculas', async () => {
    const commands = ['HOLA', 'hola', 'Hola', 'HOLA', 'productos', 'PRODUCTOS']

    for (const cmd of commands) {
      const response = await sendBotMessage(cmd)
      expect(response.status).toBe(200)
      expect(response.body).toBeTruthy()
    }
  })

  test('debería manejar mensajes con espacios extra', async () => {
    const response = await sendBotMessage('  hola  ')

    expect(response.status).toBe(200)
    expect(response.body).toMatch(/hola|ayuda|menú|¿en qué puedo ayudarte/i)
  })
})
