'use server'

import { format } from 'date-fns'
import PDFDocument from 'pdfkit'
import { createClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@/types/api.types'
import { obtenerRutaPorPedidoIdAction } from '@/actions/reparto.actions'
import { obtenerEntregasPedidoAction, obtenerResumenEntregasAction } from '@/actions/entregas.actions'
import {
  buildPedidoFinalViewModel,
  formatPedidoFinalCantidad,
} from '@/lib/pedidos/pedido-final-view'

type PedidoPdfDocument = InstanceType<typeof PDFDocument>

const ensurePdfSpace = (doc: PedidoPdfDocument, heightNeeded: number) => {
  const bottomLimit = doc.page.height - doc.page.margins.bottom
  if (doc.y + heightNeeded > bottomLimit) {
    doc.addPage()
  }
}

const drawPdfSummaryBox = (
  doc: PedidoPdfDocument,
  input: { x: number; y: number; width: number; label: string; value: string },
) => {
  doc.roundedRect(input.x, input.y, input.width, 46, 6).fillAndStroke('#f8fafc', '#e2e8f0')
  doc.fillColor('#64748b').fontSize(9).text(input.label, input.x + 10, input.y + 8, {
    width: input.width - 20,
  })
  doc.fillColor('#0f172a').fontSize(13).text(input.value, input.x + 10, input.y + 22, {
    width: input.width - 20,
  })
}

export async function generarPDFPedidoAgrupado(
  pedidoId: string,
): Promise<ApiResponse<Buffer>> {
  try {
    const supabase = await createClient()

    const { data: resultado, error } = await supabase.rpc('fn_obtener_pedido_completo', {
      p_pedido_id: pedidoId,
    })

    const pedido = resultado?.data?.pedido

    if (error || !resultado?.success || !pedido) {
      return {
        success: false,
        error: error?.message || resultado?.error || 'Pedido no encontrado',
      }
    }

    const [rutaResult, entregasResult, resumenEntregasResult] = await Promise.all([
      obtenerRutaPorPedidoIdAction(pedidoId),
      obtenerEntregasPedidoAction(pedidoId),
      obtenerResumenEntregasAction(pedidoId),
    ])

    const pedidoFinal = buildPedidoFinalViewModel({
      pedido,
      ruta: rutaResult.success ? rutaResult.data : null,
      entregas: entregasResult.success ? entregasResult.data || [] : [],
      resumenEntregas: resumenEntregasResult.success ? resumenEntregasResult.data || null : null,
    })

    const doc = new PDFDocument({ margin: 50 })
    const buffers: Buffer[] = []

    return await new Promise((resolve) => {
      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => {
        resolve({
          success: true,
          data: Buffer.concat(buffers),
        })
      })

      doc.fontSize(20).fillColor('#0f172a').text('PEDIDO FINAL AGRUPADO', { align: 'center' })
      doc.moveDown(0.25)
      doc
        .fontSize(10)
        .fillColor('#475569')
        .text(`Pedido ${pedidoFinal.resumenOperativo.numeroPedido}`, { align: 'center' })
      doc.moveDown()

      doc.fillColor('#0f172a').fontSize(12)
      doc.text(
        `Fecha de entrega: ${
          pedidoFinal.resumenOperativo.fechaEntrega
            ? format(new Date(pedidoFinal.resumenOperativo.fechaEntrega), 'dd/MM/yyyy')
            : 'Sin fecha'
        }`,
      )
      doc.text(`Zona: ${pedidoFinal.resumenOperativo.zona}`)
      doc.text(
        `Turno: ${pedidoFinal.resumenOperativo.turno || 'Sin turno'}  |  Estado: ${pedidoFinal.resumenOperativo.estado}`,
      )
      doc.text(
        `Ruta: ${
          pedidoFinal.resumenOperativo.rutaNumero
            ? `Ruta ${pedidoFinal.resumenOperativo.rutaNumero}`
            : 'Sin ruta'
        }  |  Chofer: ${pedidoFinal.resumenOperativo.repartidor}`,
      )
      doc.text(`Vehículo: ${pedidoFinal.resumenOperativo.vehiculo}`)
      doc.moveDown()

      const summaryTop = doc.y
      drawPdfSummaryBox(doc, {
        x: 50,
        y: summaryTop,
        width: 120,
        label: 'Entregas',
        value: `${pedidoFinal.resumenOperativo.cantidadEntregas}`,
      })
      drawPdfSummaryBox(doc, {
        x: 180,
        y: summaryTop,
        width: 120,
        label: 'Kg finales',
        value: `${pedidoFinal.resumenOperativo.totalKgFinal.toFixed(2)} kg`,
      })
      drawPdfSummaryBox(doc, {
        x: 310,
        y: summaryTop,
        width: 120,
        label: 'Unidades',
        value: `${pedidoFinal.resumenOperativo.totalUnidades.toFixed(0)} u`,
      })
      drawPdfSummaryBox(doc, {
        x: 440,
        y: summaryTop,
        width: 120,
        label: 'Total final',
        value: `$${pedidoFinal.resumenOperativo.totalMonetario.toFixed(2)}`,
      })
      doc.y = summaryTop + 68

      doc.fontSize(15).fillColor('#0f172a').text('Consolidado final por producto')
      doc.moveDown(0.5)

      for (const categoria of pedidoFinal.consolidadoFinalPorProducto) {
        ensurePdfSpace(doc, 40)
        doc.fillColor('#1e293b').fontSize(12).text(categoria.nombre)
        doc.moveTo(50, doc.y + 4).lineTo(560, doc.y + 4).stroke('#cbd5e1')
        doc.moveDown(0.5)

        doc.fillColor('#64748b').fontSize(9)
        doc.text('Producto', 50, doc.y, { width: 220 })
        doc.text('Tipo', 280, doc.y, { width: 70 })
        doc.text('Cantidad final', 350, doc.y, { width: 90, align: 'right' })
        doc.text('Entregas', 445, doc.y, { width: 45, align: 'right' })
        doc.text('Total', 495, doc.y, { width: 65, align: 'right' })
        doc.moveDown(0.5)

        for (const producto of categoria.productos) {
          ensurePdfSpace(doc, 24)
          const rowY = doc.y
          doc.fillColor('#0f172a').fontSize(10)
          doc.text(producto.nombre, 50, rowY, { width: 220 })
          doc.text(producto.pesable ? 'Balanza' : 'Unidad', 280, rowY, { width: 70 })
          doc.text(
            formatPedidoFinalCantidad(producto.totalCantidadFinal, producto.pesable),
            350,
            rowY,
            { width: 90, align: 'right' },
          )
          doc.text(`${producto.entregas}`, 445, rowY, { width: 45, align: 'right' })
          doc.text(`$${producto.totalSubtotal.toFixed(2)}`, 495, rowY, {
            width: 65,
            align: 'right',
          })
          doc.moveDown(0.5)
        }

        doc.moveDown(0.75)
      }

      ensurePdfSpace(doc, 60)
      doc.fontSize(15).fillColor('#0f172a').text('Entregas finales por cliente')
      doc.moveDown(0.5)

      for (const entrega of pedidoFinal.entregasFinales) {
        ensurePdfSpace(doc, 110)
        const startY = doc.y

        doc.roundedRect(50, startY, 510, 58, 6).fillAndStroke('#ffffff', '#e2e8f0')
        doc.fillColor('#0f172a').fontSize(12).text(
          `${entrega.ordenEntrega}. ${entrega.clienteNombre}`,
          62,
          startY + 10,
          { width: 240 },
        )
        doc.fillColor('#475569').fontSize(9)
        doc.text(entrega.direccion || 'Sin direccion', 62, startY + 26, { width: 250 })
        doc.text(
          `Estado entrega: ${entrega.estadoEntrega} | Pago: ${entrega.estadoPago}`,
          330,
          startY + 10,
          { width: 210, align: 'right' },
        )
        doc.text(
          `Total: $${entrega.total.toFixed(2)} | ${entrega.totalKg.toFixed(2)} kg`,
          330,
          startY + 26,
          { width: 210, align: 'right' },
        )
        doc.y = startY + 70

        for (const item of entrega.items) {
          ensurePdfSpace(doc, 20)
          const itemY = doc.y
          doc.fillColor('#0f172a').fontSize(9)
          doc.text(item.nombre, 62, itemY, { width: 250 })
          doc.fillColor('#64748b').text(item.pesable ? 'Balanza' : 'Unidad', 320, itemY, {
            width: 70,
          })
          doc.fillColor('#0f172a').text(
            formatPedidoFinalCantidad(item.cantidadFinal, item.pesable),
            390,
            itemY,
            { width: 80, align: 'right' },
          )
          doc.text(`$${item.subtotal.toFixed(2)}`, 475, itemY, {
            width: 70,
            align: 'right',
          })
          doc.moveDown(0.4)
        }

        doc.moveDown(0.8)
      }

      if (pedidoFinal.observaciones) {
        ensurePdfSpace(doc, 50)
        doc.fontSize(13).fillColor('#0f172a').text('Observaciones')
        doc.moveDown(0.3)
        doc.fontSize(10).fillColor('#334155').text(pedidoFinal.observaciones)
      }

      doc.end()
    })
  } catch (error: any) {
    console.error('Error al generar PDF del pedido:', error)
    return {
      success: false,
      error: error.message || 'Error al generar PDF del pedido',
    }
  }
}
