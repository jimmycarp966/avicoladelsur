import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exportReportSchema } from '@/lib/schemas/tesoreria.schema'
import PDFDocument from 'pdfkit'

function toCsv(headers: string[], rows: Array<Record<string, any>>) {
  const escape = (value: any) => {
    if (value === null || value === undefined) return ''
    const str = String(value)
    if (str.includes(';') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const headerLine = headers.join(';')
  const dataLines = rows.map(row => headers.map(header => escape(row[header])).join(';'))
  return [headerLine, ...dataLines].join('\n')
}

async function toPdf(
  title: string,
  headers: string[],
  rows: Array<Record<string, any>>
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 })
    const buffers: Buffer[] = []

    doc.on('data', buffers.push.bind(buffers))
    doc.on('end', () => {
      resolve(Buffer.concat(buffers))
    })
    doc.on('error', reject)

    // Título
    doc.fontSize(18).text(title, { align: 'center' })
    doc.moveDown()

    // Fecha de generación
    doc.fontSize(10).text(`Generado el: ${new Date().toLocaleString('es-AR')}`, { align: 'right' })
    doc.moveDown(2)

    if (rows.length === 0) {
      doc.fontSize(12).text('No hay datos para mostrar', { align: 'center' })
      doc.end()
      return
    }

    // Encabezados
    doc.fontSize(10).font('Helvetica-Bold')
    const headerY = doc.y
    const colWidth = (doc.page.width - 100) / headers.length
    let x = 50

    headers.forEach((header, i) => {
      doc.text(header, x, headerY, { width: colWidth, align: 'left' })
      x += colWidth
    })

    doc.moveDown()
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke()
    doc.moveDown(0.5)

    // Filas
    doc.font('Helvetica')
    rows.forEach((row, rowIndex) => {
      // Verificar si necesitamos nueva página
      if (doc.y > doc.page.height - 100) {
        doc.addPage()
      }

      x = 50
      headers.forEach((header) => {
        const value = row[header] ?? ''
        doc.text(String(value), x, doc.y, { width: colWidth, align: 'left' })
        x += colWidth
      })
      doc.moveDown(0.8)

      // Línea separadora cada 5 filas
      if ((rowIndex + 1) % 5 === 0) {
        doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke()
        doc.moveDown(0.5)
      }
    })

    // Pie de página
    doc.fontSize(8).text(`Total de registros: ${rows.length}`, 50, doc.page.height - 50, {
      align: 'left',
    })

    doc.end()
  })
}

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const parsed = exportReportSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    let headers: string[] = []
    let rows: Array<Record<string, any>> = []

    switch (parsed.data.tipo) {
      case 'ventas': {
        headers = ['numero_pedido', 'cliente', 'total', 'estado', 'pago_estado', 'fecha_pedido']
        const { data, error } = await supabase
          .from('pedidos')
          .select(
            `
            numero_pedido,
            total,
            estado,
            pago_estado,
            fecha_pedido,
            clientes (nombre)
          `
          )
          .order('fecha_pedido', { ascending: false })

        if (error) throw error

        rows = (data || []).map(p => ({
          numero_pedido: p.numero_pedido,
          cliente: (p as any).clientes?.nombre || '',
          total: p.total,
          estado: p.estado,
          pago_estado: p.pago_estado,
          fecha_pedido: p.fecha_pedido,
        }))
        break
      }
      case 'gastos': {
        headers = ['fecha', 'categoria', 'monto', 'descripcion', 'afecta_caja']
        const { data, error } = await supabase
          .from('gastos')
          .select(
            `
            fecha,
            monto,
            descripcion,
            afecta_caja,
            gastos_categorias (nombre)
          `
          )
          .order('fecha', { ascending: false })

        if (error) throw error

        rows = (data || []).map(g => ({
          fecha: g.fecha,
          categoria: (g as any).gastos_categorias?.nombre || '',
          monto: g.monto,
          descripcion: g.descripcion || '',
          afecta_caja: g.afecta_caja ? 'Sí' : 'No',
        }))
        break
      }
      case 'movimientos_caja': {
        headers = ['fecha', 'caja', 'tipo', 'monto', 'descripcion', 'metodo_pago']
        const { data, error } = await supabase
          .from('tesoreria_movimientos')
          .select(
            `
            created_at,
            tipo,
            monto,
            descripcion,
            metodo_pago,
            tesoreria_cajas (nombre)
          `
          )
          .order('created_at', { ascending: false })

        if (error) throw error

        rows = (data || []).map(m => ({
          fecha: m.created_at,
          caja: (m as any).tesoreria_cajas?.nombre || '',
          tipo: m.tipo,
          monto: m.monto,
          descripcion: m.descripcion || '',
          metodo_pago: m.metodo_pago || '',
        }))
        break
      }
      case 'cuentas_corrientes': {
        headers = ['cliente', 'saldo', 'limite_credito', 'estado']
        const { data, error } = await supabase
          .from('cuentas_corrientes')
          .select(
            `
            saldo,
            limite_credito,
            clientes (
              nombre,
              bloqueado_por_deuda
            )
          `
          )

        if (error) throw error

        rows = (data || []).map(c => ({
          cliente: (c as any).clientes?.nombre || '',
          saldo: c.saldo,
          limite_credito: c.limite_credito,
          estado: (c as any).clientes?.bloqueado_por_deuda ? 'Bloqueado' : 'Activo',
        }))
        break
      }
      default:
        headers = []
        rows = []
    }

    // Registrar exportación
    await supabase.from('reportes_export').insert({
      tipo: parsed.data.tipo,
      filtros: parsed.data.filtros || {},
      formato: parsed.data.formato,
      status: 'completed',
      generated_by: user?.id ?? null,
      completed_at: new Date().toISOString(),
    })

    const tipoTitulos: Record<string, string> = {
      ventas: 'Reporte de Ventas',
      gastos: 'Reporte de Gastos',
      movimientos_caja: 'Reporte de Movimientos de Caja',
      cuentas_corrientes: 'Reporte de Cuentas Corrientes',
    }

    if (parsed.data.formato === 'pdf') {
      const pdfBuffer = await toPdf(tipoTitulos[parsed.data.tipo] || 'Reporte', headers, rows)
      const pdfArrayBuffer = pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength)
      const pdfUint8Array = new Uint8Array(pdfArrayBuffer)
      return new NextResponse(pdfUint8Array as any, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${parsed.data.tipo}-${Date.now()}.pdf"`,
        },
      })
    } else {
      const csv = toCsv(headers, rows)
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${parsed.data.tipo}-${Date.now()}.csv"`,
        },
      })
    }
  } catch (error: any) {
    console.error('exportReport', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al generar reporte' },
      { status: 500 }
    )
  }
}

