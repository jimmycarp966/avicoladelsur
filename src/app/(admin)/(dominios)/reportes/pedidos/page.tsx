import { subDays, format } from 'date-fns'
import { getTodayArgentina } from '@/lib/utils'
import { obtenerKpisPedidos, obtenerFunnelPedidos, obtenerClientesSinComprar } from '@/actions/reportes-pedidos.actions'
import { createClient } from '@/lib/supabase/server'
import { ReportePedidosContent } from './reporte-pedidos-content'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // Revalida cada hora

export default async function ReportePedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  const resolvedSearchParams = await searchParams

  // Obtener datos para filtros
  const [zonasResult, vendedoresResult] = await Promise.all([
    supabase.from('zonas').select('id, nombre').order('nombre'),
    supabase
      .from('usuarios')
      .select('id, nombre, apellido')
      .eq('rol', 'vendedor')
      .eq('activo', true)
      .order('nombre'),
  ])

  const zonas = zonasResult.data || []
  const vendedores = vendedoresResult.data || []

  // Filtros por defecto (últimos 30 días)
  const fechaHasta = (resolvedSearchParams.fechaHasta as string) || getTodayArgentina()
  const fechaDesde =
    (resolvedSearchParams.fechaDesde as string) || format(subDays(new Date(fechaHasta), 29), 'yyyy-MM-dd')

  const filtros = {
    fechaDesde,
    fechaHasta,
    zonaId: (resolvedSearchParams.zonaId as string) || null,
    vendedorId: (resolvedSearchParams.vendedorId as string) || null,
    estado: (resolvedSearchParams.estado as string) || null,
  }

  // Obtener datos de reportes
  const [kpisResult, funnelResult, clientesSinComprarResult] = await Promise.all([
    obtenerKpisPedidos(filtros),
    obtenerFunnelPedidos(filtros),
    obtenerClientesSinComprar(filtros),
  ])

  return (
    <ReportePedidosContent
      kpis={kpisResult.data}
      funnel={funnelResult.data || []}
      clientesSinComprar={clientesSinComprarResult.data || []}
      zonas={zonas}
      vendedores={vendedores}
      filtrosIniciales={filtros}
    />
  )
}

