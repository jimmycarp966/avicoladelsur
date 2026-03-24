import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { crearPresupuestoAction } from '@/actions/presupuestos.actions'
import { crearReclamoBotAction, crearClienteDesdeBotAction } from '@/actions/ventas.actions'
import { obtenerListasClienteAction, obtenerPrecioProductoAction } from '@/actions/listas-precios.actions'
import { sendWhatsAppMessage, getWhatsAppProvider, isWhatsAppMetaAvailable } from '@/lib/services/whatsapp-meta'
import { interpretarMensajeConIA } from '@/lib/services/whatsapp-ia-interpreter'
import { processMessageWithTools, extractAndSaveFactsInBackground } from '@/lib/vertex/agent'
import { updateCustomerContext, getOrCreateSession } from '@/lib/vertex/session-manager'
import { crearPresupuestoTool } from '@/lib/vertex/tools/crear-presupuesto'
import type { MetaListSection } from '@/types/whatsapp-meta'
import { getPendingState, setPendingState, deletePendingState } from '@/lib/bot/state-manager'
import type { ConfirmacionEstado as ConfirmacionEstadoImport } from '@/lib/bot/state-manager'
import { normalizeWebhook, verifySignature } from '@kapso/whatsapp-cloud-api/server'

// Tipos para las llamadas de Botpress
interface BotpressWebhookPayload {
  intent: string
  parameters: Record<string, any>
  session: {
    userId: string
    channel: string
  }
  message?: string
}

interface BotpressResponse {
  success: boolean
  message?: string
  data?: any
  error?: string
}

// Función auxiliar para encontrar cliente por teléfono
async function findClienteByPhone(phone: string) {
  const supabase = await createClient()

  // Normalizar el número de teléfono (remover espacios, guiones, etc.)
  const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '')

  const { data: cliente, error } = await supabase
    .from('clientes')
    .select('id, codigo, nombre, telefono, whatsapp')
    .or(`telefono.ilike.%${normalizedPhone}%,whatsapp.ilike.%${normalizedPhone}%`)
    .eq('activo', true)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error finding cliente:', error)
    return null
  }

  return cliente
}

// Función auxiliar para encontrar cliente por código
async function findClienteByCode(code: string) {
  const supabase = await createClient()

  const { data: cliente, error } = await supabase
    .from('clientes')
    .select('id, codigo, nombre, telefono, whatsapp')
    .eq('codigo', code.toUpperCase())
    .eq('activo', true)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error finding cliente by code:', error)
    return null
  }

  return cliente
}

// Función auxiliar para guardar mensaje del bot en Supabase
async function saveBotMessage(
  phoneNumber: string,
  message: string,
  direction: 'incoming' | 'outgoing',
  clienteId?: string,
  metadata?: Record<string, any>
) {
  try {
    const supabase = await createClient()

    await supabase.from('bot_messages').insert({
      phone_number: phoneNumber,
      message,
      direction,
      cliente_id: clienteId,
      metadata: metadata || {}
    })
  } catch (error) {
    console.error('[Bot] Error guardando mensaje en bot_messages:', error)
    // No fallar el flujo principal si falla el guardado
  }
}

// Función auxiliar para encontrar producto por código o nombre
async function findProductoByCode(code: string) {
  const supabase = await createClient()
  const searchTerm = code.trim().toUpperCase()

  // Primero buscar por código exacto
  const { data: productoExacto, error: errorExacto } = await supabase
    .from('productos')
    .select('id, codigo, nombre, precio_venta, unidad_medida')
    .eq('codigo', searchTerm)
    .eq('activo', true)
    .single()

  if (productoExacto) {
    return productoExacto
  }

  // Si no encuentra por código, buscar por nombre parcial
  const { data: productoPorNombre, error: errorNombre } = await supabase
    .from('productos')
    .select('id, codigo, nombre, precio_venta, unidad_medida')
    .eq('activo', true)
    .ilike('nombre', `%${searchTerm}%`)
    .limit(1)
    .single()

  if (productoPorNombre) {
    return productoPorNombre
  }

  // Si tampoco encuentra por nombre, intentar con las primeras 3 letras
  if (searchTerm.length >= 3) {
    const { data: productoApprox } = await supabase
      .from('productos')
      .select('id, codigo, nombre, precio_venta, unidad_medida')
      .eq('activo', true)
      .ilike('nombre', `${searchTerm.slice(0, 3)}%`)
      .limit(1)
      .single()

    if (productoApprox) {
      return productoApprox
    }
  }

  if (errorExacto && errorExacto.code !== 'PGRST116') {
    console.error('Error finding producto:', errorExacto)
  }

  return null
}

// Función auxiliar para obtener estado de pedido
async function getPedidoStatus(pedidoNumero: string) {
  const supabase = await createClient()

  const { data: pedido, error } = await supabase
    .from('pedidos')
    .select(`
      id,
      numero_pedido,
      estado,
      fecha_pedido,
      fecha_entrega_estimada,
      fecha_entrega_real,
      total,
      clientes (
        nombre
      )
    `)
    .eq('numero_pedido', pedidoNumero)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error getting pedido status:', error)
    return null
  }

  return pedido
}

async function getReclamoStatus(numeroReclamo: string) {
  const supabase = await createClient()

  const { data: reclamo, error } = await supabase
    .from('reclamos')
    .select(`
      id,
      numero_reclamo,
      estado,
      tipo_reclamo,
      descripcion,
      prioridad,
      fecha_creacion,
      created_at,
      fecha_resolucion,
      solucion,
      clientes (
        nombre
      ),
      pedido:pedidos (
        numero_pedido
      )
    `)
    .eq('numero_reclamo', numeroReclamo.toUpperCase())
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error getting reclamo status:', error)
    return null
  }

  return reclamo
}

async function getReclamosCliente(clienteId: string) {
  const supabase = await createClient()

  const { data: reclamos, error } = await supabase
    .from('reclamos')
    .select(`
      id,
      numero_reclamo,
      estado,
      tipo_reclamo,
      descripcion,
      fecha_creacion,
      created_at
    `)
    .eq('cliente_id', clienteId)
    .order('fecha_creacion', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Error getting reclamos cliente:', error)
    return []
  }

  return reclamos || []
}

async function getCuentaCorriente(clienteId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cuentas_corrientes')
    .select('saldo, limite_credito')
    .eq('cliente_id', clienteId)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error getting cuenta corriente:', error)
    return null
  }

  return data
}

// ===========================================
// SISTEMA DE ESTADO DE REGISTRO DE CLIENTES
// ===========================================

interface RegistroClienteEstado {
  estado: 'esperando_confirmacion' | 'esperando_nombre' | 'esperando_direccion' | 'esperando_zona'
  nombre?: string
  apellido?: string
  direccion?: string
  productos_pendientes: Array<{ codigo: string; cantidad: number }>
  timestamp: number
}

const registroClientesPendientes = new Map<string, RegistroClienteEstado>()

// ===========================================
// SISTEMA DE ESTADO DE CREACIÓN DE RECLAMOS
// ===========================================

interface ReclamoEstado {
  estado: 'esperando_tipo' | 'esperando_descripcion' | 'esperando_pedido'
  tipo_reclamo?: string
  descripcion?: string
  pedido_id?: string
  timestamp: number
}

const reclamosPendientes = new Map<string, ReclamoEstado>()

// NOTA: Maps mantenidos como fallback (state-manager ya tiene lógica de fallback)
// La limpieza de estados expirados ahora se maneja en Supabase con expires_at

// Mapeo de localidades para zonas (usado si no hay data en BD)
const LOCALIDADES_POR_ZONA: Record<string, string[]> = {
  'Monteros': ['Achereal', 'Sta Lucía', 'El Cercado', 'Maldonado', 'Cáceres'],
  'Concepción': ['Río Seco', 'Villa Quinteros', 'Arcadia', 'León Rougés', 'Trinidad'],
}

// Función auxiliar para obtener zonas activas con sus localidades
async function obtenerZonasActivas() {
  const supabase = await createClient()

  // Intentar obtener zonas con localidades desde BD
  const { data: zonasData, error } = await supabase
    .from('zonas')
    .select(`
      id, 
      nombre,
      localidades (nombre)
    `)
    .eq('activo', true)
    .order('nombre', { ascending: true })

  if (error) {
    console.error('Error obteniendo zonas:', error)
    return []
  }

  if (!zonasData) return []

  // Formatear zonas con localidades
  return zonasData.map((zona: any) => {
    // Obtener localidades de la BD o del mapeo temporal
    let localidadesArray: string[] = []

    if (zona.localidades && Array.isArray(zona.localidades) && zona.localidades.length > 0) {
      localidadesArray = zona.localidades.map((l: any) => l.nombre).filter(Boolean)
    } else if (LOCALIDADES_POR_ZONA[zona.nombre]) {
      // Usar mapeo temporal si no hay localidades en BD
      localidadesArray = LOCALIDADES_POR_ZONA[zona.nombre]
    }

    const localidadesTexto = localidadesArray.length > 0
      ? ` (${localidadesArray.join(', ')})`
      : ''

    return {
      id: zona.id,
      nombre: zona.nombre,
      nombre_con_localidades: `${zona.nombre}${localidadesTexto}`
    }
  })
}

// Función para iniciar flujo de registro de cliente
async function iniciarRegistroCliente(phoneNumber: string, productos: Array<{ codigo: string; cantidad: number }>) {
  const estadoInicial: RegistroClienteEstado = {
    estado: 'esperando_nombre',
    productos_pendientes: productos,
    timestamp: Date.now()
  }
  
  await setPendingState(phoneNumber, 'registro', estadoInicial, 60)

  return `👋 *¡Bienvenido a Avícola del Sur!*

No encontramos tu número registrado. Para crear tu presupuesto necesitamos algunos datos.

📝 *Paso 1 de 3*
Por favor, envía tu *nombre y apellido*:

Ejemplo: *Juan Pérez*`
}

