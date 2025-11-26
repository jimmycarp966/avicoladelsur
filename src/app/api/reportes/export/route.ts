import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exportReporteSchema } from '@/lib/schemas/reportes.schema'
import PDFDocument from 'pdfkit'
import { getTodayArgentina } from '@/lib/utils'
import * as XLSX from 'xlsx'

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
    const parsed = exportReporteSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    let headers: string[] = []
    let rows: Array<Record<string, any>> = []

    // Aplicar filtros de fecha si existen
    const fechaDesde = parsed.data.filtros?.fechaDesde
    const fechaHasta = parsed.data.filtros?.fechaHasta

    switch (parsed.data.tipo) {
      case 'ventas': {
        headers = ['numero_pedido', 'cliente', 'total', 'estado', 'pago_estado', 'fecha_pedido', 'zona', 'vendedor']
        let query = supabase
          .from('pedidos')
          .select(
            `
            numero_pedido,
            total,
            estado,
            pago_estado,
            fecha_pedido,
            clientes!inner(nombre, zona_entrega),
            usuarios!pedidos_usuario_vendedor_fkey(nombre, apellido)
          `
          )
          .order('fecha_pedido', { ascending: false })

        if (fechaDesde) {
          query = query.gte('fecha_pedido', `${fechaDesde}T00:00:00`)
        }
        if (fechaHasta) {
          query = query.lte('fecha_pedido', `${fechaHasta}T23:59:59`)
        }

        const { data, error } = await query

        if (error) throw error

        rows = (data || []).map((p: any) => ({
          numero_pedido: p.numero_pedido,
          cliente: p.clientes?.nombre || '',
          total: p.total,
          estado: p.estado,
          pago_estado: p.pago_estado,
          fecha_pedido: p.fecha_pedido,
          zona: p.clientes?.zona_entrega || '',
          vendedor: p.usuarios ? `${p.usuarios.nombre || ''} ${p.usuarios.apellido || ''}`.trim() : '',
        }))
        break
      }
      case 'gastos': {
        headers = ['fecha', 'categoria', 'monto', 'descripcion', 'afecta_caja']
        let query = supabase
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

        if (fechaDesde) {
          query = query.gte('fecha', fechaDesde)
        }
        if (fechaHasta) {
          query = query.lte('fecha', fechaHasta)
        }

        const { data, error } = await query

        if (error) throw error

        rows = (data || []).map((g: any) => ({
          fecha: g.fecha,
          categoria: g.gastos_categorias?.nombre || '',
          monto: g.monto,
          descripcion: g.descripcion || '',
          afecta_caja: g.afecta_caja ? 'Sí' : 'No',
        }))
        break
      }
      case 'movimientos_caja': {
        headers = ['fecha', 'caja', 'tipo', 'monto', 'descripcion', 'metodo_pago']
        let query = supabase
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

        if (fechaDesde) {
          query = query.gte('created_at', `${fechaDesde}T00:00:00`)
        }
        if (fechaHasta) {
          query = query.lte('created_at', `${fechaHasta}T23:59:59`)
        }

        const { data, error } = await query

        if (error) throw error

        rows = (data || []).map((m: any) => ({
          fecha: m.created_at,
          caja: m.tesoreria_cajas?.nombre || '',
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

        rows = (data || []).map((c: any) => ({
          cliente: c.clientes?.nombre || '',
          saldo: c.saldo,
          limite_credito: c.limite_credito,
          estado: c.clientes?.bloqueado_por_deuda ? 'Bloqueado' : 'Activo',
        }))
        break
      }
      case 'kg_por_ruta': {
        const fecha = fechaDesde || getTodayArgentina()

        headers = [
          'numero_ruta',
          'fecha_ruta',
          'vehiculo',
          'zona',
          'total_kg',
          'total_ventas',
          'cantidad_entregas',
          'estado_ruta'
        ]

        const { data: rutas, error: rutasError } = await supabase
          .from('rutas_reparto')
          .select(`
            id,
            numero_ruta,
            fecha_ruta,
            estado,
            vehiculo:vehiculos(patente, modelo),
            zona:zonas(nombre),
            detalles:detalles_ruta(
              pedido:pedidos(
                total,
                detalles:detalles_pedido(
                  cantidad,
                  peso_final,
                  producto:productos(peso_unitario)
                )
              )
            )
          `)
          .eq('fecha_ruta', fecha)
          .order('numero_ruta', { ascending: true })

        if (rutasError) throw rutasError

        rows = (rutas || []).map((ruta: any) => {
          const detalles = ruta.detalles || []
          let totalKg = 0
          let totalVentas = 0

          detalles.forEach((detalle: any) => {
            const pedido = detalle.pedido
            if (pedido) {
              totalVentas += Number(pedido.total || 0)

              const detallesPedido = pedido.detalles || []
              detallesPedido.forEach((dp: any) => {
                if (dp.peso_final) {
                  totalKg += Number(dp.peso_final)
                } else if (dp.producto?.peso_unitario) {
                  totalKg += Number(dp.cantidad || 0) * Number(dp.producto.peso_unitario)
                } else {
                  totalKg += Number(dp.cantidad || 0)
                }
              })
            }
          })

          return {
            numero_ruta: ruta.numero_ruta || '',
            fecha_ruta: ruta.fecha_ruta || fecha,
            vehiculo: (ruta.vehiculo as any)?.patente || (ruta.vehiculo as any)?.modelo || 'N/A',
            zona: (ruta.zona as any)?.nombre || 'N/A',
            total_kg: totalKg.toFixed(2),
            total_ventas: totalVentas.toFixed(2),
            cantidad_entregas: detalles.length,
            estado_ruta: ruta.estado || 'pendiente',
          }
        })

        if (rows.length === 0) {
          const { data: pedidos, error: pedidosError } = await supabase
            .from('pedidos')
            .select(`
              total,
              fecha_pedido,
              detalles:detalles_pedido(
                cantidad,
                peso_final,
                producto:productos(peso_unitario)
              )
            `)
            .gte('fecha_pedido', `${fecha}T00:00:00`)
            .lt('fecha_pedido', `${fecha}T23:59:59`)

          if (!pedidosError && pedidos) {
            let totalKgDia = 0
            let totalVentasDia = 0

            pedidos.forEach((pedido: any) => {
              totalVentasDia += Number(pedido.total || 0)
              const detalles = pedido.detalles || []
              detalles.forEach((dp: any) => {
                if (dp.peso_final) {
                  totalKgDia += Number(dp.peso_final)
                } else if (dp.producto?.peso_unitario) {
                  totalKgDia += Number(dp.cantidad || 0) * Number(dp.producto.peso_unitario)
                }
              })
            })

            rows.push({
              numero_ruta: 'RESUMEN_DIA',
              fecha_ruta: fecha,
              vehiculo: 'TODOS',
              zona: 'TODAS',
              total_kg: totalKgDia.toFixed(2),
              total_ventas: totalVentasDia.toFixed(2),
              cantidad_entregas: pedidos.length,
              estado_ruta: 'completado',
            })
          }
        }

        break
      }
      case 'pedidos': {
        headers = [
          'numero_pedido',
          'cliente',
          'fecha_pedido',
          'estado',
          'pago_estado',
          'total',
          'vendedor',
          'zona',
        ]
        let query = supabase
          .from('pedidos')
          .select(
            `
            numero_pedido,
            fecha_pedido,
            total,
            estado,
            pago_estado,
            clientes!inner(nombre, zona_entrega),
            usuarios!pedidos_usuario_vendedor_fkey(nombre, apellido)
          `
          )
          .order('fecha_pedido', { ascending: false })

        if (fechaDesde) {
          query = query.gte('fecha_pedido', `${fechaDesde}T00:00:00`)
        }
        if (fechaHasta) {
          query = query.lte('fecha_pedido', `${fechaHasta}T23:59:59`)
        }

        const { data, error } = await query

        if (error) throw error

        rows = (data || []).map((p: any) => ({
          numero_pedido: p.numero_pedido,
          cliente: p.clientes?.nombre || '',
          fecha_pedido: p.fecha_pedido,
          estado: p.estado,
          pago_estado: p.pago_estado,
          total: p.total,
          vendedor: p.usuarios ? `${p.usuarios.nombre || ''} ${p.usuarios.apellido || ''}`.trim() : '',
          zona: p.clientes?.zona_entrega || '',
        }))
        break
      }
      case 'stock': {
        headers = [
          'producto',
          'categoria',
          'stock_actual',
          'stock_minimo',
          'stock_proyectado',
          'necesita_reposicion',
          'cantidad_recomendada',
        ]
        const { data: lotes } = await supabase
          .from('lotes')
          .select(
            `
            cantidad_disponible,
            productos!inner(id, nombre, categoria, stock_minimo)
          `
          )
          .eq('estado', 'disponible')

        const stockPorProducto: Record<string, any> = {}
        lotes?.forEach((lote: any) => {
          const productoId = lote.productos?.id
          if (!stockPorProducto[productoId]) {
            stockPorProducto[productoId] = {
              producto_nombre: lote.productos?.nombre,
              producto_categoria: lote.productos?.categoria,
              stock_actual: 0,
              stock_minimo: Number(lote.productos?.stock_minimo || 0),
            }
          }
          stockPorProducto[productoId].stock_actual += Number(lote.cantidad_disponible || 0)
        })

        rows = Object.values(stockPorProducto).map((p: any) => ({
          producto: p.producto_nombre,
          categoria: p.producto_categoria,
          stock_actual: p.stock_actual,
          stock_minimo: p.stock_minimo,
          stock_proyectado: p.stock_actual,
          necesita_reposicion: p.stock_actual < p.stock_minimo ? 'Sí' : 'No',
          cantidad_recomendada: p.stock_actual < p.stock_minimo ? p.stock_minimo - p.stock_actual : 0,
        }))
        break
      }
      case 'almacen': {
        headers = [
          'presupuesto',
          'fecha',
          'cliente',
          'tiempo_preparacion_min',
          'variacion_peso_promedio',
          'kg_despachados',
        ]
        let query = supabase
          .from('presupuestos')
          .select(
            `
            numero_presupuesto,
            created_at,
            updated_at,
            clientes!inner(nombre),
            presupuesto_items(pesable, peso_final, cantidad_solicitada)
          `
          )
          .eq('estado', 'facturado')
          .order('created_at', { ascending: false })

        if (fechaDesde) {
          query = query.gte('created_at', `${fechaDesde}T00:00:00`)
        }
        if (fechaHasta) {
          query = query.lte('created_at', `${fechaHasta}T23:59:59`)
        }

        const { data, error } = await query

        if (error) throw error

        rows = (data || []).map((p: any) => {
          const tiempo = p.updated_at && p.created_at
            ? Math.round((new Date(p.updated_at).getTime() - new Date(p.created_at).getTime()) / (1000 * 60))
            : 0
          const itemsPesables = (p.presupuesto_items || []).filter((i: any) => i.pesable)
          const variacionPromedio = itemsPesables.length > 0
            ? itemsPesables.reduce((sum: number, item: any) => {
                if (item.peso_final && item.cantidad_solicitada) {
                  const variacion = ((Number(item.peso_final) - Number(item.cantidad_solicitada)) / Number(item.cantidad_solicitada)) * 100
                  return sum + variacion
                }
                return sum
              }, 0) / itemsPesables.length
            : 0
          const kgDespachados = itemsPesables.reduce((sum: number, item: any) => sum + Number(item.peso_final || 0), 0)

          return {
            presupuesto: p.numero_presupuesto,
            fecha: p.created_at,
            cliente: p.clientes?.nombre || '',
            tiempo_preparacion_min: tiempo,
            variacion_peso_promedio: `${variacionPromedio.toFixed(2)}%`,
            kg_despachados: kgDespachados.toFixed(2),
          }
        })
        break
      }
      case 'reparto': {
        headers = [
          'numero_ruta',
          'fecha_ruta',
          'repartidor',
          'vehiculo',
          'zona',
          'entregas_totales',
          'entregas_exitosas',
          'tasa_exito',
          'km_recorridos',
          'tiempo_min',
        ]
        let query = supabase
          .from('rutas_reparto')
          .select(
            `
            numero_ruta,
            fecha_ruta,
            distancia_real_km,
            tiempo_real_min,
            repartidor_id,
            vehiculo_id,
            zona_id,
            detalles_ruta(estado_entrega),
            usuarios!rutas_reparto_repartidor_id_fkey(nombre, apellido),
            vehiculos!rutas_reparto_vehiculo_id_fkey(patente),
            zonas!rutas_reparto_zona_id_fkey(nombre)
          `
          )
          .order('fecha_ruta', { ascending: false })

        if (fechaDesde) {
          query = query.gte('fecha_ruta', fechaDesde)
        }
        if (fechaHasta) {
          query = query.lte('fecha_ruta', fechaHasta)
        }

        const { data, error } = await query

        if (error) throw error

        rows = (data || []).map((r: any) => {
          const entregasTotales = r.detalles_ruta?.length || 0
          const entregasExitosas = r.detalles_ruta?.filter((d: any) => d.estado_entrega === 'entregado').length || 0
          const tasaExito = entregasTotales > 0 ? (entregasExitosas / entregasTotales) * 100 : 0

          return {
            numero_ruta: r.numero_ruta,
            fecha_ruta: r.fecha_ruta,
            repartidor: r.usuarios ? `${r.usuarios.nombre || ''} ${r.usuarios.apellido || ''}`.trim() : '',
            vehiculo: r.vehiculos?.patente || '',
            zona: r.zonas?.nombre || '',
            entregas_totales: entregasTotales,
            entregas_exitosas: entregasExitosas,
            tasa_exito: `${tasaExito.toFixed(1)}%`,
            km_recorridos: Number(r.distancia_real_km || 0).toFixed(2),
            tiempo_min: r.tiempo_real_min || 0,
          }
        })
        break
      }
      case 'tesoreria': {
        headers = [
          'fecha',
          'tipo',
          'monto',
          'metodo_pago',
          'descripcion',
          'caja',
        ]
        let query = supabase
          .from('tesoreria_movimientos')
          .select(
            `
            created_at,
            tipo,
            monto,
            metodo_pago,
            descripcion,
            tesoreria_cajas!inner(nombre)
          `
          )
          .order('created_at', { ascending: false })

        if (fechaDesde) {
          query = query.gte('created_at', `${fechaDesde}T00:00:00`)
        }
        if (fechaHasta) {
          query = query.lte('created_at', `${fechaHasta}T23:59:59`)
        }

        const { data, error } = await query

        if (error) throw error

        rows = (data || []).map((m: any) => ({
          fecha: m.created_at,
          tipo: m.tipo,
          monto: m.monto,
          metodo_pago: m.metodo_pago || '',
          descripcion: m.descripcion || '',
          caja: m.tesoreria_cajas?.nombre || '',
        }))
        break
      }
      case 'clientes': {
        headers = [
          'cliente',
          'zona',
          'facturacion',
          'transacciones',
          'ticket_promedio',
          'ultima_compra',
          'primera_compra',
        ]
        let query = supabase
          .from('pedidos')
          .select(
            `
            total,
            fecha_pedido,
            cliente_id,
            clientes!inner(nombre, zona_entrega)
          `
          )
          .eq('estado', 'entregado')
          .order('fecha_pedido', { ascending: false })

        if (fechaDesde) {
          query = query.gte('fecha_pedido', `${fechaDesde}T00:00:00`)
        }
        if (fechaHasta) {
          query = query.lte('fecha_pedido', `${fechaHasta}T23:59:59`)
        }

        const { data: pedidos } = await query

        const clientesMap: Record<string, any> = {}
        pedidos?.forEach((p: any) => {
          const clienteId = p.cliente_id
          if (!clientesMap[clienteId]) {
            clientesMap[clienteId] = {
              cliente_nombre: p.clientes?.nombre || '',
              cliente_zona: p.clientes?.zona_entrega || '',
              facturacion: 0,
              transacciones: 0,
              ultima_compra: p.fecha_pedido,
              primera_compra: p.fecha_pedido,
            }
          }
          clientesMap[clienteId].facturacion += Number(p.total || 0)
          clientesMap[clienteId].transacciones += 1
          if (new Date(p.fecha_pedido) > new Date(clientesMap[clienteId].ultima_compra)) {
            clientesMap[clienteId].ultima_compra = p.fecha_pedido
          }
          if (new Date(p.fecha_pedido) < new Date(clientesMap[clienteId].primera_compra)) {
            clientesMap[clienteId].primera_compra = p.fecha_pedido
          }
        })

        rows = Object.values(clientesMap).map((c: any) => ({
          cliente: c.cliente_nombre,
          zona: c.cliente_zona,
          facturacion: c.facturacion,
          transacciones: c.transacciones,
          ticket_promedio: c.transacciones > 0 ? (c.facturacion / c.transacciones).toFixed(2) : 0,
          ultima_compra: c.ultima_compra,
          primera_compra: c.primera_compra,
        }))
        break
      }
      case 'empleados': {
        headers = [
          'empleado',
          'sector',
          'fecha',
          'horas_trabajadas',
          'retraso_minutos',
          'falta_sin_aviso',
          'estado',
        ]
        let query = supabase
          .from('rrhh_asistencia')
          .select(
            `
            fecha,
            horas_trabajadas,
            retraso_minutos,
            falta_sin_aviso,
            estado,
            rrhh_empleados!inner(
              rrhh_categorias(nombre)
            )
          `
          )
          .order('fecha', { ascending: false })

        if (fechaDesde) {
          query = query.gte('fecha', fechaDesde)
        }
        if (fechaHasta) {
          query = query.lte('fecha', fechaHasta)
        }

        const { data, error } = await query

        if (error) throw error

        rows = (data || []).map((a: any) => ({
          empleado: a.rrhh_empleados?.id || '',
          sector: a.rrhh_empleados?.rrhh_categorias?.nombre || '',
          fecha: a.fecha,
          horas_trabajadas: a.horas_trabajadas,
          retraso_minutos: a.retraso_minutos || 0,
          falta_sin_aviso: a.falta_sin_aviso ? 'Sí' : 'No',
          estado: a.estado,
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
      kg_por_ruta: 'Reporte de KG por Ruta y Ventas del Día',
      pedidos: 'Reporte de Pedidos',
      stock: 'Reporte de Stock',
      almacen: 'Reporte de Almacén',
      reparto: 'Reporte de Reparto',
      tesoreria: 'Reporte de Tesorería',
      clientes: 'Reporte de Clientes',
      empleados: 'Reporte de Empleados',
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
    } else if (parsed.data.formato === 'excel') {
      // Crear workbook Excel
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet([
        headers,
        ...rows.map((row) => headers.map((header) => row[header] ?? '')),
      ])
      
      // Establecer ancho de columnas
      const colWidths = headers.map((header) => ({ wch: Math.max(header.length, 15) }))
      ws['!cols'] = colWidths
      
      XLSX.utils.book_append_sheet(wb, ws, 'Datos')
      
      // Convertir a buffer
      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
      
      return new NextResponse(excelBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${parsed.data.tipo}-${Date.now()}.xlsx"`,
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
