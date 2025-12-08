'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ApiResponse } from '@/types/api.types'
import PDFDocument from 'pdfkit'
import { format } from 'date-fns'

// ===========================================
// IMPRESIÓN TÉRMICA
// ===========================================

/**
 * Genera un ticket térmico 80mm para una venta
 */
export async function generarTicketTermicoAction(
  pedidoId: string
): Promise<ApiResponse<Buffer>> {
  try {
    const supabase = await createClient()

    // Obtener datos del pedido con detalles
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .select(`
        id,
        numero_pedido,
        fecha_pedido,
        subtotal,
        total,
        pago_estado,
        tipo_pedido,
        sucursal_id,
        clientes (
          nombre,
          apellido,
          codigo
        ),
        detalles_pedido (
          cantidad,
          precio_unitario,
          subtotal,
          productos (
            nombre,
            codigo,
            unidad_medida
          )
        ),
        sucursales (
          nombre,
          direccion,
          telefono
        )
      `)
      .eq('id', pedidoId)
      .single()

    if (pedidoError || !pedido) {
      return { success: false, error: 'Pedido no encontrado' }
    }

    // Crear PDF para impresión térmica 80mm (226px de ancho)
    const doc = new PDFDocument({
      size: [226, 800], // 80mm = 226px, altura variable
      margins: { top: 10, bottom: 10, left: 10, right: 10 },
    })

    const buffers: Buffer[] = []

    return new Promise((resolve, reject) => {
      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => {
        resolve({
          success: true,
          data: Buffer.concat(buffers),
        })
      })
      doc.on('error', reject)

      // Configuración de fuentes
      doc.fontSize(10)

      // Encabezado
      doc.fontSize(12).font('Helvetica-Bold').text('AVÍCOLA DEL SUR', { align: 'center' })
      doc.moveDown(0.5)

      const sucursal = (pedido.sucursales as any)
      if (sucursal) {
        doc.fontSize(9).font('Helvetica').text(sucursal.nombre || 'Sucursal', { align: 'center' })
        if (sucursal.direccion) {
          doc.fontSize(8).text(sucursal.direccion, { align: 'center' })
        }
        if (sucursal.telefono) {
          doc.fontSize(8).text(`Tel: ${sucursal.telefono}`, { align: 'center' })
        }
      }

      doc.moveDown(0.5)
      doc.moveTo(10, doc.y).lineTo(216, doc.y).stroke()
      doc.moveDown(0.5)

      // Tipo de comprobante
      doc.fontSize(10).font('Helvetica-Bold').text('TICKET DE VENTA', { align: 'center' })
      doc.moveDown(0.5)

      // Información del pedido
      doc.fontSize(9).font('Helvetica')
      doc.text(`Ticket: ${pedido.numero_pedido}`)
      doc.text(`Fecha: ${new Date(pedido.fecha_pedido).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}`)

      // Cliente
      const cliente = pedido.clientes as any
      if (cliente) {
        const nombreCliente = Array.isArray(cliente) ? cliente[0] : cliente
        if (nombreCliente) {
          doc.moveDown(0.3)
          doc.text(`Cliente: ${nombreCliente.nombre || ''} ${nombreCliente.apellido || ''}`.trim())
          if (nombreCliente.codigo) {
            doc.text(`Código: ${nombreCliente.codigo}`)
          }
        }
      } else {
        doc.text('Cliente: Venta genérica')
      }

      doc.moveDown(0.5)
      doc.moveTo(10, doc.y).lineTo(216, doc.y).stroke()
      doc.moveDown(0.5)

      // Productos
      doc.fontSize(9).font('Helvetica-Bold')
      doc.text('PRODUCTOS')
      doc.moveDown(0.3)

      const detalles = pedido.detalles_pedido as any[]
      if (detalles && detalles.length > 0) {
        doc.fontSize(8).font('Helvetica')
        detalles.forEach((detalle) => {
          const producto = detalle.productos
          if (producto) {
            const nombreProd = Array.isArray(producto) ? producto[0] : producto
            doc.text(`${nombreProd?.nombre || 'Producto'}`, { continued: false })
            doc.text(
              `  ${detalle.cantidad} ${nombreProd?.unidad_medida || 'un'} x $${detalle.precio_unitario?.toFixed(2) || '0.00'}`,
              { continued: false }
            )
            doc.text(`  Subtotal: $${detalle.subtotal?.toFixed(2) || '0.00'}`, { align: 'right' })
            doc.moveDown(0.2)
          }
        })
      }

      doc.moveDown(0.5)
      doc.moveTo(10, doc.y).lineTo(216, doc.y).stroke()
      doc.moveDown(0.5)

      // Totales
      doc.fontSize(9).font('Helvetica')
      doc.text(`Subtotal: $${pedido.subtotal?.toFixed(2) || '0.00'}`, { align: 'right' })
      // Aquí se pueden agregar descuentos, recargos, etc.
      doc.moveDown(0.3)
      doc.fontSize(11).font('Helvetica-Bold')
      doc.text(`TOTAL: $${pedido.total?.toFixed(2) || '0.00'}`, { align: 'right' })

      doc.moveDown(0.5)
      doc.moveTo(10, doc.y).lineTo(216, doc.y).stroke()
      doc.moveDown(0.5)

      // Estado de pago
      doc.fontSize(9).font('Helvetica')
      doc.text(`Estado: ${pedido.pago_estado?.toUpperCase() || 'PENDIENTE'}`, { align: 'center' })

      doc.moveDown(1)
      doc.fontSize(8).font('Helvetica').text('Gracias por su compra!', { align: 'center' })
      doc.text(new Date().toLocaleString('es-AR'), { align: 'center' })

      doc.end()
    })
  } catch (error) {
    return {
      success: false,
      error: `Error interno: ${error instanceof Error ? error.message : 'Error desconocido'}`,
    }
  }
}