// Función para procesar respuesta del flujo de registro
async function procesarRegistroCliente(phoneNumber: string, mensaje: string): Promise<string | null> {
  // Obtener estado desde Supabase (con fallback automático a memoria)
  const estado = await getPendingState<RegistroClienteEstado>(phoneNumber, 'registro')
  if (!estado) return null

  const bodyLower = mensaje.toLowerCase().trim()

  // Permitir cancelar en cualquier momento
  if (bodyLower === 'cancelar' || bodyLower === 'cancel') {
    await deletePendingState(phoneNumber, 'registro')
    return '❌ Registro cancelado.\n\nEscribe *menu* para volver al inicio.'
  }

  switch (estado.estado) {
    case 'esperando_confirmacion': {
      // El cliente vio el resumen de precios y está decidiendo
      if (bodyLower === 'si' || bodyLower === 'sí' || bodyLower === 'confirmar' || bodyLower === 'confirmo' || bodyLower === 'dale') {
        // Ahora sí iniciar el registro
        estado.estado = 'esperando_nombre'
        estado.timestamp = Date.now()
        await setPendingState(phoneNumber, 'registro', estado, 60)

        return `👋 *¡Excelente! Para completar tu pedido necesitamos algunos datos.*

📝 *Paso 1 de 3*
Por favor, envía tu *nombre y apellido*:

Ejemplo: *Juan Pérez*`
      } else if (bodyLower === 'no' || bodyLower === 'cancelar' || bodyLower === 'cancel') {
        await deletePendingState(phoneNumber, 'registro')
        return `👍 Sin problema. Si querés consultar algo más, escribí *precios* para ver la lista o *menu* para ver las opciones.`
      } else {
        // Probablemente quiere modificar el pedido - dejar que Vertex AI procese
        await deletePendingState(phoneNumber, 'registro')
        return null // Devolver null para que se procese normalmente
      }
    }

    case 'esperando_nombre': {
      // Validar que tenga al menos 2 palabras (nombre y apellido)
      const palabras = mensaje.trim().split(/\s+/)
      if (palabras.length < 2) {
        return '❌ Por favor, envía tu nombre completo (nombre y apellido).\n\nEjemplo: *Juan Pérez*'
      }

      estado.nombre = palabras[0]
      estado.apellido = palabras.slice(1).join(' ')
      estado.estado = 'esperando_direccion'
      estado.timestamp = Date.now()
      await setPendingState(phoneNumber, 'registro', estado, 60)

      return `✅ Nombre registrado: *${estado.nombre} ${estado.apellido}*

📝 *Paso 2 de 3*
Ahora envía tu *dirección completa*:

Ejemplo: *Av. Corrientes 1234*`
    }

    case 'esperando_direccion': {
      if (mensaje.trim().length < 5) {
        return '❌ Por favor, envía una dirección válida (mínimo 5 caracteres).'
      }

      estado.direccion = mensaje.trim()
      estado.estado = 'esperando_zona'
      estado.timestamp = Date.now()

      // Obtener zonas
      const zonas = await obtenerZonasActivas()

      if (zonas.length === 0) {
        await deletePendingState(phoneNumber, 'registro')
        return '❌ No hay zonas disponibles en este momento. Por favor contacta con ventas.'
      }

      // Guardar zonas en el estado para validación posterior
      ; (estado as any).zonas = zonas
      await setPendingState(phoneNumber, 'registro', estado, 60)

      let mensajeZonas = `✅ Dirección registrada: *${estado.direccion}*

📝 *Paso 3 de 3*
Selecciona tu *zona* (responde con el número):

`
      zonas.forEach((zona: any, index: number) => {
        mensajeZonas += `${index + 1}. ${zona.nombre_con_localidades}\n`
      })
      mensajeZonas += `\nResponde con el número de tu zona.`

      return mensajeZonas
    }

    case 'esperando_zona': {
      const numero = parseInt(mensaje.trim())
      const zonas = (estado as any).zonas || []

      if (isNaN(numero) || numero < 1 || numero > zonas.length) {
        return `❌ Número inválido. Por favor responde con un número entre 1 y ${zonas.length}.`
      }

      const zonaSeleccionada = zonas[numero - 1]

      // Crear cliente
      const resultado = await crearClienteDesdeBotAction({
        nombre: estado.nombre!,
        apellido: estado.apellido,
        whatsapp: phoneNumber,
        direccion: estado.direccion!,
        zona_id: zonaSeleccionada.id
      })

      if (!resultado.success || !resultado.data) {
        await deletePendingState(phoneNumber, 'registro')
        return `❌ Error al crear tu cuenta: ${resultado.error}\n\nPor favor contacta con ventas.`
      }

      const clienteId = resultado.data.clienteId
      await deletePendingState(phoneNumber, 'registro')

      // Crear presupuesto con los productos pendientes
      const items = []
      for (const prod of estado.productos_pendientes) {
        const producto = await findProductoByCode(prod.codigo)
        if (producto) {
          items.push({
            producto_id: producto.id,
            cantidad_solicitada: prod.cantidad,
            precio_unit_est: producto.precio_venta
          })
        }
      }

      if (items.length === 0) {
        return `✅ *¡Cliente registrado exitosamente!*

Sin embargo, no se pudieron procesar los productos de tu pedido. Por favor intenta crear un nuevo presupuesto escribiendo el código y cantidad.`
      }

      const formData = new FormData()
      // Obtener lista automática del cliente
      let listaPrecioId: string | undefined
      const listasResult = await obtenerListasClienteAction(clienteId)
      if (listasResult.success && listasResult.data && Array.isArray(listasResult.data) && listasResult.data.length > 0) {
        listaPrecioId = listasResult.data[0].lista_precio_id

        // Actualizar precios usando la lista
        if (listaPrecioId) {
          for (let i = 0; i < items.length; i++) {
            const precioResult = await obtenerPrecioProductoAction(listaPrecioId, items[i].producto_id)
            if (precioResult.success && precioResult.data) {
              items[i].precio_unit_est = precioResult.data.precio
            }
          }
        }
      }

      formData.append('cliente_id', clienteId)
      formData.append('observaciones', 'Presupuesto desde WhatsApp - Cliente nuevo')
      if (listaPrecioId) {
        formData.append('lista_precio_id', listaPrecioId)
      }
      formData.append('items', JSON.stringify(items))

      const presupuestoResult = await crearPresupuestoTool({
        cliente_id: clienteId,
        productos: items.map(item => ({
          producto_id: item.producto_id,
          cantidad: item.cantidad_solicitada,
          precio_unitario: item.precio_unit_est
        })),
        observaciones: 'Presupuesto desde WhatsApp - Cliente nuevo',
        lista_precio_id: listaPrecioId,
        zona_id: zonaSeleccionada.id
      })

      if (presupuestoResult.success) {
        const numeroPresupuesto = presupuestoResult.numero_presupuesto
        const totalEstimado = presupuestoResult.total_estimado || 0
        const baseUrl = getBaseUrl()

        // Obtener nombres de productos para el detalle
        const productosDetalle = await Promise.all(
          estado.productos_pendientes.map(async (prod) => {
            const producto = await findProductoByCode(prod.codigo)
            return producto
              ? `${prod.cantidad} ${producto.unidad_medida} - ${producto.nombre}`
              : `${prod.cantidad} - ${prod.codigo}`
          })
        )

        const detalleProductos = productosDetalle.length <= 3
          ? productosDetalle.map((detalle, idx) => `   ${idx + 1}. ${detalle}`).join('\n')
          : `${productosDetalle.length} productos diferentes`

        // Limpiar pending_intent del CustomerContext
        await updateCustomerContext(phoneNumber, { pending_intent: undefined })

        return `✅ *¡Cliente registrado y presupuesto creado exitosamente!*

📋 *Número de presupuesto:*
   ${numeroPresupuesto}

📦 *Productos:*
${detalleProductos}

💰 *Total estimado:* $${totalEstimado.toFixed(2)}

📱 *Seguimiento en línea:*
   ${baseUrl}/seguimiento/presupuesto/${numeroPresupuesto}

⏳ *Próximos pasos:*
   1. Nuestro equipo revisará tu presupuesto
   2. Te contactaremos para confirmar disponibilidad
   3. Coordinaremos la entrega en tu zona

💬 Escribe *menu* para volver al inicio o *estado ${numeroPresupuesto}* para consultar el estado.`
      } else {
        return `✅ *¡Cliente registrado exitosamente!*

Sin embargo, hubo un error al crear el presupuesto: ${presupuestoResult.error || presupuestoResult.message || 'Error desconocido'}

Por favor intenta crear un nuevo presupuesto escribiendo el código y cantidad.`
      }
    }

    default:
      return null
  }
}

// Función para procesar respuesta del flujo de creación de reclamo
async function procesarReclamo(phoneNumber: string, mensaje: string): Promise<string | null> {
  const estado = await getPendingState<ReclamoEstado>(phoneNumber, 'reclamo')
  if (!estado) return null

  const cliente = await findClienteByPhone(phoneNumber)
  if (!cliente) {
    await deletePendingState(phoneNumber, 'reclamo')
    return '❌ No se encontró tu perfil. Por favor contacta con ventas.'
  }

  switch (estado.estado) {
    case 'esperando_tipo': {
      const tiposReclamo: Record<string, string> = {
        '1': 'producto_dañado',
        '2': 'entrega_tardia',
        '3': 'cantidad_erronea',
        '4': 'producto_equivocado',
        '5': 'precio_incorrecto',
        '6': 'calidad_deficiente',
        '7': 'empaque_dañado',
        '8': 'otro'
      }

      const tipoSeleccionado = tiposReclamo[mensaje.trim()]
      if (!tipoSeleccionado) {
        return `❌ Opción inválida. Por favor responde con un número del 1 al 8.`
      }

      estado.tipo_reclamo = tipoSeleccionado
      estado.estado = 'esperando_descripcion'
      estado.timestamp = Date.now()
      await setPendingState(phoneNumber, 'reclamo', estado, 60)

      return `📝 *Paso 2 de 3*

Ahora describe el problema con detalle:

Ejemplo: *"El producto llegó en mal estado, con el empaque roto y algunos productos dañados"*`
    }

    case 'esperando_descripcion': {
      if (mensaje.trim().length < 10) {
        return `❌ La descripción es muy corta. Por favor describe el problema con más detalle (mínimo 10 caracteres).`
      }

      estado.descripcion = mensaje.trim()
      estado.estado = 'esperando_pedido'
      estado.timestamp = Date.now()
      await setPendingState(phoneNumber, 'reclamo', estado, 60)

      return `📦 *Paso 3 de 3* (Opcional)

¿Este reclamo está relacionado con un pedido específico?

Responde con el número de pedido (ej: *PED-20250101-000001*) o escribe *no* para continuar sin pedido.`
    }

    case 'esperando_pedido': {
      let pedidoId: string | undefined

      if (mensaje.toLowerCase() !== 'no' && mensaje.toLowerCase() !== 'n') {
        // Buscar pedido por número
        const supabase = await createClient()
        const numeroPedido = mensaje.trim().toUpperCase()
        const { data: pedido } = await supabase
          .from('pedidos')
          .select('id')
          .eq('numero_pedido', numeroPedido)
          .eq('cliente_id', cliente.id)
          .single()

        if (pedido) {
          pedidoId = pedido.id
        } else {
          return `❌ No se encontró el pedido *${numeroPedido}* asociado a tu cuenta.\n\nEscribe *no* para continuar sin pedido o proporciona otro número de pedido.`
        }
      }

      // Crear reclamo
      const params: any = {
        cliente_id: cliente.id,
        tipo_reclamo: estado.tipo_reclamo!,
        descripcion: estado.descripcion!,
        prioridad: 'media',
        origen: 'whatsapp'
      }

      if (pedidoId) {
        params.pedido_id = pedidoId
      }

      const result = await crearReclamoBotAction(params)

      await deletePendingState(phoneNumber, 'reclamo')

      if (result.success && result.data) {
        // Obtener número de reclamo creado
        const supabase = await createClient()
        const { data: reclamoCreado } = await supabase
          .from('reclamos')
          .select('numero_reclamo')
          .eq('id', result.data.reclamoId)
          .single()

        const numeroReclamo = reclamoCreado?.numero_reclamo || 'REC-' + Date.now()

        return `✅ *¡Reclamo registrado exitosamente!*

📋 Número de reclamo: *${numeroReclamo}*
📝 Tipo: ${estado.tipo_reclamo?.replace('_', ' ')}
📅 Fecha: ${new Date().toLocaleDateString('es-AR')}

Nuestro equipo revisará tu reclamo y te contactará pronto.

Para consultar el estado de tu reclamo:
*reclamo ${numeroReclamo}*`
      } else {
        return `❌ Error al registrar el reclamo: ${result.error || 'Error desconocido'}\n\nPor favor intenta nuevamente o contacta con ventas.`
      }
    }

    default:
      return null
  }
}

// Función para iniciar flujo de creación de reclamo
function iniciarReclamo(phoneNumber: string) {
  reclamosPendientes.set(phoneNumber, {
    estado: 'esperando_tipo',
    timestamp: Date.now()
  })

  return `📋 *Registro de Reclamo*

Por favor selecciona el tipo de reclamo:

1️⃣ Producto dañado
2️⃣ Entrega tardía
3️⃣ Cantidad errónea
4️⃣ Producto equivocado
5️⃣ Precio incorrecto
6️⃣ Calidad deficiente
7️⃣ Empaque dañado
8️⃣ Otro

Responde con el número de la opción (1-8):`
}

