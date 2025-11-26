import { z } from 'zod'

/**
 * Schema para filtros de reportes
 */
export const reporteFiltrosSchema = z.object({
  fechaDesde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  fechaHasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  zonaId: z.string().uuid().optional().nullable(),
  vendedorId: z.string().uuid().optional().nullable(),
  metodoPago: z.string().optional().nullable(),
  vehiculoId: z.string().uuid().optional().nullable(),
  turno: z.enum(['mañana', 'tarde']).optional().nullable(),
  estado: z.string().optional().nullable(),
  clienteId: z.string().uuid().optional().nullable(),
  categoria: z.string().optional().nullable(),
  agrupacion: z.enum(['dia', 'semana', 'mes', 'trimestre']).optional().default('dia'),
})

export type ReporteFiltros = z.infer<typeof reporteFiltrosSchema>

/**
 * Schema para exportación de reportes
 */
export const exportReporteSchema = z.object({
  tipo: z.enum([
    'ventas',
    'pedidos',
    'stock',
    'almacen',
    'reparto',
    'tesoreria',
    'clientes',
    'empleados',
    'gastos',
    'movimientos_caja',
    'cuentas_corrientes',
    'kg_por_ruta',
  ]),
  formato: z.enum(['csv', 'excel', 'pdf']),
  filtros: reporteFiltrosSchema.optional(),
})

export type ExportReporte = z.infer<typeof exportReporteSchema>

/**
 * Schema para KPIs de ventas
 */
export const kpisVentasSchema = z.object({
  ventasTotales: z.number(),
  ticketPromedio: z.number(),
  ticketPromedioPorZona: z.record(z.number()),
  ticketPromedioPorCliente: z.number(),
  recaudacionPorMetodo: z.record(z.number()),
  margenPorCategoria: z.record(z.number()),
  clientesNuevos: z.number(),
  clientesRecurrentes: z.number(),
  cambioVsPeriodoAnterior: z.number().optional(),
})

export type KpisVentas = z.infer<typeof kpisVentasSchema>

/**
 * Schema para datos de ventas por período
 */
export const ventasPorPeriodoSchema = z.array(
  z.object({
    periodo: z.string(),
    ventas: z.number(),
    transacciones: z.number(),
    ticketPromedio: z.number(),
  })
)

export type VentasPorPeriodo = z.infer<typeof ventasPorPeriodoSchema>

