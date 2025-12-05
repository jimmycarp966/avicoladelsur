import { subDays, format } from 'date-fns'
import { getTodayArgentina } from '@/lib/utils'
import {
  obtenerRankingClientes,
  obtenerClientesRFM,
  obtenerCohortesClientes,
  obtenerPreferenciasClientes,
} from '@/actions/reportes-clientes.actions'
import { createClient } from '@/lib/supabase/server'
import { ReporteClientesContent } from './reporte-clientes-content'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // Revalida cada hora

export default async function ReporteClientesPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const supabase = await createClient()

  // Obtener zonas
  const { data: zonas } = await supabase.from('zonas').select('id, nombre').order('nombre')

  // Filtros por defecto (últimos 30 días)
  const fechaHasta = (searchParams.fechaHasta as string) || getTodayArgentina()
  const fechaDesde =
    (searchParams.fechaDesde as string) || format(subDays(new Date(fechaHasta), 29), 'yyyy-MM-dd')

  const filtros = {
    fechaDesde,
    fechaHasta,
    zonaId: (searchParams.zonaId as string) || null,
  }

  // Obtener datos de reportes
  const [rankingResult, rfmResult, cohortesResult, preferenciasResult] = await Promise.all([
    obtenerRankingClientes(filtros),
    obtenerClientesRFM(filtros),
    obtenerCohortesClientes(filtros),
    obtenerPreferenciasClientes(filtros),
  ])

  return (
    <ReporteClientesContent
      ranking={rankingResult.data || []}
      rfm={rfmResult.data || []}
      cohortes={cohortesResult.data}
      preferencias={preferenciasResult.data || []}
      zonas={zonas || []}
      filtrosIniciales={filtros}
    />
  )
}