/**
 * Genera una factura A o B en PDF
 */
export async function generarFacturaAction(
  pedidoId: string,
  tipoFactura: 'A' | 'B'
): Promise<ApiResponse<Buffer>> {
  try {
    const supabase = await createClient()

    // Obtener datos del pedido
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .select(`
        id,
        numero_pedido,
        fecha_pedido,
        subtotal,
        total,
        clientes (
          nombre,
          apellido,
          codigo,
          dni,
          cuit,
          direccion,
          telefono
        ),
        detalles_pedido (
          cantidad,
          precio_unitario,
          subtotal,
          productos (
            nombre,
            codigo
          )
        )
      `)
      .eq('id', pedidoId)
      .single()

    if (pedidoError || !pedido) {
      return { success: false, error: 'Pedido no encontrado' }
    }

    // Calcular IVA
    const subtotal = Number(pedido.subtotal || 0)
    const iva21 = subtotal * 0.21
    const iva105 = subtotal * 0.105
    const total = subtotal + iva21 + iva105

    // Crear PDF estándar para factura
    const doc = new PDFDocument({ margin: 50 })
    const buffers: Buffer[] = []

    return new Promise((resolve, reject) => {
      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => {
        resolve({
          success: true,
          data: Buffer.concat(buffers),
        })
      })
      doc.on('error', reject)

      // Encabezado
      doc.fontSize(18).font('Helvetica-Bold').text(`FACTURA ${tipoFactura}`, { align: 'center' })
      doc.moveDown()

      // Datos de la empresa
      doc.fontSize(10).font('Helvetica')
      doc.text('AVÍCOLA DEL SUR')
      doc.text('CUIT: XX-XXXXXXXX-X')
      doc.text('Dirección: [Dirección de la empresa]')
      doc.moveDown()

      // Datos del cliente
      const cliente = pedido.clientes as any
      if (cliente) {
        const clienteData = Array.isArray(cliente) ? cliente[0] : cliente
        doc.fontSize(12).font('Helvetica-Bold').text('DATOS DEL CLIENTE:')
        doc.fontSize(10).font('Helvetica')
        doc.text(`Razón Social: ${clienteData.nombre || ''} ${clienteData.apellido || ''}`.trim())
        if (tipoFactura === 'A' && clienteData.cuit) {
          doc.text(`CUIT: ${clienteData.cuit}`)
        } else if (tipoFactura === 'B' && clienteData.dni) {
          doc.text(`DNI: ${clienteData.dni}`)
        }
        if (clienteData.direccion) {
          doc.text(`Dirección: ${clienteData.direccion}`)
        }
      }

      doc.moveDown()
      doc.text(`Número de Factura: ${pedido.numero_pedido}`)
      doc.text(`Fecha: ${new Date(pedido.fecha_pedido).toLocaleDateString('es-AR')}`)
      doc.moveDown()

      // Tabla de productos
      doc.fontSize(12).font('Helvetica-Bold').text('DETALLE:')
      doc.moveDown(0.5)

      const tableTop = doc.y
      doc.fontSize(9).font('Helvetica-Bold')
      doc.text('Producto', 50, tableTop)
      doc.text('Cant.', 200, tableTop)
      doc.text('Precio Unit.', 250, tableTop)
      doc.text('Subtotal', 330, tableTop)

      let y = tableTop + 20
      const detalles = pedido.detalles_pedido as any[]
      if (detalles && detalles.length > 0) {
        doc.fontSize(9).font('Helvetica')
        detalles.forEach((detalle) => {
          const producto = detalle.productos
          if (producto) {
            const nombreProd = Array.isArray(producto) ? producto[0] : producto
            doc.text(nombreProd?.nombre || 'Producto', 50, y, { width: 140 })
            doc.text(String(detalle.cantidad || 0), 200, y)
            doc.text(`$${detalle.precio_unitario?.toFixed(2) || '0.00'}`, 250, y)
            doc.text(`$${detalle.subtotal?.toFixed(2) || '0.00'}`, 330, y)
            y += 20
          }
        })
      }

      doc.moveDown()
      y = doc.y

      // Totales con IVA
      doc.fontSize(10).font('Helvetica')
      doc.text(`Subtotal: $${subtotal.toFixed(2)}`, 300, y, { align: 'right' })
      y += 15
      doc.text(`IVA 10.5%: $${iva105.toFixed(2)}`, 300, y, { align: 'right' })
      y += 15
      doc.text(`IVA 21%: $${iva21.toFixed(2)}`, 300, y, { align: 'right' })
      y += 20
      doc.fontSize(12).font('Helvetica-Bold')
      doc.text(`TOTAL: $${total.toFixed(2)}`, 300, y, { align: 'right' })

      doc.end()
    })
  } catch (error) {
    return {
      success: false,
      error: `Error interno: ${error instanceof Error ? error.message : 'Error desconocido'}`,
    }
  }
}

