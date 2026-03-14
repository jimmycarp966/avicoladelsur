'use server'

import { createClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@/types/api.types'
import { reporteFiltrosSchema, type ReporteFiltros } from '@/lib/schemas/reportes.schema'
import { subDays, format } from 'date-fns'
import PDFDocument from 'pdfkit'

// ===========================================
// REPORTES - SERVER ACTIONS
// ===========================================

interface ReporteFiltrosInput {
  fechaDesde: string
  fechaHasta: string
  zonaId?: string | null
  vendedorId?: string | null
  metodoPago?: string | null
  vehiculoId?: string | null
  turno?: string | null
  estado?: string | null
  clienteId?: string | null
  categoria?: string | null
  agrupacion?: 'dia' | 'semana' | 'mes' | 'trimestre'
}

// ========== REPORTE DE VENTAS ==========

/**
 * Obtiene KPIs de ventas
 */
export async function obtenerKpisVentas(
  filtros: ReporteFiltrosInput
): Promise<ApiResponse<any>> {
  try {
    const supabase = await createClient()

    // Validar filtros
    const validated = reporteFiltrosSchema.parse({
      fechaDesde: filtros.fechaDesde,
      fechaHasta: filtros.fechaHasta,
      zonaId: filtros.zonaId,
      vendedorId: filtros.vendedorId,
      metodoPago: filtros.metodoPago,
      vehiculoId: filtros.vehiculoId,
      turno: filtros.turno,
      estado: filtros.estado,
      clienteId: filtros.clienteId,
      categoria: filtros.categoria,
      agrupacion: filtros.agrupacion || 'dia',
    })

    // Llamar a RPC
    const { data, error } = await supabase.rpc('fn_kpis_ventas', {
      fecha_inicio: validated.fechaDesde,
      fecha_fin: validated.fechaHasta,
      zona_id: validated.zonaId,
      vendedor_id: validated.vendedorId,
      metodo_pago: validated.metodoPago,
    })

    if (error) throw error

    // Calcular período anterior para comparación
    const fechaInicio = new Date(validated.fechaDesde)
    const fechaFin = new Date(validated.fechaHasta)
    const diasPeriodo = Math.ceil(
      (fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24)
    )
    const fechaInicioAnterior = subDays(fechaInicio, diasPeriodo + 1)
    const fechaFinAnterior = subDays(fechaInicio, 1)

    const { data: dataAnterior } = await supabase.rpc('fn_kpis_ventas', {
      fecha_inicio: format(fechaInicioAnterior, 'yyyy-MM-dd'),
      fecha_fin: format(fechaFinAnterior, 'yyyy-MM-dd'),
      zona_id: validated.zonaId,
      vendedor_id: validated.vendedorId,
      metodo_pago: validated.metodoPago,
    })

    // Calcular cambios
    const ventasActual = data?.ventas_totales || 0
    const ventasAnterior = dataAnterior?.ventas_totales || 0
    const cambioVentas =
      ventasAnterior > 0
        ? ((ventasActual - ventasAnterior) / ventasAnterior) * 100
        : 0

    return {
      success: true,
      data: {
        ...data,
        cambioVsPeriodoAnterior: cambioVentas,
        periodoAnterior: dataAnterior,
      },
    }
  } catch (error: any) {
    console.error('Error al obtener KPIs de ventas:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener KPIs de ventas',
    }
  }
}

/**
 * Obtiene ventas agrupadas por período
 */
export async function obtenerVentasPorPeriodo(
  filtros: ReporteFiltrosInput
): Promise<ApiResponse<any[]>> {
  try {
    const supabase = await createClient()

    const validated = reporteFiltrosSchema.parse({
      fechaDesde: filtros.fechaDesde,
      fechaHasta: filtros.fechaHasta,
      zonaId: filtros.zonaId,
      vendedorId: filtros.vendedorId,
      metodoPago: filtros.metodoPago,
      agrupacion: filtros.agrupacion || 'dia',
    })

    const { data, error } = await supabase.rpc('fn_ventas_por_periodo', {
      fecha_inicio: validated.fechaDesde,
      fecha_fin: validated.fechaHasta,
      agrupacion: validated.agrupacion,
      zona_id: validated.zonaId,
      vendedor_id: validated.vendedorId,
      metodo_pago: validated.metodoPago,
    })

    if (error) throw error

    return {
      success: true,
      data: data || [],
    }
  } catch (error: any) {
    console.error('Error al obtener ventas por período:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener ventas por período',
    }
  }
}

/**
 * Obtiene ventas agrupadas por zona
 */
export async function obtenerVentasPorZona(
  filtros: ReporteFiltrosInput
): Promise<ApiResponse<any[]>> {
  try {
    const supabase = await createClient()

    const validated = reporteFiltrosSchema.parse({
      fechaDesde: filtros.fechaDesde,
      fechaHasta: filtros.fechaHasta,
      vendedorId: filtros.vendedorId,
    })

    // Usar función RPC en lugar de consulta directa
    const { data, error } = await supabase.rpc('fn_ventas_por_zona', {
      fecha_inicio: validated.fechaDesde,
      fecha_fin: validated.fechaHasta,
      vendedor_id: validated.vendedorId,
    })

    if (error) throw error

    return {
      success: true,
      data: data || [],
    }
  } catch (error: any) {
    console.error('Error al obtener ventas por zona:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener ventas por zona',
    }
  }
}

/**
 * Obtiene top productos más vendidos
 */
export async function obtenerTopProductos(
  filtros: ReporteFiltrosInput,
  limite: number = 10
): Promise<ApiResponse<any[]>> {
  try {
    const supabase = await createClient()

    const validated = reporteFiltrosSchema.parse({
      fechaDesde: filtros.fechaDesde,
      fechaHasta: filtros.fechaHasta,
      zonaId: filtros.zonaId,
      categoria: filtros.categoria,
    })

    const { data, error } = await supabase.rpc('fn_top_productos', {
      fecha_inicio: validated.fechaDesde,
      fecha_fin: validated.fechaHasta,
      limite: limite,
      zona_id: validated.zonaId,
      categoria: validated.categoria,
    })

    if (error) throw error

    return {
      success: true,
      data: data || [],
    }
  } catch (error: any) {
    console.error('Error al obtener top productos:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener top productos',
    }
  }
}

/**
 * Obtiene ranking de vendedores
 */
export async function obtenerTopVendedores(
  filtros: ReporteFiltrosInput,
  limite: number = 10
): Promise<ApiResponse<any[]>> {
  try {
    const supabase = await createClient()

    const validated = reporteFiltrosSchema.parse({
      fechaDesde: filtros.fechaDesde,
      fechaHasta: filtros.fechaHasta,
      zonaId: filtros.zonaId,
    })

    // Usar función RPC en lugar de consulta directa
    const { data, error } = await supabase.rpc('fn_top_vendedores', {
      fecha_inicio: validated.fechaDesde,
      fecha_fin: validated.fechaHasta,
      limite: limite,
      zona_nombre: null, // TODO: obtener zona_nombre desde zona_id si es necesario
    })

    if (error) throw error

    return {
      success: true,
      data: data || [],
    }
  } catch (error: any) {
    console.error('Error al obtener top vendedores:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener top vendedores',
    }
  }
}

/**
 * Obtiene ventas por método de pago
 */
export async function obtenerVentasPorMetodoPago(
  filtros: ReporteFiltrosInput
): Promise<ApiResponse<any[]>> {
  try {
    const supabase = await createClient()

    const validated = reporteFiltrosSchema.parse({
      fechaDesde: filtros.fechaDesde,
      fechaHasta: filtros.fechaHasta,
    })

    // Usar función RPC en lugar de consulta directa
    const { data, error } = await supabase.rpc('fn_ventas_por_metodo_pago', {
      fecha_inicio: validated.fechaDesde,
      fecha_fin: validated.fechaHasta,
    })

    if (error) throw error

    return {
      success: true,
      data: data || [],
    }
  } catch (error: any) {
    console.error('Error al obtener ventas por método de pago:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener ventas por método de pago',
    }
  }
}

/**
 * Obtiene heatmap de ventas (día de semana + hora)
 */
export async function obtenerHeatmapVentas(
  filtros: ReporteFiltrosInput
): Promise<ApiResponse<any[]>> {
  try {
    const supabase = await createClient()

    const validated = reporteFiltrosSchema.parse({
      fechaDesde: filtros.fechaDesde,
      fechaHasta: filtros.fechaHasta,
    })

    const { data, error } = await supabase.rpc('fn_heatmap_ventas', {
      fecha_inicio: validated.fechaDesde,
      fecha_fin: validated.fechaHasta,
    })

    if (error) throw error

    return {
      success: true,
      data: data || [],
    }
  } catch (error: any) {
    console.error('Error al obtener heatmap de ventas:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener heatmap de ventas',
    }
  }
}

/**
 * Obtiene análisis de clientes nuevos vs recurrentes
 */
export async function obtenerClientesNuevosVsRecurrentes(
  filtros: ReporteFiltrosInput
): Promise<ApiResponse<any>> {
  try {
    const supabase = await createClient()

    const validated = reporteFiltrosSchema.parse({
      fechaDesde: filtros.fechaDesde,
      fechaHasta: filtros.fechaHasta,
    })

    // Usar función RPC en lugar de múltiples consultas
    const { data, error } = await supabase.rpc('fn_clientes_nuevos_vs_recurrentes', {
      fecha_inicio: validated.fechaDesde,
      fecha_fin: validated.fechaHasta,
    })

    if (error) throw error

    return {
      success: true,
      data: data || {
        nuevos: 0,
        recurrentes: 0,
        total: 0,
        porcentajeNuevos: 0,
        porcentajeRecurrentes: 0,
      },
    }
  } catch (error: any) {
    console.error('Error al obtener análisis de clientes:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener análisis de clientes',
    }
  }
}

/**
 * Obtiene detalle de ventas para tabla
 */
export async function obtenerDetalleVentas(
  filtros: ReporteFiltrosInput,
  page: number = 1,
  limit: number = 50
): Promise<ApiResponse<any>> {
  try {
    const supabase = await createClient()

    const validated = reporteFiltrosSchema.parse({
      fechaDesde: filtros.fechaDesde,
      fechaHasta: filtros.fechaHasta,
      zonaId: filtros.zonaId,
      vendedorId: filtros.vendedorId,
      metodoPago: filtros.metodoPago,
      vehiculoId: filtros.vehiculoId,
      estado: filtros.estado,
      clienteId: filtros.clienteId,
    })

    let query = supabase
      .from('pedidos')
      .select(
        `
        id,
        numero_pedido,
        fecha_pedido,
        total,
        estado,
        pago_estado,
        clientes(id, nombre, zona_entrega),
        usuarios!pedidos_usuario_vendedor_fkey(id, nombre, apellido),
        detalles_pedido(
          cantidad,
          precio_unitario,
          productos(id, nombre, categoria)
        )
      `,
        { count: 'exact' }
      )
      .gte('fecha_pedido', `${validated.fechaDesde}T00:00:00`)
      .lte('fecha_pedido', `${validated.fechaHasta}T23:59:59`)
      .order('fecha_pedido', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (validated.zonaId) {
      query = query.eq('clientes.zona_entrega', validated.zonaId)
    }

    if (validated.vendedorId) {
      query = query.eq('usuario_vendedor', validated.vendedorId)
    }

    if (validated.estado) {
      query = query.eq('estado', validated.estado)
    }

    if (validated.clienteId) {
      query = query.eq('cliente_id', validated.clienteId)
    }

    const { data, error, count } = await query

    if (error) throw error

    // Transformar datos para la tabla
    const transformedData = (data || []).map((pedido: any) => ({
      id: pedido.id,
      numero_pedido: pedido.numero_pedido,
      fecha_pedido: pedido.fecha_pedido,
      total: pedido.total,
      estado: pedido.estado,
      pago_estado: pedido.pago_estado,
      clientes: pedido.clientes,
      usuarios: pedido.usuarios,
      detalles_pedido: pedido.detalles_pedido,
    }))

    return {
      success: true,
      data: transformedData,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
    }
  } catch (error: any) {
    console.error('Error al obtener detalle de ventas:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener detalle de ventas',
    }
  }
}

// ===========================================
// PDF GENERATION
// ===========================================

export async function generarPDFPedido(pedidoId: string): Promise<ApiResponse<Buffer>> {
  try {
    const supabase = await createClient()

    // Usar la misma RPC del detalle para soportar pedidos agrupados.
    const { data: resultado, error } = await supabase
      .rpc('fn_obtener_pedido_completo', {
        p_pedido_id: pedidoId
      })

    const pedido = resultado?.data?.pedido

    if (error || !resultado?.success || !pedido) {
      return {
        success: false,
        error: error?.message || resultado?.error || 'Pedido no encontrado',
      }
    }

    // Generar PDF
    const doc = new PDFDocument({ margin: 50 })
    const buffers: Buffer[] = []

    return new Promise((resolve) => {
      doc.on('data', buffers.push.bind(buffers))
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers)
        resolve({
          success: true,
          data: pdfBuffer,
        })
      })

      // Título
      doc.fontSize(20).text('PEDIDO', { align: 'center' })
      doc.moveDown()

      // Información del pedido
      doc.fontSize(12)
      doc.text(`Número: ${pedido.numero_pedido}`)
      doc.text(`Fecha: ${format(new Date(pedido.fecha_pedido), 'dd/MM/yyyy')}`)
      doc.text(`Estado: ${pedido.estado}`)
      doc.text(`Pago: ${pedido.pago_estado}`)
      doc.moveDown()

      // Cliente
      doc.fontSize(14).text('Cliente:', { underline: true })
      doc.fontSize(12)
      const clientesData = pedido.clientes as any
      let clienteNombre = Array.isArray(clientesData) ? clientesData[0]?.nombre : clientesData?.nombre
      let clienteTelefono = Array.isArray(clientesData) ? clientesData[0]?.telefono : clientesData?.telefono
      let clienteZona = Array.isArray(clientesData) ? clientesData[0]?.zona_entrega : clientesData?.zona_entrega
      if (!pedido.cliente_id) {
        clienteNombre = 'Pedido agrupado'
        clienteTelefono = 'Multiples entregas'
        clienteZona = pedido.zonas?.nombre || clienteZona
      }
      doc.text(`Nombre: ${clienteNombre || 'N/A'}`)
      doc.text(`Teléfono: ${clienteTelefono || 'N/A'}`)
      doc.text(`Zona: ${clienteZona || 'N/A'}`)
      doc.moveDown()

      // Vendedor
      doc.fontSize(14).text('Vendedor:', { underline: true })
      doc.fontSize(12)
      const usuariosData = pedido.usuarios as any
      const usuarioNombre = Array.isArray(usuariosData) ? usuariosData[0]?.nombre : usuariosData?.nombre
      const usuarioApellido = Array.isArray(usuariosData) ? usuariosData[0]?.apellido : usuariosData?.apellido
      doc.text(`${usuarioNombre || ''} ${usuarioApellido || ''}`)
      doc.moveDown()

      // Productos
      doc.fontSize(14).text('Productos:', { underline: true })
      doc.moveDown(0.5)

      // Tabla de productos
      const tableTop = doc.y
      const itemX = 50
      const qtyX = 300
      const priceX = 400
      const totalX = 500

      // Headers
      doc.fontSize(10)
      doc.text('Producto', itemX, tableTop)
      doc.text('Cant.', qtyX, tableTop)
      doc.text('Precio', priceX, tableTop)
      doc.text('Total', totalX, tableTop)

      // Línea separadora
      doc.moveTo(50, doc.y + 15).lineTo(550, doc.y + 15).stroke()

      // Items
      let yPosition = doc.y + 25
      pedido.detalles_pedido?.forEach((detalle: any) => {
        doc.fontSize(9)
        doc.text(detalle.productos?.nombre || 'Producto', itemX, yPosition)
        doc.text(detalle.cantidad.toString(), qtyX, yPosition)
        doc.text(`$${detalle.precio_unitario.toFixed(2)}`, priceX, yPosition)
        doc.text(`$${detalle.subtotal.toFixed(2)}`, totalX, yPosition)
        yPosition += 20
      })

      // Total
      doc.moveDown(2)
      doc.fontSize(14).text(`Total: $${pedido.total.toFixed(2)}`, { align: 'right' })

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
