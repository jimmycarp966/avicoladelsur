import { subDays, format } from 'date-fns'
import { getTodayArgentina } from '@/lib/utils'
import { obtenerKpisAlmacen, obtenerVariacionPeso } from '@/actions/reportes-almacen.actions'
import { ReporteAlmacenContent } from './reporte-almacen-content'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // Revalida cada hora

export default async function ReporteAlmacenPage({
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
  }

  // Obtener datos de reportes
  const [kpisResult, variacionResult] = await Promise.all([
    obtenerKpisAlmacen(filtros),
    obtenerVariacionPeso(filtros),
  ])

  return (
    <ReporteAlmacenContent
      kpis={kpisResult.data}
      variacionPeso={variacionResult.data || []}
      filtrosIniciales={filtros}
    />
  )
}

