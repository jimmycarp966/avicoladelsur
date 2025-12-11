import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { crearPresupuestoAction } from '@/actions/presupuestos.actions'
import { crearReclamoBotAction, crearClienteDesdeBotAction } from '@/actions/ventas.actions'
import { obtenerListasClienteAction, obtenerPrecioProductoAction } from '@/actions/listas-precios.actions'
import { sendWhatsAppMessage, getWhatsAppProvider, isWhatsAppMetaAvailable } from '@/lib/services/whatsapp-meta'
import type { MetaListSection } from '@/types/whatsapp-meta'

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

// Función auxiliar para encontrar producto por código
async function findProductoByCode(code: string) {
  const supabase = await createClient()

  const { data: producto, error } = await supabase
    .from('productos')
    .select('id, codigo, nombre, precio_venta, unidad_medida')
    .eq('codigo', code.toUpperCase())
    .eq('activo', true)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error finding producto:', error)
    return null
  }

  return producto
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
  estado: 'esperando_nombre' | 'esperando_direccion' | 'esperando_localidad'
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

// Limpiar estados expirados (10 minutos)
function limpiarEstadosExpirados() {
  const ahora = Date.now()
  const timeout = 10 * 60 * 1000 // 10 minutos

  for (const [phone, estado] of registroClientesPendientes.entries()) {
    if (ahora - estado.timestamp > timeout) {
      registroClientesPendientes.delete(phone)
    }
  }

  for (const [phone, estado] of reclamosPendientes.entries()) {
    if (ahora - estado.timestamp > timeout) {
      reclamosPendientes.delete(phone)
    }
  }
}

// Función auxiliar para obtener localidades activas
async function obtenerLocalidadesActivas() {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('fn_obtener_localidades_activas')

  if (error) {
    console.error('Error obteniendo localidades:', error)
    return []
  }

  return data || []
}

// Función para iniciar flujo de registro de cliente
function iniciarRegistroCliente(phoneNumber: string, productos: Array<{ codigo: string; cantidad: number }>) {
  registroClientesPendientes.set(phoneNumber, {
    estado: 'esperando_nombre',
    productos_pendientes: productos,
    timestamp: Date.now()
  })

  return `👋 *¡Bienvenido a Avícola del Sur!*

No encontramos tu número registrado. Para crear tu presupuesto necesitamos algunos datos.

📝 *Paso 1 de 3*
Por favor, envía tu *nombre y apellido*:

Ejemplo: *Juan Pérez*`
}

