import { subDays, format } from 'date-fns'
import { getTodayArgentina } from '@/lib/utils'
import { obtenerKpisVentas, obtenerVentasPorPeriodo, obtenerVentasPorZona, obtenerTopProductos, obtenerTopVendedores, obtenerVentasPorMetodoPago, obtenerHeatmapVentas, obtenerClientesNuevosVsRecurrentes, obtenerDetalleVentas } from '@/actions/reportes.actions'
import { createClient } from '@/lib/supabase/server'
import { ReporteVentasContent } from './reporte-ventas-content'

export const revalidate = 300 // Revalida cada 5 minutos (reportes más frescos)

export default async function ReporteVentasPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  const resolvedSearchParams = await searchParams

  // Obtener datos para filtros
  const [zonasResult, vendedoresResult, vehiculosResult] = await Promise.all([
    supabase.from('zonas').select('id, nombre').order('nombre'),
    supabase
      .from('usuarios')
      .select('id, nombre, apellido')
      .eq('rol', 'vendedor')
      .eq('activo', true)
      .order('nombre'),
    supabase.from('vehiculos').select('id, patente, modelo').eq('activo', true).order('patente'),
  ])

  const zonas = zonasResult.data || []
  const vendedores = vendedoresResult.data || []
  const vehiculos = vehiculosResult.data || []

  // Filtros por defecto (últimos 30 días)
  const fechaHasta = (resolvedSearchParams.fechaHasta as string) || getTodayArgentina()
  const fechaDesde =
    (resolvedSearchParams.fechaDesde as string) || format(subDays(new Date(fechaHasta), 29), 'yyyy-MM-dd')

  const filtros = {
    fechaDesde,
    fechaHasta,
    zonaId: (resolvedSearchParams.zonaId as string) || null,
    vendedorId: (resolvedSearchParams.vendedorId as string) || null,
    metodoPago: (resolvedSearchParams.metodoPago as string) || null,
    vehiculoId: (resolvedSearchParams.vehiculoId as string) || null,
    agrupacion: (resolvedSearchParams.agrupacion as 'dia' | 'semana' | 'mes' | 'trimestre') || 'dia',
  }

  // Obtener datos de reportes
  const [
    kpisResult,
    ventasPorPeriodoResult,
    ventasPorZonaResult,
    topProductosResult,
    topVendedoresResult,
    ventasPorMetodoResult,
    heatmapResult,
    clientesResult,
    detalleVentasResult,
  ] = await Promise.all([
    obtenerKpisVentas(filtros),
    obtenerVentasPorPeriodo(filtros),
    obtenerVentasPorZona(filtros),
    obtenerTopProductos(filtros, 10),
    obtenerTopVendedores(filtros, 10),
    obtenerVentasPorMetodoPago(filtros),
    obtenerHeatmapVentas(filtros),
    obtenerClientesNuevosVsRecurrentes(filtros),
    obtenerDetalleVentas(filtros, 1, 100),
  ])

  return (
    <ReporteVentasContent
      kpis={kpisResult.data}
      ventasPorPeriodo={ventasPorPeriodoResult.data || []}
      ventasPorZona={ventasPorZonaResult.data || []}
      topProductos={topProductosResult.data || []}
      topVendedores={topVendedoresResult.data || []}
      ventasPorMetodo={ventasPorMetodoResult.data || []}
      heatmap={heatmapResult.data || []}
      clientes={clientesResult.data}
      detalleVentas={detalleVentasResult.data || []}
      zonas={zonas}
      vendedores={vendedores}
      vehiculos={vehiculos}
      filtrosIniciales={filtros}
    />
  )
}

