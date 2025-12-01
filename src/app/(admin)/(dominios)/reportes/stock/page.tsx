import { subDays, format } from 'date-fns'
import { getTodayArgentina } from '@/lib/utils'
import { obtenerKpisStock, obtenerProyeccionStock, obtenerMermasPorCategoria } from '@/actions/reportes-stock.actions'
import { createClient } from '@/lib/supabase/server'
import { ReporteStockContent } from './reporte-stock-content'

export const revalidate = 3600 // Revalida cada hora

export default async function ReporteStockPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const supabase = await createClient()

  // Obtener categorías de productos
  const { data: productos } = await supabase
    .from('productos')
    .select('categoria')
    .eq('activo', true)

  const categorias = Array.from(
    new Set((productos || []).map((p) => p.categoria).filter(Boolean))
  ) as string[]

  // Filtros por defecto (últimos 30 días)
  const fechaHasta = (searchParams.fechaHasta as string) || getTodayArgentina()
  const fechaDesde =
    (searchParams.fechaDesde as string) || format(subDays(new Date(fechaHasta), 29), 'yyyy-MM-dd')

  const filtros = {
    fechaDesde,
    fechaHasta,
    categoria: (searchParams.categoria as string) || null,
  }

  const diasProyeccion = Number(searchParams.diasProyeccion) || 7

  // Obtener datos de reportes
  const [kpisResult, proyeccionResult, mermasResult] = await Promise.all([
    obtenerKpisStock(filtros),
    obtenerProyeccionStock(diasProyeccion),
    obtenerMermasPorCategoria(filtros),
  ])

  return (
    <ReporteStockContent
      kpis={kpisResult.data}
      proyeccion={proyeccionResult.data || []}
      mermas={mermasResult.data || []}
      categorias={categorias}
      filtrosIniciales={filtros}
      diasProyeccion={diasProyeccion}
    />
  )
}