// Manejador principal del webhook
async function handleBotpressWebhook(payload: BotpressWebhookPayload): Promise<BotpressResponse> {
  const { intent, parameters } = payload

  try {
    switch (intent) {
      case 'crear_presupuesto':
      case 'tomar_pedido': {
        const { cliente_telefono, productos } = parameters

        if (!cliente_telefono || !productos || !Array.isArray(productos)) {
          return {
            success: false,
            error: 'Faltan parámetros: cliente_telefono y productos son requeridos'
          }
        }

        // Buscar cliente por teléfono
        const cliente = await findClienteByPhone(cliente_telefono)
        if (!cliente) {
          return {
            success: false,
            error: 'Cliente no encontrado. Por favor registre sus datos primero.'
          }
        }

        // Procesar productos
        const items = []
        for (const prod of productos) {
          if (!prod.codigo || !prod.cantidad) continue

          const producto = await findProductoByCode(prod.codigo)
          if (!producto) {
            return {
              success: false,
              error: `Producto con código ${prod.codigo} no encontrado`
            }
          }

          items.push({
            producto_id: producto.id,
            cantidad: prod.cantidad,
            precio_unitario: producto.precio_venta
          })
        }

        if (items.length === 0) {
          return {
            success: false,
            error: 'No se encontraron productos válidos en el pedido'
          }
        }

        // Crear presupuesto
        const formData = new FormData()
        // Obtener lista automática del cliente
        let listaPrecioId: string | undefined
        const listasResult = await obtenerListasClienteAction(cliente.id)
        if (listasResult.success && listasResult.data && Array.isArray(listasResult.data) && listasResult.data.length > 0) {
          listaPrecioId = listasResult.data[0].lista_precio_id

          // Actualizar precios usando la lista
          if (listaPrecioId) {
            for (let i = 0; i < items.length; i++) {
              const precioResult = await obtenerPrecioProductoAction(listaPrecioId, items[i].producto_id)
              if (precioResult.success && precioResult.data) {
                items[i].precio_unitario = precioResult.data.precio
              }
            }
          }
        }

        const result = await crearPresupuestoTool({
          cliente_id: cliente.id,
          productos: items.map(item => ({
            producto_id: item.producto_id,
            cantidad: item.cantidad,
            precio_unitario: item.precio_unitario
          })),
          observaciones: (parameters.observaciones || 'Presupuesto creado desde WhatsApp') as string,
          lista_precio_id: listaPrecioId,
          zona_id: (cliente as any).zona_id
        })

        if (result.success) {
          const numeroPresupuesto = result.numero_presupuesto
          return {
            success: true,
            message: `✅ ¡Presupuesto creado exitosamente!

📋 Número: ${numeroPresupuesto}
🔗 Seguimiento: ${getBaseUrl()}/seguimiento/presupuesto/${numeroPresupuesto}

Nuestro equipo revisará tu presupuesto y te contactará pronto.`,
            data: {
              presupuesto_id: result.presupuesto_id,
              numero_presupuesto: numeroPresupuesto,
              total_estimado: result.total_estimado,
              cliente: cliente.nombre
            }
          }
        } else {
          return {
            success: false,
            error: result.error || result.message || 'Error al crear el presupuesto'
          }
        }
      }

      case 'consultar_pedido':
      case 'estado_pedido': {
        const { pedido_numero } = parameters

        if (!pedido_numero) {
          return {
            success: false,
            error: 'Número de pedido es requerido'
          }
        }

        const pedido = await getPedidoStatus(pedido_numero)
        if (!pedido) {
          return {
            success: false,
            error: 'Pedido no encontrado'
          }
        }

        // Traducir estados a español
        const estadosTraducidos = {
          pendiente: 'Pendiente',
          confirmado: 'Confirmado',
          preparando: 'En preparación',
          enviado: 'Enviado',
          entregado: 'Entregado',
          cancelado: 'Cancelado'
        }

        return {
          success: true,
          message: `Estado del pedido ${pedido.numero_pedido}: ${estadosTraducidos[pedido.estado as keyof typeof estadosTraducidos] || pedido.estado}`,
          data: {
            numero_pedido: pedido.numero_pedido,
            estado: pedido.estado,
            fecha_pedido: pedido.fecha_pedido,
            fecha_entrega_estimada: pedido.fecha_entrega_estimada,
            fecha_entrega_real: pedido.fecha_entrega_real,
            total: pedido.total,
            cliente: (pedido as any).clientes?.nombre
          }
        }
      }

      case 'consultar_deuda': {
        const { cliente_telefono } = parameters
        if (!cliente_telefono) {
          return {
            success: false,
            error: 'Debes enviar el número de teléfono del cliente',
          }
        }

        const cliente = await findClienteByPhone(cliente_telefono)
        if (!cliente) {
          return { success: false, error: 'Cliente no encontrado' }
        }

        const cuenta = await getCuentaCorriente(cliente.id)
        const saldo = cuenta?.saldo ?? 0
        return {
          success: true,
          message: saldo > 0
            ? `Tu saldo pendiente es de $${saldo.toFixed(2)}. Puedes abonar en efectivo al repartidor o solicitar un link de pago.`
            : 'No registramos deudas pendientes. ¡Gracias por mantener tus pagos al día!',
          data: {
            saldo,
            limite_credito: cuenta?.limite_credito ?? 0,
          },
        }
      }

      case 'registrar_reclamo':
      case 'crear_reclamo': {
        const { cliente_telefono, tipo_reclamo, descripcion } = parameters

        if (!cliente_telefono || !tipo_reclamo || !descripcion) {
          return {
            success: false,
            error: 'Faltan parámetros: cliente_telefono, tipo_reclamo y descripcion son requeridos'
          }
        }

        // Buscar cliente por teléfono
        const cliente = await findClienteByPhone(cliente_telefono)
        if (!cliente) {
          return {
            success: false,
            error: 'Cliente no encontrado. Por favor registre sus datos primero.'
          }
        }

        // Crear reclamo
        const result = await crearReclamoBotAction({
          cliente_id: cliente.id,
          tipo_reclamo,
          descripcion,
          pedido_id: parameters.pedido_id,
          prioridad: parameters.prioridad || 'media',
          origen: 'whatsapp'
        })

        if (result.success && result.data) {
          return {
            success: true,
            message: 'Reclamo registrado exitosamente. Nos pondremos en contacto pronto.',
            data: {
              reclamo_id: result.data.reclamoId,
              numero_reclamo: `REC-${Date.now()}`,
              tipo_reclamo,
              cliente: cliente.nombre
            }
          }
        } else {
          return {
            success: false,
            error: result.message || 'Error al registrar el reclamo'
          }
        }
      }

      case 'consultar_productos':
      case 'lista_productos': {
        const supabase = await createClient()

        const { data: productos, error } = await supabase
          .from('productos')
          .select('codigo, nombre, precio_venta, unidad_medida')
          .eq('activo', true)
          .order('nombre')
          .limit(20)

        if (error) {
          return {
            success: false,
            error: 'Error al consultar productos'
          }
        }

        return {
          success: true,
          message: `Encontré ${productos.length} productos disponibles`,
          data: {
            productos: productos.map(p => ({
              codigo: p.codigo,
              nombre: p.nombre,
              precio: p.precio_venta,
              unidad: p.unidad_medida
            }))
          }
        }
      }

      case 'consultar_stock': {
        const { producto_codigo } = parameters

        if (!producto_codigo) {
          return {
            success: false,
            error: 'Código de producto es requerido'
          }
        }

        const producto = await findProductoByCode(producto_codigo)
        if (!producto) {
          return {
            success: false,
            error: 'Producto no encontrado'
          }
        }

        // Obtener stock disponible
        const supabase = await createClient()
        const { data: stock, error } = await supabase
          .rpc('get_stock_disponible', { producto_id: producto.id })

        if (error) {
          return {
            success: false,
            error: 'Error al consultar stock'
          }
        }

        return {
          success: true,
          message: `Stock disponible de ${producto.nombre}: ${stock || 0} ${producto.unidad_medida || 'unidades'}`,
          data: {
            producto: producto.nombre,
            stock_disponible: stock || 0,
            unidad: producto.unidad_medida || 'unidades'
          }
        }
      }

      default:
        return {
          success: false,
          error: `Intención "${intent}" no reconocida`
        }
    }
  } catch (error: any) {
    console.error('Error en webhook de Botpress:', error)
    return {
      success: false,
      error: 'Error interno del servidor'
    }
  }
}

// Store temporal para confirmaciones de pedido (en producción usar Redis o DB)
const pendingConfirmations = new Map<string, {
  productos: Array<{ codigo: string; cantidad: number }>;
  timestamp: number;
}>()

// Función auxiliar para obtener URL base del sistema
function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  // Fallback para desarrollo local
  return 'https://avicoladelsur.vercel.app'
}

type WhatsAppInboundMessage = {
  phoneNumber: string
  body: string
}

function normalizeInboundPhoneNumber(phone: string): string {
  let normalized = (phone || '').trim()

  if (!normalized) {
    return ''
  }

  if (normalized.startsWith('whatsapp:')) {
    normalized = normalized.replace(/^whatsapp:/, '')
  }

  normalized = normalized.replace(/[^\d+]/g, '')

  if (!normalized) {
    return ''
  }

  if (normalized.startsWith('+')) {
    return normalized
  }

  if (normalized.startsWith('0')) {
    normalized = normalized.substring(1)
  }

  return `+${normalized}`
}

function createWhatsAppFormData(phoneNumber: string, body: string): FormData {
  const formData = new FormData()
  formData.set('Body', body)
  formData.set('From', phoneNumber.startsWith('whatsapp:') ? phoneNumber : `whatsapp:${phoneNumber}`)
  return formData
}

function extractInboundMessageText(message: any): string | null {
  if (!message || typeof message !== 'object') {
    return null
  }

  if (message.type === 'reaction') {
    return null
  }

  const textBody = message.text?.body
  if (typeof textBody === 'string' && textBody.trim()) {
    return textBody.trim()
  }

  const content = message.content
  if (typeof content === 'string' && content.trim()) {
    return content.trim()
  }

  const buttonReply = message.interactive?.button_reply
  if (typeof buttonReply?.title === 'string' && buttonReply.title.trim()) {
    return buttonReply.title.trim()
  }

  const listReply = message.interactive?.list_reply
  if (typeof listReply?.title === 'string' && listReply.title.trim()) {
    return listReply.title.trim()
  }

  const transcript = message.kapso?.transcript?.text
  if (typeof transcript === 'string' && transcript.trim()) {
    return transcript.trim()
  }

  const kapsoContent = message.kapso?.content
  if (typeof kapsoContent === 'string' && kapsoContent.trim()) {
    return kapsoContent.trim()
  }

  const location = message.location
  if (location && typeof location === 'object') {
    const parts = [
      location.name,
      location.address,
      location.latitude !== undefined ? `Lat: ${location.latitude}` : null,
      location.longitude !== undefined ? `Lng: ${location.longitude}` : null,
    ].filter(Boolean)

    if (parts.length > 0) {
      return parts.join(' | ')
    }
  }

  return null
}

function isMetaWebhookPayload(payload: any): boolean {
  return Boolean(
    payload &&
      typeof payload === 'object' &&
      (payload.object === 'whatsapp_business_account' || Array.isArray(payload.entry))
  )
}

function isKapsoWhatsAppPayload(payload: any): boolean {
  return Boolean(
    payload &&
      typeof payload === 'object' &&
      (typeof payload.event === 'string' ||
        payload.message ||
        payload.data ||
        payload.phone_number_id ||
        payload.conversation)
  )
}

function getWebhookSecretForPayload(_payload: any): string | null {
  return (
    process.env.KAPSO_WHATSAPP_WEBHOOK_SECRET ||
    process.env.KAPSO_WEBHOOK_SECRET ||
    process.env.WHATSAPP_META_APP_SECRET ||
    null
  )
}

function getWebhookSignatureHeader(headers: Headers): string | null {
  return (
    headers.get('x-webhook-signature') ||
    headers.get('x-hub-signature-256') ||
    headers.get('X-Webhook-Signature') ||
    headers.get('X-Hub-Signature-256')
  )
}

function verifyWhatsAppWebhookSignature(rawBody: string, headers: Headers, payload: any): boolean {
  const secret = getWebhookSecretForPayload(payload)
  const signatureHeader = getWebhookSignatureHeader(headers)

  if (!secret || !signatureHeader) {
    return true
  }

  return verifySignature({
    appSecret: secret,
    rawBody,
    signatureHeader,
  })
}