// Función para procesar respuesta del flujo de registro
async function procesarRegistroCliente(phoneNumber: string, mensaje: string): Promise<string | null> {
  limpiarEstadosExpirados()

  const estado = registroClientesPendientes.get(phoneNumber)
  if (!estado) return null

  const bodyLower = mensaje.toLowerCase().trim()

  // Permitir cancelar en cualquier momento
  if (bodyLower === 'cancelar' || bodyLower === 'cancel') {
    registroClientesPendientes.delete(phoneNumber)
    return '❌ Registro cancelado.\n\nEscribe *menu* para volver al inicio.'
  }

  switch (estado.estado) {
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
      estado.estado = 'esperando_localidad'
      estado.timestamp = Date.now()

      // Obtener localidades
      const localidades = await obtenerLocalidadesActivas()

      if (localidades.length === 0) {
        registroClientesPendientes.delete(phoneNumber)
        return '❌ No hay localidades disponibles en este momento. Por favor contacta con ventas.'
      }

      // Guardar localidades en el estado para validación posterior
      ; (estado as any).localidades = localidades

      let mensajeLocalidades = `✅ Dirección registrada: *${estado.direccion}*

📝 *Paso 3 de 3*
Selecciona tu *localidad* (responde con el número):

`
      localidades.forEach((loc: any, index: number) => {
        mensajeLocalidades += `${index + 1}. ${loc.nombre} - Zona ${loc.zona_nombre}\n`
      })
      mensajeLocalidades += `\nResponde con el número de tu localidad.`

      return mensajeLocalidades
    }

    case 'esperando_localidad': {
      const numero = parseInt(mensaje.trim())
      const localidades = (estado as any).localidades || []

      if (isNaN(numero) || numero < 1 || numero > localidades.length) {
        return `❌ Número inválido. Por favor responde con un número entre 1 y ${localidades.length}.`
      }

      const localidadSeleccionada = localidades[numero - 1]

      // Crear cliente
      const resultado = await crearClienteDesdeBotAction({
        nombre: estado.nombre!,
        apellido: estado.apellido,
        whatsapp: phoneNumber,
        direccion: estado.direccion!,
        localidad_id: localidadSeleccionada.id
      })

      if (!resultado.success || !resultado.data) {
        registroClientesPendientes.delete(phoneNumber)
        return `❌ Error al crear tu cuenta: ${resultado.error}\n\nPor favor contacta con ventas.`
      }

      const clienteId = resultado.data.clienteId
      registroClientesPendientes.delete(phoneNumber)

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

      const presupuestoResult = await crearPresupuestoAction(formData)

      if (presupuestoResult.success && presupuestoResult.data) {
        const numeroPresupuesto = presupuestoResult.data.numero_presupuesto || presupuestoResult.data.numeroPresupuesto
        const totalEstimado = presupuestoResult.data.total_estimado || presupuestoResult.data.totalEstimado || 0
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

Sin embargo, hubo un error al crear el presupuesto: ${presupuestoResult.message}

Por favor intenta crear un nuevo presupuesto escribiendo el código y cantidad.`
      }
    }

    default:
      return null
  }
}

// Función para procesar respuesta del flujo de creación de reclamo
async function procesarReclamo(phoneNumber: string, mensaje: string): Promise<string | null> {
  const estado = reclamosPendientes.get(phoneNumber)
  if (!estado) return null

  const cliente = await findClienteByPhone(phoneNumber)
  if (!cliente) {
    reclamosPendientes.delete(phoneNumber)
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

      reclamosPendientes.delete(phoneNumber)

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

        formData.append('cliente_id', cliente.id)
        formData.append('observaciones', parameters.observaciones || 'Presupuesto creado desde WhatsApp')
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
          return {
            success: true,
            message: `✅ ¡Presupuesto creado exitosamente!

📋 Número: ${numeroPresupuesto}
🔗 Seguimiento: ${getBaseUrl()}/seguimiento/presupuesto/${numeroPresupuesto}

Nuestro equipo revisará tu presupuesto y te contactará pronto.`,
            data: {
              presupuesto_id: result.data.presupuesto_id || result.data.presupuestoId,
              numero_presupuesto: numeroPresupuesto,
              total_estimado: result.data.total_estimado || result.data.totalEstimado,
              cliente: cliente.nombre
            }
          }
        } else {
          return {
            success: false,
            error: result.message || 'Error al crear el presupuesto'
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

// Función auxiliar para verificar horario de atención
function isHorarioAtencion(): { abierto: boolean; mensaje?: string } {
  const now = new Date()
  const hora = now.getHours()
  const dia = now.getDay() // 0 = Domingo, 6 = Sábado

  // Lunes a Viernes: 8am - 6pm
  if (dia >= 1 && dia <= 5) {
    if (hora >= 8 && hora < 18) {
      return { abierto: true }
    }
  }

  // Sábado: 8am - 1pm
  if (dia === 6) {
    if (hora >= 8 && hora < 13) {
      return { abierto: true }
    }
  }

  // Fuera de horario
  return {
    abierto: false,
    mensaje: `🌙 *Estamos cerrados*

Horario de atención:
📅 Lun-Vie: 8:00am - 6:00pm
📅 Sábado: 8:00am - 1:00pm
📅 Domingo: Cerrado

Tu mensaje será atendido en el próximo horario hábil. ¡Gracias!`
  }
}

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
  const useButtons = isWhatsAppMetaAvailable() && (options?.buttons || options?.list)

  if (useButtons && provider === 'meta') {
    // Usar WhatsApp Meta con botones
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
    // Usar método tradicional (Twilio o texto simple)
    await sendBotResponseText(phoneNumber, message)
  }
}

/**
 * Envía respuesta de texto simple (Twilio o fallback)
 */
async function sendBotResponseText(phoneNumber: string, message: string): Promise<void> {
  const provider = getWhatsAppProvider()

  // Si es Twilio, la respuesta se envía en el XML de Twilio
  // Si es Meta sin botones, usar el servicio de Meta
  if (provider === 'meta') {
    const result = await sendWhatsAppMessage({
      to: phoneNumber,
      text: message,
    })
    if (!result.success) {
      console.error('[Bot] Error enviando mensaje de texto:', result.error)
    }
  }
  // Si es Twilio, el mensaje se retorna en el XML (manejado en el código existente)
}

// ===========================================
// CÓDIGO DE TWILIO (MANTENIDO COMO RESPALDO)
// ===========================================
// NOTA: Este código se mantiene comentado/activo como respaldo durante la migración gradual
// Una vez que Meta esté completamente funcional, se puede deshabilitar cambiando WHATSAPP_PROVIDER

// Función para manejar mensajes directos de Twilio
async function handleTwilioWebhook(formData: FormData) {
  const body = formData.get('Body')?.toString().trim() || ''
  const from = formData.get('From')?.toString() || ''

  // Extraer el número de teléfono (Twilio envía: whatsapp:+1234567890)
  const phoneNumber = from.replace('whatsapp:', '')

  console.log('[Bot] Mensaje recibido (Twilio):', { from: phoneNumber, body })

  // Buscar cliente para personalizar mensajes
  const cliente = await findClienteByPhone(phoneNumber)
  const nombreCliente = cliente?.nombre || ''

  let responseMessage = ''

  try {
    const bodyLower = body.toLowerCase()

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

    // Verificar horario de atención (excepto para consultas)
    const horario = isHorarioAtencion()
    if (!horario.abierto && !bodyLower.includes('estado') && !bodyLower.includes('consulta')) {
      responseMessage = horario.mensaje || ''
      // Continuar procesando de todos modos
    }

    // Comando: Hola / Ayuda
    if (bodyLower.includes('hola') || bodyLower.includes('ayuda') || bodyLower.includes('menu') || bodyLower.includes('inicio') || body === 'btn_menu') {
      const saludo = nombreCliente ? `¡Hola ${nombreCliente}! 👋` : '¡Hola! 👋'
      const menuText = `${saludo} Bienvenido a *Avícola del Sur*

🏡 Tu distribuidor de confianza

🛒 *Menú Principal*

Selecciona una opción:`

      // Si Meta está disponible, usar botones; sino texto
      if (isWhatsAppMetaAvailable()) {
        // Enviar mensaje con botones y retornar respuesta vacía (el mensaje ya se envió)
        await sendBotResponse(phoneNumber, menuText, {
          buttons: [
            { id: 'btn_productos', title: '📦 Ver Productos' },
            { id: 'btn_presupuesto', title: '🛒 Crear Presupuesto' },
            { id: 'btn_estado', title: '📊 Consultar Estado' },
          ],
          footer: 'Escribe *ayuda* para ver este menú',
        })
        responseMessage = '' // Ya se envió con botones
      } else {
        // Fallback a texto tradicional
        responseMessage = `${menuText}

1️⃣ Ver productos disponibles
2️⃣ Crear presupuesto
3️⃣ Consultar estado de pedidos
4️⃣ Registrar reclamo
5️⃣ Consultar saldo pendiente

📝 *Responde con el número* de la opción que deseas.

❓ Escribe *ayuda* en cualquier momento para ver este menú`
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
      const pending = pendingConfirmations.get(phoneNumber)

      if (!pending) {
        responseMessage = 'No tienes ningún presupuesto pendiente de confirmación.\n\nEscribe el código y cantidad para crear un presupuesto.'
      } else {
        // Verificar que no haya expirado (5 minutos)
        if (Date.now() - pending.timestamp > 5 * 60 * 1000) {
          pendingConfirmations.delete(phoneNumber)
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

              pendingConfirmations.delete(phoneNumber)
            } else {
              responseMessage = `❌ Error al crear presupuesto: ${result.message}`
            }
          }
        }
      }
    }
    // Cancelar pedido (acepta respuestas de botones también)
    else if (bodyLower === 'no' || bodyLower === 'cancelar' || body === 'btn_confirmar_no') {
      if (pendingConfirmations.has(phoneNumber)) {
        pendingConfirmations.delete(phoneNumber)
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
            responseMessage = iniciarRegistroCliente(phoneNumber, productos.map(p => ({ codigo: p.codigo, cantidad: p.cantidad })))
          } else {
            // Guardar para confirmación
            pendingConfirmations.set(phoneNumber, {
              productos: productos.map(p => ({ codigo: p.codigo, cantidad: p.cantidad })),
              timestamp: Date.now()
            })

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
        responseMessage = iniciarRegistroCliente(phoneNumber, [{ codigo, cantidad }])
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
            pendingConfirmations.set(phoneNumber, {
              productos: [{ codigo, cantidad }],
              timestamp: Date.now()
            })

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
            responseMessage = iniciarRegistroCliente(phoneNumber, [{ codigo, cantidad }])
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
    // Mensaje no reconocido
    else {
      responseMessage = `🤔 *No entendí tu mensaje*

💡 *Comandos disponibles:*
   • *menu* o *ayuda* - Ver menú principal
   • *productos* - Ver catálogo completo
   • *[CODIGO] [CANTIDAD]* - Crear presupuesto
      Ejemplo: *POLLO001 5*
   • *estado PRES-XXXXX* - Consultar presupuesto
   • *reclamo* - Crear nuevo reclamo
   • *mis reclamos* - Ver tus reclamos
   • *reclamo REC-XXXXX* - Consultar reclamo
   • *deuda* - Ver saldo pendiente

📞 Si necesitas ayuda personalizada, contacta a tu vendedor.`
    }

  } catch (error: any) {
    console.error('[Bot] Error procesando mensaje:', error)
    responseMessage = 'Error al procesar tu mensaje. Intenta de nuevo.'
  }

  // Determinar proveedor y enviar respuesta apropiadamente
  const provider = getWhatsAppProvider()

  // Si el mensaje ya se envió con botones (responseMessage vacío), solo retornar OK
  if (!responseMessage && provider === 'meta') {
    return new NextResponse('OK', { status: 200 })
  }

  // Si es Meta pero aún hay mensaje de texto, enviarlo
  if (provider === 'meta' && responseMessage) {
    await sendBotResponseText(phoneNumber, responseMessage)
    return new NextResponse('OK', { status: 200 })
  }

  // Si es Twilio, retornar XML tradicional
  // NOTA: Este código se mantiene como respaldo durante la migración gradual
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
      return handleTwilioWebhook(formData)
    }

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