// ===========================================
// DEVOLUCIONES
// ===========================================

export interface ItemDevolucion {
  productoId: string
  cantidad: number
  loteId?: string
  motivo: string
}

export interface DevolucionVentaParams {
  pedidoId: string
  items: ItemDevolucion[]
  observaciones?: string
}

/**
 * Obtiene los productos de un pedido para devolución
 */
export async function obtenerProductosPedidoAction(
  pedidoId: string
): Promise<ApiResponse<Array<{
  productoId: string
  productoNombre: string
  productoCodigo: string
  cantidad: number
  precioUnitario: number
  subtotal: number
  loteId?: string
}>>> {
  try {
    const supabase = await createClient()

    const { data: detalles, error } = await supabase
      .from('detalles_pedido')
      .select(`
        producto_id,
        cantidad,
        precio_unitario,
        subtotal,
        lote_id,
        productos (
          nombre,
          codigo
        )
      `)
      .eq('pedido_id', pedidoId)

    if (error) {
      return { success: false, error: `Error al obtener productos: ${error.message}` }
    }

    const productos = (detalles || []).map((detalle: any) => {
      const producto = Array.isArray(detalle.productos) ? detalle.productos[0] : detalle.productos
      return {
        productoId: detalle.producto_id,
        productoNombre: producto?.nombre || 'Producto',
        productoCodigo: producto?.codigo || '',
        cantidad: Number(detalle.cantidad),
        precioUnitario: Number(detalle.precio_unitario),
        subtotal: Number(detalle.subtotal),
        loteId: detalle.lote_id,
      }
    })

    return {
      success: true,
      data: productos,
    }
  } catch (error) {
    return {
      success: false,
      error: `Error interno: ${error instanceof Error ? error.message : 'Error desconocido'}`,
    }
  }
}

/**
 * Registra una devolución de venta con reintegro de stock y caja
 */