function extractInboundWhatsAppMessages(payload: any): WhatsAppInboundMessage[] {
  if (!payload) {
    return []
  }

  if (Array.isArray(payload)) {
    return payload.flatMap((item) => extractInboundWhatsAppMessages(item))
  }

  if (isMetaWebhookPayload(payload)) {
    const normalized = normalizeWebhook(payload)
    const messages = Array.isArray(normalized.messages) ? normalized.messages : []

    return messages.flatMap((message: any) => {
      if (message?.kapso?.direction === 'outbound') {
        return []
      }

      const body = extractInboundMessageText(message)
      const phoneNumber = normalizeInboundPhoneNumber(
        message?.from || message?.phone_number || normalized.displayPhoneNumber || ''
      )

      if (!body || !phoneNumber) {
        return []
      }

      return [{ phoneNumber, body }]
    })
  }

  if (!isKapsoWhatsAppPayload(payload)) {
    return []
  }

  const event = typeof payload.event === 'string' ? payload.event : ''
  if (event && event !== 'whatsapp.message.received' && event !== 'message.received') {
    return []
  }

  const data = payload.data && typeof payload.data === 'object' ? payload.data : payload
  const message = data.message || data
  const conversation = data.conversation || payload.conversation || {}

  if (message?.kapso?.direction === 'outbound' || message?.direction === 'outbound') {
    return []
  }

  const body = extractInboundMessageText(message)
  const phoneNumber = normalizeInboundPhoneNumber(
    conversation.phone_number ||
      conversation.phoneNumber ||
      message?.from ||
      data.phone_number ||
      payload.phone_number ||
      ''
  )

  if (!body || !phoneNumber) {
    return []
  }

  return [{ phoneNumber, body }]
}

async function handleKapsoWebhookPayload(
  payload: any,
  source: 'kapso' | 'meta'
): Promise<NextResponse> {
  const inboundMessages = extractInboundWhatsAppMessages(payload)

  if (inboundMessages.length === 0) {
    return new NextResponse('OK', { status: 200 })
  }

  for (const inboundMessage of inboundMessages) {
    await handleTwilioWebhook(createWhatsAppFormData(inboundMessage.phoneNumber, inboundMessage.body), source)
  }

  return new NextResponse('OK', { status: 200 })
}

/**
 * Función auxiliar para enviar mensajes con detección automática de proveedor
 * Intenta usar botones si Meta está disponible, sino usa texto simple
 */
async function sendBotResponse(phoneNumber: string, message: string, options?: {
  buttons?: Array<{ id: string; title: string }>
  list?: { buttonText: string; sections: MetaListSection[] }
  footer?: string
}): Promise<void> {
  const provider = getWhatsAppProvider()
  const useButtons = provider !== 'twilio' && isWhatsAppMetaAvailable() && (options?.buttons || options?.list)

  if (useButtons) {
    const result = await sendWhatsAppMessage({
      to: phoneNumber,
      text: message,
      buttons: options?.buttons,
      list: options?.list,
      footer: options?.footer,
    })

    if (!result.success) {
      console.error('[Bot] Error enviando mensaje con botones, usando fallback:', result.error)
      // Fallback a texto simple
      await sendBotResponseText(phoneNumber, message)
    }
  } else {
    await sendBotResponseText(phoneNumber, message)
  }
}

/**
 * Envía respuesta de texto simple (Twilio o fallback)
 */
async function sendBotResponseText(phoneNumber: string, message: string): Promise<void> {
  const provider = getWhatsAppProvider()

  // Guardar mensaje outgoing en Supabase
  await saveBotMessage(phoneNumber, message, 'outgoing')

  if (provider !== 'twilio') {
    const result = await sendWhatsAppMessage({
      to: phoneNumber,
      text: message,
    })
    if (!result.success) {
      console.error('[Bot] Error enviando mensaje de texto:', result.error)
    }
  }
}

// ===========================================
// CÓDIGO DE TWILIO (MANTENIDO COMO RESPALDO)
// ===========================================
// NOTA: Este código se mantiene comentado/activo como respaldo durante la migración gradual
// Una vez que Meta esté completamente funcional, se puede deshabilitar cambiando WHATSAPP_PROVIDER

