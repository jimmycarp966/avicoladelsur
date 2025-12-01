import { subDays, format } from 'date-fns'
import { getTodayArgentina } from '@/lib/utils'
import { obtenerKpisTesoreria, obtenerRecaudacionDiaria } from '@/actions/reportes-tesoreria.actions'
import { ReporteTesoreriaContent } from './reporte-tesoreria-content'

export const revalidate = 3600 // Revalida cada hora

export default async function ReporteTesoreriaPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  // Filtros por defecto (últimos 30 días)
  const fechaHasta = (searchParams.fechaHasta as string) || getTodayArgentina()
  const fechaDesde =
    (searchParams.fechaDesde as string) || format(subDays(new Date(fechaHasta), 29), 'yyyy-MM-dd')

  const filtros = {
    fechaDesde,
    fechaHasta,
    metodoPago: (searchParams.metodoPago as string) || null,
  }

  // Obtener datos de reportes
  const [kpisResult, recaudacionResult] = await Promise.all([
    obtenerKpisTesoreria(filtros),
    obtenerRecaudacionDiaria(filtros),
  ])

  return (
    <ReporteTesoreriaContent
      kpis={kpisResult.data}
      recaudacionDiaria={recaudacionResult.data || []}
      filtrosIniciales={filtros}
    />
  )
}