export async function registrarDevolucionVentaAction(
  params: DevolucionVentaParams
): Promise<ApiResponse<{ devolucionId: string }>> {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Obtener ID de usuario
    const { data: userData, error: userDataError } = await supabase
      .from('usuarios')
      .select('id')
      .eq('email', user.email)
      .single()

    if (userDataError || !userData) {
      return { success: false, error: 'Usuario no encontrado' }
    }

    // Obtener pedido para verificar
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .select('id, total, cliente_id, sucursal_id, caja_movimiento_id')
      .eq('id', params.pedidoId)
      .single()

    if (pedidoError || !pedido) {
      return { success: false, error: 'Pedido no encontrado' }
    }

    // Crear registro de devolución
    const { data: devolucion, error: devolucionError } = await supabase
      .from('devoluciones')
      .insert({
        pedido_id: params.pedidoId,
        usuario_id: userData.id,
        motivo: params.items.map(i => `${i.productoId}: ${i.motivo}`).join('; '),
        observaciones: params.observaciones,
      })
      .select('id')
      .single()

    if (devolucionError) {
      return { success: false, error: `Error al crear devolución: ${devolucionError.message}` }
    }

    // Procesar cada item de devolución
    for (const item of params.items) {
      // Obtener detalle del pedido para este producto
      const { data: detalles, error: detallesError } = await supabase
        .from('detalles_pedido')
        .select('lote_id, cantidad, precio_unitario, subtotal')
        .eq('pedido_id', params.pedidoId)
        .eq('producto_id', item.productoId)
        .limit(1)
        .single()

      if (!detalles || detallesError) {
        continue // Saltar si no se encuentra el detalle
      }

      // Reintegrar stock al lote
      if (detalles.lote_id) {
        await supabase.rpc('fn_reintegrar_stock_lote', {
          p_lote_id: detalles.lote_id,
          p_cantidad: item.cantidad,
          p_motivo: `Devolución de venta: ${item.motivo}`,
          p_usuario_id: userData.id,
        })
      }

      // Registrar movimiento de stock
      await supabase
        .from('movimientos_stock')
        .insert({
          lote_id: detalles.lote_id,
          tipo_movimiento: 'entrada',
          cantidad: item.cantidad,
          motivo: `Devolución de venta - Pedido ${params.pedidoId}`,
          usuario_id: userData.id,
          pedido_id: params.pedidoId,
        })
    }

    // Reintegrar a caja si el pedido tiene movimiento de caja
    if (pedido.caja_movimiento_id) {
      const { data: movimiento, error: movimientoError } = await supabase
        .from('tesoreria_movimientos')
        .select('caja_id, monto')
        .eq('id', pedido.caja_movimiento_id)
        .single()

      if (movimiento && !movimientoError) {
        // Calcular monto a reintegrar (proporcional a los items devueltos)
        const totalItemsDevolucion = params.items.reduce((sum, item) => {
          return sum + (item.cantidad * (params.items.find(i => i.productoId === item.productoId) ? 1 : 0))
        }, 0)

        // Calcular proporción (simplificado - debería usar precios reales)
        const montoDevolucion = (totalItemsDevolucion / params.items.length) * (pedido.total || 0)

        if (montoDevolucion > 0) {
          // Crear movimiento de egreso (reintegro)
          await supabase.rpc('fn_crear_movimiento_caja', {
            p_caja_id: movimiento.caja_id,
            p_tipo: 'egreso',
            p_monto: montoDevolucion,
            p_descripcion: `Devolución de venta - Pedido ${params.pedidoId}`,
            p_origen_tipo: 'devolucion',
            p_origen_id: devolucion.id,
            p_user_id: userData.id,
            p_metodo_pago: 'devolucion',
          })
        }
      }
    }

    // Actualizar estado del pedido si todos los items fueron devueltos
    // TODO: Implementar lógica completa

    revalidatePath('/sucursal/ventas')
    revalidatePath('/sucursal/dashboard')

    return {
      success: true,
      data: { devolucionId: devolucion.id },
    }
  } catch (error) {
    return {
      success: false,
      error: `Error interno: ${error instanceof Error ? error.message : 'Error desconocido'}`,
    }
  }
}