// Función para manejar mensajes directos de Twilio
async function handleTwilioWebhook(formData: FormData, source: 'twilio' | 'kapso' | 'meta' = 'twilio') {
  const body = formData.get('Body')?.toString().trim() || ''
  const from = formData.get('From')?.toString() || ''

  // Extraer el número de teléfono (Twilio envía: whatsapp:+1234567890)
  const phoneNumber = from.replace('whatsapp:', '')

  console.log(`[Bot] Mensaje recibido (${source}):`, { from: phoneNumber, body })

  // Buscar cliente para personalizar mensajes
  const cliente = await findClienteByPhone(phoneNumber)
  const nombreCliente = cliente?.nombre || ''
  const clienteId = cliente?.id

  // Guardar mensaje incoming en Supabase
  await saveBotMessage(phoneNumber, body, 'incoming', clienteId)

  let responseMessage = ''

  try {
    const bodyLower = body.toLowerCase()

    async function mapMessageForVertex(raw: string): Promise<string> {
      const v = (raw || '').trim()
      if (!v) return v
      const vLower = v.toLowerCase()

      // Manejar respuesta a upselling (Tarea 9)
      if (vLower === 'si' || vLower === 'sí' || vLower === 'dale' || vLower === 'bueno' || vLower === 'agregalo' || vLower === 'sumalo') {
        const session = await getOrCreateSession(phoneNumber)
        if (session.customerContext?.upselling_product_id) {
          // Limpiar el upselling_product_id para no procesarlo dos veces
          await updateCustomerContext(phoneNumber, { upselling_product_id: undefined })
          return 'Sí, agregá el producto que me sugeriste al presupuesto'
        }
      }

      // Compatibilidad con el viejo menú numérico
      if (v === '1' || vLower === 'opcion 1') return 'Quiero ver productos disponibles'
      if (v === '2' || vLower === 'opcion 2') return 'Quiero hacer un pedido / presupuesto'
      if (v === '3' || vLower === 'opcion 3') return 'Quiero ver el estado de mis pedidos'
      if (v === '4' || vLower === 'opcion 4') return 'Quiero hacer un reclamo'
      if (v === '5' || vLower === 'opcion 5') return 'Quiero consultar mi saldo'

      // Compatibilidad con IDs de botones
      if (v === 'btn_menu') return 'Muéstrame el menú principal con todas las opciones disponibles'
      if (v === 'btn_productos') return 'Quiero ver productos disponibles'
      if (v === 'btn_presupuesto') return 'Quiero hacer un presupuesto'
      if (v === 'btn_estado') return 'Quiero consultar el estado de mis pedidos'
      if (v === 'btn_confirmar_si') return 'Sí, confirmo el presupuesto'
      if (v === 'btn_confirmar_no') return 'No, cancelo el presupuesto'

      // Comandos de menú y ayuda
      if (vLower.includes('hola') || vLower.includes('ayuda') || vLower.includes('menu') || vLower.includes('inicio')) {
        return 'Muéstrame el menú principal con todas las opciones disponibles'
      }

      // Comandos de productos/catálogo
      if (vLower.includes('productos') || vLower.includes('catalogo') || vLower.includes('lista')) {
        return 'Quiero ver el catálogo completo de productos disponibles'
      }

      // Comandos de saldo/deuda
      if (vLower.includes('deuda') || vLower.includes('saldo pendiente') || vLower.includes('cuanto debo')) {
        return 'Quiero consultar mi saldo pendiente'
      }

      // Comandos de estado de pedidos
      if (vLower.includes('estado') && !vLower.includes('estado de mi pedido')) {
        return 'Quiero consultar el estado de mis pedidos'
      }

      // Comandos de reclamos
      if (vLower.includes('mis reclamos') || vLower === 'reclamos') {
        return 'Quiero ver mis reclamos registrados'
      }

      // Selección de producto desde lista (prod_CODIGO)
      if (v.startsWith('prod_')) {
        const codigo = v.replace('prod_', '').toUpperCase()
        return `Quiero información sobre el producto ${codigo}`
      }

      // Selección de pedido desde lista (pedido_NUMERO)
      if (v.startsWith('pedido_')) {
        const numeroPedido = v.replace('pedido_', '').toUpperCase()
        return `Quiero consultar el estado del pedido ${numeroPedido}`
      }

      return v
    }

    const pending = await getPendingState<ConfirmacionEstadoImport>(phoneNumber, 'confirmacion')
    const isPendingConfirmationReply = Boolean(
      pending &&
      (
        bodyLower === 'si' ||
        bodyLower === 'sí' ||
        bodyLower === 'confirmar' ||
        bodyLower === 'confirmo' ||
        bodyLower === 'no' ||
        bodyLower === 'cancelar' ||
        bodyLower === 'cancel'
      )
    )

    let vertexHandled = false

    // Verificar si hay un registro en proceso (antes de cualquier otro comando)
    const registroEnProceso = registroClientesPendientes.get(phoneNumber)
    if (registroEnProceso) {
      // Permitir cancelar o ver menú incluso durante registro
      if (bodyLower === 'cancelar' || bodyLower === 'cancel' || bodyLower.includes('menu') || bodyLower.includes('ayuda')) {
        // Continuar con el flujo normal
      } else {
        // Procesar respuesta del registro
        const resultadoRegistro = await procesarRegistroCliente(phoneNumber, body)
        if (resultadoRegistro) {
          responseMessage = resultadoRegistro
          // Retornar respuesta inmediatamente
          return new Response(
            `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${responseMessage.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Message>
</Response>`,
            {
              status: 200,
              headers: {
                'Content-Type': 'text/xml',
              },
            }
          )
        }
      }
    }

    // Verificar si hay un reclamo en proceso
    const reclamoEnProceso = reclamosPendientes.get(phoneNumber)
    if (reclamoEnProceso) {
      // Permitir cancelar o ver menú incluso durante creación de reclamo
      if (bodyLower === 'cancelar' || bodyLower === 'cancel' || bodyLower.includes('menu') || bodyLower.includes('ayuda')) {
        reclamosPendientes.delete(phoneNumber)
        // Continuar con el flujo normal
      } else {
        // Procesar respuesta del reclamo
        const resultadoReclamo = await procesarReclamo(phoneNumber, body)
        if (resultadoReclamo) {
          responseMessage = resultadoReclamo
          // Retornar respuesta inmediatamente
          return new Response(
            `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${responseMessage.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Message>
</Response>`,
            {
              status: 200,
              headers: {
                'Content-Type': 'text/xml',
              },
            }
          )
        }
      }
    }

    // Intentar usar Vertex AI Agent con tools PRIMERO (antes de comandos hardcodeados)
    // Excepciones: flujos stateful (registro/reclamo ya manejados arriba) y confirmaciones pendientes
    const clienteId = cliente?.id

    const shouldSkipVertex =
      isPendingConfirmationReply ||
      body.startsWith('prod_') ||
      body.startsWith('pedido_')

    if (!shouldSkipVertex) {
      try {
        const vertexInput = await mapMessageForVertex(body)
        const vertexResponse = await processMessageWithTools(phoneNumber, vertexInput, clienteId)
        responseMessage = vertexResponse.text || '[Vertex AI devolvió respuesta vacía]'
        
        // Guardar contexto de upselling si existe (Tarea 9)
        if (vertexResponse.context?.upselling_product_id) {
          await updateCustomerContext(phoneNumber, {
            upselling_product_id: vertexResponse.context.upselling_product_id
          })
        }
        
        vertexHandled = true
      } catch (vertexError) {
        console.error('[Vertex AI] Error, usando fallback:', vertexError)

        // Fallback a interpretación IA actual
        const interpretacionIA = await interpretarMensajeConIA(body)

        if (interpretacionIA.success && interpretacionIA.interpretacion) {
          const { intencion, productos, respuestaSugerida, confianza } = interpretacionIA.interpretacion

          // Si la IA tiene alta confianza y detectó un pedido
          if (intencion === 'pedido' && productos.length > 0 && confianza >= 60) {
            // Buscar cliente
            const cliente = await findClienteByPhone(phoneNumber)

            if (!cliente) {
              // Cliente no registrado: mostrar resumen del pedido detectado y preguntar si confirma
              // El registro se pedirá SOLO cuando confirme que quiere comprar
              const supabase = await createClient()

              // Buscar precios de los productos detectados
              const productosConPrecios: Array<{ nombre: string; cantidad: number; precio: number; unidad: string }> = []

              for (const prod of productos) {
                const { data: productoEncontrado } = await supabase
                  .from('productos')
                  .select('nombre, precio_venta, unidad_medida')
                  .ilike('nombre', `%${prod.nombre}%`)
                  .eq('activo', true)
                  .limit(1)
                  .single()

                if (productoEncontrado) {
                  productosConPrecios.push({
                    nombre: productoEncontrado.nombre,
                    cantidad: prod.cantidad,
                    precio: productoEncontrado.precio_venta || 0,
                    unidad: prod.unidad || 'kg'
                  })
                }
              }

              if (productosConPrecios.length > 0) {
                const totalEstimado = productosConPrecios.reduce((acc, p) => acc + (p.precio * p.cantidad), 0)
                const detallePedido = productosConPrecios
                  .map(p => `• ${p.cantidad} ${p.unidad} de ${p.nombre}: $${(p.precio * p.cantidad).toLocaleString('es-AR')}`)
                  .join('\n')

                // Guardar productos en memoria para cuando confirme
                const productosParaRegistro = productos.map((p: any) => ({
                  codigo: p.nombre.toUpperCase().replace(/\s+/g, ''),
                  cantidad: p.cantidad,
                  nombre: p.nombre
                }))

                // Guardar en estado temporal local (se usará si confirma)
                registroClientesPendientes.set(phoneNumber, {
                  estado: 'esperando_confirmacion' as any,
                  productos_pendientes: productosParaRegistro,
                  timestamp: Date.now()
                })

                // TAMBIÉN guardar en sesión persistente (CustomerContext)
                await updateCustomerContext(phoneNumber, {
                  pending_intent: {
                    type: 'pedido',
                    productos: productosParaRegistro,
                    timestamp: Date.now()
                  }
                })

                responseMessage = `📋 *Resumen de tu pedido:*

${detallePedido}

💰 *Total estimado:* $${totalEstimado.toLocaleString('es-AR')}

¿Querés confirmar este pedido? Respondé *SI* para continuar.

💡 Si querés agregar o cambiar algo, simplemente escribilo (ej: "agregá 2 kg de ala").`
              } else {
                // No se encontraron productos válidos
                responseMessage = `🤔 Entendí que querés: ${productos.map((p: any) => `${p.cantidad} ${p.unidad || 'kg'} de ${p.nombre}`).join(', ')}

Pero no encontré esos productos en nuestro catálogo.

📋 Escribí *precios* para ver la lista de productos disponibles.`
              }
            } else {
              // Crear presupuesto con productos detectados
              const items: any[] = []
              const productosNoEncontrados: string[] = []

              for (const prod of productos) {
                // Buscar producto por nombre aproximado
                const supabase = await createClient()
                const { data: productoEncontrado } = await supabase
                  .from('productos')
                  .select('id, codigo, nombre, precio_venta, unidad_medida')
                  .ilike('nombre', `%${prod.nombre}%`)
                  .eq('activo', true)
                  .limit(1)
                  .single()

                if (productoEncontrado) {
                  items.push({
                    producto_id: productoEncontrado.id,
                    cantidad_solicitada: prod.cantidad,
                    precio_unit_est: productoEncontrado.precio_venta
                  })
                } else {
                  productosNoEncontrados.push(prod.nombre)
                }
              }

              if (items.length > 0) {
                // Crear presupuesto
                const presupuestoResult = await crearPresupuestoTool({
                  cliente_id: cliente.id,
                  productos: items.map(p => ({
                    producto_id: p.producto_id,
                    cantidad: p.cantidad_solicitada,
                    precio_unitario: p.precio_unit_est
                  })),
                  observaciones: 'Presupuesto desde WhatsApp (IA)',
                  zona_id: (cliente as any).zona_id
                })

                if (presupuestoResult.success) {
                  const numeroPresupuesto = presupuestoResult.numero_presupuesto
                  responseMessage = `✅ *¡Entendido, ${nombreCliente || 'cliente'}!*

📋 Presupuesto creado: *${numeroPresupuesto}*

${productosNoEncontrados.length > 0 ? `⚠️ No encontré: ${productosNoEncontrados.join(', ')}\n\n` : ''}💡 Para consultar: *estado ${numeroPresupuesto}*`
                } else {
                  responseMessage = respuestaSugerida
                }
              } else {
                responseMessage = `🤔 Entendí que querés pedir: ${productos.map((p: any) => `${p.cantidad} ${p.unidad} de ${p.nombre}`).join(', ')}

Pero no encontré esos productos. ¿Podés escribir el código del producto?

Ejemplo: *POLLO001 5*`
              }
            }
          }
          // Respuesta de la IA para otros casos
          else if (respuestaSugerida) {
            responseMessage = respuestaSugerida

            const isGreetingOrHelp =
              bodyLower.includes('hola') ||
              bodyLower.includes('ayuda') ||
              bodyLower.includes('menu') ||
              bodyLower.includes('inicio') ||
              body === 'btn_menu'

            // Si la IA ya respondió a un saludo/ayuda, no pisar con menú hardcodeado
            if (isGreetingOrHelp) {
              vertexHandled = true
            }
          }
        }
      }
    }

    if (vertexHandled) {
      // Respuesta ya resuelta por Vertex, no ejecutar menú/flows hardcodeados
    }
    // Comando: Hola / Ayuda
    else if (bodyLower.includes('hola') || bodyLower.includes('ayuda') || bodyLower.includes('menu') || bodyLower.includes('inicio') || body === 'btn_menu') {
      const saludo = nombreCliente ? `¡Hola ${nombreCliente}! 👋` : '¡Hola! 👋'
      const menuText = `${saludo} ¿En qué puedo ayudarte hoy?

Puedo:
• Crearte un presupuesto
• Consultar stock de productos
• Ver el estado de tus pedidos
• Consultar tu saldo pendiente
• Registrar un reclamo

Escribí lo que necesitás y te ayudo.`

      // Si Meta está disponible, usar botones; sino texto
      if (isWhatsAppMetaAvailable()) {
        // Enviar mensaje con botones y retornar respuesta vacía (el mensaje ya se envió)
        await sendBotResponse(phoneNumber, menuText, {
          buttons: [
            { id: 'btn_productos', title: '📦 Ver Productos' },
            { id: 'btn_presupuesto', title: '🛒 Crear Presupuesto' },
            { id: 'btn_estado', title: '📊 Consultar Estado' },
          ],
          footer: 'Escribí lo que necesitás, te ayudo.',
        })
        responseMessage = '' // Ya se envió con botones
      } else {
        // Fallback a texto tradicional
        responseMessage = `${menuText}

💡 *Ejemplos:*
   "Quiero 5 kg de pechuga"
   "¿Qué stock tienen?"
   "Estado de mi pedido"
   "¿Cuánto me debe?"
   "Tengo un problema con mi pedido"`
      }
    }
    // Manejar selección de producto desde lista (prod_CODIGO)
    else if (body.startsWith('prod_')) {
      const codigo = body.replace('prod_', '').toUpperCase()
      responseMessage = `📦 *Producto: ${codigo}*

Para ordenar este producto, escribe:
*${codigo} [CANTIDAD]*

Ejemplo: *${codigo} 5*`
    }
    // Manejar selección de pedido desde lista (pedido_NUMERO)
    else if (body.startsWith('pedido_')) {
      const numeroPedido = body.replace('pedido_', '').toUpperCase()
      const pedido = await getPedidoStatus(numeroPedido)

      if (!pedido) {
        responseMessage = `❌ Pedido *${numeroPedido}* no encontrado.`
      } else {
        const estadosEmoji: Record<string, string> = {
          pendiente: '⏳',
          confirmado: '✅',
          preparando: '📦',
          enviado: '🚚',
          entregado: '🎉',
          cancelado: '❌'
        }

        const estadosTexto: Record<string, string> = {
          pendiente: 'Pendiente de confirmación',
          confirmado: 'Confirmado',
          preparando: 'En preparación',
          enviado: 'En camino',
          entregado: 'Entregado',
          cancelado: 'Cancelado'
        }

        const emoji = estadosEmoji[pedido.estado] || '📋'
        const estadoTexto = estadosTexto[pedido.estado] || pedido.estado

        responseMessage = `${emoji} *Estado de Pedido*

📋 Número: *${pedido.numero_pedido}*
🔄 Estado: *${estadoTexto}*
📅 Fecha: ${new Date(pedido.fecha_pedido).toLocaleDateString('es-AR')}
💰 Total: $${pedido.total}`

        if (pedido.fecha_entrega_estimada) {
          responseMessage += `\n🚚 Entrega estimada: ${new Date(pedido.fecha_entrega_estimada).toLocaleDateString('es-AR')}`
        }

        if (pedido.fecha_entrega_real) {
          responseMessage += `\n✅ Entregado: ${new Date(pedido.fecha_entrega_real).toLocaleDateString('es-AR')}`
        }
      }
    }
    // Comando: Opciones del menú numérico o botones
    else if (body === '1' || bodyLower === 'opcion 1' || body === 'btn_productos') {
      // Consultar productos directamente con stock disponible desde la vista
      // Mostrar TODOS los productos activos, incluso sin stock
      const supabase = await createClient()

      const { data: productos, error } = await supabase
        .from('productos_con_stock')
        .select(`
          id,
          codigo, 
          nombre, 
          precio_venta, 
          unidad_medida,
          categoria,
          stock_disponible
        `)
        .order('categoria')
        .order('nombre')

      if (error || !productos || productos.length === 0) {
        responseMessage = 'No hay productos disponibles en este momento.'
      } else {
        const categorias = [...new Set(productos.map(p => p.categoria || 'Otros'))]

        if (isWhatsAppMetaAvailable() && categorias.length > 1) {
          // Usar List Message para navegar por categorías
          const sections: MetaListSection[] = categorias.map(categoria => ({
            title: categoria,
            rows: productos
              .filter(p => (p.categoria || 'Otros') === categoria)
              .slice(0, 10) // Máximo 10 por sección
              .map(p => {
                const stock = Number(p.stock_disponible) || 0
                const stockEmoji = stock > 50 ? '🟢' : stock > 20 ? '🟡' : stock > 0 ? '🔴' : '⚪'
                return {
                  id: `prod_${p.codigo}`,
                  title: `${stockEmoji} ${p.nombre}`,
                  description: `$${p.precio_venta}/${p.unidad_medida} | Stock: ${stock > 0 ? Math.floor(stock) : 'Sin stock'}`,
                }
              }),
          }))

          await sendBotResponse(phoneNumber, `📦 *Catálogo de Productos*\n\nSelecciona una categoría para ver productos:`, {
            list: {
              buttonText: 'Ver Categorías',
              sections,
            },
            footer: 'Para ordenar: [CODIGO] [CANTIDAD]',
          })
          responseMessage = ''
        } else {
          // Fallback a texto tradicional
          responseMessage = `📦 *Catálogo de Productos*\n\n`

          categorias.forEach(categoria => {
            responseMessage += `*${categoria}:*\n`
            productos
              .filter(p => (p.categoria || 'Otros') === categoria)
              .forEach((p) => {
                const stock = Number(p.stock_disponible) || 0
                const stockEmoji = stock > 50 ? '🟢' : stock > 20 ? '🟡' : stock > 0 ? '🔴' : '⚪'
                responseMessage += `${stockEmoji} *[${p.codigo}]* ${p.nombre}\n`
                if (stock > 0) {
                  responseMessage += `   💰 $${p.precio_venta}/${p.unidad_medida} | Stock: ${Math.floor(stock)}\n\n`
                } else {
                  responseMessage += `   💰 $${p.precio_venta}/${p.unidad_medida} | Stock: Sin stock disponible\n\n`
                }
              })
          })

          responseMessage += `\n💬 Para ordenar responde:\n*[CODIGO] [CANTIDAD]*\nEj: POLLO001 5`
        }
      }
    }
    else if (body === '2' || bodyLower === 'opcion 2' || body === 'btn_presupuesto') {
      const presupuestoText = `🛒 *Crear Presupuesto*

Para crear un presupuesto escribe:
*[CODIGO] [CANTIDAD]*

Ejemplo:
*POLLO001 5*`

      if (isWhatsAppMetaAvailable()) {
        await sendBotResponse(phoneNumber, presupuestoText, {
          buttons: [
            { id: 'btn_productos', title: '📦 Ver Productos' },
            { id: 'btn_menu', title: '🏠 Menú Principal' },
          ],
          footer: 'Escribe *1* o *productos* para ver el catálogo',
        })
        responseMessage = ''
      } else {
        responseMessage = `${presupuestoText}

Para ver los productos disponibles, escribe *1* o *productos*`
      }
    }
    else if (body === '3' || bodyLower === 'opcion 3' || body === 'btn_estado') {
      const cliente = await findClienteByPhone(phoneNumber)
      if (!cliente) {
        responseMessage = '❌ No encontramos tu cuenta. Comunícate con un asesor.'
      } else {
        // Obtener pedidos del cliente
        const supabase = await createClient()
        const { data: pedidos } = await supabase
          .from('pedidos')
          .select('numero_pedido, estado, fecha_pedido, total')
          .eq('cliente_id', cliente.id)
          .order('fecha_pedido', { ascending: false })
          .limit(5)

        if (!pedidos || pedidos.length === 0) {
          responseMessage = '📊 No tienes pedidos registrados.\n\nCrea tu primer presupuesto escribiendo el código y cantidad.'
        } else {
          let estadoText = `📊 *Estado de tus Pedidos*\n\n`
          pedidos.forEach((p, idx) => {
            const estadoEmoji = p.estado === 'entregado' ? '✅' : p.estado === 'enviado' ? '🚛' : p.estado === 'confirmado' ? '⏳' : '📋'
            estadoText += `${estadoEmoji} *${p.numero_pedido}*\n`
            estadoText += `   Estado: ${p.estado}\n`
            estadoText += `   Fecha: ${new Date(p.fecha_pedido).toLocaleDateString('es-AR')}\n`
            estadoText += `   Total: $${Number(p.total).toFixed(2)}\n\n`
          })

          if (isWhatsAppMetaAvailable() && pedidos.length > 0) {
            // Crear lista con pedidos
            const sections: MetaListSection[] = [{
              title: 'Tus Pedidos',
              rows: pedidos.slice(0, 10).map(p => ({
                id: `pedido_${p.numero_pedido}`,
                title: `${p.numero_pedido}`,
                description: `${p.estado} - $${Number(p.total).toFixed(2)}`,
              })),
            }]

            await sendBotResponse(phoneNumber, estadoText, {
              list: {
                buttonText: 'Ver Detalles',
                sections,
              },
              footer: 'Selecciona un pedido para ver detalles',
            })
            responseMessage = ''
          } else {
            estadoText += `💬 Para ver detalles de un pedido, escribe:\n*estado [NUMERO_PEDIDO]*\nEj: estado PED-20250101-000001`
            responseMessage = estadoText
          }
        }
      }
    }
    else if (body === '4' || bodyLower === 'opcion 4') {
      const cliente = await findClienteByPhone(phoneNumber)
      if (!cliente) {
        responseMessage = '❌ No se encontró tu perfil. Por favor contacta con ventas para registrarte.'
      } else {
        responseMessage = iniciarReclamo(phoneNumber)
      }
    }
    else if (body === '5' || bodyLower === 'opcion 5') {
      const cliente = await findClienteByPhone(phoneNumber)
      if (!cliente) {
        responseMessage = '❌ No encontramos tu cuenta. Comunícate con un asesor.'
      } else {
        const cuenta = await getCuentaCorriente(cliente.id)
        const saldo = Number(cuenta?.saldo || 0)
        if (saldo > 0) {
          responseMessage = `📄 *Estado de cuenta*\n\nCliente: ${cliente.nombre}\nSaldo pendiente: *$${saldo.toFixed(
            2
          )}*\n\nPuedes abonar al repartidor o solicitar un link de pago respondiendo *pagar*.`
        } else {
          responseMessage = '✅ No registras deudas pendientes. ¡Gracias por estar al día!'
        }
      }
    }
    // Confirmación de pedido (acepta respuestas de botones también)
    else if (bodyLower === 'si' || bodyLower === 'sí' || bodyLower === 'confirmar' || bodyLower === 'confirmo' || body === 'btn_confirmar_si') {
      const pending = await getPendingState<ConfirmacionEstadoImport>(phoneNumber, 'confirmacion')

      if (!pending) {
        responseMessage = 'No tienes ningún presupuesto pendiente de confirmación.\n\nEscribe el código y cantidad para crear un presupuesto.'
      } else {
        // Verificar que no haya expirado (5 minutos) - aunque Supabase ya maneja expiración
        if (Date.now() - pending.timestamp > 5 * 60 * 1000) {
          await deletePendingState(phoneNumber, 'confirmacion')
          responseMessage = '⏰ La confirmación ha expirado.\n\nVuelve a hacer tu pedido.'
        } else {
          const cliente = await findClienteByPhone(phoneNumber)
          if (!cliente) {
            responseMessage = '❌ Error: Cliente no encontrado.'
          } else {
            // Procesar todos los productos
            const items = []
            let totalGeneral = 0

            for (const prod of pending.productos) {
              const producto = await findProductoByCode(prod.codigo)
              if (producto) {
                items.push({
                  producto_id: producto.id,
                  cantidad: prod.cantidad,
                  precio_unitario: producto.precio_venta
                })
                totalGeneral += prod.cantidad * producto.precio_venta
              }
            }

            // Obtener lista automática del cliente (primera lista asignada)
            let listaPrecioId: string | undefined
            const listasResult = await obtenerListasClienteAction(cliente.id)
            if (listasResult.success && listasResult.data && Array.isArray(listasResult.data) && listasResult.data.length > 0) {
              const primeraListaPrecioId = listasResult.data[0].lista_precio_id
              if (primeraListaPrecioId) {
                listaPrecioId = primeraListaPrecioId

                // Actualizar precios usando la lista de precios
                for (let i = 0; i < items.length; i++) {
                  const precioResult = await obtenerPrecioProductoAction(primeraListaPrecioId, items[i].producto_id)
                  if (precioResult.success && precioResult.data) {
                    items[i].precio_unitario = precioResult.data.precio
                  }
                }
              }
            }

            // Crear presupuesto
            const formData = new FormData()
            formData.append('cliente_id', cliente.id)
            formData.append('observaciones', 'Presupuesto desde WhatsApp')
            if (listaPrecioId) {
              formData.append('lista_precio_id', listaPrecioId)
            }
            formData.append('items', JSON.stringify(items.map(item => ({
              producto_id: item.producto_id,
              cantidad_solicitada: item.cantidad,
              precio_unit_est: item.precio_unitario
            }))))

            const result = await crearPresupuestoAction(formData)

            if (result.success && result.data) {
              const numeroPresupuesto = result.data.numero_presupuesto || result.data.numeroPresupuesto
              const totalEstimado = result.data.total_estimado || result.data.totalEstimado || 0

              // Crear notificación
              const supabase = await createClient()
              await supabase.rpc('crear_notificacion', {
                p_tipo: 'presupuesto_whatsapp',
                p_titulo: 'Nuevo presupuesto desde WhatsApp',
                p_mensaje: `${cliente.nombre} creó un presupuesto por $${totalEstimado.toFixed(2)}`,
                p_datos: { presupuesto_id: result.data.presupuesto_id, cliente: cliente.nombre, total: totalEstimado }
              })

              const baseUrl = getBaseUrl()

              // Obtener nombres de productos para el detalle
              const productosDetalle = await Promise.all(
                pending.productos.map(async (prod) => {
                  const producto = await findProductoByCode(prod.codigo)
                  return producto
                    ? `${prod.cantidad} ${producto.unidad_medida} - ${producto.nombre}`
                    : `${prod.cantidad} - ${prod.codigo}`
                })
              )

              const detalleProductos = productosDetalle.length <= 3
                ? productosDetalle.map((detalle, idx) => `   ${idx + 1}. ${detalle}`).join('\n')
                : `${productosDetalle.length} productos diferentes`

              responseMessage = `✅ *¡Presupuesto Creado Exitosamente!*

📋 *Número de presupuesto:*
   ${numeroPresupuesto}

📦 *Productos:*
${detalleProductos}

💰 *Total estimado:* $${totalEstimado.toFixed(2)}

📱 *Seguimiento en línea:*
   ${baseUrl}/seguimiento/presupuesto/${numeroPresupuesto}

⏳ *Próximos pasos:*
   1. Nuestro equipo revisará tu presupuesto
   2. Te contactaremos para confirmar disponibilidad
   3. Coordinaremos la entrega en tu zona

💬 Escribe *menu* para volver al inicio o *estado ${numeroPresupuesto}* para consultar el estado.`

              await deletePendingState(phoneNumber, 'confirmacion')
            } else {
              responseMessage = `❌ Error al crear presupuesto: ${result.message}`
            }
          }
        }
      }
    }
    // Cancelar pedido (acepta respuestas de botones también)
    else if (bodyLower === 'no' || bodyLower === 'cancelar' || body === 'btn_confirmar_no') {
      const hasPending = await getPendingState<ConfirmacionEstadoImport>(phoneNumber, 'confirmacion')
      if (hasPending) {
        await deletePendingState(phoneNumber, 'confirmacion')
        responseMessage = '❌ Pedido cancelado.\n\nEscribe *menu* para volver a empezar.'
      } else {
        responseMessage = 'No tienes ningún pedido pendiente.'
      }
    }
    // Comando: Pedido múltiple (acepta comas o líneas separadas)
    // Formato: POLLO001 5, HUEVO001 2, POLLO003 3
    // O también: POLLO001 5\nHUEVO001 2\nPOLLO003 3
    else if (true) {
      // Detectar si hay múltiples productos (por comas o líneas separadas)
      const lines = body.split('\n').map(l => l.trim()).filter(l => l.length > 0)
      const hasCommas = body.includes(',')
      const validLines = lines.filter(line => line.match(/^[A-Z]{3,10}\d{3,4}\s+\d+(?:\.\d+)?$/i))
      const multipleLines = validLines.length > 1

      if (hasCommas || multipleLines) {
        // Dividir por comas o por saltos de línea
        let items: string[] = []
        if (hasCommas) {
          items = body.split(',').map(item => item.trim()).filter(item => item.length > 0)
        } else {
          // Usar las líneas válidas detectadas
          items = validLines
        }

        const productos = []
        let totalPreview = 0
        let hayError = false
        let errorMsg = ''

        for (const item of items) {
          // Patrón más flexible: código seguido de cantidad (puede tener espacios)
          const match = item.match(/^([A-Z]{3,10}\d{3,4})\s+(\d+(?:\.\d+)?)$/i)
          if (match) {
            const codigo = match[1].toUpperCase()
            const cantidad = parseFloat(match[2])

            const producto = await findProductoByCode(codigo)
            if (!producto) {
              hayError = true
              errorMsg = `Producto ${codigo} no encontrado`
              break
            }

            // Verificar stock disponible consultando productos con stock
            const supabase = await createClient()
            const { data: productoConStock } = await supabase
              .from('productos_con_stock')
              .select('stock_disponible')
              .eq('id', producto.id)
              .single()

            const stockDisponible = productoConStock ? Number(productoConStock?.stock_disponible) || 0 : 0

            if (stockDisponible <= 0) {
              hayError = true
              errorMsg = `Sin stock disponible de ${producto.nombre}`
              break
            } else if (stockDisponible < cantidad) {
              hayError = true
              errorMsg = `Stock insuficiente de ${producto.nombre} (disponible: ${Math.floor(stockDisponible)})`
              break
            }

            productos.push({
              codigo,
              cantidad,
              nombre: producto.nombre,
              precio: producto.precio_venta,
              unidad: producto.unidad_medida
            })
            totalPreview += cantidad * producto.precio_venta
          }
        }

        if (hayError) {
          responseMessage = `❌ ${errorMsg}\n\nRevisa tu pedido e intenta de nuevo.`
        } else if (productos.length === 0) {
          responseMessage = `❌ Formato incorrecto para pedido múltiple.

Ejemplos válidos:
*POLLO001 5, HUEVO001 2, POLLO003 3*

O también:
*POLLO001 5
HUEVO001 2
POLLO003 3*`
        } else {
          const cliente = await findClienteByPhone(phoneNumber)
          if (!cliente) {
            // Iniciar flujo de registro
            responseMessage = await iniciarRegistroCliente(phoneNumber, productos.map(p => ({ codigo: p.codigo, cantidad: p.cantidad })))
          } else {
            // Guardar para confirmación
            const confirmacionEstado: ConfirmacionEstadoImport = {
              productos: productos.map(p => ({ codigo: p.codigo, cantidad: p.cantidad })),
              timestamp: Date.now()
            }
            await setPendingState(phoneNumber, 'confirmacion', confirmacionEstado, 5)

            const resumenText = `📦 *Resumen de tu pedido:*\n\n`
            let resumenDetalle = ''
            productos.forEach(p => {
              resumenDetalle += `• ${p.nombre}: ${p.cantidad} ${p.unidad}\n  $${p.precio} x ${p.cantidad} = $${(p.precio * p.cantidad).toFixed(2)}\n\n`
            })
            resumenDetalle += `💰 *Total: $${totalPreview.toFixed(2)}*`

            if (isWhatsAppMetaAvailable()) {
              await sendBotResponse(phoneNumber, `${resumenText}${resumenDetalle}\n\n¿Confirmas este pedido?`, {
                buttons: [
                  { id: 'btn_confirmar_si', title: '✅ Sí, Confirmar' },
                  { id: 'btn_confirmar_no', title: '❌ No, Cancelar' },
                ],
              })
              responseMessage = ''
            } else {
              responseMessage = `${resumenText}${resumenDetalle}\n\n¿Confirmas este pedido?\n\nResponde *SÍ* para confirmar o *NO* para cancelar.`
            }
          }
        }
      }
    }
    // Comando: Pedido simple con confirmación (solo si es una sola línea)
    // Si hay múltiples líneas con formato de pedido, se procesará como pedido múltiple arriba
    else if (/^[A-Z]{3,10}\d{3,4}\s+\d+(?:\.\d+)?$/i.test(body.trim()) && !body.includes('\n')) {
      const parts = body.trim().split(/\s+/)
      const codigo = parts[0].toUpperCase()
      const cantidad = parseFloat(parts[1])

      const cliente = await findClienteByPhone(phoneNumber)
      if (!cliente) {
        // Iniciar flujo de registro
        responseMessage = await iniciarRegistroCliente(phoneNumber, [{ codigo, cantidad }])
      } else {
        const producto = await findProductoByCode(codigo)
        if (!producto) {
          responseMessage = `❌ Producto *${codigo}* no encontrado.\n\nEscribe *1* para ver productos disponibles.`
        } else {
          // Verificar stock disponible consultando productos con stock
          const supabase = await createClient()
          const { data: productoConStock } = await supabase
            .from('productos_con_stock')
            .select('stock_disponible')
            .eq('id', producto!.id)
            .single()

          const stockDisponible = productoConStock?.stock_disponible ? Number(productoConStock?.stock_disponible) : 0

          if (stockDisponible <= 0) {
            responseMessage = `❌ *Sin stock disponible*

📦 *Producto:* ${producto!.nombre}
📊 *Solicitado:* ${cantidad} ${producto!.unidad_medida}
📦 *Disponible:* Sin stock

💡 *Opciones:*
   • Este producto no tiene stock disponible en este momento
   • Consulta otros productos escribiendo *productos*
   • Contacta a tu vendedor para más información`
          } else if (stockDisponible < cantidad) {
            responseMessage = `❌ *Stock insuficiente*

📦 *Producto:* ${producto!.nombre}
📊 *Solicitado:* ${cantidad} ${producto!.unidad_medida}
📦 *Disponible:* ${Math.floor(stockDisponible)} ${producto!.unidad_medida}

💡 *Sugerencias:*
   • Reduce la cantidad a ${Math.floor(stockDisponible)} ${producto!.unidad_medida}
   • Consulta productos similares escribiendo *productos*
   • Contacta a tu vendedor para más opciones`
          } else {
            // Guardar para confirmación
            const confirmacionEstado: ConfirmacionEstadoImport = {
              productos: [{ codigo, cantidad }],
              timestamp: Date.now()
            }
            await setPendingState(phoneNumber, 'confirmacion', confirmacionEstado, 5)

            const total = cantidad * producto!.precio_venta
            const resumenText = `📦 *Resumen de tu pedido:*

• ${producto!.nombre}
  ${cantidad} ${producto!.unidad_medida} x $${producto!.precio_venta}
  
💰 *Total: $${total.toFixed(2)}*`

            if (isWhatsAppMetaAvailable()) {
              await sendBotResponse(phoneNumber, `${resumenText}\n\n¿Confirmas este pedido?`, {
                buttons: [
                  { id: 'btn_confirmar_si', title: '✅ Sí, Confirmar' },
                  { id: 'btn_confirmar_no', title: '❌ No, Cancelar' },
                ],
              })
              responseMessage = ''
            } else {
              responseMessage = `${resumenText}

¿Confirmas este pedido?

Responde *SÍ* para confirmar o *NO* para cancelar.`
            }
          }
        }
      }
    }
    // Comando: Productos
    else if (bodyLower.includes('productos') || bodyLower.includes('catalogo') || bodyLower.includes('lista')) {
      // Consultar productos directamente con stock disponible desde la vista
      // Mostrar TODOS los productos activos, incluso sin stock
      const supabase = await createClient()

      const { data: productos, error } = await supabase
        .from('productos_con_stock')
        .select(`
          id,
          codigo, 
          nombre, 
          precio_venta, 
          unidad_medida,
          categoria,
          stock_disponible
        `)
        .order('categoria')
        .order('nombre')

      if (error) {
        console.error('Error obteniendo productos:', error)
        responseMessage = 'Error al obtener productos. Intenta de nuevo.'
      } else if (!productos || productos?.length === 0) {
        responseMessage = 'No hay productos disponibles en este momento.'
      } else {
        const categorias = [...new Set(productos!.map(p => p.categoria || 'Otros'))]

        responseMessage = `📦 *Catálogo de Productos*\n\n`

        categorias.forEach(categoria => {
          responseMessage += `*${categoria}:*\n`
          productos!
            .filter(p => (p.categoria || 'Otros') === categoria)
            .forEach((p) => {
              const stock = Number(p.stock_disponible) || 0
              const stockEmoji = stock > 50 ? '🟢' : stock > 20 ? '🟡' : stock > 0 ? '🔴' : '⚪'
              responseMessage += `${stockEmoji} *[${p.codigo}]* ${p.nombre}\n`
              if (stock > 0) {
                responseMessage += `   💰 $${p.precio_venta}/${p.unidad_medida} | Stock: ${Math.floor(stock)}\n\n`
              } else {
                responseMessage += `   💰 $${p.precio_venta}/${p.unidad_medida} | Stock: Sin stock disponible\n\n`
              }
            })
        })

        responseMessage += `\n💬 Para ordenar escribe:\n*[CODIGO] [CANTIDAD]*\nEj: POLLO001 5`
      }
    }
    // Consulta de deuda
    else if (bodyLower.includes('deuda') || bodyLower.includes('saldo pendiente')) {
      const cliente = await findClienteByPhone(phoneNumber)
      if (!cliente) {
        responseMessage = '❌ No encontramos tu cuenta. Comunícate con un asesor.'
      } else {
        const cuenta = await getCuentaCorriente(cliente!.id)
        const saldo = Number(cuenta?.saldo || 0)
        if (saldo > 0) {
          responseMessage = `📄 *Estado de cuenta*\n\nCliente: ${cliente!.nombre}\nSaldo pendiente: *$${saldo.toFixed(
            2
          )}*\n\nPuedes abonar al repartidor o solicitar un link de pago respondiendo *pagar*.`
        } else {
          responseMessage = '✅ No registras deudas pendientes. ¡Gracias por estar al día!'
        }
      }
    }
    // Comando: Pedido
    else if (bodyLower.includes('pedido')) {
      // Parsear el mensaje: "pedido POLLO001 5"
      const parts = body.split(/\s+/)
      if (parts.length >= 3) {
        const codigo = parts[1].toUpperCase()
        const cantidad = parseFloat(parts[2])

        if (!isNaN(cantidad) && cantidad > 0) {
          // Buscar cliente
          const cliente = await findClienteByPhone(phoneNumber)
          if (!cliente) {
            // Iniciar flujo de registro
            responseMessage = await iniciarRegistroCliente(phoneNumber, [{ codigo, cantidad }])
          } else {
            // Buscar producto
            const producto = await findProductoByCode(codigo)
            if (!producto) {
              responseMessage = `❌ Producto *${codigo}* no encontrado. Envía "productos" para ver el catálogo.`
            } else {
              // Verificar stock disponible consultando productos con stock
              const supabase = await createClient()
              const { data: productoConStock } = await supabase
                .from('productos_con_stock')
                .select('stock_disponible')
                .eq('id', producto!.id)
                .single()

              const stockDisponible = productoConStock?.stock_disponible ? Number(productoConStock?.stock_disponible) : 0

              if (stockDisponible < cantidad) {
                responseMessage = `❌ *Stock insuficiente*

📦 *Producto:* ${producto!.nombre}
📊 *Solicitado:* ${cantidad} ${producto!.unidad_medida}
📦 *Disponible:* ${Math.floor(stockDisponible)} ${producto!.unidad_medida}

💡 *Opciones:*
   • Reduce la cantidad a ${Math.floor(stockDisponible)} ${producto!.unidad_medida}
   • Consulta otros productos escribiendo *productos*
   • Contacta a tu vendedor para alternativas`
              } else {
                // Crear presupuesto
                const formData = new FormData()
                // Obtener lista automática del cliente
                let precioFinal = producto!.precio_venta
                const listasResult = await obtenerListasClienteAction(cliente!.id)
                if (listasResult.success && listasResult.data && Array.isArray(listasResult.data) && listasResult.data.length > 0) {
                  const primeraListaPrecioId = listasResult.data[0]?.lista_precio_id
                  if (primeraListaPrecioId) {
                    const precioResult = await obtenerPrecioProductoAction(primeraListaPrecioId, producto!.id)
                    if (precioResult.success && precioResult.data?.precio != null) {
                      precioFinal = precioResult.data!.precio
                    }

                    formData.append('cliente_id', cliente!.id)
                    formData.append('observaciones', 'Presupuesto creado desde WhatsApp')
                    formData.append('lista_precio_id', primeraListaPrecioId)
                    formData.append('items', JSON.stringify([{
                      producto_id: producto!.id,
                      cantidad_solicitada: cantidad,
                      precio_unit_est: precioFinal
                    }]))
                  } else {
                    formData.append('cliente_id', cliente!.id)
                    formData.append('observaciones', 'Presupuesto creado desde WhatsApp')
                    formData.append('items', JSON.stringify([{
                      producto_id: producto!.id,
                      cantidad_solicitada: cantidad,
                      precio_unit_est: precioFinal
                    }]))
                  }
                } else {
                  formData.append('cliente_id', cliente!.id)
                  formData.append('observaciones', 'Presupuesto creado desde WhatsApp')
                  formData.append('items', JSON.stringify([{
                    producto_id: producto!.id,
                    cantidad_solicitada: cantidad,
                    precio_unit_est: precioFinal
                  }]))
                }

                const result = await crearPresupuestoAction(formData)

                if (result.success && result.data) {
                  const numeroPresupuesto = result.data.numero_presupuesto || result.data.numeroPresupuesto
                  const totalEstimado = result.data.total_estimado || result.data.totalEstimado || 0

                  const baseUrl = getBaseUrl()
                  responseMessage = `✅ *¡Presupuesto Creado!*

📋 *Número:* ${numeroPresupuesto}
📦 *Producto:* ${producto!.nombre}
📊 *Cantidad:* ${cantidad} ${producto!.unidad_medida}
💰 *Total estimado:* $${totalEstimado.toFixed(2)}

🔗 *Seguimiento:*
   ${baseUrl}/seguimiento/presupuesto/${numeroPresupuesto}

⏳ Nuestro equipo revisará tu presupuesto y te contactará pronto para coordinar la entrega.

💬 Escribe *menu* para más opciones.`
                } else {
                  responseMessage = `❌ Error al crear presupuesto: ${result.message}`
                }
              }
            }
          }
        } else {
          responseMessage = '❌ Cantidad inválida. Ejemplo: pedido POLLO001 5'
        }
      } else {
        responseMessage = '❌ Formato incorrecto.\n\nUsa: pedido [CODIGO] [CANTIDAD]\nEjemplo: pedido POLLO001 5'
      }
    }
    // Comando: Estado de pedido
    else if (bodyLower.includes('estado') || body === '3' || bodyLower === 'opcion 3') {
      // Buscar si escribió el número de pedido
      const match = body.match(/PED-[\w-]+/i)

      if (match) {
        const numeroPedido = match![0].toUpperCase()
        const pedido = await getPedidoStatus(numeroPedido)

        if (!pedido) {
          responseMessage = `❌ Pedido *${numeroPedido}* no encontrado.\n\nVerifica el número e intenta de nuevo.`
        } else {
          const estadosEmoji: Record<string, string> = {
            pendiente: '⏳',
            confirmado: '✅',
            preparando: '📦',
            enviado: '🚚',
            entregado: '🎉',
            cancelado: '❌'
          }

          const estadosTexto: Record<string, string> = {
            pendiente: 'Pendiente de confirmación',
            confirmado: 'Confirmado',
            preparando: 'En preparación',
            enviado: 'En camino',
            entregado: 'Entregado',
            cancelado: 'Cancelado'
          }

          const emoji = estadosEmoji[pedido!.estado] || '📋'
          const estadoTexto = estadosTexto[pedido!.estado] || pedido!.estado

          responseMessage = `${emoji} *Estado de Pedido*

📋 Número: *${pedido!.numero_pedido}*
🔄 Estado: *${estadoTexto}*
📅 Fecha: ${new Date(pedido!.fecha_pedido).toLocaleDateString('es-AR')}
💰 Total: $${pedido!.total}`

          if (pedido!.fecha_entrega_estimada) {
            responseMessage += `\n🚚 Entrega estimada: ${new Date(pedido!.fecha_entrega_estimada).toLocaleDateString('es-AR')}`
          }

          if (pedido!.fecha_entrega_real) {
            responseMessage += `\n✅ Entregado: ${new Date(pedido!.fecha_entrega_real).toLocaleDateString('es-AR')}`
          }
        }
      } else {
        // Mostrar últimos pedidos del cliente
        const cliente = await findClienteByPhone(phoneNumber)
        if (!cliente) {
          responseMessage = '❌ No se encontró tu perfil.'
        } else {
          const supabase = await createClient()
          const { data: pedidos } = await supabase
            .from('pedidos')
            .select('numero_pedido, estado, total, fecha_pedido')
            .eq('cliente_id', cliente!.id)
            .order('fecha_pedido', { ascending: false })
            .limit(5)

          const pedidosList = pedidos ?? []

          if (pedidosList.length === 0) {
            responseMessage = 'No tienes pedidos registrados.'
          } else {
            responseMessage = `📋 *Tus últimos pedidos:*\n\n`
            pedidosList.forEach(p => {
              const estadosEmoji: Record<string, string> = {
                pendiente: '⏳',
                confirmado: '✅',
                preparando: '📦',
                enviado: '🚚',
                entregado: '🎉',
                cancelado: '❌'
              }
              const emoji = estadosEmoji[p.estado] || '📋'
              responseMessage += `${emoji} ${p.numero_pedido}\n`
              responseMessage += `   Estado: ${p.estado} | Total: $${p.total}\n\n`
            })
            responseMessage += `Para ver detalles de un pedido:\n*estado PED-XXXXX*`
          }
        }
      }
    }
    // Comando: Reclamo - Ver estado de reclamo específico
    else if (bodyLower.startsWith('reclamo ') && bodyLower.length > 8) {
      const numeroReclamo = body.substring(8).trim().toUpperCase()
      const reclamo = await getReclamoStatus(numeroReclamo)

      if (!reclamo) {
        responseMessage = `❌ No se encontró el reclamo *${numeroReclamo}*.\n\nVerifica el número e intenta nuevamente.`
      } else {
        const estadosEmoji: Record<string, string> = {
          abierto: '🟡',
          investigando: '🔵',
          resuelto: '✅',
          cerrado: '⚫'
        }

        const estadosTexto: Record<string, string> = {
          abierto: 'Abierto',
          investigando: 'En investigación',
          resuelto: 'Resuelto',
          cerrado: 'Cerrado'
        }

        const reclamoData = reclamo as any
        const emoji = estadosEmoji[reclamoData.estado] || '📋'
        const estadoTexto = estadosTexto[reclamoData.estado] || reclamoData.estado

        const tiposTexto: Record<string, string> = {
          producto_dañado: 'Producto Dañado',
          entrega_tardia: 'Entrega Tardía',
          cantidad_erronea: 'Cantidad Errónea',
          producto_equivocado: 'Producto Equivocado',
          precio_incorrecto: 'Precio Incorrecto',
          calidad_deficiente: 'Calidad Deficiente',
          empaque_dañado: 'Empaque Dañado',
          otro: 'Otro'
        }

        responseMessage = `${emoji} *Estado de Reclamo*

📋 Número: *${reclamoData.numero_reclamo}*
🔄 Estado: *${estadoTexto}*
📝 Tipo: ${tiposTexto[reclamoData.tipo_reclamo] || reclamoData.tipo_reclamo}
📅 Fecha: ${new Date(reclamoData.created_at || reclamoData.fecha_creacion).toLocaleDateString('es-AR')}
📄 Descripción: ${reclamoData.descripcion?.substring(0, 100) || ''}${reclamoData.descripcion?.length > 100 ? '...' : ''}`

        const pedido = Array.isArray(reclamoData.pedido) ? reclamoData.pedido[0] : reclamoData.pedido
        if (pedido) {
          responseMessage += `\n📦 Pedido relacionado: *${pedido.numero_pedido}*`
        }

        if (reclamoData.fecha_resolucion) {
          responseMessage += `\n✅ Resuelto: ${new Date(reclamoData.fecha_resolucion).toLocaleDateString('es-AR')}`
        }

        if (reclamoData.solucion) {
          responseMessage += `\n\n💬 Solución:\n${reclamoData.solucion}`
        }
      }
    }
    // Comando: Mis Reclamos
    else if (bodyLower.includes('mis reclamos') || bodyLower === 'reclamos') {
      const cliente = await findClienteByPhone(phoneNumber)
      if (!cliente) {
        responseMessage = '❌ No se encontró tu perfil.'
      } else {
        const clienteId = (cliente as { id: string }).id
        if (!clienteId) {
          responseMessage = '❌ No se encontró tu perfil.'
        } else {
          const reclamos = await getReclamosCliente(clienteId)

          if (reclamos.length === 0) {
            responseMessage = '📋 No tienes reclamos registrados.\n\nPara crear un reclamo, escribe: *reclamo*'
          } else {
            responseMessage = `📋 *Tus reclamos:*\n\n`
            reclamos.forEach((r: any) => {
              const estadosEmoji: Record<string, string> = {
                abierto: '🟡',
                investigando: '🔵',
                resuelto: '✅',
                cerrado: '⚫'
              }
              const emoji = estadosEmoji[r.estado] || '📋'
              responseMessage += `${emoji} *${r.numero_reclamo}*\n`
              responseMessage += `   Estado: ${r.estado} | ${new Date(r.created_at).toLocaleDateString('es-AR')}\n\n`
            })
            responseMessage += `Para ver detalles de un reclamo:\n*reclamo REC-XXXXX*`
          }
        }
      }
    }
    // Comando: Nuevo Reclamo
    else if (bodyLower === 'reclamo' || bodyLower === 'nuevo reclamo' || bodyLower.includes('crear reclamo')) {
      const cliente = await findClienteByPhone(phoneNumber)
      if (!cliente) {
        responseMessage = '❌ No se encontró tu perfil. Por favor contacta con ventas para registrarte.'
      } else {
        responseMessage = iniciarReclamo(phoneNumber)
      }
    }

  } catch (error: any) {
    console.error('[Bot] Error procesando mensaje:', error)
    responseMessage = 'Error al procesar tu mensaje. Intenta de nuevo.'
  }

  if (source !== 'twilio') {
    if (responseMessage) {
      await sendBotResponseText(phoneNumber, responseMessage)
    }
    return new NextResponse('OK', { status: 200 })
  }

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${responseMessage.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Message>
</Response>`,
    {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    }
  )
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''

    // Detectar si es una petición de Twilio (form-urlencoded)
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData()
      return handleTwilioWebhook(formData, 'twilio')
    }

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      return handleTwilioWebhook(formData, 'twilio')
    }

    if (contentType.includes('application/json')) {
      const rawBody = await request.text()

      let payload: any
      try {
        payload = rawBody ? JSON.parse(rawBody) : {}
      } catch {
        return NextResponse.json(
          { success: false, error: 'Payload JSON invalido' },
          { status: 400 }
        )
      }

      if (isMetaWebhookPayload(payload) || isKapsoWhatsAppPayload(payload)) {
        if (!verifyWhatsAppWebhookSignature(rawBody, request.headers, payload)) {
          return NextResponse.json(
            { success: false, error: 'Firma de webhook invalida' },
            { status: 401 }
          )
        }

        const source: 'kapso' | 'meta' = isMetaWebhookPayload(payload) ? 'meta' : 'kapso'
        return handleKapsoWebhookPayload(payload, source)
      }

      const authHeader = request.headers.get('authorization')
      const expectedToken = process.env.BOTPRESS_WEBHOOK_TOKEN

      if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
        return NextResponse.json(
          { success: false, error: 'Token de autenticacion invalido' },
          { status: 401 }
        )
      }

      const payloadBotpress: BotpressWebhookPayload = payload

      if (!payloadBotpress.intent) {
        return NextResponse.json(
          { success: false, error: 'Intencion es requerida' },
          { status: 400 }
        )
      }

      const response = await handleBotpressWebhook(payloadBotpress)

      if (payloadBotpress.session?.userId) {
        extractAndSaveFactsInBackground(payloadBotpress.session.userId).catch(() => {
          // Silenciar errores - ya se logean internamente
        })
      }

      return NextResponse.json(response, {
        status: response.success ? 200 : 400,
      })
    }

    return NextResponse.json(
      { success: false, error: 'Content-Type no soportado' },
      { status: 415 }
    )

    // Si es JSON, asumimos que es de Botpress
    const authHeader = request.headers.get('authorization')
    const expectedToken = process.env.BOTPRESS_WEBHOOK_TOKEN

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { success: false, error: 'Token de autenticación inválido' },
        { status: 401 }
      )
    }

    // Parsear el payload
    const payload: BotpressWebhookPayload = await request.json()

    // Validar payload básico
    if (!payload.intent) {
      return NextResponse.json(
        { success: false, error: 'Intención es requerida' },
        { status: 400 }
      )
    }

    // Procesar la solicitud
    const response = await handleBotpressWebhook(payload)

    // === Memory Bank: Extraer hechos en background (fire-and-forget) ===
    // No bloquea la respuesta al usuario
    if (payload.session?.userId) {
      extractAndSaveFactsInBackground(payload.session.userId).catch(() => {
        // Silenciar errores - ya se logean internamente
      })
    }

    // Retornar respuesta
    return NextResponse.json(response, {
      status: response.success ? 200 : 400
    })

  } catch (error: any) {
    console.error('Error en webhook POST:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}

// Método GET para health check
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Bot webhook is running',
    timestamp: new Date().toISOString()
  })
}
