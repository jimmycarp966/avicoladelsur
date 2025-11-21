'use server'

import { createClient } from '@/lib/supabase/server'
import PDFDocument from 'pdfkit'
import type { ApiResponse } from '@/types/api.types'

// Generar PDF de pedido
export async function generarPDFPedido(pedidoId: string): Promise<ApiResponse<Buffer>> {
  try {
    const supabase = await createClient()

    // Obtener datos completos del pedido
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .select(`
        *,
        clientes(nombre, telefono, direccion, email),
        detalles_pedido(
          *,
          productos(codigo, nombre, unidad_medida, precio_venta)
        )
      `)
      .eq('id', pedidoId)
      .single()

    if (pedidoError) throw pedidoError
    if (!pedido) {
      return {
        success: false,
        error: 'Pedido no encontrado',
      }
    }

    // Crear PDF
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' })
      const buffers: Buffer[] = []

      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => {
        resolve({
          success: true,
          data: Buffer.concat(buffers),
        })
      })
      doc.on('error', reject)

      // Encabezado
      doc.fontSize(20).font('Helvetica-Bold').text('Avícola del Sur', { align: 'center' })
      doc.fontSize(14).font('Helvetica').text('Comprobante de Pedido', { align: 'center' })
      doc.moveDown()

      // Información del pedido
      doc.fontSize(12).font('Helvetica-Bold').text('Número de Pedido:', { continued: true })
      doc.font('Helvetica').text(` ${pedido.numero_pedido}`)
      doc.font('Helvetica-Bold').text('Fecha:', { continued: true })
      doc.font('Helvetica').text(` ${new Date(pedido.fecha_pedido).toLocaleDateString('es-AR')}`)
      doc.font('Helvetica-Bold').text('Estado:', { continued: true })
      doc.font('Helvetica').text(` ${pedido.estado}`)
      doc.moveDown()

      // Información del cliente
      doc.fontSize(14).font('Helvetica-Bold').text('Cliente')
      doc.fontSize(10).font('Helvetica')
      const cliente = pedido.clientes as any
      if (cliente) {
        doc.text(`Nombre: ${cliente.nombre || 'N/A'}`)
        if (cliente.telefono) doc.text(`Teléfono: ${cliente.telefono}`)
        if (cliente.direccion) doc.text(`Dirección: ${cliente.direccion}`)
        if (cliente.email) doc.text(`Email: ${cliente.email}`)
      }
      doc.moveDown()

      // Items del pedido
      doc.fontSize(14).font('Helvetica-Bold').text('Items del Pedido')
      doc.moveDown(0.5)

      const detalles = pedido.detalles_pedido as any[] || []
      if (detalles.length === 0) {
        doc.font('Helvetica').text('No hay items en este pedido')
      } else {
        // Encabezados de tabla
        const tableTop = doc.y
        doc.fontSize(9).font('Helvetica-Bold')
        doc.text('Código', 50, tableTop)
        doc.text('Producto', 120, tableTop)
        doc.text('Cant.', 300, tableTop, { width: 60, align: 'right' })
        doc.text('Precio Unit.', 370, tableTop, { width: 80, align: 'right' })
        doc.text('Subtotal', 460, tableTop, { width: 80, align: 'right' })

        let y = tableTop + 15
        doc.font('Helvetica')

        detalles.forEach((detalle: any) => {
          if (y > doc.page.height - 100) {
            doc.addPage()
            y = 50
          }

          const producto = detalle.productos as any
          doc.text(producto?.codigo || 'N/A', 50, y)
          doc.text(producto?.nombre || 'N/A', 120, y, { width: 170 })
          doc.text(String(detalle.cantidad || 0), 300, y, { width: 60, align: 'right' })
          doc.text(`$${Number(detalle.precio_unitario || 0).toFixed(2)}`, 370, y, { width: 80, align: 'right' })
          doc.text(`$${Number(detalle.subtotal || 0).toFixed(2)}`, 460, y, { width: 80, align: 'right' })

          y += 15
        })

        // Línea separadora antes de totales
        doc.moveTo(50, y).lineTo(540, y).stroke()
        y += 10

        // Totales
        doc.fontSize(10).font('Helvetica-Bold')
        doc.text('Subtotal:', 370, y, { width: 80, align: 'right' })
        doc.text(`$${Number(pedido.subtotal || 0).toFixed(2)}`, 460, y, { width: 80, align: 'right' })
        y += 15

        if (pedido.descuento && Number(pedido.descuento) > 0) {
          doc.text('Descuento:', 370, y, { width: 80, align: 'right' })
          doc.text(`-$${Number(pedido.descuento).toFixed(2)}`, 460, y, { width: 80, align: 'right' })
          y += 15
        }

        doc.fontSize(12)
        doc.text('Total:', 370, y, { width: 80, align: 'right' })
        doc.text(`$${Number(pedido.total || 0).toFixed(2)}`, 460, y, { width: 80, align: 'right' })
      }

      doc.moveDown(2)

      // Observaciones
      if (pedido.observaciones) {
        doc.fontSize(10).font('Helvetica-Bold').text('Observaciones:')
        doc.font('Helvetica').text(pedido.observaciones, { align: 'left' })
      }

      // Pie de página
      doc.fontSize(8).text(
        `Generado el ${new Date().toLocaleString('es-AR')}`,
        50,
        doc.page.height - 50,
        { align: 'left' }
      )

      doc.end()
    })
  } catch (error: any) {
    console.error('Error al generar PDF de pedido:', error)
    return {
      success: false,
      error: error.message || 'Error al generar PDF del pedido',
    }
  }
}

